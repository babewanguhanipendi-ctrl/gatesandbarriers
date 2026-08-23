'use strict';

const { getWageRates, getShiftRateForRole } = require('../config/wages');

function isEligibleForPaidLeave(hireDate, asOfDate = new Date()) {
  if (!hireDate) return false;
  const anniversary = new Date(`${hireDate}T00:00:00Z`);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return new Date(asOfDate) >= anniversary;
}

async function createPaidLeave(db, { userId, startDate, endDate, reason }) {
  const worker = await db.query(
    'SELECT id, role, hire_date, daily_rate FROM users WHERE id = $1 AND account_status = $2',
    [userId, 'active']
  );
  if (!worker.rows[0]) throw new Error('Worker not found or inactive');

  if (!isEligibleForPaidLeave(worker.rows[0].hire_date, startDate)) {
    const error = new Error('Paid full-salary leave requires more than one year of service');
    error.statusCode = 400;
    throw error;
  }

  return db.query(
    `INSERT INTO leave_records (user_id, start_date, end_date, status, paid_full_salary, reason)
     VALUES ($1, $2, $3, 'approved', TRUE, $4)
     RETURNING *`,
    [userId, startDate, endDate, reason || null]
  );
}

async function recordLeaveWork(db, { leaveRecordId, userId, siteId, date, startTime, notes }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const leaveResult = await client.query(
      `SELECT lr.*, u.role, u.hire_date
       FROM leave_records lr JOIN users u ON u.id = lr.user_id
       WHERE lr.id = $1 AND lr.user_id = $2 AND lr.status = 'approved'
       FOR UPDATE`,
      [leaveRecordId, userId]
    );
    const leave = leaveResult.rows[0];
    if (!leave) throw Object.assign(new Error('Approved leave record not found'), { statusCode: 404 });

    const workDate = date || leave.start_date;
    if (workDate < leave.start_date || workDate > leave.end_date) {
      throw Object.assign(new Error('Work date must fall within the approved leave period'), { statusCode: 400 });
    }
    if (!isEligibleForPaidLeave(leave.hire_date, workDate)) {
      throw Object.assign(new Error('Worker is not eligible for paid full-salary leave'), { statusCode: 400 });
    }
    if (leave.worked_during_leave) {
      throw Object.assign(new Error('Leave work has already been recorded'), { statusCode: 409 });
    }

    const rates = await getWageRates(client);
    const shiftRate = getShiftRateForRole(leave.role, rates);
    const start = new Date(`${workDate}T${startTime || '18:00:00'}`);
    const end = new Date(start.getTime() + rates.standardShiftHours * 60 * 60 * 1000);

    const shiftResult = await client.query(
      `INSERT INTO shifts
        (guard_id, site_id, date, shift_type, status, start_time, end_time, hourly_rate,
         daily_rate, notes, is_overtime, overtime_reason)
       VALUES ($1, $2, $3, 'overtime', 'completed', $4, $5, NULL, $6, $7, TRUE, $8)
       RETURNING *`,
      [userId, siteId, workDate, start, end, shiftRate, notes || 'Worked during paid leave', 'Leave work override']
    );

    await client.query(
      `UPDATE leave_records
       SET worked_during_leave = TRUE, overtime_shift_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [shiftResult.rows[0].id, leaveRecordId]
    );

    await client.query(
      `INSERT INTO financial_ledgers
        (user_id, site_id, leave_record_id, entry_type, amount_shillings, description)
       VALUES ($1, $2, $3, 'paid_leave', $4, $5),
              ($1, $2, $3, 'overtime', $6, $7)`,
      [userId, siteId, leaveRecordId, shiftRate, 'Full-salary paid leave entitlement',
       shiftRate * 1.5, 'Overtime worked during paid leave']
    );

    await client.query('COMMIT');
    return { shift: shiftResult.rows[0], leavePay: shiftRate, overtimePay: shiftRate * 1.5 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { isEligibleForPaidLeave, createPaidLeave, recordLeaveWork };
