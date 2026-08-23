const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Get uniform allocation requests
router.get('/uniform-requests', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    
    // Use a query that works with both old and new schema
    const result = await db.query(`
      SELECT 
        ui.id, ui.application_id, ui.guard_id, ui.full_name, ui.status,
        ui.issued_at, ui.created_at,
        a.email, a.phone,
        u.full_name as guard_name, u.work_number
      FROM uniform_issues ui
      LEFT JOIN applications a ON a.id = ui.application_id
      LEFT JOIN users u ON u.id = ui.guard_id
      WHERE ui.status = 'pending'
      ORDER BY ui.created_at DESC
    `);

    // Transform the data to include uniform items (default to false if columns don't exist)
    const uniformRequests = result.rows.map(row => ({
      ...row,
      request_type: row.request_type || 'guard',
      requester_name: row.requester_name || null,
      shirt: row.shirt ?? true,
      rungu: row.rungu ?? true,
      rungu_holder: row.rungu_holder ?? true,
      trouser: row.trouser ?? true,
      belt: row.belt ?? true,
      whistle: row.whistle ?? true,
      shoes: row.shoes ?? false,
      raincoat: row.raincoat ?? false,
      torch: row.torch ?? false
    }));

    res.json({ uniformRequests });
  } catch (error) {
    console.error('Get uniform requests error:', error);
    res.status(500).json({ error: 'Failed to fetch uniform requests' });
  }
});

// Create uniform request (for newly hired guards)
router.post('/uniform-requests', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { application_id, guard_id, full_name, request_type, requester_id, requester_name, items } = req.body;

    // Check if the new columns exist before using them
    const hasNewColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'uniform_issues' AND column_name IN ('shirt', 'rungu', 'rungu_holder', 'trouser', 'belt', 'whistle', 'shoes', 'raincoat', 'torch', 'request_type', 'requester_id', 'requester_name')
    `);
    
    const columnNames = hasNewColumns.rows.map(r => r.column_name);
    const hasItemColumns = columnNames.includes('shirt');

    let result;
    if (hasItemColumns) {
      // Use new schema with item columns
      result = await db.query(`
        INSERT INTO uniform_issues (
          application_id, guard_id, full_name, status, request_type, requester_id, requester_name,
          shirt, rungu, rungu_holder, trouser, belt, whistle, shoes, raincoat, torch
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        application_id || null, 
        guard_id || null, 
        full_name,
        request_type || 'guard',
        requester_id || null,
        requester_name || null,
        items?.shirt ?? false,
        items?.rungu ?? false,
        items?.rungu_holder ?? false,
        items?.trouser ?? false,
        items?.belt ?? false,
        items?.whistle ?? false,
        items?.shoes ?? false,
        items?.raincoat ?? false,
        items?.torch ?? false
      ]);
    } else {
      // Use old schema without item columns
      result = await db.query(`
        INSERT INTO uniform_issues (
          application_id, guard_id, full_name, status
        )
        VALUES ($1, $2, $3, 'pending')
        RETURNING *
      `, [
        application_id || null, 
        guard_id || null, 
        full_name
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Uniform Request Created', 'uniform', `Created uniform request for ${full_name}`]
    );

    res.json({ uniformRequest: result.rows[0] });
  } catch (error) {
    console.error('Create uniform request error:', error);
    res.status(500).json({ error: 'Failed to create uniform request' });
  }
});

// Update uniform request status
router.patch('/uniform-requests/:id', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { status, items } = req.body;

    // Check if the new columns exist
    const hasNewColumns = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'uniform_issues' AND column_name = 'shirt'
    `);
    
    const hasItemColumns = hasNewColumns.rows.length > 0;

    let result;
    if (hasItemColumns && items) {
      // Build dynamic update query based on provided fields
      let updateFields = ['status = $1'];
      let updateValues = [status];
      let paramIndex = 2;

      const itemFields = ['shirt', 'rungu', 'rungu_holder', 'trouser', 'belt', 'whistle', 'shoes', 'raincoat', 'torch'];
      itemFields.forEach(field => {
        if (items[field] !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(items[field]);
          paramIndex++;
        }
      });

      updateValues.push(id);

      result = await db.query(`
        UPDATE uniform_issues
        SET ${updateFields.join(', ')}, issued_at = CURRENT_TIMESTAMP, issued_by = $${paramIndex}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex + 1}
        RETURNING *
      `, [...updateValues, req.user.id, id]);
    } else {
      // Use old schema
      result = await db.query(`
        UPDATE uniform_issues
        SET status = $1, issued_at = CURRENT_TIMESTAMP, issued_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [status, req.user.id, id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Uniform request not found' });
    }

    // If uniform is issued, update the user's uniform_status
    if (status === 'issued') {
      const uniformRequest = result.rows[0];
      if (uniformRequest.guard_id) {
        await db.query(
          'UPDATE users SET uniform_status = $1 WHERE id = $2',
          ['complete', uniformRequest.guard_id]
        );
      }
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Uniform Request Updated', 'uniform', `Updated uniform request status to ${status}`]
    );

    res.json({ uniformRequest: result.rows[0] });
  } catch (error) {
    console.error('Update uniform request error:', error);
    res.status(500).json({ error: 'Failed to update uniform request' });
  }
});

// Get requests with director replies
router.get('/contracts', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const result = await db.query(`
      SELECT 
        r.id, r.contractor_name, r.contractor_email, r.contractor_phone,
        r.site_location, r.property_type, r.coverage_hours, r.guards_needed,
        r.security_type, r.budget_estimate, r.status,
        r.reply_subject, r.reply_body, r.replied_at,
        r.created_at, r.updated_at,
        m.id as meeting_id, m.scheduled_date, m.meeting_type, m.status as meeting_status,
        m.location as meeting_location, m.agenda as meeting_agenda, m.email_sent
      FROM requests r
      LEFT JOIN meetings m ON m.request_id = r.id
      WHERE r.reply_subject IS NOT NULL 
        AND r.reply_body IS NOT NULL
        AND r.replied_at IS NOT NULL
      ORDER BY r.replied_at DESC
    `);

    res.json({ contracts: result.rows });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Send email to client
router.post('/contracts/:id/send-email', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { subject, body, meeting_date, meeting_location } = req.body;

    // Get request details
    const requestResult = await db.query(
      'SELECT * FROM requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Use provided subject/body or fall back to request's reply
    const emailSubject = subject || request.reply_subject;
    const emailBody = body || request.reply_body;

    // Append meeting details if provided
    let finalBody = emailBody;
    if (meeting_date) {
      finalBody += `\n\n=== Meeting Scheduled ===\n`;
      finalBody += `Date/Time: ${new Date(meeting_date).toLocaleString()}\n`;
      if (meeting_location) {
        finalBody += `Location: ${meeting_location}\n`;
      }
    }

    // Send the email via SMTP
    const emailResult = await sendEmail(db, {
      recipientEmail: request.contractor_email,
      recipientName: request.contractor_name,
      subject: emailSubject,
      body: finalBody,
      relatedType: 'contractor_request',
      relatedId: id,
    });

    if (!emailResult.sent) {
      return res.status(500).json({ error: `Failed to send email: ${emailResult.error || 'Unknown SMTP error'}` });
    }

    // Update request to mark as forwarded
    await db.query(
      'UPDATE requests SET forwarded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // If meeting details provided, create/update meeting
    if (meeting_date) {
      const meetingResult = await db.query(`
        INSERT INTO meetings (
          request_id, contractor_name, contractor_email, director_id, secretary_id,
          scheduled_date, meeting_type, status, location, agenda, email_sent
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'consultation', 'confirmed', $7, $8, TRUE)
        ON CONFLICT (request_id) DO UPDATE
        SET scheduled_date = $6, location = $7, agenda = $8, email_sent = TRUE, updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        id,
        request.contractor_name,
        request.contractor_email,
        null, // director_id not known at this point
        req.user.id,
        meeting_date,
        meeting_location,
        request.reply_body
      ]);

      const meeting = meetingResult.rows[0];

      // Create secretary task for tracking
      await db.query(`
        INSERT INTO secretary_tasks (
          meeting_id, request_id, assigned_to, task_type, priority, subject, body,
          recipient_email, recipient_name, status, scheduled_date
        )
        VALUES ($1, $2, $3, 'send_confirmation', 'high', $4, $5, $6, $7, 'completed', $8)
      `, [
        meeting.id,
        id,
        req.user.id,
        `Meeting Confirmation: ${request.contractor_name}`,
        finalBody,
        request.contractor_email,
        request.contractor_name,
        meeting_date
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Contract Reply Emailed', 'document', `Sent director reply to ${request.contractor_name} for request #${id}`]
    );

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get Secretary Dashboard
router.get('/dashboard', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;

    const [
      uniformRequestsResult,
      documentsResult,
      guardsResult
    ] = await Promise.all([
      // Pending uniform requests
      db.query(
        'SELECT COUNT(*) as count FROM uniform_issues WHERE status = $1',
        ['pending']
      ),

      // Recent documents
      db.query(
        'SELECT COUNT(*) as count FROM document_transfers WHERE recipient_role = $1 AND created_at >= CURRENT_DATE - INTERVAL \'7 days\'',
        ['secretary']
      ),

      // Total guards
      db.query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1 AND account_status = $2',
        ['guard', 'active']
      )
    ]);

    res.json({
      stats: {
        pendingUniformRequests: parseInt(uniformRequestsResult.rows[0]?.count || 0),
        documentsReceived: parseInt(documentsResult.rows[0]?.count || 0),
        totalGuards: parseInt(guardsResult.rows[0]?.count || 0)
      }
    });
  } catch (error) {
    console.error('Get secretary dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch secretary dashboard' });
  }
});

// ============================================
// COMPANY SCHEDULES (Secretary Access)
// ============================================

// Get all company schedules (secretary view)
router.get('/schedules', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'all', event_type = 'all', start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ` AND cs.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (event_type !== 'all') {
      whereClause += ` AND cs.event_type = $${queryParams.length + 1}`;
      queryParams.push(event_type);
    }

    if (start_date) {
      whereClause += ` AND cs.event_date >= $${queryParams.length + 1}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND cs.event_date <= $${queryParams.length + 1}`;
      queryParams.push(end_date);
    }

    const schedulesResult = await db.query(`
      SELECT 
        cs.*,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM company_schedules cs
      LEFT JOIN users u ON cs.created_by = u.id
      ${whereClause}
      ORDER BY cs.event_date ASC, cs.start_time ASC
    `, queryParams);

    res.json({ schedules: schedulesResult.rows });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// ============================================
// COMPANY SCHEDULES CRUD (Secretary)
// ============================================

// Create new schedule
router.post('/schedules', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      venue,
      event_type,
      priority,
      target_audience,
      notify_all,
      notes
    } = req.body;

    if (!title || !event_date || !start_time || !end_time || !venue) {
      return res.status(400).json({ error: 'Title, event date, start time, end time, and venue are required' });
    }

    // Validate time range
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Prevent concurrent meetings: no two events may run at overlapping times on the same date
    const conflictResult = await db.query(`
      SELECT id, title, start_time, end_time
      FROM company_schedules
      WHERE event_date = $1::date
        AND status NOT IN ('cancelled', 'postponed')
        AND start_time < $3::time
        AND end_time > $2::time
      LIMIT 1
    `, [event_date, start_time, end_time]);

    if (conflictResult.rows.length > 0) {
      const conflict = conflictResult.rows[0];
      return res.status(409).json({
        error: `Time conflict: "${conflict.title}" is already scheduled from ${conflict.start_time} to ${conflict.end_time} on this date. No two meetings can run concurrently.`,
        conflict
      });
    }

    const result = await db.query(`
      INSERT INTO company_schedules (
        title, description, event_date, start_time, end_time, venue,
        event_type, priority, status, created_by, target_audience, notify_all, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      title,
      description || null,
      event_date,
      start_time,
      end_time,
      venue,
      event_type || 'meeting',
      priority || 'medium',
      'scheduled',
      req.user.id,
      target_audience || 'all',
      notify_all || false,
      notes || null
    ]);

    const schedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Created', 'system', 
        `Created company schedule: ${title} on ${event_date}`]
    );

    res.status(201).json({ 
      success: true, 
      schedule,
      message: 'Schedule created successfully'
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/schedules/:id', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      venue,
      event_type,
      priority,
      status,
      target_audience,
      notify_all,
      notes
    } = req.body;

    // Validate time range
    if (start_time && end_time && start_time >= end_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Prevent concurrent meetings when rescheduling (exclude the schedule being updated)
    if (event_date && start_time && end_time) {
      const conflictResult = await db.query(`
        SELECT id, title, start_time, end_time
        FROM company_schedules
        WHERE event_date = $1::date
          AND id <> $2::uuid
          AND status NOT IN ('cancelled', 'postponed')
          AND start_time < $4::time
          AND end_time > $3::time
        LIMIT 1
      `, [event_date, id, start_time, end_time]);

      if (conflictResult.rows.length > 0) {
        const conflict = conflictResult.rows[0];
        return res.status(409).json({
          error: `Time conflict: "${conflict.title}" is already scheduled from ${conflict.start_time} to ${conflict.end_time} on this date. No two meetings can run concurrently.`,
          conflict
        });
      }
    }

    const result = await db.query(`
      UPDATE company_schedules
      SET title = $1,
          description = $2,
          event_date = $3,
          start_time = $4,
          end_time = $5,
          venue = $6,
          event_type = $7,
          priority = $8,
          status = $9,
          target_audience = $10,
          notify_all = $11,
          notes = $12,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      title,
      description || null,
      event_date,
      start_time,
      end_time,
      venue,
      event_type || 'meeting',
      priority || 'medium',
      status || 'scheduled',
      target_audience || 'all',
      notify_all ?? false,
      notes || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Updated', 'system', 
        `Updated company schedule: ${title} (ID: ${id})`]
    );

    res.json({ 
      success: true, 
      schedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/schedules/:id', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;

    const result = await db.query('DELETE FROM company_schedules WHERE id = $1 RETURNING id, title', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const deletedSchedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Deleted', 'system', 
        `Deleted company schedule: ${deletedSchedule.title} (ID: ${id})`]
    );

    res.json({ 
      success: true, 
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

module.exports = router;
