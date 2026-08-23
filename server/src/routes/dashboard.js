const express = require('express');
const { authenticateToken, authorize, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get admin dashboard stats
router.get('/admin', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');

    const [
      totalUsersResult,
      activeGuardsResult,
      pendingResignationsResult,
      totalSitesResult,
      complianceRisksResult
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM users WHERE role = $1 AND account_status = $2', ['guard', 'active']),
      db.query('SELECT COUNT(*) FROM users WHERE account_status = $1', ['resigning']),
      db.query('SELECT COUNT(*) FROM sites'),
      db.query('SELECT COUNT(*) FROM users WHERE compliance_risk = true')
    ]);

    res.json({
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      activeGuards: parseInt(activeGuardsResult.rows[0].count),
      pendingResignations: parseInt(pendingResignationsResult.rows[0].count),
      totalSites: parseInt(totalSitesResult.rows[0].count),
      complianceRisks: parseInt(complianceRisksResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get management dashboard stats (AWOL, resignations)
router.get('/management', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');

    // Get AWOL guards (no activity for 5+ days)
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const awolResult = await db.query(
      `SELECT id, work_number, full_name, last_active_date, site_id,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - last_active_date)) as days_inactive
       FROM users
       WHERE role = 'guard'
         AND account_status = 'active'
         AND last_active_date <= $1`,
      [fiveDaysAgo]
    );

    const awolGuards = awolResult.rows.map(guard => ({
      ...guard,
      days_inactive: parseInt(guard.days_inactive),
      urgency: guard.days_inactive >= 7 ? 'critical' : 'warning'
    }));

    // Get active resignations
    const resignationsResult = await db.query(
      `SELECT id, work_number, full_name, resignation_date, compliance_risk,
        EXTRACT(DAY FROM (resignation_date + INTERVAL '30 days' - CURRENT_DATE)) as days_remaining
       FROM users
       WHERE account_status = 'resigning'`
    );

    const resignations = resignationsResult.rows.map(r => ({
      ...r,
      days_remaining: Math.max(0, parseInt(r.days_remaining)),
      accountDisableDate: new Date(new Date(r.resignation_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isComplianceRisk: r.compliance_risk
    }));

    // Get total active guards
    const activeGuardsResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE role = $1 AND account_status = $2',
      ['guard', 'active']
    );

    res.json({
      totalActiveGuards: parseInt(activeGuardsResult.rows[0].count),
      awolCount: awolGuards.length,
      awolGuards,
      resignations
    });
  } catch (error) {
    console.error('Get management dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get guard dashboard stats
router.get('/guard', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const guardId = req.user.id;

    // Get current month shifts
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const currentMonthEnd = new Date();
    currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);
    currentMonthEnd.setDate(0);
    currentMonthEnd.setHours(23, 59, 59, 999);

    const shiftsResult = await db.query(
      `SELECT COUNT(*) as total_shifts,
        COUNT(CASE WHEN shift_type = 'day' THEN 1 END) as day_shifts,
        COUNT(CASE WHEN shift_type = 'night' THEN 1 END) as night_shifts
       FROM shifts
       WHERE guard_id = $1
         AND date >= $2
         AND date <= $3`,
      [guardId, currentMonthStart.toISOString().split('T')[0], currentMonthEnd.toISOString().split('T')[0]]
    );

    // Get resignation status
    const resignationResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_status = $2',
      [guardId, 'resigning']
    );

    const resignation = resignationResult.rows[0];

    res.json({
      shifts: shiftsResult.rows[0],
      resignation
    });
  } catch (error) {
    console.error('Get guard dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Process expired resignations (Admin only)
router.post('/process-resignations', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.query(
      'UPDATE users SET account_status = $1, updated_at = CURRENT_TIMESTAMP WHERE account_status = $2 AND resignation_date <= $3 RETURNING id, work_number, full_name',
      ['disabled', 'resigning', thirtyDaysAgo.toISOString().split('T')[0]]
    );

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Resignations Processed', 'system', `Processed ${result.rows.length} expired resignations`]
    );

    res.json({
      processed: result.rows.length,
      users: result.rows
    });
  } catch (error) {
    console.error('Process resignations error:', error);
    res.status(500).json({ error: 'Failed to process resignations' });
  }
});

module.exports = router;