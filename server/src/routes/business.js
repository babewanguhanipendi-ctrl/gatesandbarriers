const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { isDeductionExempt, getWageRates, getShiftRateForRole } = require('../config/wages');
const { createPaidLeave, recordLeaveWork } = require('../services/leaveService');

const router = express.Router();

// Calculate monthly pay for a guard
router.get('/payroll', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { guard_id, month } = req.query;

    if (!guard_id || !month) {
      return res.status(400).json({ error: 'guard_id and month are required' });
    }

    // Get guard profile with site information
    const guardResult = await db.query(
      `SELECT u.*, s.day_rate, s.night_rate, s.client_name as site_client_name
       FROM users u
       LEFT JOIN sites s ON u.site_id = s.id
       WHERE u.id = $1`,
      [guard_id]
    );

    const guard = guardResult.rows[0];
    if (!guard) {
      return res.status(404).json({ error: 'Guard not found' });
    }

    // HIGHEST PRIORITY: Fixed Shift Wage Baselines (12-hour shifts)
    // Guard = 254 KES, Supervisor = 400 KES per standard shift (editable via portal).
    const wageRates = await getWageRates(db);
    const shiftRate = getShiftRateForRole(guard.role, wageRates);

    // Parse month (format: YYYY-MM)
    const [year, monthNum] = month.split('-');
    const monthStart = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const monthEnd = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);

    // Fetch all shifts for the guard in the specified month
    const shiftsResult = await db.query(
      'SELECT * FROM shifts WHERE guard_id = $1 AND date >= $2 AND date <= $3',
      [guard_id, monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]]
    );

    const shifts = shiftsResult.rows;

    // Calculate base pay using the fixed shift baselines
    let dayShifts = 0;
    let nightShifts = 0;
    let overtimeShifts = 0;
    const standardMonthlyShifts = 26;

    shifts.forEach(shift => {
      if (shift.shift_type === 'day') {
        dayShifts++;
      } else if (shift.shift_type === 'night') {
        nightShifts++;
      } else if (shift.shift_type === 'overtime') {
        overtimeShifts++;
      }
    });

    // Standard shifts pay exactly the fixed baseline rate; overtime pays 1.5x.
    const basePay = ((dayShifts + nightShifts) * shiftRate) + (overtimeShifts * shiftRate * 1.5);

    // Apply Uniform Deduction (3-month rule)
    // DEDUCTION EXEMPTION: Supervisors are strictly exempt from ALL uniform/gear/equipment
    // deductions - deduction logic skips supervisors entirely.
    let uniformDeduction = 0;
    const joinDate = new Date(guard.join_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (!isDeductionExempt(guard.role) && joinDate > threeMonthsAgo && guard.uniform_status === 'pending') {
      const uniformRecord = await db.query(
        'SELECT amount, installment_count FROM financial_ledger WHERE guard_id = $1 AND type = $2 AND status = $3',
        [guard_id, 'uniform', 'active']
      );

      if (uniformRecord.rows.length > 0) {
        uniformDeduction = uniformRecord.rows[0].amount / uniformRecord.rows[0].installment_count;
      }
    }

    // Apply Penalty Tranches
    let penaltyDeduction = 0;
    const penaltiesResult = await db.query(
      'SELECT * FROM financial_ledger WHERE guard_id = $1 AND type = $2 AND status = $3',
      [guard_id, 'penalty', 'active']
    );

    const penalties = penaltiesResult.rows;
    penalties.forEach(penalty => {
      const monthlyInstallment = penalty.amount / penalty.installment_count;
      penaltyDeduction += monthlyInstallment;
    });

    // Off-Day Bonus
    let offDayBonus = 0;
    const totalShifts = dayShifts + nightShifts;

    if (totalShifts > standardMonthlyShifts) {
      const offDayShifts = totalShifts - standardMonthlyShifts;
      offDayBonus = offDayShifts * shiftRate * 1.5;
    }

    // Calculate net pay
    const grossPay = basePay + offDayBonus;
    const totalDeductions = uniformDeduction + penaltyDeduction;
    const netPay = grossPay - totalDeductions;

    res.json({
      guardId: guard_id,
      workNumber: guard.work_number,
      guardName: guard.full_name,
      siteName: guard.site_client_name,
      month,
      basePay,
      dayShifts,
      nightShifts,
      totalShifts,
      offDayBonus,
      uniformDeduction,
      penaltyDeduction,
      grossPay,
      totalDeductions,
      netPay,
      details: {
        shiftRate,
        overtimeShifts,
        deductionExempt: isDeductionExempt(guard.role),
        standardMonthlyShifts,
        isOnUniformPlan: !isDeductionExempt(guard.role) && joinDate > threeMonthsAgo && guard.uniform_status === 'pending'
      }
    });
  } catch (error) {
    console.error('Calculate payroll error:', error);
    res.status(500).json({ error: 'Failed to calculate payroll' });
  }
});

router.post('/leave', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, reason, user_id } = req.body;
    const requestedUserId = user_id || req.user.id;
    if (requestedUserId !== req.user.id && !['admin', 'manager', 'director'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You may only request leave for yourself' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    const result = await createPaidLeave(req.app.get('db'), {
      userId: requestedUserId, startDate: start_date, endDate: end_date, reason
    });
    res.status(201).json({ leave: result.rows[0] });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create leave record' });
  }
});

router.post('/leave/:id/work', authenticateToken, async (req, res) => {
  try {
    const { site_id, date, start_time, notes } = req.body;
    if (!site_id) return res.status(400).json({ error: 'site_id is required' });
    const result = await recordLeaveWork(req.app.get('db'), {
      leaveRecordId: req.params.id,
      userId: req.user.id,
      siteId: site_id,
      date,
      startTime: start_time,
      notes
    });
    res.status(201).json({ ...result, message: 'Leave pay and overtime earnings recorded in KES' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to record leave work' });
  }
});
// Check AWOL status
router.get('/awol', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const guardsResult = await db.query(
      'SELECT id, work_number, full_name, last_active_date, site_id FROM users WHERE role = $1 AND account_status = $2',
      ['guard', 'active']
    );

    const guards = guardsResult.rows;
    const awolGuards = [];

    guards.forEach(guard => {
      const lastActiveDate = new Date(guard.last_active_date);
      
      if (lastActiveDate <= fiveDaysAgo) {
        const daysInactive = Math.floor((new Date() - lastActiveDate) / (1000 * 60 * 60 * 24));
        
        awolGuards.push({
          guardId: guard.id,
          workNumber: guard.work_number,
          fullName: guard.full_name,
          lastActiveDate: guard.last_active_date,
          daysInactive,
          urgency: daysInactive >= 7 ? 'critical' : 'warning',
          site: guard.site_id
        });
      }
    });

    res.json({
      totalActiveGuards: guards.length,
      awolCount: awolGuards.length,
      awolGuards
    });
  } catch (error) {
    console.error('Check AWOL error:', error);
    res.status(500).json({ error: 'Failed to check AWOL status' });
  }
});

// Initiate resignation
router.post('/resignation', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const guardId = req.user.id;
    const { reason, resignation_letter_url } = req.body;

    const currentDate = new Date().toISOString().split('T')[0];

    // Update guard profile
    const result = await db.query(
      `UPDATE users 
       SET account_status = $1, 
           resignation_date = $2, 
           resignation_reason = $3, 
           resignation_letter_url = $4, 
           compliance_risk = $5,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6 
       RETURNING id, work_number, email, full_name, role, account_status, join_date, uniform_status, last_active_date, site_id, phone_number, id_number, emergency_contact, emergency_phone, resignation_date, resignation_reason, resignation_letter_url, compliance_risk, created_at, updated_at`,
      [
        'resigning',
        currentDate,
        reason,
        resignation_letter_url,
        !resignation_letter_url,
        guardId
      ]
    );

    const guard = result.rows[0];

    // Create resignation record in financial_ledger
    await db.query(
      'INSERT INTO financial_ledger (guard_id, type, amount, status, description, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        guardId,
        'resignation',
        0,
        'active',
        `Resignation initiated on ${currentDate}. 30-day notice period.`,
        {
          resignation_date: currentDate,
          notice_period_days: 30,
          account_disable_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          has_letter: !!resignation_letter_url,
          compliance_risk: !resignation_letter_url
        }
      ]
    );

    // If compliance risk (no letter), create notification for managers
    if (!resignation_letter_url) {
      // Get all managers and admins
      const managersResult = await db.query(
        "SELECT id FROM users WHERE role IN ('admin', 'director', 'manager', 'supervisor') AND account_status = 'active'"
      );

      for (const manager of managersResult.rows) {
        await db.query(
          'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            manager.id,
            'compliance_warning',
            'Resignation Without Formal Letter',
            `Guard ${guard.full_name} (Work #${guard.work_number}) has initiated resignation without uploading a formal resignation letter.`,
            'high',
            JSON.stringify({ guard_id: guardId, guard_name: guard.full_name, work_number: guard.work_number, action_required: 'Request resignation letter' })
          ]
        );
      }
    }

    res.json({
      success: true,
      guard,
      resignationDate: currentDate,
      accountDisableDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      complianceRisk: !resignation_letter_url,
      message: resignation_letter_url 
        ? 'Resignation initiated successfully with formal letter.' 
        : 'Resignation initiated. WARNING: No formal letter uploaded. Compliance risk flagged.'
    });
  } catch (error) {
    console.error('Initiate resignation error:', error);
    res.status(500).json({ error: 'Failed to initiate resignation' });
  }
});

// Get resignation countdown
router.get('/resignation-countdown', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const guardsResult = await db.query(
      'SELECT id, work_number, full_name, resignation_date, compliance_risk FROM users WHERE account_status = $1',
      ['resigning']
    );

    const guards = guardsResult.rows;

    const guardsWithCountdown = guards.map(guard => {
      const resignationDate = new Date(guard.resignation_date);
      const currentDate = new Date();
      const daysRemaining = Math.ceil((resignationDate - currentDate) / (1000 * 60 * 60 * 24)) + 30;
      
      const disableDate = new Date(resignationDate);
      disableDate.setDate(disableDate.getDate() + 30);
      const daysUntilDisable = Math.ceil((disableDate - currentDate) / (1000 * 60 * 60 * 24));

      return {
        ...guard,
        daysRemaining: Math.max(0, daysRemaining),
        daysUntilDisable: Math.max(0, daysUntilDisable),
        accountDisableDate: disableDate.toISOString().split('T')[0],
        isComplianceRisk: guard.compliance_risk
      };
    });

    res.json(guardsWithCountdown);
  } catch (error) {
    console.error('Get resignation countdown error:', error);
    res.status(500).json({ error: 'Failed to get resignation countdown' });
  }
});

module.exports = router;