const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { classifySiteLocation } = require('../utils/siteLocation');
const { getWageRates, getShiftRateForRole } = require('../config/wages');

const router = express.Router();

// ============================================
// CROSS-PORTAL ALLOCATION SYNC
// ============================================

// Create guard allocation (Syncs to all portals via DB trigger)
router.post('/guard-allocations', authenticateToken, authorize('supervisor', 'manager', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { guard_id, site_id, shift_type, date, notes, change_site = false } = req.body;

    if (!guard_id || !site_id) {
      return res.status(400).json({ error: 'guard_id and site_id are required' });
    }

    // Verify guard exists
    const guardResult = await db.query(
      'SELECT id, full_name, work_number, site_id FROM users WHERE id = $1 AND role = $2 AND account_status = $3',
      [guard_id, 'guard', 'active']
    );
    if (guardResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive guard' });
    }

    // Verify site exists
    const siteResult = await db.query(
      'SELECT id, client_name, location FROM sites WHERE id = $1',
      [site_id]
    );
    if (siteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid site' });
    }

    if (change_site) {
      await db.query(
        'UPDATE users SET site_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [site_id, guard_id]
      );
    }

    const shiftDate = date || new Date().toISOString().split('T')[0];
    const shiftType = shift_type || 'day';

    if (!['day', 'night'].includes(shiftType)) {
      return res.status(400).json({ error: 'Regular assignments must use a day or night shift. Use Quick Actions for overtime.' });
    }

    if (shiftType !== 'overtime') {
      const existingAssignment = await db.query(`
        SELECT 1
        FROM users u
        WHERE u.id = $1 AND u.site_id IS NOT NULL
        UNION ALL
        SELECT 1 FROM allocations a
        WHERE a.guard_id = $1 AND a.status = 'active'
        LIMIT 1
      `, [guard_id]);
      if (existingAssignment.rows.length > 0) {
        return res.status(400).json({
          error: 'This guard is already allocated. Use overtime for an additional shift.'
        });
      }
    }

    // Insert allocation (triggers DB function to sync to shifts + notify all portals)
    const result = await db.query(`
      INSERT INTO allocations (guard_id, site_id, allocated_by, date, shift_type, status, notes)
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      ON CONFLICT (guard_id, site_id, date, shift_type) 
      DO UPDATE SET status = 'active', allocated_by = $3, notes = $6, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [guard_id, site_id, userId, shiftDate, shiftType, notes]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.full_name, req.user.email, 'Guard Allocated', 'attendance',
       `Allocated guard ${guardResult.rows[0].full_name} to ${siteResult.rows[0].client_name}`]
    );

    res.status(201).json({
      allocation: result.rows[0],
      message: `Guard allocated to ${siteResult.rows[0].client_name}`
    });
  } catch (error) {
    console.error('Create allocation error:', error);
    res.status(500).json({ error: 'Failed to create allocation' });
  }
});

// Get guard allocations for supervisor's sites
router.get('/guard-allocations', authenticateToken, authorize('supervisor', 'manager', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const managedSitesResult = await db.query(
      `SELECT id FROM sites
       WHERE status = 'active'
         AND (
           supervisor_id = $1
           OR supervisor_id IS NULL
           OR id = (SELECT site_id FROM users WHERE id = $1)
           OR id IN (SELECT site_id FROM allocations WHERE allocated_by = $1)
         )`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ allocations: [] });
    }

    const result = await db.query(`
      SELECT 
        a.id, a.date, a.shift_type, a.status, a.notes, a.created_at,
        u.id as guard_id, u.full_name as guard_name, u.work_number as guard_work_number,
        s.id as site_id, s.client_name as site_name, s.location as site_location,
        allocator.full_name as allocated_by_name
      FROM allocations a
      JOIN users u ON u.id = a.guard_id
      JOIN sites s ON s.id = a.site_id
      LEFT JOIN users allocator ON allocator.id = a.allocated_by
      WHERE a.site_id = ANY($1::uuid[])
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [managedSiteIds]);

    res.json({ allocations: result.rows });
  } catch (error) {
    console.error('Get allocations error:', error);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// ============================================
// DOCUMENT DISTRIBUTION HUB
// ============================================

// Get all documents sent by supervisor
router.get('/documents', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const result = await db.query(`
      SELECT 
        dt.id, dt.document_type, dt.title, dt.content, dt.file_url,
        dt.status, dt.priority, dt.read_at, dt.archived_at,
        dt.created_at, dt.updated_at,
        u.full_name as recipient_name,
        u.work_number as recipient_work_number,
        u.role as recipient_role
      FROM document_transfers dt
      LEFT JOIN users u ON u.id = dt.recipient_id
      WHERE dt.sender_id = $1
      ORDER BY dt.created_at DESC
      LIMIT 100
    `, [userId]);

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Send document to team members
router.post('/documents/send', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { recipient_role, recipient_id, document_type, title, content, file_url, priority } = req.body;

    // Validate required fields
    if (!document_type || !title) {
      return res.status(400).json({ error: 'Document type and title are required' });
    }

    // If recipient_role is 'all', send to all managers, secretaries, and guards
    if (recipient_role === 'all') {
      const recipients = await db.query(`
        SELECT id FROM users 
        WHERE role IN ('manager', 'secretary', 'guard') 
        AND account_status = 'active'
      `);

      const insertPromises = recipients.rows.map(recipient => 
        db.query(`
          INSERT INTO document_transfers 
          (sender_id, recipient_id, recipient_role, document_type, title, content, file_url, priority, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
          RETURNING *
        `, [userId, recipient.id, recipient.role, document_type, title, content, file_url, priority || 'medium'])
      );

      const results = await Promise.all(insertPromises);
      
      // Log audit
      await db.query(
        'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, req.user.full_name, req.user.email, 'Document Sent', 'document', `Sent ${document_type} to all team members`]
      );

      return res.status(201).json({ 
        documents: results.map(r => r.rows[0]),
        count: results.length 
      });
    }

    // Send to specific recipient
    if (!recipient_id) {
      return res.status(400).json({ error: 'Recipient ID is required when not sending to all' });
    }

    const result = await db.query(`
      INSERT INTO document_transfers 
      (sender_id, recipient_id, recipient_role, document_type, title, content, file_url, priority, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `, [userId, recipient_id, recipient_role, document_type, title, content, file_url, priority || 'medium']);

    // Create notification for recipient
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, priority, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      recipient_id,
      'document',
      `New Document: ${title}`,
      `You have received a new ${document_type.replace('_', ' ')} from ${req.user.full_name}`,
      priority || 'medium',
      JSON.stringify({ document_id: result.rows[0].id, document_type })
    ]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.full_name, req.user.email, 'Document Sent', 'document', `Sent ${document_type} to recipient`]
    );

    res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    console.error('Send document error:', error);
    res.status(500).json({ error: 'Failed to send document' });
  }
});

// Get document templates
router.get('/documents/templates', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const templates = [
      {
        type: 'incident_report',
        title: 'Incident Report',
        description: 'Report security incidents, breaches, or unusual activities',
        fields: ['guard_id', 'site_id', 'description']
      },
      {
        type: 'shift_change_sop',
        title: 'Shift Change SOP',
        description: 'Standard operating procedure for shift handovers',
        fields: ['site_id', 'date', 'shift_type']
      },
      {
        type: 'handover_notes',
        title: 'Handover Notes',
        description: 'Notes and updates for incoming shift',
        fields: ['site_id', 'date', 'shift_type', 'notes']
      },
      {
        type: 'daily_instructions',
        title: 'Daily Instructions',
        description: 'Daily operational instructions and reminders',
        fields: ['date', 'instructions']
      },
      {
        type: 'training_material',
        title: 'Training Material',
        description: 'Training documents and resources',
        fields: ['title', 'content', 'file_url']
      },
      {
        type: 'policy_update',
        title: 'Policy Update',
        description: 'Company policy updates and announcements',
        fields: ['title', 'content']
      }
    ];

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ============================================
// SHIFT OVERSIGHT
// ============================================

// Get live shift status
router.get('/shifts/live', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Get sites managed by this supervisor
    const managedSitesResult = await db.query(
      `SELECT DISTINCT s.id FROM sites s
       WHERE s.status = 'active'
         AND (s.supervisor_id = $1 OR s.supervisor_id IS NULL OR EXISTS (
           SELECT 1 FROM supervisor_allocations sa
           WHERE sa.supervisor_id = $1
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
         ))`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ 
        shifts: [],
        alerts: [],
        stats: { total: 0, checked_in: 0, missed: 0, scheduled: 0 }
      });
    }

    const [shiftsResult, alertsResult] = await Promise.all([
      // Get today's shifts for managed sites
      db.query(`
        SELECT 
          sh.id, sh.date, sh.shift_type, sh.status, sh.check_in_time, sh.check_out_time, sh.notes,
          sh.start_time, sh.end_time, sh.hourly_rate,
          u.id as guard_id, u.full_name as guard_name, u.work_number, u.phone_number,
          s.id as site_id, s.client_name as site_name, s.location
        FROM shifts sh
        JOIN users u ON u.id = sh.guard_id
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.date = CURRENT_DATE 
          AND sh.site_id = ANY($1::uuid[])
          AND u.account_status = 'active'
        ORDER BY 
          CASE sh.shift_type WHEN 'day' THEN 1 WHEN 'night' THEN 2 END,
          sh.check_in_time ASC NULLS LAST
      `, [managedSiteIds]),

      // Get alerts for missed check-ins
      db.query(`
        SELECT 
          sh.id, sh.date, sh.shift_type, sh.status,
          u.full_name as guard_name, u.work_number, u.phone_number,
          s.client_name as site_name, s.location,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - sh.check_in_time)) / 60 as minutes_since_check_in
        FROM shifts sh
        JOIN users u ON u.id = sh.guard_id
        JOIN sites s ON s.id = sh.site_id
        WHERE sh.date = CURRENT_DATE 
          AND sh.site_id = ANY($1::uuid[])
          AND sh.status = 'scheduled'
          AND sh.check_in_time IS NULL
          AND (
            (sh.shift_type = 'day' AND CURRENT_TIME >= '08:00:00')
            OR (sh.shift_type = 'night' AND CURRENT_TIME >= '20:00:00')
          )
      `, [managedSiteIds])
    ]);

    const shifts = shiftsResult.rows;
    const alerts = alertsResult.rows;

    res.json({
      shifts,
      alerts,
      stats: {
        total: shifts.length,
        checked_in: shifts.filter(s => s.check_in_time).length,
        missed: shifts.filter(s => s.status === 'missed').length,
        scheduled: shifts.filter(s => s.status === 'scheduled').length
      }
    });
  } catch (error) {
    console.error('Get live shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch live shifts' });
  }
});

// Mark shift as missed
router.patch('/shifts/:id/missed', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { reason } = req.body;

    const result = await db.query(`
      UPDATE shifts
      SET status = 'missed', notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [reason || 'Missed check-in', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    // Create alert notification for manager
    const shift = result.rows[0];
    const managersResult = await db.query(`
      SELECT id FROM users 
      WHERE role = 'manager' AND account_status = 'active'
      LIMIT 5
    `);

    for (const manager of managersResult.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'alert', $2, $3, 'high', $4)
      `, [
        manager.id,
        'Missed Check-in Alert',
        `Guard ${shift.guard_name} missed check-in at ${shift.site_name}`,
        JSON.stringify({ shift_id: shift.id, guard_id: shift.guard_id })
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Shift Marked Missed', 'attendance', `Marked shift as missed for guard`]
    );

    res.json({ shift: result.rows[0] });
  } catch (error) {
    console.error('Mark shift missed error:', error);
    res.status(500).json({ error: 'Failed to mark shift as missed' });
  }
});

// ============================================
// NOTICE BOARD / DAILY INSTRUCTIONS
// ============================================

// Get notice board items
router.get('/notices', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

     const result = await db.query(`
      SELECT 
        n.id, n.title, n.message, n.priority, n.metadata,
        n.created_at,
        COUNT(DISTINCT nr.user_id) as read_count
      FROM notifications n
      LEFT JOIN notifications nr ON nr.user_id = n.user_id
      WHERE n.user_id = $1
        AND n.type = 'notice'
      GROUP BY n.id, n.title, n.message, n.priority, n.metadata, n.created_at
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({ notices: result.rows });
  } catch (error) {
    console.error('Get notices error:', error);
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

// Post notice to all guards
router.post('/notices', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { title, message, priority, target_roles } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const roles = target_roles || ['guard'];
    
    // Get all active users with target roles
    const usersResult = await db.query(`
      SELECT id FROM users 
      WHERE role = ANY($1::text[]) 
        AND account_status = 'active'
    `, [roles]);

    // Create notifications for all target users
    const notificationPromises = usersResult.rows.map(user =>
      db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'notice', $2, $3, $4, $5)
      `, [
        user.id,
        title,
        message,
        priority || 'medium',
        JSON.stringify({ posted_by: userId, posted_at: new Date() })
      ])
    );

    await Promise.all(notificationPromises);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.full_name, req.user.email, 'Notice Posted', 'system', `Posted notice: ${title}`]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Notice posted successfully',
      recipients: usersResult.rows.length 
    });
  } catch (error) {
    console.error('Post notice error:', error);
    res.status(500).json({ error: 'Failed to post notice' });
  }
});

// ============================================
// INCIDENT ESCALATION
// ============================================

// Get incidents for escalation
router.get('/incidents', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Get sites managed by this supervisor
    const managedSitesResult = await db.query(
      'SELECT id FROM sites WHERE supervisor_id = $1',
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    let siteFilter = '';
    const params = [];

    if (managedSiteIds.length > 0) {
      siteFilter = 'AND a.site_id = ANY($1::uuid[])';
      params.push(managedSiteIds);
    }

    const result = await db.query(`
      SELECT 
        a.id, a.issue_type, a.description, a.status, a.penalty_amount,
        a.created_at, a.updated_at, a.approved_at,
        u.full_name as guard_name, u.work_number as guard_work_number,
        s.client_name as site_name, s.location as site_location,
        reporter.full_name as reporter_name
      FROM audits a
      JOIN users u ON u.id = a.guard_id
      JOIN users reporter ON reporter.id = a.reporter_id
      JOIN sites s ON s.id = a.site_id
      WHERE a.status = 'pending' ${siteFilter}
      ORDER BY a.created_at DESC
      LIMIT 50
    `, params);

    res.json({ incidents: result.rows });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Escalate incident to manager
router.post('/incidents/:id/escalate', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user.id;

    // Get incident details
    const incidentResult = await db.query(`
      SELECT a.*, u.full_name as guard_name, s.client_name as site_name
      FROM audits a
      JOIN users u ON u.id = a.guard_id
      JOIN sites s ON s.id = a.site_id
      WHERE a.id = $1
    `, [id]);

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incident = incidentResult.rows[0];

    // Get all managers
    const managersResult = await db.query(`
      SELECT id FROM users 
      WHERE role = 'manager' AND account_status = 'active'
    `);

    // Create notifications for all managers
    const notificationPromises = managersResult.rows.map(manager =>
      db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'escalation', $2, $3, 'high', $4)
      `, [
        manager.id,
        'Incident Escalation Required',
        `Supervisor ${req.user.full_name} has escalated an incident: ${incident.issue_type} - ${incident.guard_name} at ${incident.site_name}`,
        JSON.stringify({ 
          incident_id: id, 
          guard_id: incident.guard_id,
          site_id: incident.site_id,
          escalated_by: userId,
          notes: notes || ''
        })
      ])
    );

    await Promise.all(notificationPromises);

    // Update incident status
    await db.query(`
      UPDATE audits
      SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.full_name, req.user.email, 'Incident Escalated', 'audit', `Escalated incident ${id} to manager`]
    );

    res.json({ 
      success: true, 
      message: 'Incident escalated to manager successfully',
      escalated_to: managersResult.rows.length 
    });
  } catch (error) {
    console.error('Escalate incident error:', error);
    res.status(500).json({ error: 'Failed to escalate incident' });
  }
});

// ============================================
// GUARD MANAGEMENT
// ============================================

// Get guards assigned to supervisor's sites
router.get('/guards', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Get sites managed by this supervisor
    const managedSitesResult = await db.query(
      `SELECT DISTINCT s.id FROM sites s
       WHERE s.status = 'active'
         AND (s.supervisor_id = $1 OR s.supervisor_id IS NULL OR EXISTS (
           SELECT 1 FROM supervisor_allocations sa
           WHERE sa.supervisor_id = $1
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
         ))`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ guards: [] });
    }

    const result = await db.query(`
      SELECT 
        u.id, u.work_number, u.full_name, u.email, u.phone_number,
        u.site_id, u.account_status, u.join_date,
        s.client_name as site_client, s.location as site_location,
        sh.id as today_shift_id, sh.status as today_shift_status,
        sh.shift_type as today_shift_type, sh.check_in_time as today_check_in_time,
        sh.end_time as today_end_time, sh.clock_in_method as today_clock_in_method
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN LATERAL (
        SELECT sh.*
        FROM shifts sh
        WHERE sh.guard_id = u.id AND sh.date = CURRENT_DATE
        ORDER BY CASE WHEN sh.check_in_time IS NOT NULL AND sh.end_time IS NULL THEN 0 ELSE 1 END,
          sh.check_in_time DESC NULLS LAST, sh.created_at DESC
        LIMIT 1
      ) sh ON TRUE
      WHERE u.role = 'guard'
        AND u.account_status = 'active'
        AND (
          u.site_id = ANY($1::uuid[])
          OR u.site_id IS NULL
          OR EXISTS (
            SELECT 1 FROM allocations a
            WHERE a.guard_id = u.id
              AND a.site_id = ANY($1::uuid[])
              AND a.status = 'active'
          )
          OR EXISTS (
            SELECT 1 FROM shifts assigned_shift
            WHERE assigned_shift.guard_id = u.id
              AND assigned_shift.site_id = ANY($1::uuid[])
              AND assigned_shift.status NOT IN ('cancelled', 'missed')
          )
        )
      ORDER BY u.full_name ASC
    `, [managedSiteIds]);

    res.json({ guards: result.rows });
  } catch (error) {
    console.error('Get guards error:', error);
    res.status(500).json({ error: 'Failed to fetch guards' });
  }
});

// ============================================
// DASHBOARD
// ============================================

// Get supervisor dashboard
router.get('/dashboard', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    // Get sites managed by this supervisor
    const managedSitesResult = await db.query(
      `SELECT DISTINCT s.id, s.client_name, s.location FROM sites s
       WHERE s.status = 'active'
         AND (s.supervisor_id = $1 OR s.supervisor_id IS NULL OR EXISTS (
           SELECT 1 FROM supervisor_allocations sa
           WHERE sa.supervisor_id = $1
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
         ))
       ORDER BY s.client_name`,
      [userId]
    );
    const managedSites = managedSitesResult.rows;
    const managedSiteIds = managedSites.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({
        stats: {
          totalSites: 0,
          totalGuards: 0,
          activeShifts: 0,
          pendingIncidents: 0,
          unreadNotices: 0
        },
        sites: [],
        recentIncidents: [],
        recentDocuments: []
      });
    }

    const [
      guardsResult,
      shiftsResult,
      incidentsResult,
      documentsResult,
      noticesResult
    ] = await Promise.all([
      // Total guards at managed sites
      db.query(`
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN allocations a ON a.guard_id = u.id AND a.site_id = ANY($1::uuid[]) AND a.status = 'active'
        LEFT JOIN shifts sh ON sh.guard_id = u.id AND sh.site_id = ANY($1::uuid[]) AND sh.date = CURRENT_DATE
        WHERE u.role = 'guard'
          AND u.account_status = 'active'
          AND (u.site_id = ANY($1::uuid[]) OR a.id IS NOT NULL OR sh.id IS NOT NULL)
      `, [managedSiteIds]),

      // Active shifts today
      db.query(`
        SELECT COUNT(*) as total
        FROM shifts
        WHERE date = CURRENT_DATE
          AND site_id = ANY($1::uuid[])
          AND check_in_time IS NOT NULL
          AND end_time IS NULL
      `, [managedSiteIds]),

      // Pending incidents
      db.query(`
        SELECT COUNT(*) as total
        FROM audits
        WHERE site_id = ANY($1::uuid[])
          AND status = 'pending'
      `, [managedSiteIds]),

      // Recent documents sent
      db.query(`
        SELECT COUNT(*) as total
        FROM document_transfers
        WHERE sender_id = $1
          AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      `, [userId]),

      // Unread notices
      db.query(`
        SELECT COUNT(*) as total
        FROM notifications
        WHERE user_id = $1
          AND type = 'notice'
          AND read = FALSE
      `, [userId])
    ]);

    res.json({
      stats: {
        totalSites: managedSites.length,
        totalGuards: parseInt(guardsResult.rows[0]?.total || 0),
        activeShifts: parseInt(shiftsResult.rows[0]?.total || 0),
        pendingIncidents: parseInt(incidentsResult.rows[0]?.total || 0),
        unreadNotices: parseInt(noticesResult.rows[0]?.total || 0),
        documentsSent: parseInt(documentsResult.rows[0]?.total || 0)
      },
      sites: managedSites
    });
  } catch (error) {
    console.error('Get supervisor dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor dashboard' });
  }
});

// ============================================
// MANAGED SITES VIEW (View-Only)
// ============================================

// Get all sites with currently allocated guards (view-only for supervisors)
router.get('/managed-sites', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');

    // Get all active sites with guard allocations
    const result = await db.query(`
      SELECT 
        s.id, s.site_name AS client, s.location,
        u.id as guard_id, u.full_name as guard_name,
        u.work_number as guard_work_number,
        u.shift_type,
        u.updated_at as allocation_date
      FROM sites s
      JOIN users u ON u.site_id = s.id
      WHERE s.status = 'active'
        AND u.role = 'guard'
        AND u.account_status = 'active'
      ORDER BY s.site_name ASC, u.full_name ASC
    `);

    res.json({ sites: result.rows });
  } catch (error) {
    console.error('Get managed sites error:', error);
    res.status(500).json({ error: 'Failed to fetch managed sites' });
  }
});

// ============================================
// ACTIVE & MISSED SHIFTS
// ============================================

// Get active shifts (guards currently checked in - end_time IS NULL)
router.get('/shifts/active', authenticateToken, authorize('manager', 'director', 'admin', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { area, shift_type: shiftType } = req.query;

    const managedSitesResult = await db.query(
      `SELECT DISTINCT s.id FROM sites s
       WHERE s.status = 'active'
         AND (s.supervisor_id = $1 OR s.supervisor_id IS NULL OR EXISTS (
           SELECT 1 FROM supervisor_allocations sa
           WHERE sa.supervisor_id = $1
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
         ))`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ active_shifts: [] });
    }

    // Access control: supervisors must be clocked in to view active shifts
    if (req.user.role === 'supervisor') {
      const supervisorShift = await db.query(
        `SELECT id FROM shifts WHERE guard_id = $1 AND check_in_time IS NOT NULL AND end_time IS NULL`,
        [userId]
      );
      if (supervisorShift.rows.length === 0) {
        return res.json({ active_shifts: [], supervisor_clocked_in: false });
      }
    }

    const params = [managedSiteIds];
    const filters = [];
    if (area) {
      params.push(area);
      filters.push(`(LOWER(s.location) LIKE '%' || LOWER($${params.length}) || '%' OR LOWER(s.site_name) LIKE '%' || LOWER($${params.length}) || '%')`);
    }
    if (shiftType) {
      params.push(shiftType);
      filters.push(`sh.shift_type = $${params.length}`);
    }

    const result = await db.query(`
      SELECT 
        sh.id, sh.shift_type, sh.start_time, sh.check_in_time, sh.check_out_time,
        sh.date, sh.hourly_rate, sh.clock_in_method,
        u.id as guard_id, u.full_name as guard_name, u.work_number,
        s.id as site_id, s.client_name as site_name, s.location,
        CASE 
          WHEN sh.shift_type <> 'overtime' 
            AND sh.check_in_time IS NOT NULL
            AND sh.check_in_time > (sh.start_time + INTERVAL '1 hour')
          THEN true
          ELSE false
        END as is_late,
        EXISTS (
          SELECT 1 FROM financial_ledger fl
          WHERE fl.status = 'active'
            AND fl.metadata->>'related_type' = 'late_clock_in'
            AND fl.metadata->>'shift_id' = sh.id::text
        ) as can_reverse_late_fine
      FROM shifts sh
      JOIN users u ON u.id = sh.guard_id
      JOIN sites s ON s.id = sh.site_id
      WHERE sh.site_id = ANY($1::uuid[])
        AND sh.end_time IS NULL
        AND u.account_status = 'active'
        ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
      ORDER BY COALESCE(sh.check_in_time, sh.start_time) DESC
    `, params);

    res.json({ active_shifts: result.rows, supervisor_clocked_in: true });
  } catch (error) {
    console.error('Get active shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch active shifts' });
  }
});

// Get missed/off shifts (guards on off-days, absent, or leave)
router.get('/shifts/missed-off', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const managedSitesResult = await db.query(
      `SELECT DISTINCT s.id FROM sites s
       WHERE s.status = 'active'
         AND (s.supervisor_id = $1 OR s.supervisor_id IS NULL OR EXISTS (
           SELECT 1 FROM supervisor_allocations sa
           WHERE sa.supervisor_id = $1
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
               OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%')
         ))`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ missed_off: [] });
    }

    const result = await db.query(`
      SELECT
        COALESCE(gos.id, sh.id) as id,
        COALESCE(gos.status_type, 'not_clocked_in') as status_type,
        COALESCE(gos.start_date, CURRENT_DATE) as start_date,
        gos.end_date, gos.reason,
        u.id as guard_id, u.full_name as guard_name, u.work_number, u.phone_number,
        s.id as site_id, s.client_name as site_name, s.location
      FROM users u
      LEFT JOIN sites s ON s.id = u.site_id
      LEFT JOIN LATERAL (
        SELECT sh.* FROM shifts sh
        WHERE sh.guard_id = u.id AND sh.date = CURRENT_DATE
        ORDER BY sh.created_at DESC
        LIMIT 1
      ) sh ON TRUE
      LEFT JOIN LATERAL (
        SELECT gos.* FROM guard_off_status gos
        WHERE gos.guard_id = u.id AND gos.status = 'active'
          AND gos.start_date <= CURRENT_DATE
          AND (gos.end_date IS NULL OR gos.end_date >= CURRENT_DATE)
        ORDER BY gos.start_date DESC
        LIMIT 1
      ) gos ON TRUE
      WHERE u.role = 'guard'
        AND u.account_status = 'active'
        AND (u.site_id = ANY($1::uuid[])
          OR EXISTS (SELECT 1 FROM allocations a WHERE a.guard_id = u.id AND a.site_id = ANY($1::uuid[]) AND a.status = 'active')
          OR EXISTS (SELECT 1 FROM shifts assigned_shift WHERE assigned_shift.guard_id = u.id AND assigned_shift.site_id = ANY($1::uuid[]) AND assigned_shift.date = CURRENT_DATE))
        AND (gos.id IS NOT NULL OR sh.check_in_time IS NULL)
      ORDER BY start_date DESC
    `, [managedSiteIds]);

    res.json({ missed_off: result.rows });
  } catch (error) {
    console.error('Get missed/off shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch missed/off shifts' });
  }
});

// ============================================
// OVERTIME SCHEDULING & ALLOCATION
// ============================================

// Get scheduled overtime shifts
router.get('/overtime/scheduled', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const managedSitesResult = await db.query(
      `SELECT id FROM sites
       WHERE supervisor_id = $1 OR supervisor_id IS NULL`,
      [userId]
    );
    const managedSiteIds = managedSitesResult.rows.map(s => s.id);

    if (managedSiteIds.length === 0) {
      return res.json({ overtime_shifts: [] });
    }

    const result = await db.query(`
      SELECT 
        sh.id, sh.date, sh.shift_type, sh.status, sh.start_time, sh.end_time,
        sh.hourly_rate, sh.notes, sh.overtime_reason,
        u.id as guard_id, u.full_name as guard_name, u.work_number,
        s.id as site_id, s.client_name as site_name, s.location,
        allocator.full_name as allocated_by_name
      FROM shifts sh
      JOIN users u ON u.id = sh.guard_id
      JOIN sites s ON s.id = sh.site_id
      LEFT JOIN users allocator ON allocator.id = sh.allocated_by
      WHERE sh.site_id = ANY($1::uuid[])
        AND sh.shift_type = 'overtime'
        AND sh.date >= CURRENT_DATE
        AND u.account_status = 'active'
      ORDER BY sh.date ASC, sh.start_time ASC
    `, [managedSiteIds]);

    res.json({ overtime_shifts: result.rows });
  } catch (error) {
    console.error('Get overtime shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch overtime shifts' });
  }
});

// Search guard by work number for overtime allocation
router.get('/guards/search', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ guards: [] });
    }

    const result = await db.query(`
      SELECT id, work_number, full_name, phone_number, account_status,
        last_overtime_date
      FROM users
      WHERE role = 'guard'
        AND account_status = 'active'
        AND (work_number ILIKE $1 OR full_name ILIKE $1)
      ORDER BY full_name ASC
      LIMIT 20
    `, [`%${q}%`]);

    res.json({ guards: result.rows });
  } catch (error) {
    console.error('Search guards error:', error);
    res.status(500).json({ error: 'Failed to search guards' });
  }
});

// Get uncovered sites (sites where guards are on off-day/leave/absent)
router.get('/sites/uncovered', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const result = await db.query(`
      SELECT DISTINCT
        s.id, s.client_name, s.location, s.address,
        gos.status_type as gap_reason,
        u.full_name as absent_guard_name,
        u.work_number as absent_guard_work_number
      FROM sites s
      JOIN users u ON u.site_id = s.id
      JOIN guard_off_status gos ON gos.guard_id = u.id
        AND gos.status = 'active'
        AND gos.start_date <= CURRENT_DATE
        AND (gos.end_date IS NULL OR gos.end_date >= CURRENT_DATE)
      WHERE s.status = 'active'
        AND (
          s.supervisor_id = $1
          OR s.supervisor_id IS NULL
          OR EXISTS (
            SELECT 1 FROM supervisor_allocations sa
            WHERE sa.supervisor_id = $1
              AND (
                LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER(sa.area) || '%'
                OR LOWER(COALESCE(s.client_name, '')) LIKE '%' || LOWER(sa.area) || '%'
              )
          )
        )
      ORDER BY s.client_name ASC
    `, [userId]);

    res.json({ uncovered_sites: result.rows });
  } catch (error) {
    console.error('Get uncovered sites error:', error);
    res.status(500).json({ error: 'Failed to fetch uncovered sites' });
  }
});

// ============================================
// SUPERVISOR AREA/SHIFT ALLOCATIONS
// ============================================

// Create supervisor allocation
router.post('/allocations', authenticateToken, authorize('manager', 'director'), async (req, res) => {
  let client;
  try {
    const db = req.app.get('db');
    const { supervisor_id, area, shift_type, motorcycle, motor_gear } = req.body;

    if (!supervisor_id || !area || !shift_type) {
      return res.status(400).json({ error: 'supervisor_id, area, and shift_type are required' });
    }
    if (!['town', 'nyali'].includes(area) || !['day', 'night'].includes(shift_type)) {
      return res.status(400).json({ error: 'area must be town or nyali and shift_type must be day or night' });
    }

    client = await db.connect();
    await client.query('BEGIN');

    const supervisorResult = await client.query(
      `SELECT id, full_name, role, account_status, uniform_status
       FROM users WHERE id = $1 AND role = 'supervisor' AND account_status = 'active'`,
      [supervisor_id]
    );
    if (supervisorResult.rows.length === 0) {
      const error = new Error('Active supervisor not found');
      error.statusCode = 404;
      throw error;
    }

    const result = await client.query(`
      INSERT INTO supervisor_allocations (supervisor_id, area, shift_type, motorcycle, motor_gear)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (supervisor_id)
      DO UPDATE SET
        area = EXCLUDED.area,
        shift_type = EXCLUDED.shift_type,
        motorcycle = EXCLUDED.motorcycle,
        motor_gear = EXCLUDED.motor_gear,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [supervisor_id, area, shift_type, Boolean(motorcycle), Boolean(motor_gear)]);

    const sitesResult = await client.query("SELECT id, latitude, longitude, location FROM sites WHERE status = 'active'");
    for (const site of sitesResult.rows) {
      if (classifySiteLocation(site) === area) {
        await client.query('UPDATE sites SET supervisor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [supervisor_id, site.id]);
      }
    }

    // Log audit
    await client.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Supervisor Allocation Created', 'attendance',
       `Created ${area} ${shift_type} allocation for supervisor ${supervisor_id}`]
    );

    await client.query('COMMIT');
    res.status(201).json({
      allocation: {
        ...result.rows[0],
        supervisor_name: supervisorResult.rows[0].full_name,
        uniform_status: supervisorResult.rows[0].uniform_status
      },
      message: `Allocation saved for ${supervisorResult.rows[0].full_name}`
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Create supervisor allocation error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create supervisor allocation' });
  } finally {
    if (client) client.release();
  }
});

// Get supervisor allocations
router.get('/allocations', authenticateToken, authorize('manager', 'director', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT sa.*, u.full_name as supervisor_name, u.work_number as supervisor_work_number
      FROM supervisor_allocations sa
      JOIN users u ON u.id = sa.supervisor_id
      WHERE 1=1
    `;
    const params = [];

    if (userRole === 'supervisor') {
      query += ' AND sa.supervisor_id = $1';
      params.push(userId);
    }

    query += ' ORDER BY sa.created_at DESC';

    const result = await db.query(query, params);
    const allocations = await Promise.all(result.rows.map(async (allocation) => {
      const [supervisorResult, guardsResult] = await Promise.all([
        db.query(
          `SELECT uniform_status FROM users WHERE id = $1`,
          [allocation.supervisor_id]
        ),
        db.query(
          `SELECT DISTINCT u.id, u.full_name, u.work_number, u.phone_number,
              u.uniform_status, s.id as site_id, s.site_name, s.location
           FROM users u
           JOIN sites s ON s.id = u.site_id
           WHERE u.role = 'guard' AND u.account_status = 'active'
             AND (LOWER(COALESCE(s.location, '')) LIKE '%' || LOWER($1) || '%'
               OR LOWER(COALESCE(s.site_name, '')) LIKE '%' || LOWER($1) || '%')
           ORDER BY u.full_name ASC`,
          [allocation.area]
        )
      ]);
      return {
        ...allocation,
        uniform_status: supervisorResult.rows[0]?.uniform_status || 'pending',
        guards: guardsResult.rows
      };
    }));
    res.json({ allocations });
  } catch (error) {
    console.error('Get supervisor allocations error:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor allocations' });
  }
});

// Allocate overtime to a guard for an uncovered site
router.post('/overtime/allocate', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { guard_id, site_id, date, start_time, notes } = req.body;

    if (!guard_id || !site_id) {
      return res.status(400).json({ error: 'guard_id and site_id are required' });
    }

    // Verify guard exists; overtime availability is not present in all deployed schemas.
    const guardResult = await db.query(
      'SELECT id, full_name, work_number FROM users WHERE id = $1 AND role = $2 AND account_status = $3',
      [guard_id, 'guard', 'active']
    );
    if (guardResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or inactive guard' });
    }

    // Verify site exists and is managed by this supervisor
    const siteResult = await db.query(
      `SELECT id, client_name, location FROM sites
       WHERE id = $1
         AND status = 'active'
         AND (
           supervisor_id = $2
           OR supervisor_id IS NULL
           OR id = (SELECT site_id FROM users WHERE id = $2)
           OR EXISTS (
             SELECT 1 FROM supervisor_allocations sa
             WHERE sa.supervisor_id = $2
               AND (
                 LOWER(COALESCE(location, '')) LIKE '%' || LOWER(sa.area) || '%'
                 OR LOWER(COALESCE(client_name, '')) LIKE '%' || LOWER(sa.area) || '%'
               )
           )
         )`,
      [site_id, userId]
    );
    if (siteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or unauthorized site' });
    }

    const shiftDate = date || new Date().toISOString().split('T')[0];
    const startDateTime = start_time ? new Date(`${shiftDate}T${start_time}`) : new Date(`${shiftDate}T18:00:00`);
    const endDateTime = new Date(startDateTime.getTime() + 12 * 60 * 60 * 1000);

    // Overtime is worked as the guard's night shift after the regular day shift.
    const wageRates = await getWageRates(db);
    const dailyRate = getShiftRateForRole('guard', wageRates);

    const shiftResult = await db.query(`
      INSERT INTO shifts (guard_id, site_id, date, shift_type, status, start_time, end_time, hourly_rate, daily_rate, notes, allocated_by, is_overtime, overtime_reason)
      VALUES ($1, $2, $3, 'overtime', 'scheduled', $4, $5, NULL, $6, $7, $8, TRUE, $9)
      RETURNING *
    `, [
      guard_id, site_id, shiftDate, startDateTime, endDateTime,
      dailyRate, notes || 'Overtime shift', userId,
      'Overtime allocation for uncovered site'
    ]);

    const shift = shiftResult.rows[0];

    // Also create an allocation record for cross-portal sync
    await db.query(`
      INSERT INTO allocations (guard_id, site_id, allocated_by, date, shift_type, status, notes)
      VALUES ($1, $2, $3, $4, 'overtime', 'active', $5)
      ON CONFLICT (guard_id, site_id, date, shift_type) 
      DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP
    `, [guard_id, site_id, userId, shiftDate, notes || 'Overtime allocation']);

    // Update guard's last overtime date
    await db.query(
      'UPDATE users SET last_overtime_date = $1 WHERE id = $2',
      [shiftDate, guard_id]
    );

    // Create notification for guard
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
      VALUES ($1, 'overtime', $2, $3, 'high', $4, 'guard')
    `, [
      guard_id,
      'Overtime Shift Scheduled',
      `You have been scheduled for overtime at ${siteResult.rows[0].client_name} on ${shiftDate}. Please confirm your availability.`,
      JSON.stringify({
        shift_id: shift.id,
        site_id: site_id,
        site_name: siteResult.rows[0].client_name,
        date: shiftDate,
        shift_type: 'overtime',
        start_time: startDateTime
      })
    ]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, req.user.full_name, req.user.email, 'Overtime Allocated', 'attendance',
       `Allocated overtime for guard ${guardResult.rows[0].full_name} at ${siteResult.rows[0].client_name}`]
    );

    res.status(201).json({
      shift: shift,
      message: `Overtime allocated for ${guardResult.rows[0].full_name} at ${siteResult.rows[0].client_name}`
    });
  } catch (error) {
    console.error('Allocate overtime error:', error);
    res.status(500).json({ error: 'Failed to allocate overtime' });
  }
});

module.exports = router;