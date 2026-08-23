/**
 * Unified Analytics Service
 * Provides consistent financial metrics across all director views
 */

class AnalyticsService {
  /**
   * Get date filter SQL based on period
   */
  static getDateFilter(period, columnName = 'pr.run_date') {
    const filters = {
      week: `AND ${columnName} >= CURRENT_DATE - INTERVAL '7 days'`,
      month: `AND ${columnName} >= CURRENT_DATE - INTERVAL '30 days'`,
      quarter: `AND ${columnName} >= CURRENT_DATE - INTERVAL '3 months'`,
      year: `AND ${columnName} >= CURRENT_DATE - INTERVAL '1 year'`
    };
    return filters[period] || filters.month;
  }

  /**
   * Get location filter SQL based on location parameter
   */
  static getLocationFilter(location, paramIndex = 1) {
    if (location && location !== 'all') {
      return `AND pr.location = $${paramIndex}`;
    }
    return '';
  }

  /**
   * Core financial metrics calculation
   * Used by both /analytics and /financial-reports endpoints
   */
  static async getFinancialMetrics(db, period = 'month', location = 'all') {
    const dateFilter = this.getDateFilter(period);
    const locationFilter = this.getLocationFilter(location);
    const queryParams = location !== 'all' ? [location] : [];

    // Initialize with safe defaults
    let revenueByLocation = { rows: [] };
    let wageBillsByLocation = { rows: [] };
    let bonusesByLocation = { rows: [] };
    let deductionsByLocation = { rows: [] };
    let dailyRateAnalysis = { rows: [] };

    try {
      // Get revenue by location (from sites)
      revenueByLocation = await db.query(`
        SELECT 
          s.location,
          COUNT(DISTINCT s.id) as site_count,
          SUM(s.day_rate * s.required_guards) as daily_revenue,
          SUM(s.day_rate * s.required_guards * 30) as monthly_revenue
        FROM sites s
        WHERE s.status = 'active'
        GROUP BY s.location
      `);
    } catch (error) {
      console.warn('[AnalyticsService] Revenue query failed:', error.message);
    }

    try {
      // Get wage bills by location
      wageBillsByLocation = await db.query(`
        SELECT 
          pr.location,
          COUNT(DISTINCT pr.id) as payroll_runs,
          COUNT(DISTINCT p.guard_id) as guard_count,
          SUM(pr.total_gross_amount) as total_gross,
          SUM(pr.total_deductions) as total_deductions,
          SUM(pr.total_net_amount) as total_net
        FROM payroll_runs pr
        LEFT JOIN payslips p ON p.payroll_run_id = pr.id
        ${dateFilter}
        ${locationFilter}
        GROUP BY pr.location
      `, queryParams);
    } catch (error) {
      console.warn('[AnalyticsService] Wage bills query failed:', error.message);
    }

    try {
      // Calculate bonuses by location (Nyali gets +1000 KES monthly bonus)
      bonusesByLocation = await db.query(`
        SELECT 
          pr.location,
          SUM(p.bonus_amount) as total_bonuses,
          COUNT(p.id) as bonus_count
        FROM payslips p
        LEFT JOIN payroll_runs pr ON p.payroll_run_id = pr.id
        ${dateFilter}
        ${locationFilter}
        GROUP BY pr.location
      `, queryParams);
    } catch (error) {
      console.warn('[AnalyticsService] Bonuses query failed:', error.message);
    }

    try {
      // Get uniform/motor gear deductions by location
      deductionsByLocation = await db.query(`
        SELECT 
          pr.location,
          SUM(p.uniform_deduction) as total_uniform_deductions,
          SUM(p.motor_gear_deduction) as total_motor_gear_deductions,
          SUM(p.advance_deduction) as total_advance_deductions,
          SUM(p.penalty_deduction) as total_penalty_deductions,
          SUM(p.total_deductions) as total_deductions
        FROM payslips p
        LEFT JOIN payroll_runs pr ON p.payroll_run_id = pr.id
        ${dateFilter}
        ${locationFilter}
        GROUP BY pr.location
      `, queryParams);
    } catch (error) {
      console.warn('[AnalyticsService] Deductions query failed:', error.message);
    }

    try {
      // Calculate daily rates (254/300 KES)
      dailyRateAnalysis = await db.query(`
        SELECT 
          pr.location,
          AVG(p.daily_rate) as avg_daily_rate,
          MIN(p.daily_rate) as min_daily_rate,
          MAX(p.daily_rate) as max_daily_rate,
          SUM(p.days_worked) as total_days_worked
        FROM payslips p
        LEFT JOIN payroll_runs pr ON p.payroll_run_id = pr.id
        ${dateFilter}
        ${locationFilter}
        GROUP BY pr.location
      `, queryParams);
    } catch (error) {
      console.warn('[AnalyticsService] Daily rate analysis failed:', error.message);
    }

    // Compile location data with safe defaults
    const townData = {
      location: 'Town',
      revenue: revenueByLocation.rows.find(r => r.location === 'town') || {},
      wages: wageBillsByLocation.rows.find(r => r.location === 'town') || {},
      bonuses: bonusesByLocation.rows.find(r => r.location === 'town') || {},
      deductions: deductionsByLocation.rows.find(r => r.location === 'town') || {},
      dailyRates: dailyRateAnalysis.rows.find(r => r.location === 'town') || {}
    };

    const nyaliData = {
      location: 'Nyali',
      revenue: revenueByLocation.rows.find(r => r.location === 'nyali') || {},
      wages: wageBillsByLocation.rows.find(r => r.location === 'nyali') || {},
      bonuses: bonusesByLocation.rows.find(r => r.location === 'nyali') || {},
      deductions: deductionsByLocation.rows.find(r => r.location === 'nyali') || {},
      dailyRates: dailyRateAnalysis.rows.find(r => r.location === 'nyali') || {}
    };

    // Calculate totals and comparisons with safe parsing
    const totalRevenue = (parseFloat(townData.revenue.monthly_revenue) || 0) + 
                         (parseFloat(nyaliData.revenue.monthly_revenue) || 0);
    const totalWages = (parseFloat(townData.wages.total_net) || 0) + 
                       (parseFloat(nyaliData.wages.total_net) || 0);
    const totalBonuses = (parseFloat(townData.bonuses.total_bonuses) || 0) + 
                         (parseFloat(nyaliData.bonuses.total_bonuses) || 0);
    const totalDeductions = (parseFloat(townData.deductions.total_deductions) || 0) + 
                            (parseFloat(nyaliData.deductions.total_deductions) || 0);
    const netProfit = totalRevenue - totalWages - totalBonuses;

    return {
      summary: {
        totalRevenue,
        totalWages,
        totalBonuses,
        totalDeductions,
        netProfit,
        period,
        generatedAt: new Date().toISOString()
      },
      comparison: {
        town: townData,
        nyali: nyaliData
      },
      revenueByLocation: revenueByLocation.rows
    };
  }

  /**
   * Get payroll breakdown for financial reports
   */
  static async getPayrollBreakdown(db, period = 'month', location = 'all') {
    const dateFilter = this.getDateFilter(period);
    const locationFilter = this.getLocationFilter(location);
    const queryParams = location !== 'all' ? [location] : [];

    try {
      const payrollBreakdown = await db.query(`
        SELECT 
          pr.location,
          pr.run_date,
          pr.period_start,
          pr.period_end,
          pr.guard_count,
          pr.total_gross_amount,
          pr.total_deductions,
          pr.total_net_amount,
          s.site_name,
          COUNT(p.id) as payslip_count
        FROM payroll_runs pr
        LEFT JOIN sites s ON pr.site_id = s.id
        LEFT JOIN payslips p ON p.payroll_run_id = pr.id
        ${dateFilter}
        ${locationFilter}
        GROUP BY pr.id, s.site_name
        ORDER BY pr.run_date DESC
      `, queryParams);

      return payrollBreakdown.rows;
    } catch (error) {
      console.warn('[AnalyticsService] Payroll breakdown query failed:', error.message);
      return [];
    }
  }

  /**
   * Get comprehensive analytics data for /api/director/analytics
   */
  static async getAnalytics(db, period = 'month') {
    const dateFilter = this.getDateFilter(period);

    // Initialize with empty defaults
    let revenueTrendsResult = { rows: [] };
    let wageBillResult = { rows: [] };
    let clientMetricsResult = { rows: [] };
    let recruitmentResult = { rows: [] };
    let securityTrendsResult = { rows: [] };
    let payrollTrendsResult = { rows: [] };

    try {
      const queries = [
        // Revenue trends by location
        db.query(`
          SELECT 
            s.location,
            COUNT(DISTINCT s.id) as site_count,
            SUM(s.day_rate * s.required_guards) as daily_revenue,
            SUM(s.day_rate * s.required_guards * 30) as monthly_revenue,
            COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_sites
          FROM sites s
          WHERE s.status = 'active'
          GROUP BY s.location
        `).catch(err => {
          console.warn('[AnalyticsService] Revenue trends query failed:', err.message);
          return { rows: [] };
        }),

        // Wage bill analysis with detailed breakdown
        db.query(`
          SELECT 
            pr.location,
            COUNT(DISTINCT pr.id) as payroll_runs,
            COUNT(DISTINCT p.guard_id) as guard_count,
            SUM(pr.total_gross_amount) as total_gross,
            SUM(pr.total_deductions) as total_deductions,
            SUM(pr.total_net_amount) as total_net,
            AVG(p.daily_rate) as avg_daily_rate,
            SUM(p.bonus_amount) as total_bonuses,
            SUM(p.uniform_deduction) as uniform_deductions,
            SUM(p.motor_gear_deduction) as motor_gear_deductions
          FROM payroll_runs pr
          LEFT JOIN payslips p ON p.payroll_run_id = pr.id
          ${dateFilter}
          GROUP BY pr.location
        `).catch(err => {
          console.warn('[AnalyticsService] Wage bill query failed:', err.message);
          return { rows: [] };
        }),

        // Client retention and acquisition
        db.query(`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) as active_clients,
            COUNT(DISTINCT CASE WHEN status = 'active' AND created_at >= CURRENT_DATE - INTERVAL '30 days' THEN id END) as new_clients,
            COUNT(DISTINCT CASE WHEN status = 'inactive' AND updated_at >= CURRENT_DATE - INTERVAL '30 days' THEN id END) as lost_clients
          FROM sites
          WHERE created_at >= CURRENT_DATE - INTERVAL '1 year'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
        `).catch(err => {
          console.warn('[AnalyticsService] Client metrics query failed:', err.message);
          return { rows: [] };
        }),

        // Recruitment metrics
        db.query(`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as total_applications,
            COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed
          FROM applications
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
        `).catch(err => {
          console.warn('[AnalyticsService] Recruitment query failed:', err.message);
          return { rows: [] };
        }),

        // Security incidents trends
        db.query(`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as total_incidents,
            COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
            COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical,
            COUNT(CASE WHEN priority = 'high' THEN 1 END) as high
          FROM audits
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
        `).catch(err => {
          console.warn('[AnalyticsService] Security trends query failed:', err.message);
          return { rows: [] };
        }),

        // Payroll trends over time
        db.query(`
          SELECT 
            DATE_TRUNC('month', pr.run_date) as month,
            pr.location,
            COUNT(DISTINCT pr.id) as payroll_runs,
            SUM(pr.total_gross_amount) as total_gross,
            SUM(pr.total_deductions) as total_deductions,
            SUM(pr.total_net_amount) as total_net,
            COUNT(DISTINCT p.guard_id) as total_guards
          FROM payroll_runs pr
          LEFT JOIN payslips p ON p.payroll_run_id = pr.id
          ${dateFilter}
          GROUP BY DATE_TRUNC('month', pr.run_date), pr.location
          ORDER BY month DESC, pr.location
        `).catch(err => {
          console.warn('[AnalyticsService] Payroll trends query failed:', err.message);
          return { rows: [] };
        })
      ];

      const results = await Promise.all(queries);
      
      revenueTrendsResult = results[0];
      wageBillResult = results[1];
      clientMetricsResult = results[2];
      recruitmentResult = results[3];
      securityTrendsResult = results[4];
      payrollTrendsResult = results[5];
    } catch (error) {
      console.error('[AnalyticsService] Error executing queries:', error);
    }

    // Calculate summary metrics (with safe defaults)
    const totalRevenue = (revenueTrendsResult.rows || []).reduce((sum, row) => sum + (parseFloat(row.monthly_revenue) || 0), 0);
    const totalWages = (wageBillResult.rows || []).reduce((sum, row) => sum + (parseFloat(row.total_net) || 0), 0);
    const totalBonuses = (wageBillResult.rows || []).reduce((sum, row) => sum + (parseFloat(row.total_bonuses) || 0), 0);
    const totalDeductions = (wageBillResult.rows || []).reduce((sum, row) => sum + (parseFloat(row.total_deductions) || 0), 0);
    const netProfit = totalRevenue - totalWages - totalBonuses;

    // Calculate client metrics
    const activeClients = (clientMetricsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.active_clients) || 0), 0);
    const newClients = (clientMetricsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.new_clients) || 0), 0);
    const lostClients = (clientMetricsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.lost_clients) || 0), 0);
    const retentionRate = activeClients > 0 ? Math.round(((activeClients - lostClients) / activeClients) * 100) : 0;

    // Calculate recruitment metrics
    const totalApplications = (recruitmentResult.rows || []).reduce((sum, row) => sum + (parseInt(row.total_applications) || 0), 0);
    const totalHired = (recruitmentResult.rows || []).reduce((sum, row) => sum + (parseInt(row.hired) || 0), 0);
    const totalRejected = (recruitmentResult.rows || []).reduce((sum, row) => sum + (parseInt(row.rejected) || 0), 0);
    const totalPending = (recruitmentResult.rows || []).reduce((sum, row) => sum + (parseInt(row.pending) || 0), 0);

    // Calculate security metrics
    const totalIncidents = (securityTrendsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.total_incidents) || 0), 0);
    const resolvedIncidents = (securityTrendsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.resolved) || 0), 0);
    const pendingIncidents = (securityTrendsResult.rows || []).reduce((sum, row) => sum + (parseInt(row.pending) || 0), 0);
    const resolutionRate = totalIncidents > 0 ? Math.round((resolvedIncidents / totalIncidents) * 100) : 0;

    return {
      summary: {
        totalRevenue,
        totalWages,
        totalBonuses,
        totalDeductions,
        netProfit,
        retentionRate,
        activeClients,
        newClients,
        lostClients,
        totalApplications,
        totalHired,
        totalRejected,
        totalPending,
        totalIncidents,
        resolvedIncidents,
        pendingIncidents,
        resolutionRate,
        period,
        generatedAt: new Date().toISOString()
      },
      revenueTrends: revenueTrendsResult.rows || [],
      wageBill: wageBillResult.rows || [],
      clientMetrics: clientMetricsResult.rows || [],
      recruitment: recruitmentResult.rows || [],
      securityTrends: securityTrendsResult.rows || [],
      payrollTrends: payrollTrendsResult.rows || []
    };
  }
}

module.exports = AnalyticsService;