const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { hashPassword, comparePassword, generateToken, authenticateToken, authorize } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const { isDeductionExempt, getWageRates, getShiftRateForRole } = require('../config/wages');

const router = express.Router();
const STAFF_ROLES = ['admin', 'director', 'manager', 'supervisor', 'secretary', 'guard'];

const ROLE_CONFIG = {
  director: { prefix: 'GBD', min: 1, max: 500 },
  manager: { prefix: 'GBM', min: 1, max: 500 },
  supervisor: { prefix: 'GBS', min: 1, max: 500 },
  secretary: { prefix: 'GBSEC', min: 1, max: 500 },
  admin: { prefix: 'GBA', min: 1, max: 500 },
  guard: { prefix: 'GBG', min: 501, max: 2000 }
};

const publicUserFields = 'id, email, full_name, role, work_number, account_status, join_date, uniform_status, last_active_date, site_id, phone_number, id_number, emergency_contact, emergency_phone, resignation_date, resignation_reason, resignation_letter_url, compliance_risk, created_at, updated_at';

const createToken = () => crypto.randomBytes(32).toString('hex');
const createCode = () => crypto.randomInt(100000, 1000000).toString();

const getClientUrl = (req) => {
  const configured = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const corsOrigin = (process.env.CORS_ORIGIN || '').split(',')[0]?.trim().replace(/\/$/, '');
  return corsOrigin || `${req.protocol}://${req.get('host')}`;
};

async function queueEmail(db, { recipientEmail, recipientName, subject, body, relatedType, relatedId }) {
  return sendEmail(db, { recipientEmail, recipientName, subject, body, relatedType, relatedId, required: true });
}

const validateRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
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

router.post('/bootstrap', [
  body('email').isEmail().normalizeEmail().custom((value) => {
    if (!value.endsWith('@gmail.com')) throw new Error('Use a valid Gmail address');
    return true;
  }),
  body('full_name').notEmpty().trim(),
  body('work_number').notEmpty().trim(),
  body('phone_number').notEmpty().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const { email, full_name, work_number, phone_number } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const adminCheck = await db.query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );
    if (adminCheck.rows.length > 0) {
      return res.status(403).json({ error: 'Admin account already exists. Please use the login page.' });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR work_number = $2 OR phone_number = $3',
      [email, work_number, phone_number]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'A user already exists with this email, work number, or phone number' });
    }

    const allocatedCheck = await db.query(
      'SELECT work_number FROM allocated_work_numbers WHERE work_number = $1',
      [work_number]
    );
    if (allocatedCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This work number has already been allocated and cannot be reused' });
    }

    const tempPassword = createToken();
    const password_hash = await hashPassword(tempPassword);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, work_number, phone_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, work_number, phone_number, account_status, join_date`,
      [email, password_hash, full_name, 'admin', work_number, phone_number]
    );

    const user = result.rows[0];

    await db.query(
      'INSERT INTO allocated_work_numbers (work_number, user_id, role) VALUES ($1, $2, $3)',
      [work_number, user.id, 'admin']
    );

    const verifyToken = createToken();
    const verifyUrl = `${getClientUrl(req)}/verify-email?token=${verifyToken}`;
    
    await db.query(
      `UPDATE users SET email_verification_token = $1, email_verified_at = NULL WHERE id = $2`,
      [verifyToken, user.id]
    );

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Verify your email - Gates & Barriers',
      body: `Hello ${user.full_name},\n\nPlease verify your email address to complete your account setup.\n\nVerify here: ${verifyUrl}\n\nGates & Barriers`,
      relatedType: 'email_verification',
      relatedId: user.id,
    });

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Your Gates & Barriers Admin Account',
      body: `Hello ${user.full_name},\n\nYour admin account has been created successfully.\n\nWork number: ${user.work_number}\nTemporary password: ${tempPassword}\n\nSign in at: ${getClientUrl(req)}/login\n\nPlease change your password after signing in.\n\nGates & Barriers`,
      relatedType: 'user_creation',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, full_name, email, 'Admin Bootstrap', 'user_management', 'Initial admin account created via bootstrap']
    );

    res.status(201).json({ message: 'Admin account created successfully. Login credentials sent to your Gmail.', user });
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'Bootstrap failed' });
  }
});

router.post('/register', authenticateToken, authorize('admin', 'director', 'manager'), [
  body('email').isEmail().normalizeEmail().custom((value) => {
    if (!value.endsWith('@gmail.com')) throw new Error('Use a valid Gmail address');
    return true;
  }),
  body('full_name').notEmpty().trim(),
  body('role').isIn(STAFF_ROLES),
  body('work_number').notEmpty().trim(),
  body('phone_number').notEmpty().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const { email, full_name, role, work_number, phone_number } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const validation = validateWorkNumber(role, work_number);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR work_number = $2 OR phone_number = $3',
      [email, work_number, phone_number]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'A staff account already exists with this Gmail, work number, or phone number' });
    }

    const allocatedCheck = await db.query(
      'SELECT work_number FROM allocated_work_numbers WHERE work_number = $1',
      [work_number]
    );
    if (allocatedCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This work number has already been allocated and cannot be reused' });
    }

    const setupToken = createToken();
    const setupUrl = `${getClientUrl(req)}/set-password?token=${setupToken}&wn=${work_number}`;
    const placeholderHash = await hashPassword(createToken());
    const wageRates = await getWageRates(db);
    const dailyRate = getShiftRateForRole(role, wageRates);
    const uniformStatus = ['manager', 'director'].includes(role) ? 'na' : 'allocated';

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role, work_number, phone_number, uniform_status, daily_rate, join_date, password_reset_token, password_reset_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9, CURRENT_TIMESTAMP + INTERVAL '7 days')
       RETURNING id, email, full_name, role, work_number, phone_number, account_status, join_date`,
      [email, placeholderHash, full_name, role, work_number, phone_number, uniformStatus, dailyRate, setupToken]
    );

    const user = result.rows[0];

    await db.query(
      'INSERT INTO allocated_work_numbers (work_number, user_id, role) VALUES ($1, $2, $3)',
      [work_number, user.id, role]
    );

    // Automatic uniform allocation for guards and supervisors
    // DEDUCTION EXEMPTION: Supervisors are strictly exempt from ALL uniform/gear/equipment
    // deductions - no active deduction ledger entry is ever created for them.
    const deductionExempt = isDeductionExempt(role);
    if (role === 'guard' || role === 'supervisor') {
      // Create uniform record (check first to avoid duplicate errors)
      const existingUniform = await db.query('SELECT id FROM uniforms WHERE guard_id = $1', [user.id]);
      if (existingUniform.rows.length === 0) {
        await db.query(`
          INSERT INTO uniforms (guard_id, monthly_deduction, total_deductions, deductions_remaining, is_complete, issued_at)
          VALUES ($1, $2, 0.00, 0.00, $3, CURRENT_TIMESTAMP)
        `, [user.id, deductionExempt ? 0.00 : 300.00, deductionExempt]);
      }

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
        `, [user.id, itemName]).catch(() => {});
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

    const verifyToken = createToken();
    const verifyUrl = `${getClientUrl(req)}/verify-email?token=${verifyToken}`;
    
    await db.query(
      `UPDATE users SET email_verification_token = $1, email_verified_at = NULL WHERE id = $2`,
      [verifyToken, user.id]
    );

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Verify your email - Gates & Barriers',
      body: `Hello ${user.full_name},\n\nPlease verify your email address to complete your account setup.\n\nVerify here: ${verifyUrl}\n\nGates & Barriers`,
      relatedType: 'email_verification',
      relatedId: user.id,
    });

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Set your password - Gates & Barriers',
      body: `Hello ${user.full_name},\n\nYour Gates & Barriers staff account has been created.\n\nWork number: ${user.work_number}\n\nSet your password here (link expires in 7 days): ${setupUrl}\n\nGates & Barriers`,
      relatedType: 'user_creation',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, full_name, email, 'User Created', 'user_management', `New ${role} account created by admin`]
    );

    res.status(201).json({ message: 'User created successfully. Password setup link sent to their Gmail.', user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', [
  body('work_number').notEmpty().trim(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const { work_number, password } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query(`SELECT * FROM users WHERE work_number = $1`, [work_number]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid work number or password' });

    if (user.pending_password_hash) {
      const pendingMatches = await comparePassword(password, user.pending_password_hash);
      if (pendingMatches && !user.password_reset_verified_at) {
        return res.status(403).json({ error: 'Verify the password reset email before using your new password' });
      }
    }

    const validPassword = await comparePassword(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid work number or password' });
    if (user.account_status === 'disabled') return res.status(403).json({ error: 'Account is disabled' });

    await db.query('UPDATE users SET last_active_date = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const token = generateToken(user);
    delete user.password_hash;
    delete user.pending_password_hash;

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'User Login', 'security', 'User logged in successfully']
    );

    res.json({ message: 'Login successful', user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot-password', [
  body('work_number').notEmpty().trim(),
  body('phone_number').notEmpty().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;
    const { work_number, phone_number } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query(
      'SELECT id, email, full_name, work_number, phone_number FROM users WHERE work_number = $1 AND phone_number = $2',
      [work_number, phone_number]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No staff account matches that work number and phone number' });

    const resetToken = createToken();
    const resetCode = createCode();
    const resetUrl = `${getClientUrl(req)}/forgot-password?token=${resetToken}`;

    await db.query(
      `UPDATE users
       SET password_reset_token = $1,
           password_reset_code = $2,
           password_reset_expires_at = CURRENT_TIMESTAMP + INTERVAL '30 minutes',
           pending_password_hash = NULL,
           pending_password_set_at = NULL,
           password_reset_verify_token = NULL,
           password_reset_verified_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [resetToken, resetCode, user.id]
    );

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Password reset link and code',
      body: `Hello ${user.full_name},\n\nUse this link to set a new password: ${resetUrl}\n\nYour reset code is: ${resetCode}\n\nThis code expires in 30 minutes.\n\nGates & Barriers`,
      relatedType: 'password_reset_request',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'Password Reset Requested', 'security', 'Password reset link and code queued']
    );

    res.json({ message: 'Password reset link and code sent to your Gmail address' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to start password reset' });
  }
});

router.post('/reset-password', [
  body('token').notEmpty().trim(),
  body('code').isLength({ min: 6, max: 6 }).trim(),
  body('password').isLength({ min: 6 }),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;
    const { token, code, password } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query(
      `SELECT id, email, full_name FROM users
       WHERE password_reset_token = $1
         AND password_reset_code = $2
         AND password_reset_expires_at > CURRENT_TIMESTAMP`,
      [token, code]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link/code' });

    const pendingHash = await hashPassword(password);
    const verifyToken = createToken();
    const verifyUrl = `${getClientUrl(req)}/forgot-password?verify=${verifyToken}`;

    await db.query(
      `UPDATE users
       SET pending_password_hash = $1,
           pending_password_set_at = CURRENT_TIMESTAMP,
           password_reset_verify_token = $2,
           password_reset_verified_at = NULL,
           password_reset_token = NULL,
           password_reset_code = NULL,
           password_reset_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [pendingHash, verifyToken, user.id]
    );

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Verify your password reset',
      body: `Hello ${user.full_name},\n\nYour new password has been saved but cannot be used until you verify this email.\n\nVerify here: ${verifyUrl}\n\nGates & Barriers`,
      relatedType: 'password_reset_verify',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'Password Reset Pending Verification', 'security', 'New password saved pending email verification']
    );

    res.json({ message: 'New password saved. Verify your Gmail before logging in with it.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.post('/verify-password-reset', [
  body('token').notEmpty().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query(
      `UPDATE users
       SET password_hash = pending_password_hash,
           pending_password_hash = NULL,
           pending_password_set_at = NULL,
           password_reset_verify_token = NULL,
           password_reset_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE password_reset_verify_token = $1
         AND pending_password_hash IS NOT NULL
       RETURNING id, email, full_name`,
      [req.body.token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already used verification link' });

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Password reset verified',
      body: `Hello ${user.full_name},\n\nYour password reset has been verified. You can now log in with your new password.\n\nGates & Barriers`,
      relatedType: 'password_reset_verified',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'Password Reset Verified', 'security', 'Password reset email verified and new password activated']
    );

    res.json({ message: 'Password reset verified. You can now log in with your new password.' });
  } catch (error) {
    console.error('Verify password reset error:', error);
    res.status(500).json({ error: 'Failed to verify password reset' });
  }
});

router.post('/set-password', [
  body('token').notEmpty().trim(),
  body('work_number').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
  body('confirm_password').isLength({ min: 6 }),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const { token, work_number, password, confirm_password } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const result = await db.query(
      `SELECT id, email, full_name, work_number FROM users
       WHERE password_reset_token = $1
         AND work_number = $2
         AND password_reset_expires_at > CURRENT_TIMESTAMP`,
      [token, work_number]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired setup link. Please contact your administrator.' });
    }

    const password_hash = await hashPassword(password);

    await db.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_code = NULL,
           password_reset_expires_at = NULL,
           password_reset_verify_token = NULL,
           password_reset_verified_at = NULL,
           pending_password_hash = NULL,
           pending_password_set_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [password_hash, user.id]
    );

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Password set successfully - Gates & Barriers',
      body: `Hello ${user.full_name},\n\nYour password has been set successfully. You can now sign in with your work number and new password.\n\nSign in at: ${getClientUrl(req)}/login\n\nGates & Barriers`,
      relatedType: 'password_set',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'Password Set', 'security', 'User set their password via admin-created setup link']
    );

    res.json({ message: 'Password set successfully. You can now sign in.' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

router.post('/change-password', authenticateToken, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const { current_password, new_password } = req.body;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validCurrent = await comparePassword(current_password, user.password_hash);
    if (!validCurrent) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await hashPassword(new_password);
    await db.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.user.id]);

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Password Changed', 'security', 'User changed their own password']
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });

      const db = req.app.get('db');
      if (!db) return res.status(500).json({ error: 'Database connection not available' });
      const result = await db.query(`SELECT ${publicUserFields} FROM users WHERE id = $1`, [decoded.id]);
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({ user });
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/profile', authenticateToken, [
  body('phone_number').optional().trim(),
  body('emergency_contact').optional().trim(),
  body('emergency_phone').optional().trim(),
  body('profile_picture_url').optional().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;

    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const { phone_number, emergency_contact, emergency_phone, profile_picture_url } = req.body;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE users SET
        phone_number = COALESCE($1, phone_number),
        emergency_contact = COALESCE($2, emergency_contact),
        emergency_phone = COALESCE($3, emergency_phone),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING ${publicUserFields}`,
      [
        phone_number || null,
        emergency_contact || null,
        emergency_phone || null,
        userId
      ]
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, user.full_name, user.email, 'Profile Updated', 'user_management', 'User updated their own profile']
    );

    res.json({ user, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/verify-email', [
  body('token').notEmpty().trim(),
], async (req, res) => {
  try {
    if (!validateRequest(req, res)) return;
    const db = req.app.get('db');
    if (!db) return res.status(500).json({ error: 'Database connection not available' });

    const result = await db.query(
      `UPDATE users
       SET email_verified_at = CURRENT_TIMESTAMP,
           email_verification_token = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE email_verification_token = $1
       RETURNING id, email, full_name`,
      [req.body.token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already used verification link' });

    await queueEmail(db, {
      recipientEmail: user.email,
      recipientName: user.full_name,
      subject: 'Email verified',
      body: `Hello ${user.full_name},\n\nYour email has been verified successfully. You can now log in to your account.\n\nGates & Barriers`,
      relatedType: 'email_verified',
      relatedId: user.id,
    });

    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.full_name, user.email, 'Email Verified', 'user_management', 'Email address verified successfully']
    );

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });

      const db = req.app.get('db');
      if (!db) return res.status(500).json({ error: 'Database connection not available' });
      const result = await db.query('SELECT id, email, full_name, role, work_number FROM users WHERE id = $1', [decoded.id]);
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newToken = generateToken(user);
      res.json({ token: newToken });
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;