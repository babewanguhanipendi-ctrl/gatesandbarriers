const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const { sendEmail, sendRoleEmail } = require('../utils/email');

const router = express.Router();
const REQUEST_SELECT = 'id, contractor_name, contractor_email, contractor_phone, site_location, property_type, coverage_hours, guards_needed, entry_points, risk_notes, security_type, budget_estimate, status, assigned_role, email_confirmed_at, reply_subject, reply_body, replied_at, forwarded_at, notes, created_at, updated_at';

async function queueEmail(db, { recipientEmail, recipientName, subject, body, relatedType, relatedId, required = false }) {
  return sendEmail(db, { recipientEmail, recipientName, subject, body, relatedType, relatedId, required });
}

async function notifyRole(db, role, { title, message, type, priority = 'high', metadata = {} }) {
  const users = await db.query("SELECT id FROM users WHERE role = $1 AND account_status = 'active'", [role]);
  for (const user of users.rows) {
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, type, title, message, priority, JSON.stringify(metadata || {})]
    );
  }
}

router.post('/', [
  body('contractor_name').notEmpty().trim(),
  body('contractor_email').isEmail().normalizeEmail(),
  body('site_location').notEmpty().trim(),
  body('property_type').notEmpty().trim(),
  body('coverage_hours').notEmpty().trim(),
  body('guards_needed').notEmpty().trim(),
  body('security_type').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { 
      contractor_name, 
      contractor_email, 
      contractor_phone, 
      site_location, 
      property_type, 
      coverage_hours, 
      guards_needed, 
      entry_points, 
      risk_notes, 
      security_type, 
      budget_estimate 
    } = req.body;
    const db = req.app.get('db');
    
    // Construct site_details from structured fields for backward compatibility
    const site_details = `Location: ${site_location}\nProperty Type: ${property_type}\nCoverage Hours: ${coverage_hours}\nGuards Needed: ${guards_needed}\nEntry Points: ${entry_points || 'Not specified'}\nRisk Notes: ${risk_notes || 'None provided'}`;
    
    const result = await db.query(
      `INSERT INTO requests (contractor_name, contractor_email, contractor_phone, site_details, site_location, property_type, coverage_hours, guards_needed, entry_points, risk_notes, security_type, budget_estimate, assigned_role, email_confirmed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'director', CURRENT_TIMESTAMP)
       RETURNING ${REQUEST_SELECT}`,
       [
         contractor_name, 
         contractor_email, 
         contractor_phone || null, 
         site_details,
         site_location, 
         property_type, 
         coverage_hours, 
         guards_needed, 
         entry_points || null, 
         risk_notes || null, 
         security_type, 
         budget_estimate || null
       ]
    );
    const request = result.rows[0];

    // Send confirmation email to applicant
    await queueEmail(db, {
      recipientEmail: contractor_email,
      recipientName: contractor_name,
      subject: 'Security service request received',
      body: `Hello ${contractor_name},\n\nThank you for your interest in GB Security Services. We have received your request for ${security_type}.\n\nHere are the details you submitted:\n- Location: ${site_location}\n- Property Type: ${property_type}\n- Coverage Hours: ${coverage_hours}\n- Guards Needed: ${guards_needed}\n- Security Type: ${security_type}\n\nOur director will review your request and get back to you soon with the next steps.\n\nWe'll get back to you soon!\n\nBest regards,\nGates & Barriers Security Team`,
      relatedType: 'contractor_request',
      relatedId: request.id,
    });

    // Send detailed notification email to company (mme77225@gmail.com)
    const companyEmailBody = `New Contractor Bid Submission\n\n=== Contractor Information ===\nName: ${contractor_name}\nEmail: ${contractor_email}\nPhone: ${contractor_phone || 'Not provided'}\n\n=== Site Specifications ===\nLocation: ${site_location}\nProperty Type: ${property_type}\nCoverage Hours: ${coverage_hours}\nNumber of Guards Needed: ${guards_needed}\nEntry Points: ${entry_points || 'Not specified'}\nRisk Notes: ${risk_notes || 'None provided'}\n\n=== Security Requirements ===\nSecurity Type: ${security_type}\nBudget Estimate: ${budget_estimate ? 'KES ' + budget_estimate : 'Not provided'}\n\n=== Request Details ===\nRequest ID: ${request.id}\nSubmitted: ${request.created_at}\nStatus: ${request.status}\n\nPlease review this request and assign to the appropriate team member.`;
    
    await queueEmail(db, {
      recipientEmail: 'mme77225@gmail.com',
      recipientName: 'Gates & Barriers',
      subject: 'New Contractor Bid Submission - Action Required',
      body: companyEmailBody,
      relatedType: 'contractor_request_director',
      relatedId: request.id,
      required: true,
    });

    // Also send to director role users in the system
    await sendRoleEmail(db, 'director', {
      subject: 'New contractor security request',
      body: companyEmailBody,
      relatedType: 'contractor_request_director',
      relatedId: request.id,
    });

    await notifyRole(db, 'director', {
      title: 'New contractor request',
      message: `${contractor_name} requested ${security_type}.`,
      type: 'contractor_request',
      metadata: {
        entity_type: 'request',
        entity_id: request.id,
        request_id: request.id,
        action_type: 'reply',
        link_url: '/director/requests',
        reply_allowed: true,
        reply_url: '/director/requests',
        requester_name: contractor_name,
        created_at: request.created_at
      },
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [null, contractor_name, contractor_email, 'Contractor Request Submitted', 'user_management', 'New contractor request assigned to director']
    );

    res.status(201).json({ message: 'Request submitted successfully', request });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

router.get('/', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, assigned_role } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (assigned_role) { params.push(assigned_role); where.push(`assigned_role = $${params.length}`); }
    let query = `SELECT ${REQUEST_SELECT} FROM requests`;
    if (where.length) query += ` WHERE ${where.join(' AND ')}`;
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.get('/:id', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(`SELECT ${REQUEST_SELECT} FROM requests WHERE id = $1`, [req.params.id]);
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ request });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

router.put('/:id', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, notes } = req.body;
    const result = await db.query(
      `UPDATE requests SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING ${REQUEST_SELECT}`,
      [status, notes, req.params.id]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json({ request });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

router.post('/:id/forward', authenticateToken, authorize('director', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    if ((req.body.assigned_role || 'manager') !== 'manager') {
      return res.status(400).json({ error: 'Contractor requests can only be forwarded to Manager' });
    }
    const result = await db.query(
      `UPDATE requests SET assigned_role = 'manager', status = 'reviewed', forwarded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${REQUEST_SELECT}`,
      [req.params.id]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });
    await notifyRole(db, 'manager', {
      title: 'Contractor request forwarded',
      message: `${request.contractor_name}'s security request was forwarded by the director.`,
      type: 'contractor_request_forwarded',
      metadata: { request_id: request.id },
    });

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Request Forwarded to Manager', 'system', `Forwarded contractor request #${request.id} for ${request.contractor_name} to manager`]
    );

    res.json({ request });
  } catch (error) {
    console.error('Forward request error:', error);
    res.status(500).json({ error: 'Failed to forward request' });
  }
});

router.post('/:id/reply', authenticateToken, authorize('director', 'manager', 'admin'), [
  body('subject').notEmpty().trim(),
  body('body').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const db = req.app.get('db');
    const { subject, body: replyBody, schedule_meeting, meeting_date, meeting_location, meeting_agenda } = req.body;
    
    const result = await db.query(
      `UPDATE requests SET reply_subject = $1, reply_body = $2, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING ${REQUEST_SELECT}`,
      [subject, replyBody, req.params.id]
    );
    const request = result.rows[0];
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Send reply email to contractor
    await queueEmail(db, {
      recipientEmail: request.contractor_email,
      recipientName: request.contractor_name,
      subject,
      body: replyBody,
      relatedType: 'contractor_request',
      relatedId: request.id,
    });

    // If director wants to schedule a meeting, create meeting and task
    if (schedule_meeting && meeting_date) {
      try {
        // Create meeting
        const meetingResult = await db.query(`
          INSERT INTO meetings (
            request_id, contractor_name, contractor_email, director_id, scheduled_date,
            duration_minutes, meeting_type, status, location, agenda
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'consultation', 'pending', $7, $8)
          RETURNING *
        `, [
          request.id,
          request.contractor_name,
          request.contractor_email,
          req.user.id,
          meeting_date,
          60,
          meeting_location || 'Office',
          meeting_agenda || 'Discussion of security services'
        ]);

        const meeting = meetingResult.rows[0];

        // Find a secretary to assign
        const secretaryResult = await db.query(
          "SELECT id FROM users WHERE role = 'secretary' AND account_status = 'active' LIMIT 1"
        );

        if (secretaryResult.rows.length > 0) {
          const secretaryId = secretaryResult.rows[0].id;

          // Update meeting with secretary
          await db.query(
            'UPDATE meetings SET secretary_id = $1 WHERE id = $2',
            [secretaryId, meeting.id]
          );

          // Create secretary task for scheduling
          const taskBody = `Please schedule a meeting with ${request.contractor_name} for ${new Date(meeting_date).toLocaleString()}. Location: ${meeting_location || 'TBD'}. Agenda: ${meeting_agenda || 'Discussion of security services'}\n\nDirector's message: ${replyBody}`;

          await db.query(`
            INSERT INTO secretary_tasks (
              meeting_id, request_id, assigned_to, task_type, priority, subject, body,
              recipient_email, recipient_name, scheduled_date
            )
            VALUES ($1, $2, $3, 'schedule_meeting', 'high', $4, $5, $6, $7, $8)
          `, [
            meeting.id,
            request.id,
            secretaryId,
            `Schedule Meeting: ${request.contractor_name}`,
            taskBody,
            request.contractor_email,
            request.contractor_name,
            meeting_date
          ]);

          // Notify secretary
          await db.query(`
            INSERT INTO notifications (user_id, type, title, message, priority, metadata)
            VALUES ($1, 'meeting', $2, $3, 'high', $4)
          `, [
            secretaryId,
            'New Meeting Scheduling Task',
            `Director scheduled a meeting with ${request.contractor_name}. Please confirm details and send calendar invite.`,
            JSON.stringify({ meeting_id: meeting.id, request_id: request.id })
          ]);
        }

        // Log audit
        await db.query(
          'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
          [req.user.id, req.user.full_name, req.user.email, 'Meeting Created', 'system', `Created meeting with ${request.contractor_name} from request reply`]
        );

        res.json({ 
          request,
          meeting: meeting,
          message: 'Reply sent and meeting scheduled successfully'
        });
      } catch (meetingError) {
        console.error('Meeting creation error:', meetingError);
        // Still return success for the reply, but note the meeting error
        res.json({ 
          request,
          warning: 'Reply sent but meeting scheduling failed',
          error: meetingError.message
        });
      }
    } else {
      // Log audit for reply without meeting
      await db.query(
        'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.user.id, req.user.full_name, req.user.email, 'Request Reply Sent', 'system', `Replied to contractor request #${request.id} for ${request.contractor_name}: ${subject}`]
      );
      res.json({ request });
    }
  } catch (error) {
    console.error('Reply request error:', error);
    res.status(500).json({ error: 'Failed to queue reply' });
  }
});

router.delete('/:id', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    await db.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

module.exports = router;

