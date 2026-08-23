const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken, authorize, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all audits
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, reporter_id, site_id, status, issue_type } = req.query;

    let query = `
      SELECT a.*, 
        u.full_name as guard_name,
        u.work_number as guard_work_number,
        u.role as guard_role,
        r.full_name as reporter_name,
        s.client_name as site_client,
        s.location as site_location,
        approver.full_name as approved_by_name
      FROM audits a
      JOIN users u ON a.guard_id = u.id
      JOIN users r ON a.reporter_id = r.id
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN users approver ON a.approved_by = approver.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'guard') {
      params.push(req.user.id);
      query += ` AND (a.guard_id = $${params.length} OR a.reporter_id = $${params.length})`;
    } else if (guard_id) {
      params.push(guard_id);
      query += ` AND a.guard_id = $${params.length}`;
    }

    if (reporter_id) {
      params.push(reporter_id);
      query += ` AND a.reporter_id = $${params.length}`;
    }

    if (site_id) {
      params.push(site_id);
      query += ` AND a.site_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (issue_type) {
      params.push(`%${issue_type}%`);
      query += ` AND a.issue_type ILIKE $${params.length}`;
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await db.query(query, params);
    res.json({ audits: result.rows });
  } catch (error) {
    console.error('Get audits error:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

// Get audit by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      `SELECT a.*, 
        u.full_name as guard_name,
        u.work_number as guard_work_number,
        r.full_name as reporter_name,
        s.client_name as site_client,
        s.location as site_location,
        approver.full_name as approved_by_name
       FROM audits a
       JOIN users u ON a.guard_id = u.id
       JOIN users r ON a.reporter_id = r.id
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN users approver ON a.approved_by = approver.id
       WHERE a.id = $1`,
      [req.params.id]
    );

    const audit = result.rows[0];
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json({ audit });
  } catch (error) {
    console.error('Get audit error:', error);
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

// Create audit (Guards can report their own incidents, supervisors and above can report any)
router.post('/', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor', 'guard'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, site_id, issue_type, description, penalty_amount } = req.body;

    // If user is a guard, they can only report incidents about themselves
    let actualGuardId = guard_id
    if (req.user.role === 'guard') {
      actualGuardId = req.user.id
    }

    // Get guard's site if not provided
    let actualSiteId = site_id
    if (!actualSiteId && actualGuardId) {
      const guardResult = await db.query(
        'SELECT site_id FROM users WHERE id = $1',
        [actualGuardId]
      )
      actualSiteId = guardResult.rows[0]?.site_id
    }

    // Validate required fields
    if (!actualGuardId || !issue_type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: guard_id, issue_type, and description are required' 
      })
    }

    const result = await db.query(
      'INSERT INTO audits (reporter_id, guard_id, site_id, issue_type, description, priority, penalty_amount) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.id, actualGuardId, actualSiteId, issue_type, description, req.body.priority || 'medium', penalty_amount || 0]
    );

    const audit = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Audit Created', 'audit', `Created audit for ${issue_type}`]
    );

    // Create notification for guard (don't notify if guard is reporting their own incident)
    if (req.user.role !== 'guard' || req.user.id !== actualGuardId) {
      await db.query(
        'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          actualGuardId,
          'audit_created',
          'New Audit Filed',
          `An audit has been filed for: ${issue_type}`,
          'medium',
          JSON.stringify({
            entity_type: 'incident',
            entity_id: audit.id,
            action_type: 'view',
            link_url: '/guard/incidents',
            audit_id: audit.id,
            issue_type,
            site_id: actualSiteId
          })
        ]
      );
    }

    res.status(201).json({ audit });
  } catch (error) {
    console.error('Create audit error:', error);
    res.status(500).json({ error: 'Failed to create audit' });
  }
});

// Approve audit and create penalty (Director and above)
router.post('/:id/approve', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { penalty_amount, installment_count } = req.body;

    // Get audit details
    const auditResult = await db.query('SELECT * FROM audits WHERE id = $1', [req.params.id]);
    const audit = auditResult.rows[0];

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    if (audit.status === 'approved' || audit.status === 'resolved') {
      return res.status(400).json({ error: 'Audit already approved' });
    }

    // Update audit status
    const updatedAudit = await db.query(
      'UPDATE audits SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, penalty_amount = COALESCE($3, penalty_amount), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      ['resolved', req.user.id, penalty_amount, req.params.id]
    );

    // Create penalty record in financial_ledger
    if (penalty_amount && penalty_amount > 0) {
      await db.query(
        'INSERT INTO financial_ledger (guard_id, site_id, type, amount, status, installment_count, description, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          audit.guard_id,
          audit.site_id,
          'penalty',
          penalty_amount,
          'active',
          installment_count || 1,
          `Penalty for audit #${audit.id}: ${audit.issue_type}`,
          {
            audit_id: audit.id,
            issue_type: audit.issue_type,
            monthly_installment: penalty_amount / (installment_count || 1)
          }
        ]
      );

      // Create notification for guard
      await db.query(
        'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          audit.guard_id,
          'penalty_issued',
          'Penalty Issued',
          `A penalty of KES ${penalty_amount} has been issued for ${audit.issue_type}. It will be deducted in ${installment_count || 1} installments.`,
          'medium',
          JSON.stringify({
            entity_type: 'incident',
            entity_id: audit.id,
            action_type: 'view',
            link_url: '/guard/incidents',
            audit_id: audit.id,
            amount: penalty_amount,
            installments: installment_count || 1
          })
        ]
      );
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Audit Approved', 'audit', `Approved audit ${audit.id} with penalty KES ${penalty_amount}`]
    );

    res.json({ audit: updatedAudit.rows[0] });
  } catch (error) {
    console.error('Approve audit error:', error);
    res.status(500).json({ error: 'Failed to approve audit' });
  }
});

// Reject audit (Director and above)
router.post('/:id/reject', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { reason } = req.body;

    const result = await db.query(
      'UPDATE audits SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['rejected', req.params.id]
    );

    const audit = result.rows[0];
    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Audit Rejected', 'audit', `Rejected audit ${audit.id}. Reason: ${reason || 'No reason provided'}`]
    );

    res.json({ audit });
  } catch (error) {
    console.error('Reject audit error:', error);
    res.status(500).json({ error: 'Failed to reject audit' });
  }
});

// Delete audit (Admin only)
router.delete('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    
    await db.query('DELETE FROM audits WHERE id = $1', [req.params.id]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Audit Deleted', 'audit', `Deleted audit ${req.params.id}`]
    );

    res.json({ message: 'Audit deleted successfully' });
  } catch (error) {
    console.error('Delete audit error:', error);
    res.status(500).json({ error: 'Failed to delete audit' });
  }
});

module.exports = router;