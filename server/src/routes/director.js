const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Get Director Global Dashboard
router.get('/dashboard', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');

    const [
      totalRevenueResult,
      activeContractsResult,
      guardDeploymentResult,
      totalClientsResult,
      monthlyStatsResult,
      sitePerformanceResult
    ] = await Promise.all([
      // Total revenue from financial ledger
      db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_revenue
        FROM financial_ledger
        WHERE type IN ('salary', 'bonus') AND status = 'completed'
      `),
      
      // Active contracts (sites)
      db.query('SELECT COUNT(*) FROM sites WHERE status = $1', ['active']),
      
      // Guard deployment by site
      db.query(`
        SELECT s.id, s.client_name, s.location, COUNT(u.id) as guard_count
        FROM sites s
        LEFT JOIN users u ON u.site_id = s.id AND u.role = 'guard' AND u.account_status = 'active'
        WHERE s.status = 'active'
        GROUP BY s.id, s.client_name, s.location
        ORDER BY guard_count DESC
      `),
      
      // Total clients
      db.query('SELECT COUNT(DISTINCT client_name) as total_clients FROM sites WHERE status = $1', ['active']),
      
      // Monthly stats for the last 6 months
      db.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as new_guards,
          COUNT(CASE WHEN role = 'guard' THEN 1 END) as guard_count
        FROM users
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `),
      
      // Site performance metrics
      db.query(`
        SELECT
          s.id,
          s.client_name,
          s.location,
          COUNT(DISTINCT sh.id) as total_shifts,
          COUNT(DISTINCT CASE WHEN sh.status = 'completed' THEN sh.id END) as completed_shifts,
          COUNT(DISTINCT a.id) as incidents
        FROM sites s
        LEFT JOIN shifts sh ON sh.site_id = s.id AND sh.date >= CURRENT_DATE - INTERVAL '30 days'
        LEFT JOIN audits a ON a.site_id = s.id AND a.created_at >= CURRENT_DATE - INTERVAL '30 days'
        WHERE s.status = 'active'
        GROUP BY s.id, s.client_name, s.location
        ORDER BY total_shifts DESC
      `)
    ]);

    // Calculate retention rate and pipeline count
    const retentionRate = totalClientsResult.rows[0].total_clients > 0 
      ? Math.round((activeContractsResult.rows[0].count / totalClientsResult.rows[0].total_clients) * 100)
      : 0;
    
    const pipelineCount = monthlyStatsResult.rows.reduce((sum, row) => sum + parseInt(row.guard_count || 0), 0);

    res.json({
      financial: {
        totalRevenue: parseFloat(totalRevenueResult.rows[0].total_revenue),
        activeContracts: parseInt(activeContractsResult.rows[0].count)
      },
      deployment: guardDeploymentResult.rows,
      totalClients: parseInt(totalClientsResult.rows[0].total_clients),
      retentionRate,
      pipelineCount,
      monthlyStats: monthlyStatsResult.rows,
      sitePerformance: sitePerformanceResult.rows
    });
  } catch (error) {
    console.error('Get director dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch director dashboard' });
  }
});

// Get company-wide analytics with live database queries
router.get('/analytics', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { period = 'month' } = req.query;

    // Use unified analytics service
    const AnalyticsService = require('../services/analyticsService');
    const analyticsData = await AnalyticsService.getAnalytics(db, period);
    
    res.json(analyticsData);
  } catch (error) {
    console.error('Get analytics error:', error);
    // Return empty but valid structure instead of error
    res.json({
      summary: {
        totalRevenue: 0,
        totalWages: 0,
        totalBonuses: 0,
        totalDeductions: 0,
        netProfit: 0,
        retentionRate: 0,
        activeClients: 0,
        newClients: 0,
        lostClients: 0,
        totalApplications: 0,
        totalHired: 0,
        totalRejected: 0,
        totalPending: 0,
        totalIncidents: 0,
        resolvedIncidents: 0,
        pendingIncidents: 0,
        resolutionRate: 0,
        period: req.query.period || 'month',
        generatedAt: new Date().toISOString()
      },
      revenueTrends: [],
      wageBill: [],
      clientMetrics: [],
      recruitment: [],
      securityTrends: [],
      payrollTrends: []
    });
  }
});

// Get policies
router.get('/policies', authenticateToken, authorize('admin', 'director', 'manager', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    
    const result = await db.query(`
      SELECT id, title, content, category, version, created_by, created_at, updated_at
      FROM policies
      ORDER BY created_at DESC
    `);

    res.json({ policies: result.rows });
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

// Create policy
router.post('/policies', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { title, content, category, priority, version } = req.body;

    const result = await db.query(`
      INSERT INTO policies (title, content, category, priority, version, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [title, content, category, priority || 'medium', version || '1.0', req.user.id]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Policy Created', 'system', `Created policy: ${title}`]
    );

    res.status(201).json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

// Update policy
router.put('/policies/:id', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { title, content, category, version } = req.body;

    const result = await db.query(`
      UPDATE policies
      SET title = $1, content = $2, category = $3, version = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [title, content, category, version, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Policy Updated', 'system', `Updated policy: ${title}`]
    );

    res.json({ policy: result.rows[0] });
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

// Get resource allocation
router.get('/resources', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');

    const [
      budgetResult,
      insuranceResult,
      clientGoalsResult
    ] = await Promise.all([
      // Budget overview
      db.query(`
        SELECT 
          type,
          SUM(amount) as total,
          COUNT(*) as count
        FROM financial_ledger
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY type
      `),
      
      // Insurance compliance (guards with complete uniform status)
      db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE uniform_status = 'complete') as compliant,
          COUNT(*) FILTER (WHERE uniform_status = 'pending') as pending,
          COUNT(*) as total
        FROM users
        WHERE role = 'guard' AND account_status = 'active'
      `),
      
      // Client acquisition goals
      db.query(`
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(DISTINCT client_name) as new_clients
        FROM sites
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
      `)
    ]);

    res.json({
      budget: budgetResult.rows,
      insurance: {
        compliant: parseInt(insuranceResult.rows[0].compliant) || 0,
        pending: parseInt(insuranceResult.rows[0].pending) || 0,
        total: parseInt(insuranceResult.rows[0].total) || 0,
        complianceRate: insuranceResult.rows[0].total > 0 
          ? Math.round((insuranceResult.rows[0].compliant / insuranceResult.rows[0].total) * 100)
          : 0
      },
      clientGoals: clientGoalsResult.rows
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ error: 'Failed to fetch resource allocation' });
  }
});

// ============================================
// DIRECTOR CONTRACTS & PAYROLL SIGN-OFF API
// ============================================

// Get all forwarded contracts (applications and requests forwarded to director)
router.get('/contracts', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'all' } = req.query;

    // Fetch forwarded applications (contracts)
    const applicationsQuery = `
      SELECT 
        a.id,
        a.full_name as contractor_name,
        a.email as contractor_email,
        a.phone as contractor_phone,
        a.position,
        a.status,
        a.assigned_role,
        a.work_number,
        a.contract_document_url,
        a.forwarded_at,
        a.created_at,
        'application' as contract_type,
        u.full_name as forwarded_by_name
      FROM applications a
      LEFT JOIN users u ON a.forwarded_at IS NOT NULL AND u.id = a.id
      WHERE a.forwarded_at IS NOT NULL
        AND a.assigned_role = 'director'
        ${status !== 'all' ? 'AND a.status = $1' : ''}
      ORDER BY a.forwarded_at DESC
    `;

    // Fetch forwarded requests (site contracts)
    const requestsQuery = `
      SELECT 
        r.id,
        r.contractor_name,
        r.contractor_email,
        r.contractor_phone,
        r.site_location,
        r.property_type,
        r.coverage_hours,
        r.guards_needed,
        r.security_type,
        r.budget_estimate,
        r.status,
        r.assigned_role,
        r.forwarded_at,
        r.created_at,
        'request' as contract_type,
        u.full_name as forwarded_by_name
      FROM requests r
      LEFT JOIN users u ON r.forwarded_at IS NOT NULL AND u.id = r.id
      WHERE r.forwarded_at IS NOT NULL
        AND r.assigned_role = 'director'
        ${status !== 'all' ? 'AND r.status = $1' : ''}
      ORDER BY r.forwarded_at DESC
    `;

    const queryParams = status !== 'all' ? [status] : [];

    const [applicationsResult, requestsResult] = await Promise.all([
      db.query(applicationsQuery, queryParams),
      db.query(requestsQuery, queryParams)
    ]);

    const contracts = [
      ...applicationsResult.rows.map(row => ({
        ...row,
        contract_type: 'Guard Application'
      })),
      ...requestsResult.rows.map(row => ({
        ...row,
        contract_type: 'Site Contract'
      }))
    ].sort((a, b) => new Date(b.forwarded_at || b.created_at) - new Date(a.forwarded_at || a.created_at));

    res.json({ contracts });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Approve/reject contract
router.post('/contracts/:id/approve', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Try to update applications table first
    let result = await db.query(`
      UPDATE applications 
      SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND assigned_role = 'director'
      RETURNING *
    `, [newStatus, notes, id]);

    // If not found in applications, try requests table
    if (result.rows.length === 0) {
      result = await db.query(`
        UPDATE requests 
        SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND assigned_role = 'director'
        RETURNING *
      `, [newStatus, notes, id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, `Contract ${action}d`, 'document', `${action === 'approve' ? 'Approved' : 'Rejected'} contract ${id}`]
    );

    // Create notification for the contractor
    if (contract.contractor_email || contract.email) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, target_role, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        req.user.id,
        'contract',
        `Contract ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        `Contract ${id} has been ${action === 'approve' ? 'approved' : 'rejected'} by ${req.user.full_name}`,
        'high',
        'director',
        JSON.stringify({ contract_id: id, action, contractor_name: contract.contractor_name || contract.full_name })
      ]);
    }

    res.json({ 
      success: true, 
      contract,
      message: `Contract ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Approve contract error:', error);
    res.status(500).json({ error: 'Failed to process contract approval' });
  }
});

// ============================================
// PAYROLL SIGN-OFF WORKFLOW
// ============================================

// Get pending payroll summaries for sign-off
router.get('/payroll', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'pending_review', location = 'all' } = req.query;

    let whereClause = 'WHERE pr.status = $1';
    const queryParams = [status];

    if (location !== 'all') {
      whereClause += ` AND pr.location = $${queryParams.length + 1}`;
      queryParams.push(location);
    }

    const payrollRunsResult = await db.query(`
      SELECT 
        pr.*,
        s.site_name,
        s.location as site_location,
        u.full_name as created_by_name,
        u.email as created_by_email,
        so.full_name as signed_off_by_name,
        COUNT(p.id) as payslip_count,
        SUM(p.net_salary) as total_net_payable
      FROM payroll_runs pr
      LEFT JOIN sites s ON pr.site_id = s.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN users so ON pr.signed_off_by = so.id
      LEFT JOIN payslips p ON p.payroll_run_id = pr.id
      ${whereClause}
      GROUP BY pr.id, s.site_name, s.location, u.full_name, u.email, so.full_name
      ORDER BY pr.run_date DESC
    `, queryParams);

    // Get detailed payslips for each payroll run
    const payrollRuns = await Promise.all(
      payrollRunsResult.rows.map(async (run) => {
        const payslipsResult = await db.query(`
          SELECT 
            p.*,
            u.full_name as guard_name,
            u.work_number,
            u.email as guard_email
          FROM payslips p
          LEFT JOIN users u ON p.guard_id = u.id
          WHERE p.payroll_run_id = $1
          ORDER BY u.full_name
        `, [run.id]);

        return {
          ...run,
          payslips: payslipsResult.rows
        };
      })
    );

    res.json({ payrollRuns });
  } catch (error) {
    console.error('Get payroll error:', error);
    res.status(500).json({ error: 'Failed to fetch payroll summaries' });
  }
});

// Sign off payroll (director approval of calculations - Phase 1)
router.post('/payroll/:id/sign-off', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject' });
    }

    const newStatus = action === 'approve' ? 'signed_off' : 'cancelled';

    // Update payroll run status - uses signed_off_by/signed_off_at for Phase 1 sign-off
    const payrollResult = await db.query(`
      UPDATE payroll_runs 
      SET status = $1, signed_off_by = $2, signed_off_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND status = 'pending_review'
      RETURNING *
    `, [newStatus, req.user.id, id]);

    if (payrollResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll run not found or not in pending_review status' });
    }

    const payrollRun = payrollResult.rows[0];

    // Update all payslips in this payroll run
    await db.query(`
      UPDATE payslips 
      SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE payroll_run_id = $2
    `, [action === 'approve' ? 'processing' : 'failed', id]);

    // Log audit for payroll sign-off
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, `Payroll ${action === 'approve' ? 'Signed Off' : 'Rejected'}`, 'financial', 
        `${action === 'approve' ? 'Signed off' : 'Rejected'} payroll run ${id} for ${payrollRun.location} - KES ${parseFloat(payrollRun.total_net_amount).toFixed(2)}`]
    );

    // If signed off, create a treasury disbursement record in pending_authorization status
    if (action === 'approve') {
      await db.query(`
        INSERT INTO treasury_disbursements (
          payroll_run_id,
          disbursement_date,
          total_amount,
          status,
          notes
        ) VALUES ($1, CURRENT_DATE, $2, 'pending_authorization', $3)
      `, [id, payrollRun.total_net_amount, `Auto-created after payroll sign-off for ${payrollRun.location} period ${payrollRun.period_start} to ${payrollRun.period_end}`]);
    }

    res.json({ 
      success: true, 
      payrollRun,
      message: `Payroll ${action === 'approve' ? 'signed off' : 'rejected'} successfully. ${action === 'approve' ? 'Treasury disbursement record created, pending authorization.' : ''}`
    });
  } catch (error) {
    console.error('Payroll sign-off error:', error);
    res.status(500).json({ error: 'Failed to process payroll sign-off' });
  }
});

// ============================================
// TREASURY DISBURSEMENT WORKFLOW (Phase 2 - after sign-off)
// ============================================

// Get treasury disbursements pending authorization
router.get('/treasury', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'pending_authorization' } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ` AND td.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    const disbursementsResult = await db.query(`
      SELECT 
        td.*,
        pr.run_date,
        pr.period_start,
        pr.period_end,
        pr.location as payroll_location,
        pr.total_gross_amount,
        pr.total_deductions,
        pr.total_net_amount,
        pr.guard_count,
        pr.status as payroll_status,
        s.site_name,
        u.full_name as authorized_by_name,
        u.email as authorized_by_email
      FROM treasury_disbursements td
      LEFT JOIN payroll_runs pr ON td.payroll_run_id = pr.id
      LEFT JOIN sites s ON pr.site_id = s.id
      LEFT JOIN users u ON td.authorized_by = u.id
      ${whereClause}
      ORDER BY td.disbursement_date DESC, td.created_at DESC
    `, queryParams);

    res.json({ disbursements: disbursementsResult.rows });
  } catch (error) {
    console.error('Get treasury disbursements error:', error);
    res.status(500).json({ error: 'Failed to fetch treasury disbursements' });
  }
});

// Authorize treasury disbursement (director authorizes capital release - Phase 2)
router.post('/treasury/:id/disburse', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { action, notes, payment_method, reference_number } = req.body; // action: 'authorize' or 'reject'

    if (!['authorize', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be authorize or reject' });
    }

    const newStatus = action === 'authorize' ? 'disbursed' : 'cancelled';

    // Update treasury disbursement status - uses authorized_by/authorized_at for Phase 2 authorization
    const disbursementResult = await db.query(`
      UPDATE treasury_disbursements 
      SET status = $1, 
          authorized_by = $2, 
          authorized_at = CURRENT_TIMESTAMP, 
          payment_method = COALESCE($3, payment_method),
          reference_number = COALESCE($4, reference_number),
          notes = CASE WHEN $5 IS NOT NULL THEN 
            COALESCE(notes || E'\n', '') || $5
          ELSE notes END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND status = 'pending_authorization'
      RETURNING *
    `, [newStatus, req.user.id, payment_method, reference_number, notes, id]);

    if (disbursementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Disbursement not found or not in pending_authorization status' });
    }

    const disbursement = disbursementResult.rows[0];

    // If authorized, update the payroll run status to 'disbursed'
    if (action === 'authorize') {
      await db.query(`
        UPDATE payroll_runs 
        SET status = 'disbursed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'signed_off'
      `, [disbursement.payroll_run_id]);

      // Update all payslips in this payroll run to 'paid'
      await db.query(`
        UPDATE payslips 
        SET payment_status = 'paid', 
            disbursement_id = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE payroll_run_id = $2
      `, [id, disbursement.payroll_run_id]);
    }

    // Log audit for treasury disbursement
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, `Treasury ${action === 'authorize' ? 'Disbursed' : 'Rejected'}`, 'financial', 
        `${action === 'authorize' ? 'Authorized disbursement' : 'Rejected disbursement'} ${id} for KES ${parseFloat(disbursement.total_amount).toFixed(2)}`]
    );

    res.json({ 
      success: true, 
      disbursement,
      message: `Disbursement ${action === 'authorize' ? 'authorized and funds released' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('Treasury disbursement error:', error);
    res.status(500).json({ error: 'Failed to process treasury disbursement' });
  }
});

// ============================================
// FINANCIAL REPORTING DASHBOARD API
// ============================================

// Get financial analytics comparing Town vs Nyali
router.get('/financial-reports', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { period = 'month', location = 'all' } = req.query;

    // Use unified analytics service
    const AnalyticsService = require('../services/analyticsService');
    
    // Get financial metrics and payroll breakdown using the same service
    const [financialMetrics, payrollBreakdown] = await Promise.all([
      AnalyticsService.getFinancialMetrics(db, period, location),
      AnalyticsService.getPayrollBreakdown(db, period, location)
    ]);

    res.json({
      ...financialMetrics,
      payrollBreakdown
    });
  } catch (error) {
    console.error('Get financial reports error:', error);
    res.status(500).json({ error: 'Failed to fetch financial reports' });
  }
});

// Generate financial report
router.post('/financial-reports/generate', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { report_type, period_start, period_end, location } = req.body;

    // Calculate financial metrics
    const metricsQuery = await db.query(`
      SELECT 
        pr.location,
        COUNT(DISTINCT pr.id) as payroll_runs,
        COUNT(DISTINCT p.guard_id) as guard_count,
        COUNT(DISTINCT s.id) as site_count,
        SUM(pr.total_gross_amount) as total_wage_bill,
        SUM(p.bonus_amount) as total_bonuses,
        SUM(p.uniform_deduction + p.motor_gear_deduction + p.advance_deduction + p.penalty_deduction) as total_deductions,
        SUM(pr.total_net_amount) as total_net_paid
      FROM payroll_runs pr
      LEFT JOIN payslips p ON p.payroll_run_id = pr.id
      LEFT JOIN sites s ON s.location = pr.location AND s.status = 'active'
      WHERE pr.run_date >= $1 AND pr.run_date <= $2
      ${location !== 'all' ? 'AND pr.location = $3' : ''}
      GROUP BY pr.location
    `, location !== 'all' ? [period_start, period_end, location] : [period_start, period_end]);

    // Calculate revenue
    const revenueQuery = await db.query(`
      SELECT 
        location,
        SUM(day_rate * required_guards * 30) as monthly_revenue
      FROM sites
      WHERE status = 'active'
      ${location !== 'all' ? 'AND location = $1' : ''}
      GROUP BY location
    `, location !== 'all' ? [location] : []);

    // Create financial report records
    const reports = [];
    for (const metric of metricsQuery.rows) {
      const revenue = revenueQuery.rows.find(r => r.location === metric.location);
      const totalRevenue = parseFloat(revenue?.monthly_revenue) || 0;
      const totalWageBill = parseFloat(metric.total_wage_bill) || 0;
      const totalBonuses = parseFloat(metric.total_bonuses) || 0;
      const totalDeductions = parseFloat(metric.total_deductions) || 0;
      const netProfit = totalRevenue - totalWageBill - totalBonuses;

      const reportResult = await db.query(`
        INSERT INTO financial_reports (
          report_date,
          report_type,
          period_start,
          period_end,
          location,
          total_revenue,
          total_wage_bill,
          total_bonuses,
          total_deductions,
          net_profit,
          guard_count,
          site_count,
          metadata,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        CURRENT_DATE,
        report_type,
        period_start,
        period_end,
        metric.location,
        totalRevenue,
        totalWageBill,
        totalBonuses,
        totalDeductions,
        netProfit,
        metric.guard_count,
        metric.site_count,
        JSON.stringify({ payroll_runs: metric.payroll_runs }),
        req.user.id
      ]);

      reports.push(reportResult.rows[0]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Financial Report Generated', 'financial', 
        `Generated ${report_type} financial report for ${location === 'all' ? 'all locations' : location}`]
    );

    res.status(201).json({ 
      success: true, 
      reports,
      message: 'Financial report generated successfully'
    });
  } catch (error) {
    console.error('Generate financial report error:', error);
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
});

// ============================================
// COMPANY SCHEDULES MANAGEMENT
// ============================================

// Get all company schedules
router.get('/schedules', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status = 'all', event_type = 'all', start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];

    if (status !== 'all') {
      whereClause += ` AND cs.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    if (event_type !== 'all') {
      whereClause += ` AND cs.event_type = $${queryParams.length + 1}`;
      queryParams.push(event_type);
    }

    if (start_date) {
      whereClause += ` AND cs.event_date >= $${queryParams.length + 1}`;
      queryParams.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND cs.event_date <= $${queryParams.length + 1}`;
      queryParams.push(end_date);
    }

    const schedulesResult = await db.query(`
      SELECT 
        cs.*,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM company_schedules cs
      LEFT JOIN users u ON cs.created_by = u.id
      ${whereClause}
      ORDER BY cs.event_date ASC, cs.start_time ASC
    `, queryParams);

    res.json({ schedules: schedulesResult.rows });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create new schedule
router.post('/schedules', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      venue,
      event_type,
      priority,
      target_audience,
      notify_all,
      notes
    } = req.body;

    if (!title || !event_date || !start_time || !end_time || !venue) {
      return res.status(400).json({ error: 'Title, event date, start time, end time, and venue are required' });
    }

    // Validate time range
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Prevent concurrent meetings: no two events may run at overlapping times on the same date
    const conflictResult = await db.query(`
      SELECT id, title, start_time, end_time
      FROM company_schedules
      WHERE event_date = $1::date
        AND status NOT IN ('cancelled', 'postponed')
        AND start_time < $3::time
        AND end_time > $2::time
      LIMIT 1
    `, [event_date, start_time, end_time]);

    if (conflictResult.rows.length > 0) {
      const conflict = conflictResult.rows[0];
      return res.status(409).json({
        error: `Time conflict: "${conflict.title}" is already scheduled from ${conflict.start_time} to ${conflict.end_time} on this date. No two meetings can run concurrently.`,
        conflict
      });
    }

    const result = await db.query(`
      INSERT INTO company_schedules (
        title, description, event_date, start_time, end_time, venue,
        event_type, priority, status, created_by, target_audience, notify_all, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      title,
      description || null,
      event_date,
      start_time,
      end_time,
      venue,
      event_type || 'meeting',
      priority || 'medium',
      'scheduled',
      req.user.id,
      target_audience || 'all',
      notify_all || false,
      notes || null
    ]);

    const schedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Created', 'system', 
        `Created company schedule: ${title} on ${event_date}`]
    );

    // If notify_all is true, create notifications for all users
    if (notify_all) {
      const usersResult = await db.query('SELECT id FROM users WHERE account_status = $1', ['active']);
      
      for (const user of usersResult.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, priority, target_role, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          user.id,
          'schedule',
          title,
          `New company event scheduled: ${title} on ${event_date} from ${start_time} to ${end_time} at ${venue}`,
          priority || 'medium',
          target_audience || 'all',
          JSON.stringify({ schedule_id: schedule.id, event_date, start_time, end_time, venue })
        ]);
      }
    }

    res.status(201).json({ 
      success: true, 
      schedule,
      message: 'Schedule created successfully'
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule
router.put('/schedules/:id', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      venue,
      event_type,
      priority,
      status,
      target_audience,
      notify_all,
      notes
    } = req.body;

    // Validate time range
    if (start_time && end_time && start_time >= end_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Prevent concurrent meetings when rescheduling (exclude the schedule being updated)
    if (event_date && start_time && end_time) {
      const conflictResult = await db.query(`
        SELECT id, title, start_time, end_time
        FROM company_schedules
        WHERE event_date = $1::date
          AND id <> $2::uuid
          AND status NOT IN ('cancelled', 'postponed')
          AND start_time < $4::time
          AND end_time > $3::time
        LIMIT 1
      `, [event_date, id, start_time, end_time]);

      if (conflictResult.rows.length > 0) {
        const conflict = conflictResult.rows[0];
        return res.status(409).json({
          error: `Time conflict: "${conflict.title}" is already scheduled from ${conflict.start_time} to ${conflict.end_time} on this date. No two meetings can run concurrently.`,
          conflict
        });
      }
    }

    const result = await db.query(`
      UPDATE company_schedules
      SET title = $1,
          description = $2,
          event_date = $3,
          start_time = $4,
          end_time = $5,
          venue = $6,
          event_type = $7,
          priority = $8,
          status = $9,
          target_audience = $10,
          notify_all = $11,
          notes = $12,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      title,
      description,
      event_date,
      start_time,
      end_time,
      venue,
      event_type,
      priority,
      status,
      target_audience,
      notify_all,
      notes,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Updated', 'system', 
        `Updated company schedule: ${title} (ID: ${id})`]
    );

    res.json({ 
      success: true, 
      schedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/schedules/:id', authenticateToken, authorize('admin', 'director'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;

    const result = await db.query('DELETE FROM company_schedules WHERE id = $1 RETURNING id, title', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const deletedSchedule = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Schedule Deleted', 'system', 
        `Deleted company schedule: ${deletedSchedule.title} (ID: ${id})`]
    );

    res.json({ 
      success: true, 
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

module.exports = router;
