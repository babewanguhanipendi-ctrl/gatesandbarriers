const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize, hashPassword, createToken } = require('../middleware/auth');
const { sendEmail, sendRoleEmail } = require('../utils/email');
const { isDeductionExempt } = require('../config/wages');

const getClientUrl = (req) => {
  const configured = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const corsOrigin = (process.env.CORS_ORIGIN || '').split(',')[0]?.trim().replace(/\/$/, '');
  return corsOrigin || `${req.protocol}://${req.get('host')}`;
};

const router = express.Router();
const APPLICATION_SELECT = 'id, full_name, email, phone, position, experience, message, status, assigned_role, work_number, reply_subject, reply_body, replied_at, forwarded_at, notes, contract_document_url, created_at, updated_at';
const STAFF_ROLES = ['admin', 'director', 'manager', 'supervisor', 'secretary', 'guard'];

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
  body('full_name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('phone').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, email, phone, experience, message } = req.body;
    const db = req.app.get('db');
    const result = await db.query(
      `INSERT INTO applications (full_name, email, phone, position, experience, message, assigned_role)
       VALUES ($1, $2, $3, 'guard', $4, $5, 'manager')
       RETURNING ${APPLICATION_SELECT}`,
      [full_name, email, phone, experience || null, message || null]
    );
    const application = result.rows[0];

    await notifyRole(db, 'manager', {
      title: 'New guard application',
      message: `${full_name} applied for guard work.`,
      type: 'guard_application',
      metadata: {
        entity_type: 'application',
        entity_id: application.id,
        action_type: 'review',
        link_url: '/manager/applicants',
        reply_allowed: true,
        reply_url: '/manager/applicants',
        application_id: application.id,
        applicant_name: full_name,
        applicant_email: email
      },
    });

    await sendRoleEmail(db, 'manager', {
      subject: 'New guard application',
      body: `New guard application\n\nApplicant: ${full_name}\nEmail: ${email}\nPhone: ${phone}\nExperience: ${experience || 'Not provided'}\n\nMessage:\n${message || 'Not provided'}`,
      relatedType: 'guard_application_manager',
      relatedId: application.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [null, full_name, email, 'Guard Application Submitted', 'user_management', 'New guard application assigned to manager']
    );

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

router.get('/', authenticateToken, authorize('manager', 'secretary', 'director', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, assigned_role } = req.query;
    const params = [];
    const where = [];
    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (assigned_role) { params.push(assigned_role); where.push(`assigned_role = $${params.length}`); }
    let query = `SELECT ${APPLICATION_SELECT} FROM applications`;
    if (where.length) query += ` WHERE ${where.join(' AND ')}`;
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

router.put('/:id', authenticateToken, authorize('manager', 'secretary', 'director', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, notes, assigned_role, contract_document_url } = req.body;

    // Get the application first
    const appResult = await db.query(`SELECT * FROM applications WHERE id = $1`, [req.params.id]);
    const application = appResult.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Update the application
    const updateFields = ['status = COALESCE($1, status)', 'notes = COALESCE($2, notes)', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [status, notes];
    let paramIndex = 3;

    // Handle contract document URL update
    if (contract_document_url !== undefined) {
      updateFields.push(`contract_document_url = $${paramIndex}`);
      updateParams.push(contract_document_url);
      paramIndex++;
    }

    // If status is changed to 'hired', auto-create user account
    if (status === 'hired' && application.status !== 'hired') {
      const role = assigned_role || application.assigned_role || 'guard';
      
      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 OR work_number = $2',
        [application.email, `GBG-${String(application.id).padStart(3, '0')}`]
      );
      
      if (existingUser.rows.length === 0) {
        // Generate unique work number with format: GBG-XXX (uppercase, range 501-2000)
        // Get the next sequential number for guards
        const workNumberQuery = await db.query(
          `SELECT work_number FROM allocated_work_numbers 
           WHERE work_number LIKE $1 
           ORDER BY work_number DESC 
           LIMIT 1`,
          ['GBG-%']
        );
        
        let nextNumber = 501;
        if (workNumberQuery.rows.length > 0) {
          const lastWorkNumber = workNumberQuery.rows[0].work_number;
          const match = lastWorkNumber.match(/GBG-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        
        // Ensure we don't exceed the maximum
        if (nextNumber > 2000) {
          return res.status(400).json({ error: 'No available work numbers for guards. Maximum limit reached.' });
        }
        
        const workNumber = `GBG-${String(nextNumber).padStart(3, '0')}`;
        const tempPassword = createToken();
        const password_hash = await hashPassword(tempPassword);

        // Create user account
        const userResult = await db.query(
          `INSERT INTO users (email, password_hash, full_name, role, work_number, phone_number, account_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, email, full_name, role, work_number, phone_number, account_status, join_date`,
          [application.email, password_hash, application.full_name, role, workNumber, application.phone, 'active']
        );

        const newUser = userResult.rows[0];

        // Allocate work number in the ledger
        await db.query(
          'INSERT INTO allocated_work_numbers (work_number, user_id, role) VALUES ($1, $2, $3)',
          [workNumber, newUser.id, role]
        );

        // Automatic uniform allocation for guards and supervisors
        // DEDUCTION EXEMPTION: Supervisors are strictly exempt from ALL uniform/gear/equipment
        // deductions - no active deduction ledger entry is ever created for them.
        const deductionExempt = isDeductionExempt(role);
        if (role === 'guard' || role === 'supervisor') {
          // Create uniform record (zero deduction for exempt roles)
          await db.query(`
            INSERT INTO uniforms (guard_id, monthly_deduction, total_deductions, deductions_remaining, is_complete, issued_at)
            VALUES ($1, $2, 0.00, 0.00, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (guard_id) DO NOTHING
          `, [newUser.id, deductionExempt ? 0.00 : 300.00, deductionExempt]);

          // Define uniform items based on role
          const compulsoryItems = role === 'supervisor'
            ? ['Shirt', 'Trouser', 'Belt', 'Whistle', 'Shoes']
            : ['Shirt', 'Trouser', 'Belt', 'Whistle', 'Rungu', 'Rungu Holder'];

          // Create uniform request items as disbursed
          const uniformInsertPromises = compulsoryItems.map(itemName => {
            return db.query(`
              INSERT INTO uniform_requests (guard_id, item_name, status, requested_at, delivery_status)
              VALUES ($1, $2, 'disbursed', CURRENT_TIMESTAMP, 'delivered')
              ON CONFLICT DO NOTHING
            `, [newUser.id, itemName]).catch(() => {});
          });

          // Create financial ledger entry for uniform deductions (guards only).
          // Supervisors are exempt - zero uniform/gear/equipment deductions.
          if (!deductionExempt) {
            const uniformCost = 3000.00;
            const installmentCount = 3;
            const itemDescription = 'Compulsory uniform set (Shirt, Trouser, Belt, Whistle, Rungu, Rungu Holder) - KES 1000/month for 3 months';

            await db.query(`
              INSERT INTO financial_ledger (guard_id, type, amount, status, installment_count, description)
              VALUES ($1, 'uniform', $2, 'active', $3, $4)
              ON CONFLICT DO NOTHING
            `, [newUser.id, uniformCost, installmentCount, itemDescription]).catch(() => {});
          }

          // For supervisors, also create supervisor_allocations record with motorcycle and motor gear
          if (role === 'supervisor') {
            await db.query(`
              INSERT INTO supervisor_allocations (supervisor_id, area, shift_type, motorcycle, motor_gear)
              VALUES ($1, 'town', 'day', TRUE, TRUE)
              ON CONFLICT (supervisor_id) DO NOTHING
            `, [newUser.id]).catch(() => {});
          }

          await Promise.allSettled(uniformInsertPromises);
        }

        // Send credentials email to the new guard
        await queueEmail(db, {
          recipientEmail: application.email,
          recipientName: application.full_name,
          subject: 'Welcome to Gates & Barriers - Your Staff Account',
          body: `Hello ${application.full_name},\n\nCongratulations! You have been hired.\n\nYour staff account has been created:\n\nWork Number: ${workNumber}\nTemporary Password: ${tempPassword}\n\nSign in at: ${getClientUrl(req)}\n\nPlease change your password after signing in.\n\nWelcome to the team!\n\nGates & Barriers`,
          relatedType: 'user_creation_from_application',
          relatedId: newUser.id,
        });

        // Send notification email to all admins
        await sendRoleEmail(db, 'admin', {
          subject: 'New Guard Hired - Work Number Generated',
          body: `A new guard has been hired and their account has been created.\n\nApplicant Details:\nName: ${application.full_name}\nEmail: ${application.email}\nPhone: ${application.phone}\nPosition: ${role}\n\nGenerated Work Number: ${workNumber}\nTemporary Password: ${tempPassword}\n\nUser ID: ${newUser.id}\nJoin Date: ${newUser.join_date}\n\nThe guard has been notified via email with their login credentials.\n\nGates & Barriers`,
          relatedType: 'guard_hired_notification',
          relatedId: newUser.id,
        });

        // Send in-app notification to all admins
        await notifyRole(db, 'admin', {
          title: 'New Guard Hired',
          message: `${application.full_name} has been hired. Work Number: ${workNumber}`,
          type: 'guard_hired',
          priority: 'high',
          metadata: {
            entity_type: 'user',
            entity_id: newUser.id,
            action_type: 'view_profile',
            link_url: '/admin/users',
            user_id: newUser.id,
            work_number: workNumber,
            applicant_name: application.full_name,
            applicant_email: application.email,
            role: role
          },
        });

        // Update application with work number
        updateFields.push(`work_number = $${paramIndex}`);
        updateParams.push(workNumber);
        paramIndex++;

        // Log audit
        await db.query(
          'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
          [newUser.id, newUser.full_name, newUser.email, 'User Auto-Created', 'user_management', `User account auto-created from hired application with work number ${workNumber}`]
        );
      }
    }

    // Execute update
    const query = `UPDATE applications SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING ${APPLICATION_SELECT}`;
    updateParams.push(req.params.id);
    
    const result = await db.query(query, updateParams);
    const updatedApplication = result.rows[0];
    
    res.json({ application: updatedApplication });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

router.post('/:id/forward', authenticateToken, authorize('manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const assignedRole = req.body.assigned_role;
    if (!['secretary', 'director'].includes(assignedRole)) {
      return res.status(400).json({ error: 'Guard applications can only be forwarded to Secretary or Director' });
    }
    const result = await db.query(
      `UPDATE applications SET assigned_role = $1, status = 'reviewed', forwarded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${APPLICATION_SELECT}`,
      [assignedRole, req.params.id]
    );
    const application = result.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });

    // If application has a contract document, create a document transfer for the recipient
    if (application.contract_document_url) {
      await db.query(`
        INSERT INTO document_transfers (
          sender_id, recipient_role, document_type, related_id, title, file_url, status, priority
        ) VALUES ($1, $2, 'contract_application', $3, $4, $5, 'pending', 'high')
      `, [
        req.user.id,
        assignedRole,
        application.id,
        `Contract Application - ${application.full_name}`,
        application.contract_document_url
      ]);
    }

    await notifyRole(db, assignedRole, {
      title: 'Guard application forwarded',
      message: `${application.full_name}'s guard application was forwarded by the manager.${application.contract_document_url ? ' Contract document attached.' : ''}`,
      type: 'guard_application_forwarded',
      metadata: {
        entity_type: 'application',
        entity_id: application.id,
        action_type: 'review',
        link_url: assignedRole === 'director' ? '/director/applicants' : '/secretary/applications',
            reply_allowed: true,
            reply_url: assignedRole === 'director' ? '/director/applicants' : '/secretary/applications',
        application_id: application.id,
        has_contract_document: !!application.contract_document_url
      },
    });

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Application Forwarded', 'user_management', `Forwarded application #${application.id} for ${application.full_name} to ${assignedRole}`]
    );

    res.json({ application });
  } catch (error) {
    console.error('Forward application error:', error);
    res.status(500).json({ error: 'Failed to forward application' });
  }
});

router.post('/:id/reply', authenticateToken, authorize('manager', 'secretary', 'director', 'admin'), [
  body('subject').notEmpty().trim(),
  body('body').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const db = req.app.get('db');
    const { subject, body: replyBody } = req.body;
    const result = await db.query(
      `UPDATE applications SET reply_subject = $1, reply_body = $2, replied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING ${APPLICATION_SELECT}`,
      [subject, replyBody, req.params.id]
    );
    const application = result.rows[0];
    if (!application) return res.status(404).json({ error: 'Application not found' });
    await queueEmail(db, {
      recipientEmail: application.email,
      recipientName: application.full_name,
      subject,
      body: replyBody,
      relatedType: 'guard_application',
      relatedId: application.id,
    });

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Application Reply Sent', 'user_management', `Replied to application #${application.id} for ${application.full_name}: ${subject}`]
    );

    res.json({ application });
  } catch (error) {
    console.error('Reply application error:', error);
    res.status(500).json({ error: 'Failed to queue reply' });
  }
});

module.exports = router;

