const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all uniform requests (Secretary view)
router.get('/', authenticateToken, authorize('secretary', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { status } = req.query;

    let query = `
      SELECT 
        ur.id, ur.guard_id, ur.item_name, ur.status,
        ur.requested_at, ur.processed_at, ur.processed_by,
        u.full_name as guard_name, 
        u.work_number as guard_work_number,
        u.phone_number as guard_phone,
        p.full_name as processed_by_name
      FROM uniform_requests ur
      JOIN users u ON u.id = ur.guard_id
      LEFT JOIN users p ON p.id = ur.processed_by
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND ur.status = $${params.length}`;
    }

    query += ' ORDER BY ur.requested_at DESC';

    const result = await db.query(query, params);

    res.json({ uniformRequests: result.rows });
  } catch (error) {
    console.error('Get uniform requests error:', error);
    res.status(500).json({ error: 'Failed to fetch uniform requests' });
  }
});

// Get my uniform requests (Guard view)
router.get('/my', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const guardId = req.user.id;

    const result = await db.query(`
      SELECT id, guard_id, item_name, status, requested_at, processed_at, notes, delivery_status, guard_confirmed, follow_up_requested
      FROM uniform_requests
      WHERE guard_id = $1
      ORDER BY requested_at DESC
    `, [guardId]);

    res.json({ uniformRequests: result.rows });
  } catch (error) {
    console.error('Get my uniform requests error:', error);
    res.status(500).json({ error: 'Failed to fetch your uniform requests' });
  }
});

// Submit uniform request (Guard)
router.post('/', authenticateToken, authorize('guard', 'supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const guardId = req.user.id;
    const { item_name } = req.body;

    // Validate item_name
    if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    // TRUNCATE item_name to avoid too-long values
    const trimmedItemName = item_name.trim().substring(0, 255);

    // Check the 2-item limit: Count pending + disbursed (not yet completed) requests
    // Guard limit rule: No more than 2 active/pending uniform items at the same time
    const pendingCountResult = await db.query(`
      SELECT COUNT(*) as count 
      FROM uniform_requests 
      WHERE guard_id = $1 AND status IN ('pending')
    `, [guardId]);

    const pendingCount = parseInt(pendingCountResult.rows[0]?.count || 0);

    if (pendingCount >= 2) {
      return res.status(400).json({ 
        error: 'You already have 2 pending uniform requests. Please wait until they are processed before submitting new requests.',
        pending_count: pendingCount,
        max_allowed: 2
      });
    }

    // Insert the uniform request
    const result = await db.query(`
      INSERT INTO uniform_requests (guard_id, item_name, status, requested_at)
      VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
      RETURNING id, guard_id, item_name, status, requested_at
    `, [guardId, trimmedItemName]);

    const uniformRequest = result.rows[0];

    await db.query(
      `UPDATE users SET uniform_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [guardId]
    );

    // Create notification for all secretaries
    const secretaryResult = await db.query(
      'SELECT id FROM users WHERE role = $1 AND account_status = $2',
      ['secretary', 'active']
    );

    for (const secretary of secretaryResult.rows) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'uniform', $2, $3, 'medium', $4)
      `, [
        secretary.id,
        'New Uniform Request',
        `${req.user.full_name} (${req.user.work_number || 'N/A'}) has requested: ${trimmedItemName}`,
        JSON.stringify({
          entity_type: 'uniform_request',
          entity_id: uniformRequest.id,
          action_type: 'allocate',
          link_url: '/secretary/uniform',
          uniform_request_id: uniformRequest.id,
          guard_id: guardId,
          guard_name: req.user.full_name,
          guard_work_number: req.user.work_number,
          item_name: trimmedItemName
        })
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [guardId, req.user.full_name, req.user.email, 'Uniform Request Submitted', 'uniform',
       `Submitted uniform request for: ${trimmedItemName}`]
    );

    res.status(201).json({
      uniformRequest,
      message: 'Uniform request submitted successfully'
    });
  } catch (error) {
    console.error('Create uniform request error:', error);
    res.status(500).json({ error: 'Failed to submit uniform request' });
  }
});

// Update uniform request status (Secretary - Disburse or Reject)
router.patch('/:id/status', authenticateToken, authorize('secretary', 'admin'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { status, notes } = req.body;
    const secretaryId = req.user.id;

    // Validate status
    if (!status || !['disbursed', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "disbursed" or "rejected"' });
    }

    // Fetch the uniform request
    const requestResult = await db.query(`
      SELECT ur.*, u.full_name as guard_name, u.work_number, u.email, u.phone_number, u.site_id as guard_site_id
      FROM uniform_requests ur
      JOIN users u ON u.id = ur.guard_id
      WHERE ur.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Uniform request not found' });
    }

    const uniformRequest = requestResult.rows[0];

    // Update the status
    const result = await db.query(`
      UPDATE uniform_requests
        SET status = $1::varchar, processed_at = CURRENT_TIMESTAMP, processed_by = $2, notes = COALESCE($3, notes),
          delivery_status = CASE WHEN $1::varchar = 'disbursed' THEN 'pending_delivery' ELSE NULL END
      WHERE id = $4
      RETURNING id, guard_id, item_name, status, requested_at, processed_at, notes, delivery_status, guard_confirmed, follow_up_requested
    `, [status, secretaryId, notes || null, id]);

    const updatedRequest = result.rows[0];

    await db.query(
      `UPDATE users
       SET uniform_status = CASE WHEN $1 = 'disbursed' THEN 'allocated' ELSE 'pending' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [status, uniformRequest.guard_id]
    );

    // Create notification for the guard
    if (status === 'disbursed') {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'uniform', $2, $3, 'high', $4)
      `, [
        uniformRequest.guard_id,
        'Uniform Disbursed',
        `Your request for ${uniformRequest.item_name} has been approved and disbursed. Your uniform will be delivered by the supervisor of your particular site. In case of failure, please follow up.`,
        JSON.stringify({
          entity_type: 'uniform_request',
          entity_id: id,
          action_type: 'confirm_receipt',
          link_url: '/guard/uniform',
          uniform_request_id: id,
          item_name: uniformRequest.item_name,
          status: 'disbursed',
          delivery_status: 'pending_delivery',
          delivery_message: 'Your uniform will be delivered by the supervisor of your particular site. In case of failure, please follow up.'
        })
      ]);

      // Notify the supervisor of the guard's site about the delivery
      if (uniformRequest.guard_site_id) {
        const supervisorResult = await db.query(
          'SELECT supervisor_id FROM sites WHERE id = $1 AND supervisor_id IS NOT NULL',
          [uniformRequest.guard_site_id]
        );

        if (supervisorResult.rows.length > 0) {
          const supervisorId = supervisorResult.rows[0].supervisor_id;
          await db.query(`
            INSERT INTO notifications (user_id, type, title, message, priority, metadata)
            VALUES ($1, 'uniform', $2, $3, 'high', $4)
          `, [
            supervisorId,
            'Uniform Delivery Assigned',
            `You have a new uniform delivery for ${uniformRequest.guard_name} (${uniformRequest.work_number}): ${uniformRequest.item_name}`,
            JSON.stringify({
              entity_type: 'uniform_request',
              entity_id: id,
              action_type: 'update_delivery',
              link_url: '/supervisor/uniform-delivery',
              uniform_request_id: id,
              guard_id: uniformRequest.guard_id,
              guard_name: uniformRequest.guard_name,
              guard_work_number: uniformRequest.work_number,
              item_name: uniformRequest.item_name,
              delivery_status: 'pending_delivery',
              action_required: 'Please deliver this item to the guard'
            })
          ]);
        }
      }
    } else if (status === 'rejected') {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, priority, metadata)
        VALUES ($1, 'uniform', $2, $3, 'medium', $4)
      `, [
        uniformRequest.guard_id,
        'Uniform Request Rejected',
        `Your request for ${uniformRequest.item_name} has been rejected.${notes ? ` Reason: ${notes}` : ' Please contact the secretary for more information.'}`,
        JSON.stringify({
          uniform_request_id: id,
          item_name: uniformRequest.item_name,
          status: 'rejected',
          reason: notes || null
        })
      ]);
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [secretaryId, req.user.full_name, req.user.email,
        status === 'disbursed' ? 'Uniform Disbursed' : 'Uniform Request Rejected', 'uniform',
        `${status === 'disbursed' ? 'Disbursed' : 'Rejected'} uniform request: ${uniformRequest.item_name} for ${uniformRequest.guard_name} (${uniformRequest.work_number})`]
    );

    res.json({
      uniformRequest: updatedRequest,
      message: status === 'disbursed'
        ? 'Uniform marked as disbursed. Guard and supervisor have been notified about delivery.'
        : 'Uniform request has been rejected.'
    });
  } catch (error) {
    console.error('Update uniform request status error:', error);
    res.status(500).json({ error: 'Failed to update uniform request status' });
  }
});

// Guard confirms receipt of uniform
router.patch('/:id/confirm-receipt', authenticateToken, authorize('guard'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { received, follow_up } = req.body;
    const guardId = req.user.id;

    // Validate input
    if (typeof received !== 'boolean') {
      return res.status(400).json({ error: 'received field is required and must be a boolean' });
    }

    // Fetch the uniform request
    const requestResult = await db.query(`
      SELECT ur.*, u.full_name as guard_name, u.work_number, u.site_id as guard_site_id
      FROM uniform_requests ur
      JOIN users u ON u.id = ur.guard_id
      WHERE ur.id = $1 AND ur.guard_id = $2 AND ur.status = 'disbursed'
    `, [id, guardId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Uniform request not found or not available for confirmation' });
    }

    const uniformRequest = requestResult.rows[0];

    // Determine delivery status
    let deliveryStatus = 'delivered';
    let guardConfirmed = true;
    let followUpRequested = false;

    if (!received) {
      deliveryStatus = 'delayed';
      guardConfirmed = false;
      followUpRequested = follow_up === true;
    }

    // Update the uniform request
    const result = await db.query(`
      UPDATE uniform_requests
      SET delivery_status = $1, guard_confirmed = $2, follow_up_requested = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, guard_id, item_name, status, requested_at, processed_at, delivery_status, guard_confirmed, follow_up_requested
    `, [deliveryStatus, guardConfirmed, followUpRequested, id]);

    const updatedRequest = result.rows[0];

    if (received) {
      await db.query(
        `UPDATE users SET uniform_status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [guardId]
      );
    }

    // If follow-up requested, notify secretary and supervisor with high priority
    if (followUpRequested) {
      // Notify all secretaries
      const secretaryResult = await db.query(
        'SELECT id FROM users WHERE role = $1 AND account_status = $2',
        ['secretary', 'active']
      );

      for (const secretary of secretaryResult.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, priority, metadata)
          VALUES ($1, 'uniform', $2, $3, 'critical', $4)
        `, [
          secretary.id,
          'Uniform Delivery Follow-Up Required',
          `Follow-up requested for ${uniformRequest.item_name} - Guard: ${uniformRequest.guard_name} (${uniformRequest.work_number})`,
          JSON.stringify({
            uniform_request_id: id,
            guard_id: guardId,
            guard_name: uniformRequest.guard_name,
            guard_work_number: uniformRequest.work_number,
            item_name: uniformRequest.item_name,
            delivery_status: 'delayed',
            action_required: 'Please follow up with supervisor on delivery'
          })
        ]);
      }

      // Notify supervisor
      if (uniformRequest.guard_site_id) {
        const supervisorResult = await db.query(
          'SELECT supervisor_id FROM sites WHERE id = $1 AND supervisor_id IS NOT NULL',
          [uniformRequest.guard_site_id]
        );

        if (supervisorResult.rows.length > 0) {
          await db.query(`
            INSERT INTO notifications (user_id, type, title, message, priority, metadata)
            VALUES ($1, 'uniform', $2, $3, 'critical', $4)
          `, [
            supervisorResult.rows[0].supervisor_id,
            'Uniform Delivery Follow-Up Required',
            `Follow-up requested for ${uniformRequest.item_name} - Guard: ${uniformRequest.guard_name} (${uniformRequest.work_number}) has not received the item`,
            JSON.stringify({
              uniform_request_id: id,
              guard_id: guardId,
              guard_name: uniformRequest.guard_name,
              guard_work_number: uniformRequest.work_number,
              item_name: uniformRequest.item_name,
              delivery_status: 'delayed',
              action_required: 'Please deliver this item immediately or provide update'
            })
          ]);
        }
      }
    } else if (received) {
      // Notify secretary that delivery was confirmed
      const secretaryResult = await db.query(
        'SELECT id FROM users WHERE role = $1 AND account_status = $2',
        ['secretary', 'active']
      );

      for (const secretary of secretaryResult.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, priority, metadata)
          VALUES ($1, 'uniform', $2, $3, 'low', $4)
        `, [
          secretary.id,
          'Uniform Delivery Confirmed',
          `${uniformRequest.guard_name} (${uniformRequest.work_number}) has confirmed receipt of ${uniformRequest.item_name}`,
          JSON.stringify({
            uniform_request_id: id,
            guard_id: guardId,
            guard_name: uniformRequest.guard_name,
            item_name: uniformRequest.item_name,
            delivery_status: 'delivered'
          })
        ]);
      }
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [guardId, req.user.full_name, req.user.email, 
        received ? 'Uniform Receipt Confirmed' : 'Uniform Delivery Follow-Up Requested', 'uniform',
        `${received ? 'Confirmed receipt' : 'Requested follow-up'} for ${uniformRequest.item_name}. Delivery status: ${deliveryStatus}`]
    );

    res.json({
      uniformRequest: updatedRequest,
      message: received
        ? 'Receipt confirmed successfully. Thank you!'
        : followUpRequested
        ? 'Follow-up requested. Secretary and supervisor have been notified.'
        : 'Delivery status updated to delayed.'
    });
  } catch (error) {
    console.error('Confirm receipt error:', error);
    res.status(500).json({ error: 'Failed to confirm receipt' });
  }
});

// Supervisor updates delivery status
router.patch('/:id/delivery-status', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { delivery_status } = req.body;
    const supervisorId = req.user.id;

    // Validate delivery status
    if (!delivery_status || !['delivered', 'delayed'].includes(delivery_status)) {
      return res.status(400).json({ error: 'delivery_status must be "delivered" or "delayed"' });
    }

    // Fetch the uniform request
    const requestResult = await db.query(`
      SELECT ur.*, u.full_name as guard_name, u.work_number, u.email, s.supervisor_id
      FROM uniform_requests ur
      JOIN users u ON u.id = ur.guard_id
      JOIN sites s ON s.id = u.site_id
      WHERE ur.id = $1 AND ur.status = 'disbursed'
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Uniform request not found' });
    }

    const uniformRequest = requestResult.rows[0];

    // Verify supervisor is assigned to the guard's site
    if (uniformRequest.supervisor_id !== supervisorId) {
      return res.status(403).json({ error: 'You are not authorized to update this delivery' });
    }

    // Update delivery status
    const result = await db.query(`
      UPDATE uniform_requests
      SET delivery_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, guard_id, item_name, status, requested_at, processed_at, delivery_status, guard_confirmed, follow_up_requested
    `, [delivery_status, id]);

    const updatedRequest = result.rows[0];

    // Notify the guard
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, priority, metadata)
      VALUES ($1, 'uniform', $2, $3, 'high', $4)
    `, [
      uniformRequest.guard_id,
      delivery_status === 'delivered' ? 'Uniform Delivered' : 'Uniform Delivery Delayed',
      delivery_status === 'delivered'
        ? `Your ${uniformRequest.item_name} has been delivered. Please confirm receipt.`
        : `Your ${uniformRequest.item_name} delivery has been delayed. We apologize for the inconvenience.`,
      JSON.stringify({
        uniform_request_id: id,
        item_name: uniformRequest.item_name,
        delivery_status: delivery_status,
        action_required: delivery_status === 'delivered' ? 'Please confirm receipt' : null
      })
    ]);

    // If delayed, also notify secretary
    if (delivery_status === 'delayed') {
      const secretaryResult = await db.query(
        'SELECT id FROM users WHERE role = $1 AND account_status = $2',
        ['secretary', 'active']
      );

      for (const secretary of secretaryResult.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, priority, metadata)
          VALUES ($1, 'uniform', $2, $3, 'high', $4)
        `, [
          secretary.id,
          'Uniform Delivery Delayed',
          `Supervisor has marked ${uniformRequest.item_name} for ${uniformRequest.guard_name} (${uniformRequest.work_number}) as delayed`,
          JSON.stringify({
            uniform_request_id: id,
            guard_id: uniformRequest.guard_id,
            guard_name: uniformRequest.guard_name,
            item_name: uniformRequest.item_name,
            delivery_status: 'delayed'
          })
        ]);
      }
    }

    // Log audit
    await db.query(
      'INSERT INTO audit_logs (user_id, user_name, user_email, action, type, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [supervisorId, req.user.full_name, req.user.email, 
        'Uniform Delivery Status Updated', 'uniform',
        `Updated delivery status to "${delivery_status}" for ${uniformRequest.item_name} for guard ${uniformRequest.guard_name}`]
    );

    res.json({
      uniformRequest: updatedRequest,
      message: `Delivery status updated to ${delivery_status}`
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

// Get supervisor's delivery assignments
router.get('/delivery-assignments', authenticateToken, authorize('supervisor'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const supervisorId = req.user.id;

    // Get all sites supervised by this supervisor
    const sitesResult = await db.query(
      'SELECT id FROM sites WHERE supervisor_id = $1',
      [supervisorId]
    );

    const siteIds = sitesResult.rows.map(s => s.id);

    if (siteIds.length === 0) {
      return res.json({ deliveries: [] });
    }

    // Get all disbursed uniform requests for guards at these sites
    const result = await db.query(`
      SELECT 
        ur.id, ur.guard_id, ur.item_name, ur.status, ur.requested_at, ur.processed_at,
        ur.delivery_status, ur.guard_confirmed, ur.follow_up_requested, ur.notes,
        u.full_name as guard_name, u.work_number as guard_work_number, u.phone_number as guard_phone,
        u.site_id as guard_site_id,
        s.client_name as site_client, s.location as site_location
      FROM uniform_requests ur
      JOIN users u ON u.id = ur.guard_id
      JOIN sites s ON s.id = u.site_id
      WHERE ur.status = 'disbursed'
        AND s.id = ANY($1::uuid[])
        AND (ur.delivery_status IS NULL OR ur.delivery_status != 'delivered' OR ur.follow_up_requested = TRUE)
      ORDER BY 
        CASE WHEN ur.follow_up_requested = TRUE THEN 0 ELSE 1 END,
        ur.requested_at ASC
    `, [siteIds]);

    res.json({ deliveries: result.rows });
  } catch (error) {
    console.error('Get delivery assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch delivery assignments' });
  }
});

module.exports = router;
