const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { authenticateToken, adminOnly } = require('../middleware/auth');

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const enrichNotification = async (db, notification) => {
  const metadata = notification.metadata && typeof notification.metadata === 'object'
    ? notification.metadata
    : {};
  const entityId = metadata.uniform_request_id || (
    metadata.entity_type === 'uniform_request' ? metadata.entity_id : null
  );

  if (!entityId || !UUID_PATTERN.test(entityId)) {
    return { ...notification, metadata };
  }

  const result = await db.query(
    `SELECT ur.id, ur.guard_id, ur.item_name, ur.status, ur.requested_at,
            u.full_name AS guard_name, u.work_number AS guard_work_number
     FROM uniform_requests ur
     JOIN users u ON u.id = ur.guard_id
     WHERE ur.id = $1`,
    [entityId]
  );
  const request = result.rows[0];
  if (!request) return { ...notification, metadata };

  return {
    ...notification,
    metadata: {
      ...metadata,
      entity_type: 'uniform_request',
      entity_id: request.id,
      uniform_request_id: request.id,
      guard_id: request.guard_id,
      guard_name: metadata.guard_name || request.guard_name,
      guard_work_number: metadata.guard_work_number || request.guard_work_number,
      item_name: metadata.item_name || request.item_name,
      status: request.status,
      requested_at: request.requested_at
    }
  };
};

// Get user's notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { read, priority } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [req.user.id];

    if (read !== undefined) {
      params.push(read === 'true');
      query += ` AND read = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND priority = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    const notifications = await Promise.all(result.rows.map(notification => enrichNotification(db, notification)));
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    const notification = result.rows[0];
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    await db.query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Create notification (Admin only)
router.post('/', authenticateToken, adminOnly, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { user_id, type, title, message, priority, metadata } = req.body;

    const result = await db.query(
      'INSERT INTO notifications (user_id, type, title, message, priority, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [user_id, type, title, message, priority || 'medium', JSON.stringify(metadata || {})]
    );

    const notification = result.rows[0];
    res.status(201).json({ notification });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = req.app.get('db');
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;