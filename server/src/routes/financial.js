const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken, authorize, adminOnly } = require('../middleware/auth');
const { isDeductionExempt, isFeeDeduction } = require('../config/wages');

const router = express.Router();

// Get financial records
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, type, status, start_date, end_date } = req.query;

    let query = `
      SELECT f.*, 
        u.full_name as guard_name,
        u.work_number as guard_work_number,
        u.daily_rate,
        u.tenure_years,
        s.client_name as site_client,
        s.location as site_location
      FROM financial_ledger f
      JOIN users u ON f.guard_id = u.id
      LEFT JOIN sites s ON f.site_id = s.id
      WHERE 1=1
        AND NOT (
          LOWER(u.role) = 'supervisor'
          AND (f.type = 'uniform' OR LOWER(COALESCE(f.description, '')) LIKE ANY(ARRAY['%gear%', '%equipment%']))
        )
    `;
    const params = [];

    // Role-based filtering
    if (req.user.role === 'guard') {
      params.push(req.user.id);
      query += ` AND f.guard_id = $${params.length}`;
    } else if (guard_id) {
      params.push(guard_id);
      query += ` AND f.guard_id = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND f.type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND f.status = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND f.created_at >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND f.created_at <= $${params.length}`;
    }

    query += ' ORDER BY f.created_at DESC';

    const result = await db.query(query, params);
    res.json({ records: result.rows });
  } catch (error) {
    console.error('Get financial records error:', error);
    res.status(500).json({ error: 'Failed to fetch financial records' });
  }
});

// Get financial record by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      `SELECT f.*, 
        u.full_name as guard_name,
        u.work_number as guard_work_number,
        u.daily_rate,
        u.tenure_years,
        s.client_name as site_client,
        s.location as site_location
       FROM financial_ledger f
       JOIN users u ON f.guard_id = u.id
       LEFT JOIN sites s ON f.site_id = s.id
       WHERE f.id = $1
         AND NOT (
           LOWER(u.role) = 'supervisor'
           AND (f.type = 'uniform' OR LOWER(COALESCE(f.description, '')) LIKE ANY(ARRAY['%gear%', '%equipment%']))
         )`,
      [req.params.id]
    );

    const record = result.rows[0];
    if (!record) {
      return res.status(404).json({ error: 'Financial record not found' });
    }

    res.json({ record });
  } catch (error) {
    console.error('Get financial record error:', error);
    res.status(500).json({ error: 'Failed to fetch financial record' });
  }
});

// Create financial record (Admin only)
router.post('/', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, site_id, type, amount, status, installment_count, description, metadata } = req.body;

    const userResult = await db.query('SELECT role FROM users WHERE id = $1', [guard_id]);
    const ledgerUser = userResult.rows[0];
    if (ledgerUser && isDeductionExempt(ledgerUser.role) && isFeeDeduction({ type, description, metadata })) {
      return res.status(400).json({ error: 'Supervisors are exempt from uniform, gear, and equipment deductions' });
    }

    const result = await db.query(
      'INSERT INTO financial_ledger (guard_id, site_id, type, amount, status, installment_count, description, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [guard_id, site_id, type, amount, status || 'active', installment_count || 1, description, metadata || {}]
    );

    const record = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Financial Record Created', 'financial', `Created ${type} record for guard ${guard_id}`]
    );

    res.status(201).json({ record });
  } catch (error) {
    console.error('Create financial record error:', error);
    res.status(500).json({ error: 'Failed to create financial record' });
  }
});

// Update financial record (Admin only)
router.put('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { type, amount, status, installment_count, installments_paid, description } = req.body;

    const existingResult = await db.query(
      `SELECT f.type, f.description, u.role
       FROM financial_ledger f JOIN users u ON u.id = f.guard_id
       WHERE f.id = $1`,
      [req.params.id]
    );
    const existingRecord = existingResult.rows[0];
    if (existingRecord && isDeductionExempt(existingRecord.role) &&
      isFeeDeduction({
        type: type === undefined || type === null ? existingRecord.type : type,
        description: description === undefined || description === null ? existingRecord.description : description
      })) {
      return res.status(400).json({ error: 'Supervisors are exempt from uniform, gear, and equipment deductions' });
    }

    const result = await db.query(
      'UPDATE financial_ledger SET type = COALESCE($1, type), amount = COALESCE($2, amount), status = COALESCE($3, status), installment_count = COALESCE($4, installment_count), installments_paid = COALESCE($5, installments_paid), description = COALESCE($6, description), updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [type, amount, status, installment_count, installments_paid, description, req.params.id]
    );

    const record = result.rows[0];
    if (!record) {
      return res.status(404).json({ error: 'Financial record not found' });
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Financial Record Updated', 'financial', `Updated financial record ${record.id}`]
    );

    res.json({ record });
  } catch (error) {
    console.error('Update financial record error:', error);
    res.status(500).json({ error: 'Failed to update financial record' });
  }
});

// Delete financial record (Admin only)
router.delete('/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    
    await db.query('DELETE FROM financial_ledger WHERE id = $1', [req.params.id]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Financial Record Deleted', 'financial', `Deleted financial record ${req.params.id}`]
    );

    res.json({ message: 'Financial record deleted successfully' });
  } catch (error) {
    console.error('Delete financial record error:', error);
    res.status(500).json({ error: 'Failed to delete financial record' });
  }
});

module.exports = router;