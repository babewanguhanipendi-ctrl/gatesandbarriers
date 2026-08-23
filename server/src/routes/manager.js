const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  DEFAULT_GUARD_SHIFT_RATE,
  DEFAULT_SUPERVISOR_SHIFT_RATE,
  SETTING_KEYS,
  DEDUCTION_EXEMPT_ROLES,
  getWageRates,
  getShiftRateForRole
} = require('../config/wages');

const router = express.Router();

// ============================================================
// WAGE SETTINGS (HIGHEST PRIORITY BUSINESS RULES)
// Fixed Shift Wage Baselines for a standard 12-hour shift:
//   - Guard:      KES 254 (default)
//   - Supervisor: KES 400 (default)
// Both rates are fully editable via this manager/admin portal.
// Supervisors are STRICTLY EXEMPT from uniform/gear/equipment deductions.
// ============================================================

// Get current wage baselines & deduction exemption rules
router.get('/settings/wages', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const rates = await getWageRates(db);

    res.json({
      guardShiftRate: rates.guardShiftRate,
      supervisorShiftRate: rates.supervisorShiftRate,
      defaults: {
        guardShiftRate: DEFAULT_GUARD_SHIFT_RATE,
        supervisorShiftRate: DEFAULT_SUPERVISOR_SHIFT_RATE
      },
      deductionExemptRoles: DEDUCTION_EXEMPT_ROLES
    });
  } catch (error) {
    console.error('Get wage settings error:', error);
    res.status(500).json({ error: 'Failed to fetch wage settings' });
  }
});

// Update wage baselines (fully editable via manager/admin portal)
router.put('/settings/wages', authenticateToken, authorize('admin', 'manager', 'director'), [
  body('guardShiftRate').optional().isFloat({ min: 0 }).withMessage('Guard rate must be a non-negative number'),
  body('supervisorShiftRate').optional().isFloat({ min: 0 }).withMessage('Supervisor rate must be a non-negative number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const db = req.app.get('db');
    const updates = [];

    if (req.body.guardShiftRate !== undefined && req.body.guardShiftRate !== null && req.body.guardShiftRate !== '') {
      updates.push({
        key: SETTING_KEYS.guardShiftRate,
        value: parseFloat(req.body.guardShiftRate).toFixed(2),
        description: 'Guard pay per shift (KES). Editable via manager/admin portal.'
      });
    }

    if (req.body.supervisorShiftRate !== undefined && req.body.supervisorShiftRate !== null && req.body.supervisorShiftRate !== '') {
      updates.push({
        key: SETTING_KEYS.supervisorShiftRate,
        value: parseFloat(req.body.supervisorShiftRate).toFixed(2),
        description: 'Supervisor pay per shift (KES). Editable via manager/admin portal.'
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid wage rate changes provided' });
    }

    for (const update of updates) {
      await db.query(
        `INSERT INTO system_settings (key, value, description, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             description = EXCLUDED.description,
             updated_by = EXCLUDED.updated_by,
             updated_at = CURRENT_TIMESTAMP`,
        [update.key, update.value, update.description, req.user.id]
      );
    }

    // Audit log the change
    const changedKeys = updates.map(u => `${u.key}=${u.value}`).join(', ');
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Wage Baselines Updated', 'financial', `Updated fixed shift wage baselines: ${changedKeys}`]
    );

    const rates = await getWageRates(db);

    res.json({
      success: true,
      message: 'Wage baselines updated successfully',
      guardShiftRate: rates.guardShiftRate,
      supervisorShiftRate: rates.supervisorShiftRate,
      deductionExemptRoles: DEDUCTION_EXEMPT_ROLES
    });
  } catch (error) {
    console.error('Update wage settings error:', error);
    res.status(500).json({ error: 'Failed to update wage settings' });
  }
});

// Get attendance roster for the manager portal.
router.get('/attendance', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const params = [];
    let siteFilter = '';

    if (req.user.role === 'supervisor') {
      params.push(req.user.id);
      siteFilter = 'AND s.supervisor_id = $1';
    }

    const [guardsResult, supervisorsResult] = await Promise.all([
      db.query(`
        SELECT u.id, u.full_name, u.work_number, u.email, u.role, u.account_status,
          u.join_date, u.site_id, u.shift_type, u.daily_rate,
          s.site_name, s.location as site_location, s.day_rate, s.night_rate,
          COALESCE(SUM(CASE WHEN sh.check_in_time IS NOT NULL THEN 1 ELSE 0 END), 0) as attended_shifts
        FROM users u
        LEFT JOIN sites s ON s.id = u.site_id
        LEFT JOIN shifts sh ON sh.guard_id = u.id AND sh.date = CURRENT_DATE
        WHERE u.role = 'guard' AND u.account_status = 'active' ${siteFilter}
        GROUP BY u.id, s.id
        ORDER BY u.full_name ASC
      `, params),
      db.query(`
        SELECT u.id, u.full_name, u.work_number, u.email, u.role, u.account_status,
          u.join_date, u.site_id, u.shift_type, u.daily_rate,
          s.site_name, s.location as site_location, s.day_rate, s.night_rate
        FROM users u
        LEFT JOIN sites s ON s.id = u.site_id
        WHERE u.role = 'supervisor' AND u.account_status = 'active' ${siteFilter}
        ORDER BY u.full_name ASC
      `, params)
    ]);

    res.json({ guards: guardsResult.rows, supervisors: supervisorsResult.rows });
  } catch (error) {
    console.error('Get manager attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Get Manager Operational Dashboard
router.get('/dashboard', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    // Base queries for managers/supervisors (filtered by their sites)
    let siteFilter = '';
    let joinFilter = '';
    const params = [];

    if (userRole === 'supervisor') {
      // Get sites managed by this user
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = `AND (sh.site_id = ANY($1::uuid[]) OR s.id = ANY($1::uuid[]))`;
        params.push(managedSiteIds);
      } else {
        // No managed sites, return empty data
        return res.json({
          activeSites: [],
          todayShifts: [],
          actionItems: [],
          stats: {
            totalSites: 0,
            activeShifts: 0,
            pendingIncidents: 0,
            guardsOnDuty: 0,
            pendingInspections: 0,
            unreadDocuments: 0,
            applicants: 0
          }
        });
      }
    }

    // Get stats for applicants
    const applicantsResult = await db.query(
      `SELECT COUNT(*) as count FROM applications WHERE assigned_role = 'manager' AND status = 'pending'`,
      []
    );

    // Get stats for pending inspections (sites with 2+ incidents)
    const inspectionsResult = await db.query(
      `SELECT COUNT(*) as count FROM (
        SELECT s.id FROM sites s
        JOIN audits a ON a.site_id = s.id
        WHERE a.status = 'pending'
        GROUP BY s.id
        HAVING COUNT(a.id) >= 2
      ) as flagged_sites`,
      []
    );

    // Get stats for unread documents
    const documentsResult = await db.query(
      `SELECT COUNT(*) as count FROM document_transfers 
       WHERE recipient_role = 'manager' AND status = 'pending'`,
      []
    );

    const [
      activeSitesResult,
      todayShiftsResult,
      pendingIncidentsResult,
      guardAttendanceResult
    ] = await Promise.all([
      // Active sites
      db.query(`
        SELECT s.id, s.site_name, s.location, s.address,
          COUNT(DISTINCT u.id) as total_guards,
          COUNT(DISTINCT CASE WHEN u.last_active_date >= CURRENT_DATE - INTERVAL '1 day' THEN u.id END) as active_guards
        FROM sites s
        LEFT JOIN users u ON u.site_id = s.id AND u.role = 'guard' AND u.account_status = 'active'
        WHERE s.status = 'active' ${siteFilter.replace('sh.site_id', 's.id').replace('s.id', 's.id')}
        GROUP BY s.id, s.site_name, s.location, s.address
        ORDER BY s.site_name
      `, params.length > 0 ? [params[0]] : []),

      // Today's shift schedule
      db.query(`
        SELECT sh.id, sh.date, sh.shift_type, sh.status, sh.check_in_time, sh.check_out_time,
          u.full_name as guard_name, u.work_number as guard_work_number, s.site_name as site_name, s.location
        FROM shifts sh
        JOIN users u ON u.id = sh.guard_id
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.date = CURRENT_DATE ${siteFilter}
        ORDER BY sh.shift_type DESC, sh.check_in_time ASC NULLS LAST
      `, params),

      // Pending incidents/audits
      db.query(`
        SELECT a.id, a.issue_type, a.description, a.status, a.created_at,
          u.full_name as guard_name, s.site_name as site_name, s.location
        FROM audits a
        JOIN users u ON u.id = a.guard_id
        JOIN sites s ON s.id = a.site_id
        WHERE a.status = 'pending' ${siteFilter.replace('sh.site_id', 'a.site_id').replace('s.id', 's.id')}
        ORDER BY a.created_at DESC
        LIMIT 10
      `, params),

      // Guard attendance summary
      db.query(`
        SELECT 
          COUNT(*) as total_guards,
          COUNT(CASE WHEN last_active_date >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as present_today,
          COUNT(CASE WHEN last_active_date < CURRENT_DATE - INTERVAL '5 days' THEN 1 END) as absent_5_days
        FROM users
        WHERE role = 'guard' AND account_status = 'active'
        ${siteFilter.replace('sh.site_id', 'site_id').replace('s.id', 'site_id')}
      `, params.length > 0 ? [params[0]] : [])
    ]);

    res.json({
      activeSites: activeSitesResult.rows,
      todayShifts: todayShiftsResult.rows,
      actionItems: pendingIncidentsResult.rows,
      stats: {
        totalSites: activeSitesResult.rows.length,
        activeShifts: todayShiftsResult.rows.filter(s => s.status === 'completed').length,
        pendingIncidents: pendingIncidentsResult.rows.length,
        guardsOnDuty: guardAttendanceResult.rows[0]?.present_today || 0,
        pendingInspections: parseInt(inspectionsResult.rows[0]?.count || 0),
        unreadDocuments: parseInt(documentsResult.rows[0]?.count || 0),
        applicants: parseInt(applicantsResult.rows[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Get manager dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch manager dashboard' });
  }
});

// Get Active Shifts for Manager
router.get('/shifts', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND s.id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      } else {
        return res.json({ activeShifts: [] });
      }
    }

    // Site allocation lives on users.site_id; today's shift only tells us clock-in status.
    const result = await db.query(`
      WITH managed_sites AS (
        SELECT s.id, s.site_name, s.location, s.required_guards,
          COALESCE(s.supervisor_id, area_sup.id) as supervisor_id,
          COALESCE(sup.full_name, area_sup.full_name) as supervisor_name,
          COALESCE(sup.work_number, area_sup.work_number) as supervisor_work_number
        FROM sites s
        LEFT JOIN users sup ON sup.id = s.supervisor_id
        LEFT JOIN LATERAL (
          SELECT allocated_sup.id, allocated_sup.full_name, allocated_sup.work_number
          FROM supervisor_allocations sa
          JOIN users allocated_sup ON allocated_sup.id = sa.supervisor_id
          WHERE LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
            OR LOWER(COALESCE(s.site_name, '')) LIKE '%' || LOWER(sa.area) || '%'
          ORDER BY sa.created_at DESC
          LIMIT 1
        ) area_sup ON TRUE
        WHERE s.status = 'active'
          ${siteFilter}
      ),
      ranked_today_shifts AS (
        SELECT 
          sh.id as shift_id,
          sh.date,
          sh.guard_id,
          sh.site_id,
          sh.shift_type,
          sh.status,
          sh.check_in_time,
          sh.check_out_time,
          sh.start_time,
          sh.end_time,
          sh.clock_in_method,
          sh.clock_out_method,
          sh.created_at,
          ROW_NUMBER() OVER (
            PARTITION BY sh.guard_id, sh.site_id
            ORDER BY
              CASE WHEN COALESCE(sh.check_in_time, sh.start_time) IS NOT NULL AND COALESCE(sh.check_out_time, sh.end_time) IS NULL THEN 0 ELSE 1 END,
              COALESCE(sh.check_in_time, sh.start_time) DESC NULLS LAST,
              sh.created_at DESC
          ) as rn
        FROM shifts sh
        WHERE sh.date = CURRENT_DATE
          AND sh.status NOT IN ('cancelled', 'missed')
      ),
      assigned_rows AS (
        SELECT
          ms.id as site_id,
          ms.site_name,
          ms.location as site_location,
          ms.required_guards,
          ms.supervisor_id,
          ms.supervisor_name,
          ms.supervisor_work_number,
          sh.shift_id,
          sh.date,
          COALESCE(sh.shift_type, u.shift_type) as shift_type,
          sh.status,
          sh.check_in_time,
          sh.check_out_time,
          sh.start_time,
          sh.end_time,
          sh.clock_in_method,
          sh.clock_out_method,
          u.id as guard_id,
          u.full_name as guard_name,
          u.work_number as guard_work_number,
          CASE
            WHEN sh.check_in_time IS NOT NULL
              AND sh.start_time IS NOT NULL
              AND COALESCE(sh.shift_type, u.shift_type) <> 'overtime'
              AND sh.check_in_time > sh.start_time + INTERVAL '1 hour'
              AND (sh.shift_id IS NOT NULL)
            THEN TRUE ELSE FALSE
          END as is_late,
          CASE 
            WHEN COALESCE(sh.check_in_time, sh.start_time) IS NOT NULL AND COALESCE(sh.check_out_time, sh.end_time) IS NULL THEN 'clocked_in'
            WHEN sh.shift_id IS NOT NULL THEN 'scheduled'
            WHEN u.id IS NOT NULL THEN 'assigned'
            ELSE 'unassigned'
          END as shift_status
        FROM managed_sites ms
        JOIN users u ON u.role = 'guard'
          AND u.account_status = 'active'
          AND (u.site_id = ms.id OR EXISTS (
            SELECT 1 FROM allocations a
            WHERE a.guard_id = u.id AND a.site_id = ms.id AND a.status = 'active'
          ) OR EXISTS (
            SELECT 1 FROM shifts assigned_shift
            WHERE assigned_shift.guard_id = u.id AND assigned_shift.site_id = ms.id
              AND assigned_shift.date = CURRENT_DATE
              AND assigned_shift.status NOT IN ('cancelled', 'missed')
          ))
        LEFT JOIN ranked_today_shifts sh ON sh.guard_id = u.id
          AND sh.site_id = ms.id
          AND sh.rn = 1
      ),
      missing_rows AS (
        SELECT
          ms.id as site_id,
          ms.site_name,
          ms.location as site_location,
          ms.required_guards,
          ms.supervisor_id,
          ms.supervisor_name,
          ms.supervisor_work_number,
          NULL::uuid as shift_id,
          CURRENT_DATE as date,
          NULL::varchar as shift_type,
          NULL::varchar as status,
          NULL::timestamp as check_in_time,
          NULL::timestamp as check_out_time,
          NULL::timestamp as start_time,
          NULL::timestamp as end_time,
          NULL::varchar as clock_in_method,
          NULL::varchar as clock_out_method,
          NULL::uuid as guard_id,
          NULL::varchar as guard_name,
          NULL::varchar as guard_work_number,
          FALSE as is_late,
          'unassigned' as shift_status
        FROM managed_sites ms
        CROSS JOIN LATERAL generate_series(
          1,
          GREATEST(
            ms.required_guards - (
              SELECT COUNT(*)
              FROM users u
              WHERE u.site_id = ms.id
                AND u.role = 'guard'
                AND u.account_status = 'active'
            ),
            0
          )
        )
      ),
      combined_rows AS (
        SELECT * FROM assigned_rows
        UNION ALL
        SELECT * FROM missing_rows
      )
      SELECT * FROM combined_rows
      ORDER BY 
        CASE shift_status 
          WHEN 'clocked_in' THEN 1 
          WHEN 'scheduled' THEN 2 
          WHEN 'assigned' THEN 3
          WHEN 'unassigned' THEN 4
        END,
        site_name,
        guard_name NULLS LAST
    `, params);

    res.json({ activeShifts: result.rows });
  } catch (error) {
    console.error('Get active shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch active shifts' });
  }
});
// Get Live Operations Board - Real-time status grid with color codes
router.get('/attendance/live-board', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND u.site_id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      } else {
        return res.json({ guards: [], supervisors: [], stats: { active: 0, late: 0, absent: 0, patrol: 0 } });
      }
    }

    // Get all guards with their current shift status
    const guardsResult = await db.query(`
      SELECT 
        u.id as guard_id, u.full_name as guard_name, u.work_number,
        s.id as site_id, s.site_name, s.location as site_location,
        sh.id as shift_id, sh.shift_type, sh.check_in_time, sh.check_out_time,
        sh.start_time, sh.check_in_geofence_verified,
        CASE 
          WHEN sh.check_in_time IS NOT NULL AND sh.check_out_time IS NULL THEN 'active'
          WHEN sh.check_in_time IS NULL AND sh.start_time IS NOT NULL 
               AND sh.start_time < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'late'
          WHEN sh.check_in_time IS NULL AND sh.start_time IS NOT NULL THEN 'pending'
          WHEN sh.check_in_time IS NULL AND sh.start_time IS NULL THEN 'scheduled'
          ELSE 'scheduled'
        END as status,
        CASE 
          WHEN sh.check_in_time IS NOT NULL AND sh.start_time IS NOT NULL 
               AND sh.check_in_time > sh.start_time + INTERVAL '1 hour' THEN TRUE
          ELSE FALSE
        END as is_late,
        CASE WHEN sh.shift_type = 'overtime' THEN TRUE ELSE FALSE END as is_patrol,
        CASE 
          WHEN sh.check_in_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (COALESCE(sh.check_out_time, CURRENT_TIMESTAMP) - sh.check_in_time)) / 3600
          ELSE 0
        END as hours_worked
      FROM users u
      JOIN sites s ON s.id = u.site_id
      LEFT JOIN LATERAL (
        SELECT sh.* FROM shifts sh
        WHERE sh.guard_id = u.id AND sh.date = CURRENT_DATE AND sh.status IN ('scheduled', 'completed')
        ORDER BY sh.created_at DESC LIMIT 1
      ) sh ON TRUE
      WHERE u.role = 'guard' AND u.account_status = 'active'
      ${siteFilter}
      ORDER BY u.full_name
    `, params);

    // Get supervisors with their current shift status
    const supervisorsResult = await db.query(`
      SELECT 
        u.id as supervisor_id, u.full_name as supervisor_name, u.work_number,
        COALESCE(shift_site.id, s.id) as site_id,
        COALESCE(shift_site.site_name, s.site_name) as site_name,
        sh.id as shift_id, sh.shift_type, sh.check_in_time, sh.check_out_time,
        sh.start_time, sh.check_in_geofence_verified, sh.tied_to_inspection,
        CASE 
          WHEN sh.check_in_time IS NOT NULL AND sh.check_out_time IS NULL THEN 'active'
          WHEN sh.check_in_time IS NULL AND sh.start_time IS NOT NULL 
               AND sh.start_time < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'late'
          WHEN sh.check_in_time IS NULL AND sh.start_time IS NOT NULL THEN 'pending'
          ELSE 'scheduled'
        END as status
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN LATERAL (
        SELECT sh.* FROM shifts sh
        WHERE sh.guard_id = u.id AND sh.date = CURRENT_DATE AND sh.status IN ('scheduled', 'completed')
        ORDER BY sh.created_at DESC LIMIT 1
      ) sh ON TRUE
      LEFT JOIN sites shift_site ON shift_site.id = sh.site_id
      WHERE u.role = 'supervisor' AND u.account_status = 'active'
      ${siteFilter}
      ORDER BY u.full_name
    `, params);

    // Get exception counts
    const exceptionsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open_exceptions,
        COUNT(*) FILTER (WHERE exception_type = 'geofence_violation' AND created_at::date = CURRENT_DATE) as geofence_violations_today,
        COUNT(*) FILTER (WHERE exception_type = 'missed_punch_out' AND created_at::date = CURRENT_DATE) as missed_punch_outs_today,
        COUNT(*) FILTER (WHERE exception_type = 'supervisor_override' AND created_at::date = CURRENT_DATE) as supervisor_overrides_today
      FROM attendance_exceptions
    `);

    // Calculate stats
    const guards = guardsResult.rows;
    const stats = {
      active: guards.filter(g => g.status === 'active').length,
      late: guards.filter(g => g.status === 'late' || g.is_late).length,
      absent: guards.filter(g => g.status === 'scheduled' && !g.check_in_time && g.start_time < new Date(Date.now() - 12 * 60 * 60 * 1000)).length,
      patrol: guards.filter(g => g.is_patrol).length,
      pending: guards.filter(g => g.status === 'pending').length,
      open_exceptions: parseInt(exceptionsResult.rows[0]?.open_exceptions || 0),
      geofence_violations_today: parseInt(exceptionsResult.rows[0]?.geofence_violations_today || 0),
      missed_punch_outs_today: parseInt(exceptionsResult.rows[0]?.missed_punch_outs_today || 0),
      supervisor_overrides_today: parseInt(exceptionsResult.rows[0]?.supervisor_overrides_today || 0)
    };

    res.json({ guards, supervisors: supervisorsResult.rows, stats });
  } catch (error) {
    console.error('Get live operations board error:', error);
    res.status(500).json({ error: 'Failed to fetch live operations board' });
  }
});

// Get Exception Queue - aggregated anomalies
router.get('/attendance/exceptions', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'open', limit = 50 } = req.query;

    const result = await db.query(`
      SELECT 
        ae.id, ae.exception_type, ae.severity, ae.status, ae.description,
        ae.metadata, ae.created_at, ae.resolved_at, ae.resolution_note,
        ae.guard_id, u.full_name as guard_name, u.work_number as guard_work_number,
        ae.site_id, s.site_name,
        ae.shift_id,
        ae.resolved_by, ru.full_name as resolved_by_name
      FROM attendance_exceptions ae
      JOIN users u ON u.id = ae.guard_id
      LEFT JOIN sites s ON s.id = ae.site_id
      LEFT JOIN users ru ON ru.id = ae.resolved_by
      WHERE ae.status = $1
      ORDER BY 
        CASE ae.severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        ae.created_at DESC
      LIMIT $2
    `, [status, parseInt(limit)]);

    res.json({ exceptions: result.rows });
  } catch (error) {
    console.error('Get exception queue error:', error);
    res.status(500).json({ error: 'Failed to fetch exception queue' });
  }
});

// Resolve an exception
router.patch('/attendance/exceptions/:id/resolve', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { resolution_note, status = 'resolved' } = req.body;

    const result = await db.query(`
      UPDATE attendance_exceptions
      SET status = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP,
          resolution_note = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, req.user.id, resolution_note || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Exception Resolved', 'attendance', `Resolved attendance exception ${id}`]
    );

    res.json({ exception: result.rows[0] });
  } catch (error) {
    console.error('Resolve exception error:', error);
    res.status(500).json({ error: 'Failed to resolve exception' });
  }
});

// Get Compliance & Overtime Tracking
router.get('/attendance/compliance', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { week_start } = req.query;

    // Calculate week start (Monday)
    let targetWeek;
    if (week_start) {
      targetWeek = new Date(week_start);
    } else {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      targetWeek = new Date(now);
      targetWeek.setDate(now.getDate() - diff);
      targetWeek.setHours(0, 0, 0, 0);
    }

    const weekEnd = new Date(targetWeek);
    weekEnd.setDate(targetWeek.getDate() + 6);

    // Get compliance records
    const complianceResult = await db.query(`
      SELECT 
        ac.*, u.full_name as guard_name, u.work_number,
        s.site_name
      FROM attendance_compliance ac
      JOIN users u ON u.id = ac.guard_id
      LEFT JOIN sites s ON s.id = u.site_id
      WHERE ac.week_start = $1
      ORDER BY 
        CASE ac.compliance_status 
          WHEN 'critical' THEN 1 
          WHEN 'violation' THEN 2 
          WHEN 'warning' THEN 3 
          ELSE 4 
        END,
        u.full_name
    `, [targetWeek.toISOString().split('T')[0]]);

    // Get summary stats
    const summaryResult = await db.query(`
      SELECT 
        COUNT(*) as total_guards,
        COUNT(*) FILTER (WHERE compliance_status = 'compliant') as compliant,
        COUNT(*) FILTER (WHERE compliance_status = 'warning') as warning,
        COUNT(*) FILTER (WHERE compliance_status = 'violation') as violation,
        COUNT(*) FILTER (WHERE compliance_status = 'critical') as critical,
        COALESCE(SUM(total_hours_worked), 0) as total_hours,
        COALESCE(SUM(overtime_hours), 0) as total_overtime_hours,
        COALESCE(SUM(unauthorized_overtime_hours), 0) as unauthorized_overtime_hours
      FROM attendance_compliance
      WHERE week_start = $1
    `, [targetWeek.toISOString().split('T')[0]]);

    res.json({
      week_start: targetWeek.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      summary: summaryResult.rows[0] || { total_guards: 0, compliant: 0, warning: 0, violation: 0, critical: 0, total_hours: 0, total_overtime_hours: 0, unauthorized_overtime_hours: 0 },
      compliance: complianceResult.rows
    });
  } catch (error) {
    console.error('Get compliance tracking error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance tracking' });
  }
});

// Get Attendance Audit Logs
router.get('/attendance/audit-logs', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { limit = 50 } = req.query;

    const result = await db.query(`
      SELECT id, user_id, user_name, action, type, description, metadata, created_at
      FROM audit_logs
      WHERE type IN ('attendance', 'shift')
      ORDER BY created_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({ audit_logs: result.rows });
  } catch (error) {
    console.error('Get attendance audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance audit logs' });
  }
});

// Get Attendance Summary (Daily/Weekly)
router.get('/attendance/summary', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { period = 'daily', date } = req.query;

    if (period === 'daily') {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const result = await db.query(`
        SELECT 
          $1::date as date,
          COUNT(DISTINCT u.id) as total_guards,
          COUNT(DISTINCT CASE WHEN sh.check_in_time IS NOT NULL AND sh.check_out_time IS NULL THEN u.id END) as active_guards,
          COUNT(DISTINCT CASE WHEN sh.check_in_time IS NOT NULL AND sh.check_in_time <= sh.start_time + INTERVAL '1 hour' THEN u.id END) as on_time,
          COUNT(DISTINCT CASE WHEN sh.check_in_time IS NOT NULL AND sh.check_in_time > sh.start_time + INTERVAL '1 hour' THEN u.id END) as late,
          COUNT(DISTINCT CASE WHEN sh.id IS NULL OR sh.status = 'missed' THEN u.id END) as absent,
          COUNT(DISTINCT CASE WHEN sh.check_in_time IS NULL AND sh.status = 'scheduled' THEN u.id END) as pending,
          COUNT(DISTINCT CASE WHEN sh.check_in_geofence_verified = FALSE AND sh.check_in_time IS NOT NULL THEN u.id END) as geofence_violations
        FROM users u
        LEFT JOIN shifts sh ON sh.guard_id = u.id
          AND sh.date = $1::date
          AND sh.status IN ('scheduled', 'completed', 'missed')
        WHERE u.role = 'guard' AND u.account_status = 'active'
      `, [targetDate]);

      return res.json({ summary: result.rows[0] });
    }

    // Weekly summary
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const result = await db.query(`
      SELECT 
        COUNT(sh.id) as total_shifts,
        COUNT(CASE WHEN sh.status = 'completed' THEN 1 END) as completed_shifts,
        COUNT(CASE WHEN sh.status = 'missed' THEN 1 END) as missed_shifts,
        COUNT(CASE WHEN sh.status = 'cancelled' THEN 1 END) as cancelled_shifts,
        COUNT(CASE WHEN sh.check_in_time > sh.start_time + INTERVAL '1 hour' THEN 1 END) as late_clock_ins,
        COUNT(CASE WHEN sh.check_in_geofence_verified = FALSE AND sh.check_in_time IS NOT NULL THEN 1 END) as geofence_violations,
        COALESCE(SUM(CASE WHEN sh.shift_type = 'overtime' THEN EXTRACT(EPOCH FROM (COALESCE(sh.end_time, CURRENT_TIMESTAMP) - sh.start_time)) / 3600 ELSE 12 END), 0) as total_hours,
        COALESCE(SUM(CASE WHEN sh.shift_type = 'overtime' THEN EXTRACT(EPOCH FROM (COALESCE(sh.end_time, CURRENT_TIMESTAMP) - sh.start_time)) / 3600 ELSE 0 END), 0) as overtime_hours
      FROM shifts sh
      WHERE sh.date >= $1 AND sh.date <= $2
    `, [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);

    res.json({
      period: 'weekly',
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      summary: result.rows[0]
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Export Payroll-Ready Attendance Data
router.get('/attendance/export-payroll', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    const wageRates = await getWageRates(db);
    const result = await db.query(`
      SELECT 
        u.id as guard_id, u.full_name as guard_name, u.work_number,
        s.id as site_id, s.site_name,
        COUNT(DISTINCT sh.date) as days_worked,
        COALESCE(SUM(CASE WHEN sh.shift_type = 'overtime' THEN EXTRACT(EPOCH FROM (COALESCE(sh.end_time, CURRENT_TIMESTAMP) - sh.start_time)) / 3600 ELSE 12 END), 0) as total_hours,
        COALESCE(SUM(CASE WHEN sh.shift_type = 'overtime' THEN EXTRACT(EPOCH FROM (COALESCE(sh.end_time, CURRENT_TIMESTAMP) - sh.start_time)) / 3600 ELSE 0 END), 0) as overtime_hours,
        $3 as daily_rate,
        COALESCE(SUM(COALESCE(sh.daily_rate, $3)), 0) as gross_pay,
        COALESCE((
          SELECT SUM(fl.amount) FROM financial_ledger fl
          WHERE fl.guard_id = u.id AND fl.type = 'penalty' AND fl.status = 'active'
            AND fl.created_at::date >= $1::date AND fl.created_at::date <= $2::date
        ), 0) as penalties,
        COALESCE((
          SELECT SUM(fl.amount) FROM financial_ledger fl
          WHERE fl.guard_id = u.id AND fl.type = 'bonus' AND fl.status = 'active'
            AND fl.created_at::date >= $1::date AND fl.created_at::date <= $2::date
        ), 0) as bonuses
      FROM users u
      JOIN shifts sh ON sh.guard_id = u.id
        AND sh.date >= $1::date AND sh.date <= $2::date
        AND sh.status = 'completed'
      JOIN sites s ON s.id = sh.site_id
      WHERE u.role = 'guard' AND u.account_status = 'active'
      GROUP BY u.id, u.full_name, u.work_number, s.id, s.site_name, sh.daily_rate, u.daily_rate
      ORDER BY u.full_name
    `, [start_date, end_date, wageRates.guardShiftRate]);

    // Save report record
    await db.query(`
      INSERT INTO attendance_reports (report_type, period_start, period_end, generated_by, report_data, status)
      VALUES ('payroll', $1, $2, $3, $4, 'generated')
    `, [start_date, end_date, req.user.id, JSON.stringify({ entries: result.rows.length })]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Payroll Attendance Exported', 'attendance', `Exported payroll attendance for ${start_date} to ${end_date}`]
    );

    res.json({
      period_start: start_date,
      period_end: end_date,
      payroll_entries: result.rows,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Export payroll attendance error:', error);
    res.status(500).json({ error: 'Failed to export payroll attendance' });
  }
});

// Get Attendance Data (Guards and Supervisors)
router.get('/attendance', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'manager' || userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND u.site_id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      } else {
        return res.json({ guards: [], supervisors: [] });
      }
    }

    const currentShiftCte = `
      WITH ranked_today_shifts AS (
        SELECT
          sh.*,
          ROW_NUMBER() OVER (
            PARTITION BY sh.guard_id
            ORDER BY
              CASE WHEN COALESCE(sh.check_in_time, sh.start_time) IS NOT NULL AND COALESCE(sh.check_out_time, sh.end_time) IS NULL THEN 0 ELSE 1 END,
              COALESCE(sh.check_in_time, sh.start_time) DESC NULLS LAST,
              sh.created_at DESC
          ) as rn
        FROM shifts sh
        WHERE sh.date = CURRENT_DATE
          AND sh.status NOT IN ('cancelled', 'missed')
      )
    `;

    // Attendance shows the allocated site and shift type even when the guard has not clocked in yet.
    const guardsResult = await db.query(`
      ${currentShiftCte}
      SELECT 
        u.id, u.full_name, u.work_number, u.email, u.phone_number,
        u.site_id, u.uniform_status,
        s.site_name as site_name, s.location as site_location,
        supervisor.full_name as supervisor_name,
        s.day_rate, s.night_rate,
        COALESCE(sh.shift_type, u.shift_type) as shift_type,
        CASE WHEN u.role = 'supervisor' THEN 400 ELSE 254 END as rate
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN users supervisor ON supervisor.id = s.supervisor_id
      LEFT JOIN ranked_today_shifts sh ON sh.guard_id = u.id AND sh.rn = 1
      WHERE u.role = 'guard' AND u.account_status = 'active'
      ${siteFilter}
      ORDER BY u.full_name
    `, params);

    const supervisorsResult = await db.query(`
      ${currentShiftCte}
      SELECT 
        u.id, u.full_name, u.work_number, u.email, u.phone_number,
        u.site_id,
        s.site_name as site_name, s.location as site_location,
        sa.area as allocation_area, sa.motorcycle, sa.motor_gear,
        CASE WHEN sa.id IS NULL THEN 'Unassigned' ELSE 'Assigned' END as assignment_status,
        s.day_rate, s.night_rate,
        COALESCE(sh.shift_type, u.shift_type) as shift_type,
        CASE WHEN u.role = 'supervisor' THEN 400 ELSE 254 END as rate
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN ranked_today_shifts sh ON sh.guard_id = u.id AND sh.rn = 1
      LEFT JOIN supervisor_allocations sa ON sa.supervisor_id = u.id
      WHERE u.role = 'supervisor' AND u.account_status = 'active'
      ${siteFilter}
      ORDER BY u.full_name
    `, params);

    res.json({
      guards: guardsResult.rows,
      supervisors: supervisorsResult.rows
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Get manager-facing details for a guard or supervisor.
router.get('/attendance/:personId/details', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { personId } = req.params;

    const personResult = await db.query(`
      SELECT u.id, u.full_name, u.work_number, u.email, u.phone_number, u.role,
        u.site_id, u.daily_rate, s.site_name, s.location as site_location
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      WHERE u.id = $1 AND u.role IN ('guard', 'supervisor') AND u.account_status = 'active'
    `, [personId]);

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Guard or supervisor not found' });
    }

    const person = personResult.rows[0];
    const [allocationResult, sitesResult, visitsResult, shiftsResult, payslipsResult] = await Promise.all([
      db.query(`
        SELECT area, shift_type, motorcycle, motor_gear, created_at
        FROM supervisor_allocations WHERE supervisor_id = $1
        ORDER BY created_at DESC LIMIT 1
      `, [personId]),
      person.role === 'supervisor'
        ? db.query(`
            SELECT s.id, s.site_name, s.location, s.address, s.status,
              u.full_name as supervisor_name
            FROM sites s LEFT JOIN users u ON u.id = s.supervisor_id
            WHERE s.supervisor_id = $1 ORDER BY s.site_name
          `, [personId])
        : db.query(`
            SELECT DISTINCT s.id, s.site_name, s.location, s.address, s.status,
              supervisor.full_name as supervisor_name
            FROM shifts sh JOIN sites s ON s.id = sh.site_id
            LEFT JOIN users supervisor ON supervisor.id = s.supervisor_id
            WHERE sh.guard_id = $1 ORDER BY s.site_name
          `, [personId]),
      person.role === 'supervisor'
        ? db.query(`
            SELECT DISTINCT s.id, s.site_name, s.location, supervisor.full_name as supervisor_name,
              MAX(a.created_at) as last_visited_at
            FROM audits a JOIN sites s ON s.id = a.site_id
            LEFT JOIN users supervisor ON supervisor.id = s.supervisor_id
            WHERE a.reporter_id = $1 GROUP BY s.id, s.site_name, s.location, supervisor.full_name
            ORDER BY last_visited_at DESC
          `, [personId])
        : db.query(`
            SELECT DISTINCT s.id, s.site_name, s.location, supervisor.full_name as supervisor_name,
              MAX(sh.check_in_time) as last_visited_at
            FROM shifts sh JOIN sites s ON s.id = sh.site_id
            LEFT JOIN users supervisor ON supervisor.id = s.supervisor_id
            WHERE sh.guard_id = $1 AND sh.check_in_time IS NOT NULL
            GROUP BY s.id, s.site_name, s.location, supervisor.full_name
            ORDER BY last_visited_at DESC
          `, [personId]),
      db.query(`
        SELECT sh.date, sh.shift_type, sh.status, sh.check_in_time, sh.check_out_time,
          s.site_name, s.location
        FROM shifts sh LEFT JOIN sites s ON s.id = sh.site_id
        WHERE sh.guard_id = $1
        ORDER BY sh.date DESC, sh.created_at DESC LIMIT 30
      `, [personId]),
      db.query(`
        SELECT p.id, pr.period_start, pr.period_end, p.days_worked, p.daily_rate,
          p.gross_salary, p.total_deductions, p.net_salary, p.payment_status,
          s.site_name, s.location
        FROM payslips p
        LEFT JOIN payroll_runs pr ON pr.id = p.payroll_run_id
        LEFT JOIN sites s ON s.id = pr.site_id
        WHERE p.guard_id = $1
        ORDER BY p.period_end DESC, p.created_at DESC LIMIT 12
      `, [personId])
    ]);

    const payslips = payslipsResult.rows;
    const accumulatedAmount = payslips.reduce((total, payslip) => total + Number(payslip.net_salary || 0), 0);

    res.json({
      person,
      allocation: allocationResult.rows[0] || null,
      allocated_sites: sitesResult.rows,
      visited_sites: visitsResult.rows,
      shifts: shiftsResult.rows,
      payslips,
      accumulated_amount: accumulatedAmount
    });
  } catch (error) {
    console.error('Get attendance person details error:', error);
    res.status(500).json({ error: 'Failed to fetch person details' });
  }
});
// Manually clock in a supervisor (grants operational access to active shifts)
router.post('/supervisors/clock-in', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { supervisor_id, site_id, shift_type = 'day' } = req.body;

    if (!supervisor_id) {
      return res.status(400).json({ error: 'supervisor_id is required' });
    }

    // Verify supervisor exists and is active
    const supervisorResult = await db.query(
      `SELECT id, full_name, work_number FROM users WHERE id = $1 AND role = 'supervisor' AND account_status = 'active'`,
      [supervisor_id]
    );
    if (supervisorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active supervisor not found' });
    }

    // Check for existing active shift
    const activeShift = await db.query(
      `SELECT id FROM shifts WHERE guard_id = $1 AND check_in_time IS NOT NULL AND end_time IS NULL`,
      [supervisor_id]
    );
    if (activeShift.rows.length > 0) {
      return res.status(400).json({ error: 'Supervisor already has an active shift' });
    }

    // Determine site - use provided site or supervisor's assigned site
    let targetSiteId = site_id;
    if (!targetSiteId) {
      const siteResult = await db.query(
        `SELECT s.id FROM sites s
         LEFT JOIN supervisor_allocations sa ON sa.supervisor_id = $1
         WHERE s.status = 'active'
           AND (s.supervisor_id = $1 OR (
             sa.id IS NOT NULL
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
           ))
         ORDER BY CASE WHEN s.supervisor_id = $1 THEN 0 ELSE 1 END
         LIMIT 1`,
        [supervisor_id]
      );
      targetSiteId = siteResult.rows[0]?.id;
    }

    if (!targetSiteId) {
      return res.status(400).json({ error: 'No site found for this supervisor. Please assign a site first.' });
    }

    const siteResult = await db.query(
      `SELECT id, client_name, day_rate, night_rate FROM sites WHERE id = $1 AND status = 'active'`,
      [targetSiteId]
    );
    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active site not found' });
    }

    const now = new Date();
    const scheduledStart = new Date(now);
    scheduledStart.setHours(shift_type === 'night' ? 18 : 6, 0, 0, 0);
    const wageRates = await getWageRates(db);
    const supervisorDailyRate = getShiftRateForRole('supervisor', wageRates);

    // Insert or update the shift record
    const shiftResult = await db.query(`
      INSERT INTO shifts (guard_id, site_id, date, shift_type, status, start_time, check_in_time,
        hourly_rate, daily_rate, notes, clock_in_method, supervisor_clock_in, supervisor_clock_in_by)
      VALUES ($1, $2, CURRENT_DATE, $3, 'scheduled', $4, $5, NULL, $6, $7, 'manager', TRUE, $8)
      ON CONFLICT (guard_id, site_id, date, shift_type, is_overtime)
      DO UPDATE SET
        start_time = EXCLUDED.start_time,
        check_in_time = EXCLUDED.check_in_time,
        status = 'scheduled',
        clock_in_method = 'manager',
        supervisor_clock_in = TRUE,
        supervisor_clock_in_by = EXCLUDED.supervisor_clock_in_by,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      supervisor_id, targetSiteId, shift_type, scheduledStart, now,
      supervisorDailyRate, `Clocked in by manager ${req.user.full_name}`, req.user.id
    ]);

    const createdShift = shiftResult.rows[0];

    // Notify the supervisor
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
       VALUES ($1, 'attendance', $2, $3, 'high', $4, 'supervisor')`,
      [
        supervisor_id,
        'Clocked In by Manager',
        `You have been clocked in by ${req.user.full_name} at ${siteResult.rows[0].client_name}. You now have operational access.`,
        JSON.stringify({ shift_id: createdShift.id, site_id: targetSiteId, clock_in_type: 'manager' })
      ]
    );

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Supervisor Clocked In by Manager', 'attendance',
       `Manually clocked in supervisor ${supervisorResult.rows[0].full_name} at ${siteResult.rows[0].client_name}`]
    );

    res.status(201).json({
      shift: createdShift,
      clock_in_type: 'manager',
      message: `${supervisorResult.rows[0].full_name} has been clocked in and granted operational access.`
    });
  } catch (error) {
    console.error('Manager clock-in supervisor error:', error);
    res.status(500).json({ error: 'Failed to clock in supervisor' });
  }
});

// Get Site Inspections (sites with 2+ incidents)
router.get('/inspections', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'manager' || userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND s.id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      }
    }

    // Get sites with 2+ incidents
    const sitesResult = await db.query(`
      SELECT 
        s.id, s.site_name, s.location, s.address,
        s.day_rate, s.night_rate,
        COUNT(a.id) as incident_count,
        CASE 
          WHEN COUNT(a.id) >= 2 THEN 'flagged'
          ELSE 'active'
        END as status
      FROM sites s
      LEFT JOIN audits a ON a.site_id = s.id AND a.status = 'pending'
      WHERE s.status = 'active' ${siteFilter}
      GROUP BY s.id, s.site_name, s.location, s.address, s.day_rate, s.night_rate
      HAVING COUNT(a.id) >= 2
      ORDER BY s.site_name
    `, params);

    // For each site, get day and night shift guards
    const sitesWithGuards = await Promise.all(
      sitesResult.rows.map(async (site) => {
        const dayGuardsResult = await db.query(`
          SELECT u.full_name, u.work_number
          FROM shifts sh
          JOIN users u ON u.id = sh.guard_id
          WHERE sh.site_id = $1 AND sh.date = CURRENT_DATE AND sh.shift_type = 'day'
        `, [site.id]);

        const nightGuardsResult = await db.query(`
          SELECT u.full_name, u.work_number
          FROM shifts sh
          JOIN users u ON u.id = sh.guard_id
          WHERE sh.site_id = $1 AND sh.date = CURRENT_DATE AND sh.shift_type = 'night'
        `, [site.id]);

        return {
          ...site,
          day_shift_guards: dayGuardsResult.rows,
          night_shift_guards: nightGuardsResult.rows
        };
      })
    );

    res.json({ sites: sitesWithGuards });
  } catch (error) {
    console.error('Get site inspections error:', error);
    res.status(500).json({ error: 'Failed to fetch site inspections' });
  }
});

// Get Documents for Manager
router.get('/documents', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'manager' || userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND s.id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      }
    }

    // 1. Application letters from new guards
    const applicationLettersResult = await db.query(
      `SELECT id, full_name, email, phone, created_at
       FROM applications
       WHERE assigned_role = 'manager'
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    // 2. Resignation letters
    const resignationLettersResult = await db.query(
      `SELECT id, full_name, work_number, resignation_date, resignation_reason
       FROM users
       WHERE role = 'guard' AND account_status = 'resigning'
       ORDER BY resignation_date DESC
       LIMIT 50`,
      []
    );

    // 3. Documents received from director/admin/secretary/supervisor
    const receivedDocumentsResult = await db.query(
      `SELECT 
        dt.id, dt.title, dt.document_type, dt.content, dt.file_url,
        dt.status, dt.priority, dt.created_at,
        u.full_name as sender_name
       FROM document_transfers dt
       JOIN users u ON u.id = dt.sender_id
       WHERE dt.recipient_role = 'manager'
       ORDER BY dt.created_at DESC
       LIMIT 50`,
      []
    );

    // 4. Emails
    const emailsResult = await db.query(
      `SELECT id, recipient_email, recipient_name, subject, body, status, created_at
       FROM email_outbox
       WHERE related_type IN ('guard_application', 'guard_application_manager')
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );

    res.json({
      applicationLetters: applicationLettersResult.rows,
      resignationLetters: resignationLettersResult.rows,
      receivedDocuments: receivedDocumentsResult.rows,
      emails: emailsResult.rows
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Create account request for hired guard
router.post('/account-request', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { application_id, full_name, email, phone, work_number } = req.body;

    // Create notification for admin
    const adminsResult = await db.query(
      "SELECT id FROM users WHERE role = 'admin' AND account_status = 'active'"
    );

    for (const admin of adminsResult.rows) {
      await db.query(
        'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          admin.id,
          'account_request',
          'New Guard Account Request',
          `${full_name} has been hired. Please create their account.`,
          'high',
          JSON.stringify({ application_id, full_name, email, phone, work_number })
        ]
      );
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Account Request Created', 'user_management', `Requested account creation for ${full_name}`]
    );

    res.json({ success: true, message: 'Account request sent to admin' });
  } catch (error) {
    console.error('Create account request error:', error);
    res.status(500).json({ error: 'Failed to create account request' });
  }
});

// Create shift for hired guard
router.post('/shifts', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, site_id, date, shift_type } = req.body;

    // Insert into shifts table (guard_id can be null for future assignment)
    const shiftResult = await db.query(
      'INSERT INTO shifts (guard_id, site_id, date, shift_type, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [guard_id, site_id, date, shift_type, 'scheduled']
    );

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Shift Created', 'system', `Created shift for guard_id ${guard_id || 'pending'} at site_id ${site_id}`]
    );

    res.json({ success: true, shift: shiftResult.rows[0] });
  } catch (error) {
    console.error('Create shift error:', error);
    res.status(500).json({ error: 'Failed to create shift' });
  }
});

// Create uniform request for hired guard
router.post('/uniform-request', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { application_id, guard_id, full_name } = req.body;

    // Insert into uniform_issues table
    const uniformResult = await db.query(
      'INSERT INTO uniform_issues (application_id, guard_id, full_name, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [application_id, guard_id, full_name, 'pending']
    );

    // Create notification for secretary
    const secretariesResult = await db.query(
      "SELECT id FROM users WHERE role = 'secretary' AND account_status = 'active'"
    );

    for (const secretary of secretariesResult.rows) {
      await db.query(
        'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          secretary.id,
          'uniform_request',
          'New Uniform Allocation Request',
          `${full_name} has been hired. Please allocate uniform.`,
          'high',
          JSON.stringify({ application_id, guard_id, full_name, uniform_issue_id: uniformResult.rows[0].id })
        ]
      );
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Uniform Request Created', 'uniform', `Requested uniform allocation for ${full_name}`]
    );

    res.json({ success: true, message: 'Uniform request sent to secretary', uniformIssue: uniformResult.rows[0] });
  } catch (error) {
    console.error('Create uniform request error:', error);
    res.status(500).json({ error: 'Failed to create uniform request' });
  }
});

// Report incident
router.post('/incidents', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, site_id, issue_type, description } = req.body;

    const result = await db.query(`
      INSERT INTO audits (reporter_id, guard_id, site_id, issue_type, description, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [req.user.id, guard_id, site_id, issue_type, description]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Incident Reported', 'audit', `Reported incident: ${issue_type}`]
    );

    res.status(201).json({ incident: result.rows[0] });
  } catch (error) {
    console.error('Report incident error:', error);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

// Get incidents list
router.get('/incidents', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'manager' || userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND a.site_id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      }
    }

    const result = await db.query(`
      SELECT a.id, a.issue_type, a.description, a.status, a.penalty_amount, a.created_at, a.updated_at,
        u.full_name as guard_name, u.work_number as guard_work_number,
        s.site_name as site_name, s.location as site_location,
        reporter.full_name as reporter_name
      FROM audits a
      JOIN users u ON u.id = a.guard_id
      JOIN users reporter ON reporter.id = a.reporter_id
      JOIN sites s ON s.id = a.site_id
      WHERE 1=1 ${siteFilter}
      ORDER BY a.created_at DESC
      LIMIT 50
    `, params);

    res.json({ incidents: result.rows });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Update incident status
router.patch('/incidents/:id', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { status, penalty_amount } = req.body;

    const result = await db.query(`
      UPDATE audits
      SET status = $1, penalty_amount = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, penalty_amount, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Incident Updated', 'audit', `Updated incident status to ${status}`]
    );

    res.json({ incident: result.rows[0] });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Get staff management data
router.get('/staff', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let siteFilter = '';
    const params = [];

    if (userRole === 'manager' || userRole === 'supervisor') {
      const managedSitesResult = await db.query(
        'SELECT id FROM sites WHERE supervisor_id = $1',
        [userId]
      );
      const managedSiteIds = managedSitesResult.rows.map(s => s.id);
      
      if (managedSiteIds.length > 0) {
        siteFilter = 'AND u.site_id = ANY($1::uuid[])';
        params.push(managedSiteIds);
      }
    }

    const result = await db.query(`
      SELECT u.id, u.work_number, u.full_name, u.email, u.role, u.account_status, 
        u.join_date, u.uniform_status, u.last_active_date, u.site_id,
        s.site_name as site_name, s.location as site_location,
        COUNT(DISTINCT sh.id) as total_shifts_this_month,
        COUNT(DISTINCT CASE WHEN sh.status = 'completed' THEN sh.id END) as completed_shifts
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN shifts sh ON sh.guard_id = u.id 
        AND sh.date >= DATE_TRUNC('month', CURRENT_DATE)
        AND sh.date <= CURRENT_DATE
      WHERE u.role = 'guard' AND u.account_status = 'active' ${siteFilter}
      GROUP BY u.id, u.work_number, u.full_name, u.email, u.role, u.account_status,
        u.join_date, u.uniform_status, u.last_active_date, u.site_id,
        s.site_name, s.location
      ORDER BY u.full_name
    `, params);

    res.json({ staff: result.rows });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff data' });
  }
});

// Generate report
router.post('/reports', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { report_type, site_id, date_from, date_to } = req.body;

    let reportData = {};
    let siteFilter = '';
    const params = [];

    if (site_id) {
      siteFilter = 'AND site_id = $1';
      params.push(site_id);
    }

    if (report_type === 'site_performance') {
      const shiftsResult = await db.query(`
        SELECT 
          COUNT(*) as total_shifts,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'missed' THEN 1 END) as missed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
        FROM shifts
        WHERE date >= $1 AND date <= $2 ${siteFilter}
      `, [date_from, date_to, ...params]);

      const incidentsResult = await db.query(`
        SELECT COUNT(*) as total_incidents,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
        FROM audits
        WHERE created_at >= $1 AND created_at <= $2 || ' 23:59:59' ${siteFilter.replace('site_id', 'site_id')}
      `, [date_from, date_to, ...params]);

      reportData = {
        shifts: shiftsResult.rows[0],
        incidents: incidentsResult.rows[0]
      };
    } else if (report_type === 'guard_performance') {
      const guardsResult = await db.query(`
        SELECT 
          u.id, u.full_name, u.work_number,
          COUNT(sh.id) as total_shifts,
          COUNT(CASE WHEN sh.status = 'completed' THEN sh.id END) as completed_shifts,
          COUNT(CASE WHEN sh.status = 'missed' THEN sh.id END) as missed_shifts
        FROM users u
        LEFT JOIN shifts sh ON sh.guard_id = u.id 
          AND sh.date >= $1 
          AND sh.date <= $2
        WHERE u.role = 'guard' AND u.account_status = 'active' ${siteFilter.replace('site_id', 'u.site_id')}
        GROUP BY u.id, u.full_name, u.work_number
        ORDER BY completed_shifts DESC
      `, [date_from, date_to, ...params]);

      reportData = { guards: guardsResult.rows };
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Report Generated', 'system', `Generated ${report_type} report`]
    );

    res.json({ report_type, report_data: reportData, generated_at: new Date() });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;


