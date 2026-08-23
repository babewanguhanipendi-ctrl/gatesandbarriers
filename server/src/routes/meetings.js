const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Get secretary tasks
router.get('/tasks', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { status, priority } = req.query;

    let query = `
      SELECT st.*, m.scheduled_date, m.meeting_type, m.status as meeting_status,
        r.contractor_name, r.contractor_email, r.site_location, r.security_type
      FROM secretary_tasks st
      LEFT JOIN meetings m ON m.id = st.meeting_id
      LEFT JOIN requests r ON r.id = st.request_id
      WHERE st.assigned_to = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      query += ` AND st.status = $${params.length}`;
    }
    if (priority) {
      params.push(priority);
      query += ` AND st.priority = $${params.length}`;
    }

    query += ' ORDER BY st.created_at DESC';

    const result = await db.query(query, params);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get secretary tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Update secretary task
router.patch('/tasks/:id', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { status, notes, scheduled_date, subject, body } = req.body;

    const updateFields = ['updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [];
    let paramIndex = 1;

    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      updateValues.push(notes);
      paramIndex++;
    }
    if (scheduled_date) {
      updateFields.push(`scheduled_date = $${paramIndex}`);
      updateValues.push(scheduled_date);
      paramIndex++;
    }
    if (subject) {
      updateFields.push(`subject = $${paramIndex}`);
      updateValues.push(subject);
      paramIndex++;
    }
    if (body) {
      updateFields.push(`body = $${paramIndex}`);
      updateValues.push(body);
      paramIndex++;
    }

    if (status === 'completed') {
      updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    updateValues.push(id);
    const query = `UPDATE secretary_tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, updateValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Send email for task
router.post('/tasks/:id/send-email', authenticateToken, authorize('secretary'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;

    // Get task details
    const taskResult = await db.query(`
      SELECT st.*, m.scheduled_date, m.meeting_type, m.location
      FROM secretary_tasks st
      LEFT JOIN meetings m ON m.id = st.meeting_id
      WHERE st.id = $1
    `, [id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Send email
    const emailResult = await sendEmail(db, {
      recipientEmail: task.recipient_email,
      recipientName: task.recipient_name,
      subject: task.subject,
      body: task.body,
      relatedType: 'meeting',
      relatedId: task.meeting_id,
    });

    if (!emailResult.sent) {
      return res.status(500).json({ error: `Failed to send email: ${emailResult.error || 'Unknown SMTP error'}` });
    }

    // Update task status
    await db.query(
      'UPDATE secretary_tasks SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', id]
    );

    // Update meeting email_sent flag
    if (task.meeting_id) {
      await db.query(
        'UPDATE meetings SET email_sent = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [task.meeting_id]
      );
    }

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get meetings
router.get('/', authenticateToken, authorize('director', 'secretary', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, director_id } = req.query;

    let query = `
      SELECT m.*, r.site_location, r.security_type, r.budget_estimate
      FROM meetings m
      LEFT JOIN requests r ON r.id = m.request_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND m.status = $${params.length}`;
    }
    if (director_id) {
      params.push(director_id);
      query += ` AND m.director_id = $${params.length}`;
    }

    query += ' ORDER BY m.scheduled_date DESC';

    const result = await db.query(query, params);
    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Get meeting by ID
router.get('/:id', authenticateToken, authorize('director', 'secretary', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(`
      SELECT m.*, r.site_location, r.security_type, r.budget_estimate, r.contractor_phone
      FROM meetings m
      LEFT JOIN requests r ON r.id = m.request_id
      WHERE m.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting: result.rows[0] });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

// Create meeting (triggered when director replies to request)
router.post('/', authenticateToken, authorize('director', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const {
      request_id,
      scheduled_date,
      duration_minutes,
      meeting_type,
      location,
      agenda,
      notes
    } = req.body;

    // Get request details
    const requestResult = await db.query(
      'SELECT * FROM requests WHERE id = $1',
      [request_id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Create meeting
    const meetingResult = await db.query(`
      INSERT INTO meetings (
        request_id, contractor_name, contractor_email, director_id, scheduled_date,
        duration_minutes, meeting_type, status, location, agenda, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10)
      RETURNING *
    `, [
      request_id,
      request.contractor_name,
      request.contractor_email,
      req.user.id,
      scheduled_date,
      duration_minutes || 60,
      meeting_type || 'consultation',
      location,
      agenda,
      notes
    ]);

    const meeting = meetingResult.rows[0];

    // Find a secretary to assign
    const secretaryResult = await db.query(
      "SELECT id FROM users WHERE role = 'secretary' AND account_status = 'active' LIMIT 1"
    );

    if (secretaryResult.rows.length > 0) {
      const secretaryId = secretaryResult.rows[0].id;
      meeting.secretary_id = secretaryId;

      // Update meeting with secretary
      await db.query(
        'UPDATE meetings SET secretary_id = $1 WHERE id = $2',
        [secretaryId, meeting.id]
      );

      // Create secretary task for scheduling
      const taskBody = `Please schedule a meeting with ${request.contractor_name} for ${new Date(scheduled_date).toLocaleString()}. Location: ${location || 'TBD'}. Agenda: ${agenda || 'Discussion of security services'}`;

      await db.query(`
        INSERT INTO secretary_tasks (
          meeting_id, request_id, assigned_to, task_type, priority, subject, body,
          recipient_email, recipient_name, scheduled_date
        )
        VALUES ($1, $2, $3, 'schedule_meeting', 'high', $4, $5, $6, $7, $8)
      `, [
        meeting.id,
        request_id,
        secretaryId,
        `Schedule Meeting: ${request.contractor_name}`,
        taskBody,
        request.contractor_email,
        request.contractor_name,
        scheduled_date
      ]);

      // Notify secretary
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'meeting', $2, $3, 'high', $4)
      `, [
        secretaryId,
        'New Meeting Scheduling Task',
        `Director scheduled a meeting with ${request.contractor_name}. Please confirm details and send calendar invite.`,
        JSON.stringify({ meeting_id: meeting.id, request_id })
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Meeting Created', 'system', `Created meeting with ${request.contractor_name}`]
    );

    res.status(201).json({ meeting });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Update meeting (director can reschedule)
router.patch('/:id', authenticateToken, authorize('director', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { scheduled_date, location, agenda, notes, status, reschedule_reason } = req.body;

    // Get current meeting
    const meetingResult = await db.query('SELECT * FROM meetings WHERE id = $1', [id]);
    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const meeting = meetingResult.rows[0];
    const updateFields = ['updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [];
    let paramIndex = 1;

    if (scheduled_date) {
      updateFields.push(`scheduled_date = $${paramIndex}`);
      updateValues.push(scheduled_date);
      paramIndex++;
    }
    if (location !== undefined) {
      updateFields.push(`location = $${paramIndex}`);
      updateValues.push(location);
      paramIndex++;
    }
    if (agenda !== undefined) {
      updateFields.push(`agenda = $${paramIndex}`);
      updateValues.push(agenda);
      paramIndex++;
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex}`);
      updateValues.push(notes);
      paramIndex++;
    }
    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }
    if (reschedule_reason) {
      updateFields.push(`reschedule_reason = $${paramIndex}`);
      updateValues.push(reschedule_reason);
      updateFields.push(`original_date = COALESCE(original_date, scheduled_date)`);
      updateFields.push(`status = 'rescheduled'`);
      paramIndex++;
    }

    updateValues.push(id);
    const query = `UPDATE meetings SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    const result = await db.query(query, updateValues);
    const updatedMeeting = result.rows[0];

    // If rescheduled, create task for secretary to send reschedule email
    if (reschedule_reason && meeting.secretary_id) {
      const emailBody = `Dear ${meeting.contractor_name},\n\nWe need to reschedule our meeting originally set for ${new Date(meeting.scheduled_date).toLocaleString()}.\n\nNew Meeting Details:\nDate/Time: ${new Date(scheduled_date).toLocaleString()}\nLocation: ${location || meeting.location || 'TBD'}\n\nReason for rescheduling: ${reschedule_reason}\n\nWe apologize for any inconvenience and look forward to meeting with you.\n\nBest regards,\n${req.user.full_name}`;

      await db.query(`
        INSERT INTO secretary_tasks (
          meeting_id, request_id, assigned_to, task_type, priority, subject, body,
          recipient_email, recipient_name, scheduled_date
        )
        VALUES ($1, $2, $3, 'send_reschedule', 'urgent', $4, $5, $6, $7, $8)
      `, [
        meeting.id,
        meeting.request_id,
        meeting.secretary_id,
        `Reschedule Notification: ${meeting.contractor_name}`,
        emailBody,
        meeting.contractor_email,
        meeting.contractor_name,
        scheduled_date
      ]);

      // Notify secretary
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'meeting', $2, $3, 'urgent', $4)
      `, [
        meeting.secretary_id,
        'Meeting Rescheduled - Action Required',
        `Meeting with ${meeting.contractor_name} has been rescheduled. Please send reschedule notification email.`,
        JSON.stringify({ meeting_id: meeting.id, new_date: scheduled_date })
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Meeting Updated', 'system', `Updated meeting ${meeting.id}`]
    );

    res.json({ meeting: updatedMeeting });
  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// Get director's meetings
router.get('/director/my-meetings', authenticateToken, authorize('director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(`
      SELECT m.*, r.site_location, r.security_type
      FROM meetings m
      LEFT JOIN requests r ON r.id = m.request_id
      WHERE m.director_id = $1
      ORDER BY m.scheduled_date DESC
    `, [req.user.id]);

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get director meetings error:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

module.exports = router;