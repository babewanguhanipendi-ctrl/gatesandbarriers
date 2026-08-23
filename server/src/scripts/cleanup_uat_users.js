#!/usr/bin/env node
/**
 * cleanup_uat_users.js — Semi-UAT Cleanup Script
 * ------------------------------------------------
 * Completely and safely removes ALL mock UAT data created by seed_uat_users.js:
 *
 *   - UAT users   (any user whose email ends in @gatesandbarriers.test, or whose
 *                  work number belongs to the reserved UAT blocks GBS-45x / GBG-195x)
 *   - UAT sites   (sites supervised/created by UAT users)
 *   - UAT shifts  (active/completed shifts belonging to UAT users or UAT sites)
 *   - Related financial test records (financial_ledger, payslips, payroll runs,
 *     attendance records, allocations, notifications, audit logs, emails, ...)
 *
 * Deletion order respects foreign-key constraints:
 *   children first (shifts, allocations, ledger...), then sites (which cascade their
 *   own shifts/payroll runs), then the users themselves (cascading the remainder).
 *
 * Usage:  npm run cleanup:uat      (from the server/ directory)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const { pool } = require('../db/pool');

// ---------------------------------------------------------------------------
// UAT identification constants (MUST stay in sync with seed_uat_users.js)
// ---------------------------------------------------------------------------

/** Every seeded account uses this reserved e-mail domain. */
const UAT_EMAIL_DOMAIN = '@gatesandbarriers.test';
const UAT_EMAIL_LIKE = `%${UAT_EMAIL_DOMAIN}`;

/**
 * Reserved work-number blocks (valid per system rules):
 *   supervisors -> GBS prefix, range 1-500  -> GBS-451 .. GBS-454
 *   guards      -> GBG prefix, range 501-2000 -> GBG-1951 .. GBG-1960
 */
const UAT_WORK_NUMBERS = [
  'GBS-451', 'GBS-452', 'GBS-453', 'GBS-454',
  'GBG-1951', 'GBG-1952', 'GBG-1953', 'GBG-1954',
  'GBG-1955', 'GBG-1956', 'GBG-1957', 'GBG-1958', 'GBG-1959', 'GBG-1960',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tableExists(client, table) {
  const result = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
  return result.rows[0].reg !== null;
}

/** Deletes rows from `table` if that table exists; returns deleted row count. */
async function deleteIfTableExists(client, table, sql, params) {
  if (!(await tableExists(client, table))) return 0;
  const result = await client.query(sql, params);
  return result.rowCount || 0;
}

// ---------------------------------------------------------------------------
// Purge logic (exported so the seed script can reuse it for idempotent re-runs)
// ---------------------------------------------------------------------------

/**
 * Removes every trace of UAT data using the provided client.
 * NOTE: does NOT manage transactions — the caller decides BEGIN/COMMIT so this
 *       can run standalone or inside the seed script's transaction.
 *
 * @param {import('pg').PoolClient} client
 * @returns {Promise<Object>} summary of deleted row counts per table
 */
async function purgeUatData(client) {
  const summary = {
    uat_users_found: 0,
    shifts: 0,
    allocations: 0,
    supervisor_allocations: 0,
    guard_off_status: 0,
    uniforms: 0,
    uniform_requests: 0,
    financial_ledger: 0,
    audits: 0,
    notifications: 0,
    attendance_compliance: 0,
    attendance_exceptions: 0,
    attendance_reports: 0,
    payslips: 0,
    shift_handovers: 0,
    company_schedules: 0,
    policies: 0,
    document_transfers: 0,
    meetings: 0,
    email_outbox: 0,
    audit_logs: 0,
    allocated_work_numbers: 0,
    sites: 0,
    users: 0,
  };

  // 1) Locate every UAT user (by reserved e-mail domain OR reserved work number).
  const usersResult = await client.query(
    `SELECT id, work_number, email, full_name
       FROM users
      WHERE email LIKE $1 OR work_number = ANY($2::varchar[])`,
    [UAT_EMAIL_LIKE, UAT_WORK_NUMBERS]
  );

  summary.uat_users_found = usersResult.rows.length;
  if (usersResult.rows.length === 0) {
    return summary; // nothing to clean
  }

  const ids = usersResult.rows.map((row) => row.id);

  // 2) Delete child records that reference UAT users directly.
  //    (Most of these would also cascade on user deletion — deleting them
  //     explicitly keeps the operation deterministic and countable.)

  summary.shifts = await deleteIfTableExists(
    client, 'shifts',
    'DELETE FROM shifts WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.allocations = await deleteIfTableExists(
    client, 'allocations',
    'DELETE FROM allocations WHERE guard_id = ANY($1::uuid[]) OR allocated_by = ANY($1::uuid[])',
    [ids]
  );

  summary.supervisor_allocations = await deleteIfTableExists(
    client, 'supervisor_allocations',
    'DELETE FROM supervisor_allocations WHERE supervisor_id = ANY($1::uuid[])',
    [ids]
  );

  summary.guard_off_status = await deleteIfTableExists(
    client, 'guard_off_status',
    'DELETE FROM guard_off_status WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.uniforms = await deleteIfTableExists(
    client, 'uniforms',
    'DELETE FROM uniforms WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.uniform_requests = await deleteIfTableExists(
    client, 'uniform_requests',
    'DELETE FROM uniform_requests WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.financial_ledger = await deleteIfTableExists(
    client, 'financial_ledger',
    'DELETE FROM financial_ledger WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.audits = await deleteIfTableExists(
    client, 'audits',
    'DELETE FROM audits WHERE reporter_id = ANY($1::uuid[]) OR guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.notifications = await deleteIfTableExists(
    client, 'notifications',
    'DELETE FROM notifications WHERE user_id = ANY($1::uuid[])',
    [ids]
  );

  summary.attendance_compliance = await deleteIfTableExists(
    client, 'attendance_compliance',
    'DELETE FROM attendance_compliance WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.attendance_exceptions = await deleteIfTableExists(
    client, 'attendance_exceptions',
    'DELETE FROM attendance_exceptions WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.attendance_reports = await deleteIfTableExists(
    client, 'attendance_reports',
    'DELETE FROM attendance_reports WHERE generated_by = ANY($1::uuid[])',
    [ids]
  );

  summary.payslips = await deleteIfTableExists(
    client, 'payslips',
    'DELETE FROM payslips WHERE guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.shift_handovers = await deleteIfTableExists(
    client, 'shift_handovers',
    'DELETE FROM shift_handovers WHERE guard_id = ANY($1::uuid[]) OR next_guard_id = ANY($1::uuid[])',
    [ids]
  );

  summary.company_schedules = await deleteIfTableExists(
    client, 'company_schedules',
    'DELETE FROM company_schedules WHERE created_by = ANY($1::uuid[])',
    [ids]
  );

  summary.policies = await deleteIfTableExists(
    client, 'policies',
    'DELETE FROM policies WHERE created_by = ANY($1::uuid[])',
    [ids]
  );

  summary.document_transfers = await deleteIfTableExists(
    client, 'document_transfers',
    'DELETE FROM document_transfers WHERE sender_id = ANY($1::uuid[]) OR recipient_id = ANY($1::uuid[])',
    [ids]
  );

  // Meetings may reference UAT users via director_id/secretary_id depending on
  // schema version — best effort, never fatal.
  try {
    summary.meetings = await deleteIfTableExists(
      client, 'meetings',
      'DELETE FROM meetings WHERE director_id = ANY($1::uuid[]) OR secretary_id = ANY($1::uuid[])',
      [ids]
    );
  } catch (_error) {
    summary.meetings = 0;
  }

  // 3) Delete UAT sites BEFORE deleting the users.
  //    sites.supervisor_id is ON DELETE SET NULL, so deleting users first would
  //    orphan the mock sites. Deleting sites here also cascades any remaining
  //    site-bound shifts, payroll_runs, treasury_disbursements and attendance data.
  summary.sites = await deleteIfTableExists(
    client, 'sites',
    'DELETE FROM sites WHERE supervisor_id = ANY($1::uuid[]) OR created_by = ANY($1::uuid[])',
    [ids]
  );

  // 4) Queued mail addressed to mock accounts (no FK — clean by address).
  summary.email_outbox = await deleteIfTableExists(
    client, 'email_outbox',
    'DELETE FROM email_outbox WHERE recipient_email LIKE $1',
    [UAT_EMAIL_LIKE]
  );

  // 5) Audit trail entries produced by/for the mock accounts
  //    (audit_logs.user_id is ON DELETE SET NULL — clean explicitly instead).
  summary.audit_logs = await deleteIfTableExists(
    client, 'audit_logs',
    'DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[]) OR user_email LIKE $2',
    [ids, UAT_EMAIL_LIKE]
  );

  // 6) Release the reserved work numbers so they can be re-seeded cleanly
  //    (allocated_work_numbers.user_id is ON DELETE SET NULL — clean explicitly).
  summary.allocated_work_numbers = await deleteIfTableExists(
    client, 'allocated_work_numbers',
    'DELETE FROM allocated_work_numbers WHERE work_number = ANY($1::varchar[])',
    [UAT_WORK_NUMBERS]
  );

  // 7) Finally remove the users themselves — cascades anything left over
  //    (remaining shifts, ledger rows, compliance records, etc.).
  const usersDelete = await client.query(
    'DELETE FROM users WHERE id = ANY($1::uuid[])',
    [ids]
  );
  summary.users = usersDelete.rowCount || 0;

  return summary;
}

// ---------------------------------------------------------------------------
// Verification + CLI entry point
// ---------------------------------------------------------------------------

async function verifyPurge(client) {
  const result = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE email LIKE $1 OR work_number = ANY($2::varchar[])) AS users_left,
       (SELECT COUNT(*) FROM sites s
          WHERE EXISTS (SELECT 1 FROM users u
                         WHERE (u.id = s.supervisor_id OR u.id = s.created_by)
                           AND (u.email LIKE $1 OR u.work_number = ANY($2::varchar[])))) AS sites_left,
       (SELECT COUNT(*) FROM shifts sh
          JOIN users u ON u.id = sh.guard_id
          WHERE u.email LIKE $1 OR u.work_number = ANY($2::varchar[])) AS shifts_left`,
    [UAT_EMAIL_LIKE, UAT_WORK_NUMBERS]
  );
  return result.rows[0];
}

function printSummary(summary, verification) {
  console.log('');
  console.log('==================== UAT CLEANUP SUMMARY ====================');
  for (const [table, count] of Object.entries(summary)) {
    if (count > 0) console.log(`  ${table.padEnd(26)} ${count} deleted`);
  }
  console.log('-------------------------------------------------------------');
  const leftovers = Number(verification.users_left) + Number(verification.sites_left) + Number(verification.shifts_left);
  if (leftovers === 0) {
    console.log('  Verification PASSED: no UAT users, sites or shifts remain.');
  } else {
    console.log(`  Verification WARNING: leftovers detected ->`, verification);
  }
  console.log('=============================================================');
  console.log('');
}

async function main() {
  const client = await pool.connect();
  try {
    const target = `${process.env.DB_NAME || 'gatesandbarriers'} @ ${process.env.DB_HOST || 'localhost'}`;
    console.log('');
    console.log(`🧹  Gates & Barriers — UAT cleanup started (database: ${target})`);

    await client.query('BEGIN');
    await client.query("SET TIME ZONE 'Africa/Nairobi'");

    const summary = await purgeUatData(client);

    if (summary.uat_users_found === 0) {
      await client.query('COMMIT');
      console.log('');
      console.log('✅  No UAT test data found — database already clean. Nothing to do.');
      console.log('');
      return;
    }

    const verification = await verifyPurge(client);
    await client.query('COMMIT');

    console.log('');
    console.log(`Found ${summary.uat_users_found} UAT user(s). Removed all associated test data.`);
    printSummary(summary, verification);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    console.error('');
    console.error('❌  UAT cleanup FAILED — transaction rolled back.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  purgeUatData,
  verifyPurge,
  UAT_EMAIL_DOMAIN,
  UAT_WORK_NUMBERS,
};