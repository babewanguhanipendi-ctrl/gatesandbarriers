const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { classifySiteLocation } = require('../utils/siteLocation');

const router = express.Router();

/**
 * GET /api/sites - Fetch all dynamically registered sites from the database.
 * Accessible by all authenticated users (filtered by role context).
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status } = req.query;

    let query = `
      SELECT s.*,
        supervisor.daily_rate AS supervisor_daily_rate,
        u.full_name AS created_by_name,
        u.work_number AS created_by_work_number,
        (SELECT COUNT(*) FROM users gu WHERE gu.site_id = s.id AND gu.role = 'guard' AND gu.account_status = 'active') AS assigned_guard_count
      FROM sites s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users supervisor ON s.supervisor_id = supervisor.id AND supervisor.role = 'supervisor'
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await db.query(query, params);
    const allocationResult = await db.query(`
      SELECT sa.area, u.id as supervisor_id, u.full_name as supervisor_name, u.work_number as supervisor_work_number, u.daily_rate as supervisor_daily_rate
      FROM supervisor_allocations sa
      JOIN users u ON u.id = sa.supervisor_id
      WHERE u.role = 'supervisor' AND u.account_status = 'active'
    `);
    const sites = result.rows.map(site => {
      const locationCategory = classifySiteLocation(site);
      const allocatedSupervisor = allocationResult.rows.find(allocation => allocation.area === locationCategory);
      return {
        ...site,
        location_category: locationCategory,
        allocated_supervisor_id: allocatedSupervisor?.supervisor_id || null,
        allocated_supervisor_name: allocatedSupervisor?.supervisor_name || null,
        allocated_supervisor_work_number: allocatedSupervisor?.supervisor_work_number || null,
        allocated_supervisor_daily_rate: allocatedSupervisor?.supervisor_daily_rate || site.supervisor_daily_rate || 400
      };
    });
    res.json({ sites });
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

/**
 * GET /api/sites/:id - Fetch a single site by ID.
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      `SELECT s.*,
        supervisor.daily_rate AS supervisor_daily_rate,
        u.full_name AS created_by_name,
        u.work_number AS created_by_work_number,
        (SELECT COUNT(*) FROM users gu WHERE gu.site_id = s.id AND gu.role = 'guard' AND gu.account_status = 'active') AS assigned_guard_count
      FROM sites s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN users supervisor ON s.supervisor_id = supervisor.id AND supervisor.role = 'supervisor'
      WHERE s.id = $1`,
      [req.params.id]
    );

    const site = result.rows[0];
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const allocationResult = await db.query(`
      SELECT u.id as supervisor_id, u.full_name as supervisor_name, u.work_number as supervisor_work_number, u.daily_rate as supervisor_daily_rate
      FROM supervisor_allocations sa
      JOIN users u ON u.id = sa.supervisor_id
      WHERE sa.area = $1 AND u.role = 'supervisor' AND u.account_status = 'active'
      LIMIT 1
    `, [classifySiteLocation(site)]);
    const allocatedSupervisor = allocationResult.rows[0] || {};
    res.json({ site: {
      ...site,
      location_category: classifySiteLocation(site),
      allocated_supervisor_id: allocatedSupervisor.supervisor_id || null,
      allocated_supervisor_name: allocatedSupervisor.supervisor_name || null,
      allocated_supervisor_work_number: allocatedSupervisor.supervisor_work_number || null,
      allocated_supervisor_daily_rate: allocatedSupervisor.supervisor_daily_rate || site.supervisor_daily_rate || 400
    } });
  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ error: 'Failed to fetch site' });
  }
});

/**
 * POST /api/sites - Create a new site.
 * Restricted to Director, Manager, and Admin roles.
 */
router.post('/', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { site_name, location, address, client_name, contact_number, required_guards, day_rate, night_rate, amount_offered, latitude, longitude, geofence_radius } = req.body;

    // Validate required fields (all NOT NULL in DB schema)
    if (!site_name || !location || !address || !client_name) {
      return res.status(400).json({ error: 'site_name, location, address, and client_name are required' });
    }
    if (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90 ||
        !Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180) {
      return res.status(400).json({ error: 'A valid latitude and longitude are required for the site location' });
    }

    // Validate day_rate and night_rate are valid numbers
    if (day_rate === undefined || day_rate === null || isNaN(Number(day_rate))) {
      return res.status(400).json({ error: 'day_rate is required and must be a valid number' });
    }
    if (night_rate === undefined || night_rate === null || isNaN(Number(night_rate))) {
      return res.status(400).json({ error: 'night_rate is required and must be a valid number' });
    }
    if (!Number.isFinite(Number(amount_offered)) || Number(amount_offered) < 30000 || Number(amount_offered) > 40000) {
      return res.status(400).json({ error: 'Contractor monthly rate must be between KES 30,000 and KES 40,000' });
    }

    const result = await db.query(
      `INSERT INTO sites (site_name, location, address, client_name, contact_number, required_guards, day_rate, night_rate, amount_offered, latitude, longitude, geofence_radius, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        site_name,
        location,
        address,
        client_name,
        contact_number || '',
        required_guards || 1,
        day_rate,
        night_rate,
        amount_offered,
        latitude,
        longitude,
        100,
        req.user.id
      ]
    );

    const site = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Site Created', 'system', `Created new site: ${site_name} at ${location}`]
    );

    res.status(201).json({ site });
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Failed to create site' });
  }
});

/**
 * PUT /api/sites/:id - Update site parameters.
 * Restricted to Director, Manager, and Admin roles.
 */
router.put('/:id', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { site_name, location, client_name, contact_number, required_guards, day_rate, night_rate, amount_offered, status, latitude, longitude, geofence_radius } = req.body;

    // Check if site exists
    const existing = await db.query('SELECT id FROM sites WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Validate required fields are not being set to empty/null if they are NOT NULL
    if (client_name !== undefined && !client_name) {
      return res.status(400).json({ error: 'client_name cannot be empty' });
    }
    if (amount_offered !== undefined && (!Number.isFinite(Number(amount_offered)) || Number(amount_offered) < 30000 || Number(amount_offered) > 40000)) {
      return res.status(400).json({ error: 'Contractor monthly rate must be between KES 30,000 and KES 40,000' });
    }
    if (site_name !== undefined && !site_name) {
      return res.status(400).json({ error: 'site_name cannot be empty' });
    }
    if (location !== undefined && !location) {
      return res.status(400).json({ error: 'location cannot be empty' });
    }

    const result = await db.query(
      `UPDATE sites 
       SET site_name = COALESCE($1, site_name),
           location = COALESCE($2, location),
           client_name = COALESCE($3, client_name),
           contact_number = COALESCE($4, contact_number),
           required_guards = COALESCE($5, required_guards),
           day_rate = COALESCE($6, day_rate),
           night_rate = COALESCE($7, night_rate),
             amount_offered = COALESCE($8, amount_offered),
             status = COALESCE($9, status),
             latitude = COALESCE($10, latitude),
             longitude = COALESCE($11, longitude),
             geofence_radius = COALESCE($12, geofence_radius),
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $13
       RETURNING *`,
      [site_name, location, client_name, contact_number, required_guards, day_rate, night_rate, amount_offered, status, latitude ?? null, longitude ?? null, 100, req.params.id]
    );

    const site = result.rows[0];

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Site Updated', 'system', `Updated site: ${site.site_name}`]
    );

    res.json({ site });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

/**
 * DELETE /api/sites/:id - Remove or deactivate a site.
 * Checks for active guard allocations first.
 * Restricted to Director, Manager, and Admin roles.
 */
router.delete('/:id', authenticateToken, authorize('director', 'manager', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');

    // Get site info
    const siteResult = await db.query('SELECT * FROM sites WHERE id = $1', [req.params.id]);
    if (siteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const site = siteResult.rows[0];

    // Check for active guard allocations (active scheduled shifts)
    const activeAllocations = await db.query(
      `SELECT COUNT(*) AS count FROM shifts 
       WHERE site_id = $1 AND status = 'scheduled' AND (end_time IS NULL OR end_time > CURRENT_TIMESTAMP)`,
      [req.params.id]
    );

    const activeCount = parseInt(activeAllocations.rows[0].count, 10);

    if (activeCount > 0) {
      // Site has active guard allocations - soft deactivate instead of hard delete
      await db.query(
        'UPDATE sites SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['inactive', req.params.id]
      );

      // Log audit
      await db.query(
        'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.user.id, req.user.full_name, req.user.email, 'Site Deactivated', 'system', 
         `Deactivated site: ${site.site_name} - ${activeCount} active allocation(s) found`]
      );

      return res.json({ 
        message: 'Site deactivated due to active guard allocations',
        deactivated: true,
        active_allocations: activeCount 
      });
    }

    // No active allocations, safe to delete
    await db.query('DELETE FROM sites WHERE id = $1', [req.params.id]);

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, req.user.full_name, req.user.email, 'Site Deleted', 'system', `Deleted site: ${site.site_name}`]
    );

    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;