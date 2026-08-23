const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken, authorize, adminOnly } = require('../middleware/auth');
const crypto = require('crypto');
const { isDeductionExempt, getWageRates, getShiftRateForRole } = require('../config/wages');

const router = express.Router();

const ROLE_CONFIG = {
  director: { prefix: 'GBD', min: 1, max: 500 },
  manager: { prefix: 'GBM', min: 1, max: 500 },
  supervisor: { prefix: 'GBS', min: 1, max: 500 },
  secretary: { prefix: 'GBSEC', min: 1, max: 500 },
  admin: { prefix: 'GBA', min: 1, max: 500 },
  guard: { prefix: 'GBG', min: 501, max: 2000 }
};

const validateWorkNumber = (role, workNumber) => {
  const config = ROLE_CONFIG[role];
  if (!config) {
    return { valid: false, error: `Invalid role: ${role}` };
  }

  const expectedPrefix = config.prefix;
  const match = workNumber.match(/^([A-Z]+)-(\d+)$/);
  
  if (!match) {
    return { valid: false, error: `Work number must be in format PREFIX-NUMBER (e.g., ${expectedPrefix}-001)` };
  }

  const [, prefix, numberStr] = match;
  const number = parseInt(numberStr, 10);

  if (prefix !== expectedPrefix) {
    return { valid: false, error: `Work number prefix must be ${expectedPrefix} for role ${role}` };
  }

  if (isNaN(number) || number < config.min || number > config.max) {
    return { 
      valid: false, 
      error: `Work number must be between ${config.min} and ${config.max} for role ${role}` 
    };
  }

  return { valid: true };
};

router.get('/', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { role, status, search } = req.query;

    let query = `SELECT id, email, full_name, role, work_number, account_status, join_date,
      CASE WHEN role IN ('manager', 'director') THEN NULL ELSE uniform_status END AS uniform_status,
      last_active_date, site_id, phone_number, id_number, resignation_date, compliance_risk, created_at, updated_at
      FROM users WHERE 1=1`;
    const params = [];

    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND account_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR work_number ILIKE $${params.length})`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', authenticateToken, authorize('admin', 'director', 'manager'), [
  body('email').isEmail().normalizeEmail().custom((value) => {
    if (!value.endsWith('@gmail.com')) throw new Error('Use a valid Gmail address');
    return true;
  }),
  body('full_name').notEmpty().trim(),
  body('role').isIn(['admin', 'director', 'manager', 'supervisor', 'secretary', 'guard']),
  body('work_number').custom((value, { req }) => {
    const role = req.body.role;
    // Work number is optional only for guards, required for all other roles
    if (role !== 'guard' && (!value || value.trim() === '')) {
      throw new Error('Work number is required for this role');
    }
    return true;
  }).trim(),
  body('phone_number').notEmpty().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.get('db');
    const { email, full_name, role, work_number, phone_number, site_id, account_status } = req.body;

    // Auto-correct or generate work number for guards
    let finalWorkNumber = work_number;
    if (role === 'guard') {
      const config = ROLE_CONFIG[role];
      
      // If no work number provided, generate one
      if (!work_number || work_number.trim() === '') {
        // Get the next sequential number for guards
        const workNumberQuery = await db.query(
          `SELECT work_number FROM allocated_work_numbers 
           WHERE work_number LIKE $1 
           ORDER BY work_number DESC 
           LIMIT 1`,
          ['GBG-%']
        );
        
        let nextNumber = config.min; // 501
        if (workNumberQuery.rows.length > 0) {
          const lastWorkNumber = workNumberQuery.rows[0].work_number;
          const match = lastWorkNumber.match(/GBG-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        
        // Ensure we don't exceed the maximum
        if (nextNumber > config.max) {
          return res.status(400).json({ error: 'No available work numbers for guards. Maximum limit reached.' });
        }
        
        finalWorkNumber = `${config.prefix}-${String(nextNumber).padStart(3, '0')}`;
      } else {
        // Auto-correct existing work number format
        const match = work_number.match(/^([A-Z]+)-?(\d+)$/);
        if (match) {
          const [, prefix, numberStr] = match;
          const num = parseInt(numberStr, 10);
          // Always apply the correct prefix for guards
          finalWorkNumber = `${config.prefix}-${String(num).padStart(3, '0')}`;
        } else if (/^\d+$/.test(work_number.trim())) {
          const num = parseInt(work_number.trim(), 10);
          // Always apply the correct prefix for guards
          finalWorkNumber = `${config.prefix}-${String(num).padStart(3, '0')}`;
        }
      }
    }

    const validation = validateWorkNumber(role, finalWorkNumber);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR work_number = $2',
      [email, finalWorkNumber]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'A user already exists with this email or work number' });
    }

    const allocatedCheck = await db.query(
      'SELECT work_number FROM allocated_work_numbers WHERE work_number = $1',
      [finalWorkNumber]
    );
    if (allocatedCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This work number has already been allocated and cannot be reused' });
    }

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const password_hash = await require('bcrypt').hash(tempPassword, 10);

  // HIGHEST PRIORITY: Fixed Shift Wage Baselines (12-hour shifts)
  // Guard = KES 254, Supervisor = KES 400 per standard shift (editable via portal).
  const wageRates = await getWageRates(db);
  const baselineDailyRate = getShiftRateForRole(role, wageRates);

  const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, work_number, phone_number, site_id, account_status, join_date, daily_rate, tenure_years)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9, 0)
       RETURNING id, email, full_name, role, work_number, phone_number, account_status, join_date, site_id, daily_rate, tenure_years, created_at, updated_at`,
      [email, password_hash, full_name, role, finalWorkNumber, phone_number, site_id, account_status || 'active', baselineDailyRate]
    );

    const user = result.rows[0];

    await db.query(
      'INSERT INTO allocated_work_numbers (work_number, user_id, role) VALUES ($1, $2, $3)',
      [finalWorkNumber, user.id, role]
    );

    if (role === 'guard' || role === 'supervisor') {
      // DEDUCTION EXEMPTION: Supervisors are strictly exempt from ALL uniform/gear/equipment
      // deductions. Their uniform record carries zero deduction; only guards get deduction tracking.
      const supervisorExempt = isDeductionExempt(role);
      const uniformResult = await db.query(`
        INSERT INTO uniforms (guard_id, monthly_deduction, total_deductions, deductions_remaining, is_complete, issued_at)
        VALUES ($1, $2, 0.00, 0.00, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (guard_id) DO NOTHING
        RETURNING id
      `, [user.id, supervisorExempt ? 0.00 : 300.00, supervisorExempt]);

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
          RETURNING id
        `, [user.id, itemName]).catch(() => {});
      });

      // Create financial ledger entry for uniform deductions (guards only).
      // Supervisors are exempt - no active deduction ledger entry is ever created for them.
      if (!supervisorExempt) {
        const uniformCost = 3000.00;
        const installmentCount = 3;
        const itemDescription = 'Compulsory uniform set (Shirt, Trouser, Belt, Whistle, Rungu, Rungu Holder) - KES 1000/month for 3 months';

        await db.query(`
          INSERT INTO financial_ledger (guard_id, type, amount, status, installment_count, description)
          VALUES ($1, 'uniform', $2, 'active', $3, $4)
          ON CONFLICT DO NOTHING
        `, [user.id, uniformCost, installmentCount, itemDescription]).catch(() => {});
      }

      // For supervisors, also create supervisor_allocations record with motorcycle and motor gear
      if (role === 'supervisor') {
        await db.query(`
          INSERT INTO supervisor_allocations (supervisor_id, area, shift_type, motorcycle, motor_gear)
          VALUES ($1, 'town', 'day', TRUE, TRUE)
          ON CONFLICT (supervisor_id) DO NOTHING
        `, [user.id]).catch(() => {});
      }

      await Promise.allSettled(uniformInsertPromises);
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'User Created', 'user_management', `Created ${role} account for ${full_name}`]
    );

    res.status(201).json({ user, tempPassword });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/guards', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status, search, site_id } = req.query;

    let query = `SELECT u.id, u.email, u.full_name, u.role, u.work_number, u.account_status, u.join_date, u.uniform_status, u.last_active_date, u.site_id, u.shift_type, u.phone_number, u.id_number, u.emergency_contact, u.emergency_phone, u.compliance_risk, u.created_at, u.updated_at,
      s.client_name as site_name, s.location as site_location
      FROM users u
      LEFT JOIN sites s ON u.site_id = s.id
      WHERE u.role = 'guard'`;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND u.account_status = $${params.length}`;
    }

    if (site_id) {
      params.push(site_id);
      query += ` AND u.site_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.work_number ILIKE $${params.length} OR u.phone_number ILIKE $${params.length})`;
    }

    query += ' ORDER BY u.full_name ASC';

    const result = await db.query(query, params);
    res.json({ guards: result.rows });
  } catch (error) {
    console.error('Get guards error:', error);
    res.status(500).json({ error: 'Failed to fetch guards' });
  }
});

router.get('/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'SELECT id, email, full_name, role, work_number, account_status, join_date, uniform_status, last_active_date, site_id, phone_number, id_number, emergency_contact, emergency_phone, resignation_date, resignation_reason, resignation_letter_url, compliance_risk, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/:id', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { role, account_status, site_id, phone_number, uniform_status, work_number, compliance_risk, emergency_contact, emergency_phone, shift_type, is_overtime } = req.body;

    const targetUser = await db.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (!targetUser.rows[0]) return res.status(404).json({ error: 'User not found' });
    const targetRole = targetUser.rows[0].role;

    if (req.user.role === 'manager' && targetRole !== 'guard') {
      return res.status(403).json({ error: 'Managers can only manage guard accounts' });
    }

    if (req.user.role === 'director' && !['guard', 'supervisor'].includes(targetRole)) {
      return res.status(403).json({ error: 'Directors can only manage guards and supervisors' });
    }

    if (shift_type && !['day', 'night', 'overtime'].includes(shift_type)) {
      return res.status(400).json({ error: 'Invalid shift_type. Must be day, night, or overtime' });
    }

    const finalRole = req.user.role === 'admin' ? role : undefined;
    const overtimeAssignment = Boolean(is_overtime);

    const result = await db.query(
      `UPDATE users SET
        role = COALESCE($1, role),
        account_status = COALESCE($2, account_status),
        site_id = CASE WHEN $12 THEN site_id ELSE COALESCE($3, site_id) END,
        phone_number = COALESCE($4, phone_number),
        uniform_status = CASE WHEN COALESCE($1, role) IN ('manager', 'director') THEN 'na' ELSE COALESCE($5, uniform_status) END,
        work_number = COALESCE($6, work_number),
        compliance_risk = COALESCE($7, compliance_risk),
        emergency_contact = COALESCE($8, emergency_contact),
        emergency_phone = COALESCE($9, emergency_phone),
        shift_type = CASE WHEN $12 THEN shift_type ELSE COALESCE($10, shift_type) END,
        updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
       RETURNING id, email, full_name, role, work_number, account_status, join_date, uniform_status, last_active_date, site_id, phone_number, id_number, emergency_contact, emergency_phone, resignation_date, compliance_risk, daily_rate, tenure_years, created_at, updated_at`,
      [finalRole, account_status, site_id, phone_number, uniform_status, work_number, compliance_risk, emergency_contact, emergency_phone, shift_type, req.params.id, overtimeAssignment]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (site_id && user.role === 'guard') {
      const allocationType = overtimeAssignment ? 'overtime' : shift_type || user.shift_type || 'day';
      await db.query(
        `INSERT INTO allocations (guard_id, site_id, allocated_by, date, shift_type, status, notes)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, 'active', $5)
         ON CONFLICT (guard_id, site_id, date, shift_type)
         DO UPDATE SET status = 'active', allocated_by = EXCLUDED.allocated_by, notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP`,
        [user.id, site_id, req.user.id, allocationType, overtimeAssignment
          ? `Overtime assignment at site ${site_id}`
          : `Normal ${allocationType} assignment`]
      );
    }

    const changes = [];
    if (account_status) changes.push(`status → ${account_status}`);
    if (site_id) changes.push('site reassigned');
    if (shift_type) changes.push(`shift type -> ${shift_type}`);
    if (uniform_status) changes.push(`uniform → ${uniform_status}`);
    if (finalRole) changes.push(`role → ${finalRole}`);
    if (emergency_contact) changes.push('emergency contact updated');

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'User Updated', 'user_management', `Updated ${user.full_name}: ${changes.join(', ') || 'profile data'}`]
    );

    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const userResult = await db.query('SELECT full_name, email, work_number FROM users WHERE id = $1', [req.params.id]);
    const user = userResult.rows[0];

    if (req.user.role !== 'admin') {
      if (!user || user.role !== 'guard') {
        return res.status(403).json({ error: 'You can only delete guard accounts' });
      }
    }

    const policyCheck = await db.query('SELECT COUNT(*) FROM policies WHERE created_by = $1', [req.params.id]);
    if (parseInt(policyCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user. This user is referenced in existing policies. Please reassign or delete the policies first.' 
      });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'User Deleted', 'user_management', `Deleted user ${user?.full_name || req.params.id}`]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update guard daily rate (Director/Manager only)
router.patch('/:id/rate', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { daily_rate } = req.body;

    if (daily_rate === undefined || daily_rate < 0) {
      return res.status(400).json({ error: 'Valid daily_rate is required' });
    }

    // Verify the user is a guard
    const userResult = await db.query('SELECT id, role, full_name FROM users WHERE id = $1', [req.params.id]);
    const user = userResult.rows[0];
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!['guard', 'supervisor'].includes(user.role)) {
      return res.status(400).json({ error: 'Can only set rates for guards or supervisors' });
    }

    const result = await db.query(
      'UPDATE users SET daily_rate = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, full_name, work_number, daily_rate, tenure_years, site_id',
      [daily_rate, req.params.id]
    );

    const updatedUser = result.rows[0];

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Guard Rate Updated', 'user_management', 
        `Updated daily rate for ${updatedUser.full_name} (${updatedUser.work_number}) to KES ${daily_rate}`]
    );

    res.json({ 
      user: updatedUser,
      message: `Rate updated to KES ${daily_rate} for ${updatedUser.full_name}`
    });
  } catch (error) {
    console.error('Update guard rate error:', error);
    res.status(500).json({ error: 'Failed to update guard rate' });
  }
});

router.patch('/:id/role', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { role } = req.body;

    if (!['admin', 'director', 'manager', 'supervisor', 'secretary', 'guard'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, full_name, role, work_number, account_status, join_date, uniform_status, last_active_date, site_id, phone_number, id_number, emergency_contact, emergency_phone, resignation_date, compliance_risk, created_at, updated_at',
      [role, req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'User Role Changed', 'user_management', `Changed ${user.full_name}'s role to ${role}`]
    );

    res.json({ user });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Emergency Contacts Management
router.get('/:id/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'SELECT emergency_contact, emergency_phone FROM users WHERE id = $1',
      [req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      emergency_contact: user.emergency_contact,
      emergency_phone: user.emergency_phone
    });
  } catch (error) {
    console.error('Get emergency contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch emergency contacts' });
  }
});

router.put('/:id/emergency-contacts', authenticateToken, authorize('admin', 'director', 'manager'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { emergency_contact, emergency_phone } = req.body;

    const result = await db.query(
      `UPDATE users SET
        emergency_contact = $1,
        emergency_phone = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, full_name, emergency_contact, emergency_phone`,
      [emergency_contact, emergency_phone, req.params.id]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Emergency Contact Updated', 'user_management', 
        `Updated emergency contact for ${user.full_name}: ${emergency_contact} (${emergency_phone})`]
    );

    res.json({ 
      user: {
        id: user.id,
        full_name: user.full_name,
        emergency_contact: user.emergency_contact,
        emergency_phone: user.emergency_phone
      }
    });
  } catch (error) {
    console.error('Update emergency contacts error:', error);
    res.status(500).json({ error: 'Failed to update emergency contacts' });
  }
});

module.exports = router;


