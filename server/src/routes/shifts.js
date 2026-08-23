const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken, authorize, adminOnly } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const { classifySiteLocation } = require('../utils/siteLocation');
const { getWageRates, getShiftRateForRole } = require('../config/wages');

const router = express.Router();

const SHIFT_GRACE_MS = 60 * 60 * 1000;
// HIGHEST PRIORITY: Fixed daily wage baselines per shift.
// Guard = KES 254, Supervisor = KES 400 per shift (editable via portal).
const resolveShiftRates = async (db, role) => {
  const rates = await getWageRates(db);
  return { dailyRate: getShiftRateForRole(role, rates) };
};

const formatDateOnly = (date) => date.toISOString().split('T')[0];

const atLocalTime = (date, hour) => {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
};

const getShiftWindow = (actualTime, shiftType) => {
  const actual = new Date(actualTime);

  if (shiftType === 'night') {
    const start = atLocalTime(actual, 18);
    if (actual.getHours() < 6) {
      start.setDate(start.getDate() - 1);
    }
    const end = atLocalTime(start, 6);
    end.setDate(end.getDate() + 1);
    return { start, end, graceEnd: new Date(start.getTime() + SHIFT_GRACE_MS) };
  }

  if (shiftType === 'day') {
    const start = atLocalTime(actual, 6);
    const end = atLocalTime(actual, 18);
    return { start, end, graceEnd: new Date(start.getTime() + SHIFT_GRACE_MS) };
  }

  return { start: actual, end: null, graceEnd: new Date(actual.getTime() + SHIFT_GRACE_MS) };
};

const getScheduledEndTime = (shift) => {
  if (!shift?.start_time || shift.shift_type === 'overtime') return new Date();
  const start = new Date(shift.start_time);
  if (shift.shift_type === 'night') {
    const end = atLocalTime(start, 6);
    end.setDate(end.getDate() + 1);
    return end;
  }
  return atLocalTime(start, 18);
};

const appendNote = (currentNotes, note) => [currentNotes, note].filter(Boolean).join('\n');

const getLateCoveringGuard = async (db, guardId, siteId, shiftId) => {
  const result = await db.query(
    `SELECT sh.guard_id, u.full_name, u.work_number
     FROM shifts sh
     JOIN users u ON u.id = sh.guard_id
     WHERE sh.site_id = $1
       AND sh.guard_id <> $2
       AND sh.id <> $3
       AND sh.end_time IS NULL
       AND sh.start_time IS NOT NULL
     ORDER BY sh.start_time ASC
     LIMIT 1`,
    [siteId, guardId, shiftId]
  );
  return result.rows[0] || null;
};

const notifyLateClockIn = async (db, { shift, guard, site, actualTime, graceEnd, amount, coveringGuard }) => {
  const recipientsResult = await db.query(
    `SELECT DISTINCT id, email, full_name, role
     FROM users
     WHERE account_status = 'active'
       AND (
         id = $1
         OR id = $2
         OR role IN ('admin', 'manager')
       )`,
    [site.supervisor_id || null, guard.id]
  );

  const actualLabel = actualTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const graceLabel = graceEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const title = 'Late Clock-in Warning';
  const message = `${guard.full_name} (${guard.work_number || 'N/A'}) clocked in at ${actualLabel}, after the ${graceLabel} grace cutoff for ${site.client_name}. One hour (KES ${amount.toFixed(2)}) has been recorded as a late penalty${coveringGuard ? ` and bonus for ${coveringGuard.full_name}.` : '.'}`;

  for (const recipient of recipientsResult.rows) {
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        recipient.id,
        'late_clock_in',
        title,
        message,
        'high',
        JSON.stringify({
          shift_id: shift.id,
          guard_id: guard.id,
        }),
        'supervisor'
      ]
    );
  }
};

const recordLateFine = async (db, { shift, guard, site, actualTime, graceEnd, supervisorOverride }) => {
  const isLate = actualTime > graceEnd;
  let amount = 0;
  let coveringGuard = null;

  if (isLate) {
    const covering = await getLateCoveringGuard(db, guard.id, shift.site_id, shift.id);
    if (covering) {
      coveringGuard = covering;
      amount = 600.00;
    } else {
      amount = 300.00;
    }
  }

  if (isLate && coveringGuard) {
    await notifyLateClockIn(db, { shift, guard, site, actualTime, graceEnd, amount, coveringGuard });
  }

  return {
    isLate,
    amount,
    coveringGuard
  };
};

// List shifts for management views and the supervisor roster.
router.get('/', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor', 'secretary', 'guard'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { date_from: dateFrom, date_to: dateTo, status, guard_id: guardId, site_id: siteId } = req.query;
    const params = [];
    const conditions = [];

    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`sh.date >= $${params.length}::date`);
    }

    if (dateTo) {
      params.push(dateTo);
      conditions.push(`sh.date <= $${params.length}::date`);
    }

    if (status) {
      params.push(status);
      conditions.push(`sh.status = $${params.length}`);
    }

    if (siteId) {
      params.push(siteId);
      conditions.push(`sh.site_id = $${params.length}`);
    }

    if (req.user.role === 'guard') {
      params.push(req.user.id);
      conditions.push(`sh.guard_id = $${params.length}`);
    } else if (guardId) {
      params.push(guardId);
      conditions.push(`sh.guard_id = $${params.length}`);
    }

    const result = await db.query(`
      SELECT sh.*, u.full_name as guard_name, u.work_number, u.role,
        s.site_name, s.client_name, s.location
      FROM shifts sh
      JOIN users u ON u.id = sh.guard_id
      JOIN sites s ON s.id = sh.site_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY sh.date DESC, sh.start_time DESC NULLS LAST, sh.created_at DESC
    `, params);

    res.json({ shifts: result.rows });
  } catch (error) {
    console.error('Get shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// Return the guard's currently clocked-in shift.
router.get('/current', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(`
      SELECT sh.*, s.site_name, s.location, s.address, s.client_name, s.contact_number,
        s.required_guards, s.day_rate, s.night_rate, s.geofence_radius,
        s.latitude as site_latitude, s.longitude as site_longitude
      FROM shifts sh
      JOIN sites s ON s.id = sh.site_id
      WHERE sh.guard_id = $1 AND sh.check_in_time IS NOT NULL AND sh.end_time IS NULL
      ORDER BY sh.check_in_time DESC
      LIMIT 1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({ has_active_shift: false, shift: null });
    }

    const shift = result.rows[0];
    const graceEnd = shift.start_time
      ? new Date(new Date(shift.start_time).getTime() + SHIFT_GRACE_MS)
      : null;
    const actualCheckIn = shift.check_in_time ? new Date(shift.check_in_time) : null;

    res.json({
      has_active_shift: true,
      shift,
      site: {
        id: shift.site_id,
        site_name: shift.site_name,
        location: shift.location,
        address: shift.address,
        client_name: shift.client_name,
        contact_number: shift.contact_number,
        required_guards: shift.required_guards,
        day_rate: shift.day_rate,
        night_rate: shift.night_rate,
        geofence_radius: shift.geofence_radius
      },
      is_late: Boolean(graceEnd && actualCheckIn > graceEnd),
      late_check_in_time: actualCheckIn,
      grace_end_time: graceEnd,
      check_in_geofence_verified: shift.check_in_geofence_verified,
      check_in_distance_meters: null,
      geofence_radius: shift.geofence_radius
    });
  } catch (error) {
    console.error('Get current shift error:', error);
    res.status(500).json({ error: 'Failed to load shift data' });
  }
});

router.get('/my-assigned-site', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    let site = null;
    const directResult = await db.query(
      `SELECT s.* FROM sites s
       LEFT JOIN users u ON u.site_id = s.id AND u.id = $1
       WHERE s.status = 'active' AND (u.id = $1 OR s.supervisor_id = $1)
       ORDER BY CASE WHEN u.id IS NOT NULL THEN 0 ELSE 1 END, s.site_name
       LIMIT 1`,
      [req.user.id]
    );
    site = directResult.rows[0] || null;

    if (!site && req.user.role === 'supervisor') {
      const [allocationResult, sitesResult] = await Promise.all([
        db.query('SELECT area FROM supervisor_allocations WHERE supervisor_id = $1 LIMIT 1', [req.user.id]),
        db.query("SELECT * FROM sites WHERE status = 'active' ORDER BY site_name")
      ]);
      const allocatedArea = allocationResult.rows[0]?.area;
      site = sitesResult.rows.find(candidate => classifySiteLocation(candidate) === allocatedArea) || null;
    }

    if (!site) {
      return res.status(404).json({ error: 'No active site assignment found' });
    }

    res.json({ site: { ...site, location_category: classifySiteLocation(site) } });
  } catch (error) {
    console.error('Get assigned site error:', error);
    res.status(500).json({ error: 'Failed to load assigned site' });
  }
});

router.get('/next-milestone', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  const now = new Date();
  const milestone = new Date(now);
  const hour = now.getHours();
  const isMorning = hour < 6 || hour >= 18;
  milestone.setHours(isMorning ? 6 : 18, 0, 0, 0);
  if (milestone <= now) milestone.setDate(milestone.getDate() + 1);

  const label = milestone.getHours() === 6 ? '6:00 AM' : '6:00 PM';
  res.json({ milestone_time: milestone.toISOString(), milestone_type: label, display: label });
});

// Return the guard's shifts and supervisor allocations for the selected week.
router.get('/my-schedule', authenticateToken, authorize('guard'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const weekOffset = Number.parseInt(req.query.week_offset || '0', 10) || 0;

    const result = await db.query(`
      WITH week AS (
        SELECT
          (CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::integer - 1) + ($2::integer * 7))::date AS week_start,
          (CURRENT_DATE - (EXTRACT(ISODOW FROM CURRENT_DATE)::integer - 1) + ($2::integer * 7) + 6)::date AS week_end
      ),
      scheduled_shifts AS (
        SELECT
          sh.id::text AS id, sh.guard_id, sh.site_id, sh.date, sh.shift_type, sh.status,
          sh.start_time, sh.end_time, sh.check_in_time, sh.check_out_time,
          CASE WHEN sh.start_time IS NULL THEN sh.date::timestamp + CASE WHEN sh.shift_type = 'night' THEN INTERVAL '18 hours' ELSE INTERVAL '6 hours' END ELSE NULL END AS scheduled_start_time,
          CASE WHEN sh.end_time IS NULL THEN sh.date::timestamp + CASE WHEN sh.shift_type = 'night' THEN INTERVAL '30 hours' ELSE INTERVAL '18 hours' END ELSE NULL END AS scheduled_end_time,
          sh.notes, sh.is_overtime,
          s.client_name AS site_client, s.site_name, s.location AS site_location,
          CASE WHEN a.id IS NOT NULL AND COALESCE(sh.is_overtime, FALSE) = FALSE THEN 'temporary' ELSE NULL END AS allocation_type
        FROM shifts sh
        JOIN sites s ON s.id = sh.site_id
        LEFT JOIN allocations a ON a.guard_id = sh.guard_id
          AND a.site_id = sh.site_id AND a.date = sh.date
          AND (a.shift_type = sh.shift_type OR (a.shift_type = 'overtime' AND sh.is_overtime = TRUE))
          AND a.status = 'active'
        CROSS JOIN week
        WHERE sh.guard_id = $1
          AND sh.date BETWEEN week.week_start AND week.week_end
          AND sh.status NOT IN ('cancelled', 'missed')
      ),
      allocated_shifts AS (
        SELECT
          'allocation-' || a.id::text AS id, a.guard_id, a.site_id, a.date,
          CASE WHEN a.shift_type = 'overtime' THEN 'night' ELSE a.shift_type END AS shift_type,
          'scheduled' AS status,
          a.date::timestamp + CASE WHEN a.shift_type = 'night' THEN INTERVAL '18 hours' ELSE INTERVAL '6 hours' END AS start_time,
          a.date::timestamp + CASE WHEN a.shift_type = 'night' THEN INTERVAL '30 hours' ELSE INTERVAL '18 hours' END AS end_time,
          NULL::timestamp AS check_in_time, NULL::timestamp AS check_out_time,
          NULL::timestamp AS scheduled_start_time, NULL::timestamp AS scheduled_end_time,
          a.notes, (a.shift_type = 'overtime') AS is_overtime,
          s.client_name AS site_client, s.site_name, s.location AS site_location,
          CASE WHEN a.shift_type = 'overtime' THEN NULL ELSE 'temporary' END AS allocation_type
        FROM allocations a
        JOIN sites s ON s.id = a.site_id
        CROSS JOIN week
        WHERE a.guard_id = $1
          AND a.date BETWEEN week.week_start AND week.week_end
          AND a.status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM shifts sh
            WHERE sh.guard_id = a.guard_id AND sh.site_id = a.site_id
              AND sh.date = a.date
              AND (sh.shift_type = a.shift_type OR (a.shift_type = 'overtime' AND sh.is_overtime = TRUE))
              AND sh.status NOT IN ('cancelled', 'missed')
          )
      )
      SELECT * FROM scheduled_shifts
      UNION ALL
      SELECT * FROM allocated_shifts
      ORDER BY date ASC, start_time ASC NULLS LAST
    `, [req.user.id, weekOffset]);

    const activeResult = await db.query(`
      SELECT sh.*, s.client_name AS site_client, s.location AS site_location
      FROM shifts sh
      JOIN sites s ON s.id = sh.site_id
      WHERE sh.guard_id = $1 AND sh.check_in_time IS NOT NULL AND sh.end_time IS NULL
      ORDER BY sh.check_in_time DESC
      LIMIT 1
    `, [req.user.id]);

    const shifts = result.rows;
    const activeShift = activeResult.rows[0] || null;
    const nextShift = shifts.find(shift => {
      const scheduledStart = shift.scheduled_start_time || shift.start_time;
      return !shift.check_in_time && scheduledStart && new Date(scheduledStart) >= new Date();
    }) || null;

    res.json({
      shifts,
      current_status: { is_clocked_in: Boolean(activeShift), active_shift: activeShift },
      next_shift: nextShift
    });
  } catch (error) {
    console.error('Get guard schedule error:', error);
    res.status(500).json({ error: 'Failed to load guard schedule' });
  }
});

router.get('/next-guard', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { site_id: siteId, date } = req.query;
    const result = await db.query(
      `SELECT u.id, u.full_name, u.work_number, sh.date, sh.shift_type, sh.start_time
       FROM shifts sh
       JOIN users u ON u.id = sh.guard_id
       WHERE sh.site_id = $1
         AND sh.guard_id <> $2
         AND sh.date >= COALESCE($3::date, CURRENT_DATE)
         AND sh.check_in_time IS NULL
         AND sh.end_time IS NULL
         AND sh.status NOT IN ('cancelled', 'missed')
       ORDER BY sh.date ASC, sh.start_time ASC NULLS LAST
       LIMIT 1`,
      [siteId, req.user.id, date || null]
    );

    res.json({ next_guard: result.rows[0] || null });
  } catch (error) {
    console.error('Get next guard error:', error);
    res.status(500).json({ error: 'Failed to load next guard' });
  }
});

router.post('/handover', authenticateToken, authorize('guard'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { shift_id: shiftId, notes, next_guard_id: nextGuardId } = req.body;

    if (!shiftId || !notes?.trim()) {
      return res.status(400).json({ error: 'shift_id and handover notes are required' });
    }

    const shiftResult = await db.query(
      `SELECT id, guard_id, site_id FROM shifts WHERE id = $1 AND guard_id = $2`,
      [shiftId, req.user.id]
    );
    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const result = await db.query(
      `INSERT INTO shift_handovers (shift_id, guard_id, site_id, notes, next_guard_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [shiftId, req.user.id, shiftResult.rows[0].site_id, notes.trim(), nextGuardId || null]
    );

    if (nextGuardId) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
         VALUES ($1, 'briefing', 'New Shift Handover', $2, 'high', $3, 'guard')`,
        [
          nextGuardId,
          `${req.user.full_name} left handover notes for your next shift.`,
          JSON.stringify({ handover_id: result.rows[0].id, shift_id: shiftId, site_id: shiftResult.rows[0].site_id })
        ]
      );
    }

    res.status(201).json({ handover: result.rows[0] });
  } catch (error) {
    console.error('Create handover error:', error);
    res.status(500).json({ error: 'Failed to save handover notes' });
  }
});

router.get('/handovers', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      `SELECT h.*, from_guard.full_name as from_guard_name, from_guard.work_number as from_guard_work_number,
          to_guard.full_name as to_guard_name, to_guard.work_number as to_guard_work_number,
          s.client_name as site_name, s.location
       FROM shift_handovers h
       JOIN users from_guard ON from_guard.id = h.guard_id
       LEFT JOIN users to_guard ON to_guard.id = h.next_guard_id
       JOIN sites s ON s.id = h.site_id
       WHERE h.guard_id = $1 OR h.next_guard_id = $1
       ORDER BY h.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ handovers: result.rows });
  } catch (error) {
    console.error('Get handovers error:', error);
    res.status(500).json({ error: 'Failed to load handover notes' });
  }
});

router.patch('/handovers/:id/read', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      `UPDATE shift_handovers
       SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND next_guard_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Handover not found' });
    res.json({ handover: result.rows[0] });
  } catch (error) {
    console.error('Mark handover read error:', error);
    res.status(500).json({ error: 'Failed to mark handover as read' });
  }
});

router.post('/clock-in', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const guard = req.user;
    const { site_id, shift_type, start_time: requestedStartTime } = req.body;
    const currentTime = new Date();

    if (!site_id || !shift_type) {
      return res.status(400).json({ error: 'site_id and shift_type are required' });
    }

    // Check for active shift
    const existingShiftResult = await db.query(
      `SELECT * FROM shifts WHERE guard_id = $1 AND check_in_time IS NOT NULL AND end_time IS NULL`,
      [guard.id]
    );

    if (existingShiftResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'You already have an active shift. Please clock out before clocking in again.',
        active_shift_id: existingShiftResult.rows[0].id
      });
    }

    const siteResult = await db.query(
      `SELECT * FROM sites WHERE id = $1`,
      [site_id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];
    const shiftWindow = getShiftWindow(currentTime, shift_type);
    const requestedStart = requestedStartTime ? new Date(requestedStartTime) : null;
    const scheduledStart = requestedStart && !Number.isNaN(requestedStart.getTime())
      ? requestedStart
      : shiftWindow.start;
    const graceEnd = new Date(scheduledStart.getTime() + SHIFT_GRACE_MS);
    const actualCheckIn = new Date(currentTime);

    let latitude = null, longitude = null, accuracy = null;
    if (req.body.latitude !== undefined) {
      latitude = req.body.latitude;
      longitude = req.body.longitude;
      accuracy = req.body.accuracy;
    }

    // Geofence validation
    let geofenceVerified = false;
    let geofenceDistance = null;

    if (latitude !== null && longitude !== null && site.latitude !== null && site.longitude !== null) {
      const R = 6371000; // Earth radius in meters
      const toRad = (deg) => deg * Math.PI / 180;
      const lat1 = toRad(site.latitude);
      const lat2 = toRad(latitude);
      const deltaLat = toRad(latitude - site.latitude);
      const deltaLng = toRad(longitude - site.longitude);
      const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      geofenceDistance = R * c;

      const maxRadius = site.geofence_radius || 50;
      geofenceVerified = geofenceDistance <= maxRadius;
    }

    if (site.latitude === null || site.longitude === null) {
      return res.status(400).json({ error: 'This site has no exact geolocation configured. Ask a manager to update the site location.' });
    }
    if (latitude === null || longitude === null) {
      return res.status(400).json({ error: 'GPS location is required to clock in at this site.' });
    }
    if (!geofenceVerified) {
      return res.status(400).json({
        error: `You are outside the 100 m clock-in boundary (${Math.round(geofenceDistance)} m away).`,
        geofence: {
          verified: false,
          distance_meters: Math.round(geofenceDistance),
          radius_meters: 100
        }
      });
    }

    // Apply the fixed shift wage baselines based on the user's role.
    const { dailyRate: shiftDailyRate } = await resolveShiftRates(db, guard.role);

    const scheduledShiftResult = await db.query(
      `SELECT id FROM shifts
       WHERE guard_id = $1 AND site_id = $2 AND date = CURRENT_DATE
         AND check_in_time IS NULL AND end_time IS NULL
         AND status NOT IN ('cancelled', 'missed')
       ORDER BY created_at DESC LIMIT 1`,
      [guard.id, site_id]
    );

    const shiftResult = scheduledShiftResult.rows.length > 0
      ? await db.query(
        `UPDATE shifts SET shift_type = $1, status = 'scheduled', start_time = $2, check_in_time = $3, clock_in_method = 'normal',
           hourly_rate = NULL, daily_rate = $4, notes = $5, check_in_latitude = $6, check_in_longitude = $7,
           check_in_accuracy = $8, check_in_geofence_verified = $9, tied_to_inspection = $10,
           inspection_checklist_id = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING id, guard_id, site_id, date, shift_type, status, start_time, check_in_time, end_time, check_out_time, hourly_rate, daily_rate, notes, created_at`,
        [shift_type, scheduledStart, actualCheckIn, shiftDailyRate, 'Clocked in for ' + shift_type + ' shift at ' + site.client_name, latitude || null, longitude || null, accuracy || null, geofenceVerified, false, null, scheduledShiftResult.rows[0].id]
      )
      : await db.query(
        `INSERT INTO shifts (guard_id, site_id, date, shift_type, status, start_time, check_in_time, end_time, check_out_time, daily_rate, notes, clock_in_method,
           check_in_latitude, check_in_longitude, check_in_accuracy, check_in_geofence_verified, tied_to_inspection, inspection_checklist_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, $9, 'normal', $10, $11, $12, $13, $14, $15)
         RETURNING id, guard_id, site_id, date, shift_type, status, start_time, check_in_time, end_time, check_out_time, hourly_rate, daily_rate, notes, created_at`,
        [guard.id, site_id, currentTime.toISOString().split('T')[0], shift_type, 'scheduled', scheduledStart, actualCheckIn, shiftDailyRate, 'Clocked in for ' + shift_type + ' shift at ' + site.client_name, latitude || null, longitude || null, accuracy || null, geofenceVerified, false, null]
      );

    const shift = shiftResult.rows[0];
    const lateFine = await recordLateFine(db, { shift, guard, site, actualTime: actualCheckIn, graceEnd, supervisorOverride: false });

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [guard.id, guard.full_name, guard.email, 'Shift Clocked In', 'attendance', `Clocked in for ${shift_type} shift at ${site.client_name}`]
    );

    // Create notification for supervisor with guard details
    const supervisorResult = await db.query(
      'SELECT id FROM users WHERE role = $1 AND account_status = $2',
      ['supervisor', 'active']
    );

    for (const supervisorId of supervisorResult.rows.map(r => r.id)) {
      await db.query(
        'INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          supervisorId,
          'shift',
          'Guard Clocked In',
          `${guard.full_name} (${guard.work_number || 'N/A'}) has clocked in for a ${shift_type} shift at ${site.client_name}`,
          'medium',
          JSON.stringify({ 
            entity_type: 'shift',
            entity_id: shift.id,
            action_type: 'view',
            link_url: '/supervisor/shifts',
            shift_id: shift.id, 
            guard_id: guard.id, 
            guard_name: guard.full_name,
            guard_work_number: guard.work_number,
            site_id, 
            site_name: site.client_name,
            shift_type,
            actual_check_in_time: actualCheckIn,
            geofence: {
              verified: geofenceVerified,
              distance_meters: geofenceDistance !== null ? Math.round(geofenceDistance) : null,
              radius_meters: site.geofence_radius || 50,
              message: geofenceDistance !== null ? (geofenceVerified ? 'Successfully clocked in: ' + Math.round(geofenceDistance) + 'm from site center' : 'Clock-in failed: You are ' + Math.round(geofenceDistance) + 'm away, maximum allowed is ' + (site.geofence_radius || 50) + 'm') : null
            }
          }),
          'supervisor'
        ]
      );
    }

    res.status(201).json({
      shift_id: shift.id,
      message: lateFine.isLate ? 'Clocked in late. A one-hour late penalty has been recorded.' : 'Successfully clocked in',
      shift: shift,
      site: {
        id: site.id,
        site_name: site.client_name,
        location: site.location,
        address: site.address,
        client_name: site.client_name,
        contact_number: site.contact_number,
        required_guards: site.required_guards,
        day_rate: site.day_rate,
        night_rate: site.night_rate
      },
      actual_check_in_time: actualCheckIn,
      scheduled_start_time: scheduledStart,
      grace_end_time: graceEnd,
      late: lateFine.isLate,
      late_penalty_amount: lateFine.amount,
      covering_guard: lateFine.coveringGuard,
      geofence: {
        verified: geofenceVerified,
        distance_meters: geofenceDistance !== null ? Math.round(geofenceDistance) : null,
        radius_meters: site.geofence_radius || 50,
        message: geofenceDistance !== null ? (geofenceVerified ? 'Successfully clocked in: ' + Math.round(geofenceDistance) + 'm from site center' : 'Clock-in failed: You are ' + Math.round(geofenceDistance) + 'm away, maximum allowed is ' + (site.geofence_radius || 50) + 'm') : null
      }
    });
  } catch (error) {
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  }
});

// Clock Out - Guard ends their current shift
router.post('/clock-out', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const guard = req.user;
    const currentTime = new Date();
    const { handover_notes: handoverNotes, next_guard_id: nextGuardId } = req.body;

    const shiftResult = await db.query(
      `SELECT * FROM shifts WHERE guard_id = $1 AND end_time IS NULL`,
      [guard.id]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active shift to clock out from' });
    }

    const shift = shiftResult.rows[0];
    const siteResult = await db.query(
      `SELECT * FROM sites WHERE id = $1`,
      [shift.site_id]
    );

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];
    const checkOutTime = currentTime;

    if (handoverNotes?.trim()) {
      await db.query(
        `INSERT INTO shift_handovers (shift_id, guard_id, site_id, notes, next_guard_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [shift.id, guard.id, shift.site_id, handoverNotes.trim(), nextGuardId || null]
      );
    }

    await db.query(
      `UPDATE shifts SET check_out_time = $1, end_time = $2, status = 'completed', clock_out_method = 'normal', updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [checkOutTime, checkOutTime, shift.id]
    );

    const hoursWorked = Math.max(0, (checkOutTime - new Date(shift.check_in_time || shift.start_time)) / 3600000);

    const managerResult = await db.query(
      `SELECT id FROM users WHERE role = 'manager' AND account_status = 'active'`
    );
    for (const manager of managerResult.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
         VALUES ($1, 'attendance', $2, $3, 'medium', $4, 'manager')`,
        [
          manager.id,
          'Guard Clocked Out',
          `${guard.full_name} clocked out from ${site.client_name}.`,
          JSON.stringify({ shift_id: shift.id, guard_id: guard.id, site_id: site.id, hours_worked: hoursWorked, clock_out_type: 'normal' })
        ]
      );
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [guard.id, guard.full_name, guard.email, 'Shift Clocked Out', 'attendance', `Clocked out from ${shift.shift_type} shift at ${site.client_name}`]
    );

    res.json({
      shift_id: shift.id,
      message: 'Successfully clocked out',
      shift: { ...shift, check_out_time: checkOutTime, end_time: checkOutTime, status: 'completed' },
      actual_check_out_time: checkOutTime,
      hours_worked: hoursWorked,
      next_guard_id: nextGuardId || null
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Failed to clock out' });
  }
});

router.post('/supervisor-clock-in', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id: guardId, site_id: siteId, shift_type: shiftType = 'day' } = req.body;
    if (!guardId || !siteId) return res.status(400).json({ error: 'guard_id and site_id are required' });

    const guardResult = await db.query(
      `SELECT id, full_name, work_number FROM users WHERE id = $1 AND role = 'guard' AND account_status = 'active'`,
      [guardId]
    );
    const siteResult = await db.query(`SELECT * FROM sites WHERE id = $1 AND status = 'active'`, [siteId]);
    if (guardResult.rows.length === 0 || siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active guard or site not found' });
    }

    const active = await db.query(
      `SELECT id FROM shifts WHERE guard_id = $1 AND check_in_time IS NOT NULL AND end_time IS NULL`,
      [guardId]
    );
    if (active.rows.length > 0) return res.status(400).json({ error: 'Guard already has an active shift' });

    const now = new Date();
    const scheduledStart = getShiftWindow(now, shiftType).start;
    // Apply the fixed shift wage baselines based on the guard's role.
    const { dailyRate: guardDailyRate } = await resolveShiftRates(db, 'guard');
    const scheduled = await db.query(
      `SELECT id FROM shifts WHERE guard_id = $1 AND site_id = $2 AND date = CURRENT_DATE
       AND check_in_time IS NULL AND end_time IS NULL AND status NOT IN ('cancelled', 'missed')
       ORDER BY created_at DESC LIMIT 1`,
      [guardId, siteId]
    );
    const shift = scheduled.rows.length > 0
      ? await db.query(
        `UPDATE shifts SET shift_type = $1, start_time = $2, check_in_time = $3, hourly_rate = NULL, daily_rate = $4, clock_in_method = 'supervisor',
          supervisor_clock_in = TRUE, supervisor_clock_in_by = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6 RETURNING *`,
        [shiftType, scheduledStart, now, guardDailyRate, req.user.id, scheduled.rows[0].id]
      )
      : await db.query(
        `INSERT INTO shifts (guard_id, site_id, date, shift_type, status, start_time, check_in_time,
            hourly_rate, daily_rate, notes, clock_in_method, supervisor_clock_in, supervisor_clock_in_by)
         VALUES ($1, $2, CURRENT_DATE, $3, 'scheduled', $4, $5, NULL, $6, $7, 'supervisor', TRUE, $8)
         RETURNING *`,
        [guardId, siteId, shiftType, scheduledStart, now, guardDailyRate,
          `Clocked in by supervisor ${req.user.full_name}`, req.user.id]
      );

    const createdShift = shift.rows[0];
    const managers = await db.query(`SELECT id FROM users WHERE role = 'manager' AND account_status = 'active'`);
    for (const manager of managers.rows) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
         VALUES ($1, 'attendance', 'Guard Clocked In by Supervisor', $2, 'medium', $3, 'manager')`,
        [manager.id, `${guardResult.rows[0].full_name} was clocked in by supervisor at ${siteResult.rows[0].client_name}.`,
          JSON.stringify({ shift_id: createdShift.id, guard_id: guardId, site_id: siteId, clock_in_type: 'supervisor' })]
      );
    }

    res.status(201).json({ shift: createdShift, clock_in_type: 'supervisor' });
  } catch (error) {
    console.error('Supervisor clock-in error:', error);
    res.status(500).json({ error: 'Failed to clock in guard' });
  }
});

module.exports = router;