#!/usr/bin/env node
'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { pool } = require('../db/pool');

const UAT_EMAIL_LIKE = '%@gatesandbarriers.test';
const UAT_WORK_NUMBERS = [
  'GBS-451', 'GBS-452', 'GBS-453', 'GBS-454',
  'GBG-1951', 'GBG-1952', 'GBG-1953', 'GBG-1954',
  'GBG-1955', 'GBG-1956', 'GBG-1957', 'GBG-1958',
];
const UAT_PHONES = Array.from({ length: 12 }, (_, index) =>
  `+254700000${String(index + 1).padStart(2, '0')}`
);
const UAT_SITE_NAMES = [
  'Nyali Centre',
  'Nyali Luxury Apartments',
  'Moi Avenue Plaza',
  'Mombasa Business Hub',
];

async function tableExists(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return result.rows[0].table_name !== null;
}

async function deleteRows(client, summary, key, tableName, sql, params) {
  if (!(await tableExists(client, tableName))) return;
  const result = await client.query(sql, params);
  summary[key] = result.rowCount || 0;
}

async function findTargets(client) {
  const users = await client.query(
    `SELECT id, email, work_number, phone_number
       FROM users
      WHERE email ILIKE $1
         OR work_number = ANY($2::varchar[])
         OR phone_number = ANY($3::varchar[])
         OR LOWER(COALESCE(email, '')) LIKE '%@example.test'
         OR LOWER(COALESCE(email, '')) LIKE '%@test.local'
         OR LOWER(COALESCE(full_name, '')) ~ '(^|[^a-z])(uat|mock)[^a-z]*($|[^a-z])'`,
    [UAT_EMAIL_LIKE, UAT_WORK_NUMBERS, UAT_PHONES]
  );
  const userIds = users.rows.map((user) => user.id);

  const sites = await client.query(
    `SELECT id, site_name, client_name
       FROM sites
      WHERE supervisor_id = ANY($1::uuid[])
         OR created_by = ANY($1::uuid[])
         OR site_name = ANY($2::varchar[])
         OR LOWER(COALESCE(site_name, '')) ~ '(^|[^a-z])(uat|mock|test)([^a-z]|$)'
         OR LOWER(COALESCE(client_name, '')) ~ '(^|[^a-z])(uat|mock|test)([^a-z]|$)'`,
    [userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'], UAT_SITE_NAMES]
  );

  return {
    userIds,
    siteIds: sites.rows.map((site) => site.id),
    users: users.rows,
    sites: sites.rows,
  };
}

async function purgeUatData(client) {
  const targets = await findTargets(client);
  const userIds = targets.userIds.length ? targets.userIds : ['00000000-0000-0000-0000-000000000000'];
  const siteIds = targets.siteIds.length ? targets.siteIds : ['00000000-0000-0000-0000-000000000000'];
  const summary = {
    users_found: targets.userIds.length,
    sites_found: targets.siteIds.length,
    clock_ins: 0,
    leave_records: 0,
    financial_ledgers: 0,
    financial_ledger: 0,
    shifts: 0,
    allocations: 0,
    guard_off_status: 0,
    supervisor_allocations: 0,
    uniforms: 0,
    uniform_requests: 0,
    shift_handovers: 0,
    audits: 0,
    notifications: 0,
    attendance_exceptions: 0,
    attendance_compliance: 0,
    attendance_reports: 0,
    payslips: 0,
    payroll_runs: 0,
    treasury_disbursements: 0,
    meetings: 0,
    secretary_tasks: 0,
    document_transfers: 0,
    company_schedules: 0,
    policies: 0,
    email_outbox: 0,
    audit_logs: 0,
    allocated_work_numbers: 0,
    sites: 0,
    users: 0,
  };

  await deleteRows(client, summary, 'clock_ins', 'clock_ins',
    'DELETE FROM clock_ins WHERE user_id = ANY($1::uuid[]) OR shift_id IN (SELECT id FROM shifts WHERE guard_id = ANY($1::uuid[]))', [userIds]);
  await deleteRows(client, summary, 'leave_records', 'leave_records',
    'DELETE FROM leave_records WHERE user_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'financial_ledgers', 'financial_ledgers',
    'DELETE FROM financial_ledgers WHERE user_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'financial_ledger', 'financial_ledger',
    'DELETE FROM financial_ledger WHERE guard_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'shift_handovers', 'shift_handovers',
    'DELETE FROM shift_handovers WHERE guard_id = ANY($1::uuid[]) OR next_guard_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'shifts', 'shifts',
    'DELETE FROM shifts WHERE guard_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'allocations', 'allocations',
    'DELETE FROM allocations WHERE guard_id = ANY($1::uuid[]) OR allocated_by = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'guard_off_status', 'guard_off_status',
    'DELETE FROM guard_off_status WHERE guard_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'supervisor_allocations', 'supervisor_allocations',
    'DELETE FROM supervisor_allocations WHERE supervisor_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'uniforms', 'uniforms',
    'DELETE FROM uniforms WHERE guard_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'uniform_requests', 'uniform_requests',
    'DELETE FROM uniform_requests WHERE guard_id = ANY($1::uuid[]) OR processed_by = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'audits', 'audits',
    'DELETE FROM audits WHERE reporter_id = ANY($1::uuid[]) OR guard_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'notifications', 'notifications',
    'DELETE FROM notifications WHERE user_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'attendance_exceptions', 'attendance_exceptions',
    'DELETE FROM attendance_exceptions WHERE guard_id = ANY($1::uuid[]) OR site_id = ANY($2::uuid[]) OR resolved_by = ANY($1::uuid[])', [userIds, siteIds]);
  await deleteRows(client, summary, 'attendance_compliance', 'attendance_compliance',
    'DELETE FROM attendance_compliance WHERE guard_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'attendance_reports', 'attendance_reports',
    'DELETE FROM attendance_reports WHERE generated_by = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'payslips', 'payslips',
    'DELETE FROM payslips WHERE guard_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'payroll_runs', 'payroll_runs',
    'DELETE FROM payroll_runs WHERE site_id = ANY($1::uuid[]) OR created_by = ANY($2::uuid[]) OR approved_by = ANY($2::uuid[])', [siteIds, userIds]);
  await deleteRows(client, summary, 'treasury_disbursements', 'treasury_disbursements',
    'DELETE FROM treasury_disbursements WHERE approved_by = ANY($1::uuid[]) OR processed_by = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'secretary_tasks', 'secretary_tasks',
    'DELETE FROM secretary_tasks WHERE assigned_to = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'meetings', 'meetings',
    'DELETE FROM meetings WHERE director_id = ANY($1::uuid[]) OR secretary_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'document_transfers', 'document_transfers',
    'DELETE FROM document_transfers WHERE sender_id = ANY($1::uuid[]) OR recipient_id = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'company_schedules', 'company_schedules',
    'DELETE FROM company_schedules WHERE created_by = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'policies', 'policies',
    'DELETE FROM policies WHERE created_by = ANY($1::uuid[])', [userIds]);
  await deleteRows(client, summary, 'email_outbox', 'email_outbox',
    'DELETE FROM email_outbox WHERE recipient_email ILIKE $1', [UAT_EMAIL_LIKE]);
  await deleteRows(client, summary, 'audit_logs', 'audit_logs',
    'DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[]) OR user_email ILIKE $2', [userIds, UAT_EMAIL_LIKE]);
  await deleteRows(client, summary, 'allocated_work_numbers', 'allocated_work_numbers',
    'DELETE FROM allocated_work_numbers WHERE user_id = ANY($1::uuid[]) OR work_number = ANY($2::varchar[])', [userIds, UAT_WORK_NUMBERS]);

  await deleteRows(client, summary, 'sites', 'sites',
    'DELETE FROM sites WHERE id = ANY($1::uuid[])', [siteIds]);
  await deleteRows(client, summary, 'users', 'users',
    'DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);

  return summary;
}

async function verifyClean(client) {
  const targets = await findTargets(client);
  return { users_left: targets.userIds.length, sites_left: targets.siteIds.length };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const summary = await purgeUatData(client);
    const verification = await verifyClean(client);
    if (verification.users_left || verification.sites_left) {
      throw new Error(`Purge verification failed: ${JSON.stringify(verification)}`);
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ success: true, summary, verification }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`UAT purge rolled back: ${error.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main();

module.exports = { purgeUatData, verifyClean, findTargets };
