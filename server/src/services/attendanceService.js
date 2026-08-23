const SHIFT_GRACE_MS = 60 * 60 * 1000;

const getScheduledStart = (shift) => {
  if (shift.start_time) return new Date(shift.start_time);

  const [year, month, day] = String(shift.date).slice(0, 10).split('-').map(Number);
  const start = new Date(year, month - 1, day, shift.shift_type === 'night' ? 18 : 6, 0, 0, 0);
  return start;
};

const getScheduledEnd = (shift) => {
  if (shift.shift_type === 'overtime') return null;
  const end = getScheduledStart(shift);
  end.setHours(shift.shift_type === 'night' ? 6 : 18, 0, 0, 0);
  if (shift.shift_type === 'night') end.setDate(end.getDate() + 1);
  return end;
};

const notifyManagers = async (db, title, message, metadata) => {
  const managers = await db.query(`SELECT id FROM users WHERE role = 'manager' AND account_status = 'active'`);
  for (const manager of managers.rows) {
    await db.query(
      `INSERT INTO notifications (user_id, type, title, message, priority, metadata, target_role)
       VALUES ($1, 'attendance', $2, $3, 'high', $4, 'manager')`,
      [manager.id, title, message, JSON.stringify(metadata)]
    );
  }
};

const reconcileOverdueShifts = async (db) => {
  const active = await db.query(
    `SELECT sh.*, u.full_name as guard_name, s.client_name as site_name
     FROM shifts sh JOIN users u ON u.id = sh.guard_id JOIN sites s ON s.id = sh.site_id
     WHERE sh.check_in_time IS NOT NULL AND sh.end_time IS NULL`
  );

  for (const shift of active.rows) {
    const scheduledEnd = getScheduledEnd(shift);
    if (!scheduledEnd || new Date() < new Date(scheduledEnd.getTime() + SHIFT_GRACE_MS)) continue;

    const clockOutTime = new Date(scheduledEnd.getTime() + SHIFT_GRACE_MS);
    const closed = await db.query(
      `UPDATE shifts SET check_out_time = $1, end_time = $1, status = 'completed',
          clock_out_method = 'auto', notes = COALESCE(notes, '') || $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND end_time IS NULL RETURNING id`,
      [clockOutTime, `\nAuto clocked out after the one-hour duty overrun at ${clockOutTime.toISOString()}.`, shift.id]
    );
    if (closed.rows.length === 0) continue;

    await notifyManagers(db, 'Guard Auto Clocked Out',
      `${shift.guard_name} was auto clocked out from ${shift.site_name} after exceeding duty by one hour.`,
      { shift_id: shift.id, guard_id: shift.guard_id, site_id: shift.site_id, clock_out_type: 'auto' });

    const next = await db.query(
      `SELECT sh.id, sh.guard_id, sh.site_id, u.full_name as guard_name, s.client_name as site_name
       FROM shifts sh JOIN users u ON u.id = sh.guard_id JOIN sites s ON s.id = sh.site_id
       WHERE sh.site_id = $1 AND sh.date >= CURRENT_DATE AND sh.check_in_time IS NULL
         AND sh.end_time IS NULL AND sh.status NOT IN ('cancelled', 'missed')
       ORDER BY sh.date ASC, sh.start_time ASC NULLS LAST LIMIT 1`,
      [shift.site_id]
    );
    if (next.rows.length === 0) continue;

    const nextShift = next.rows[0];
    const hasActive = await db.query(
      `SELECT 1 FROM shifts WHERE guard_id = $1 AND check_in_time IS NOT NULL AND end_time IS NULL LIMIT 1`,
      [nextShift.guard_id]
    );
    if (hasActive.rows.length > 0) {
      await notifyManagers(db, 'Automatic Coverage Warning',
        `${nextShift.guard_name} could not be auto clocked in at ${nextShift.site_name} because they already have an active shift.`,
        { shift_id: nextShift.id, guard_id: nextShift.guard_id, site_id: nextShift.site_id, warning: 'active_shift' });
      continue;
    }

    await db.query(
      `UPDATE shifts SET check_in_time = $1, clock_in_method = 'auto',
          notes = COALESCE(notes, '') || $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND check_in_time IS NULL AND end_time IS NULL`,
      [clockOutTime, `\nWarning: auto clocked in to ${nextShift.site_name} after previous guard exceeded duty.`, nextShift.id]
    );
    await notifyManagers(db, 'Guard Auto Clocked In',
      `${nextShift.guard_name} was auto clocked in at ${nextShift.site_name} after the previous guard was auto clocked out.`,
      { shift_id: nextShift.id, guard_id: nextShift.guard_id, site_id: nextShift.site_id, clock_in_type: 'auto', warning: true });
  }
};

module.exports = { reconcileOverdueShifts };