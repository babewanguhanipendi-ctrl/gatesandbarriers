#!/usr/bin/env node
/**
 * seed_uat_users.js — Semi-UAT Seed Script
 * ------------------------------------------
 * Populates the database with a complete, immediately-usable semi-UAT dataset:
 *
 *   1. AUTHENTICATION & VALIDATION COMPLIANCE
 *      - 14 mock accounts (4 supervisors + 10 guards) with valid e-mail format
 *        (<role><n>@gatesandbarriers.test) and valid Kenyan phone numbers
 *        (+2547XXXXXXXX).
 *      - Work numbers follow the system's role prefix rules
 *        (supervisors GBS-### within 1-500, guards GBG-#### within 501-2000).
 *      - Passwords hashed with bcrypt (10 rounds), all set to "1234567" so the
 *        accounts can log in immediately via work number + password.
 *
 *   2. EMAIL VERIFICATION BYPASS
 *      - Every mock user is flagged as verified (email_verified_at set,
 *        verification token cleared) so no verification workflow blocks login.
 *
 *   3. SITES & LOCATION ALLOCATION
 *      - 5 valid sites split across Nyali and Town (Mombasa CBD),
 *        each with real GPS coordinates (geofence-compatible), day/night rates
 *        and amount_offered so revenue accumulation works out of the box.
 *      - 4 supervisors allocated 1-per-site with an hourly rate of KES 400.
 *
 *   4. AUTO-ALLOCATION & BUSINESS MACHINE STARTUP
 *      - 10 guards auto-allocated evenly (2 per site) under their supervisor.
 *      - Active day-shifts generated for every guard AND supervisor so the
 *        manager/supervisor dashboards are populated immediately.
 *      - Financial machine initialized: shift rates (guards 254/hr,
 *        supervisors 400/hr), daily rates tied to site day rates, and site
 *        revenue inputs (day_rate x required_guards x 30) all present, so
 *        labor cost and revenue start calculating dynamically on clock-in.
 *
 *   5. LEAVE ELIGIBILITY SUPPORT
 *      - All workers have join_date 18-30 months in the past (> 1 year), making
 *        them eligible for paid full-salary leave and overtime tracking rules.
 *
 * The script is idempotent: it purges any previous UAT dataset (via the shared
 * cleanup logic) before inserting fresh data, all inside a single transaction.
 *
 * Usage:  npm run seed:uat       (from the server/ directory)
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { purgeUatData } = require('./cleanup_uat_users');

// ---------------------------------------------------------------------------
// UAT configuration (identification constants MUST stay in sync with
// cleanup_uat_users.js)
// ---------------------------------------------------------------------------

const UAT_EMAIL_DOMAIN = '@gatesandbarriers.test';
const UAT_PASSWORD = '1234567';
const BCRYPT_SALT_ROUNDS = 10;

/** System default guard hourly rate (DEFAULT_HOURLY_RATE in routes/shifts.js). */
const GUARD_SHIFT_RATE = 254.0;
const GUARD_HOURLY_RATE = GUARD_SHIFT_RATE / 12;
/** Required supervisor hourly rate for UAT (KES/hour). */
const SUPERVISOR_HOURLY_RATE = 400.0;
/** Standard guard daily rate (matches users table default). */
const GUARD_DAILY_RATE = 254.0;

/** East Africa Time (UTC+3) offset — timestamps are written as EAT wall-clock. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Mock dataset
// ---------------------------------------------------------------------------

const UAT_SITES = [
  {
    key: 'nyali_centre',
    site_name: 'Nyali Centre',
    location: 'Nyali',
    address: 'Links Road, Nyali, Mombasa',
    client_name: 'Nyali Centre Management Ltd',
    contact_number: '+254700000101',
    required_guards: 1,
    day_rate: 600.0,
    night_rate: 650.0,
    amount_offered: 32000.0,
    latitude: -4.0430,
    longitude: 39.6940, // east of the island polygon -> classifies as 'nyali'
    supervisorKey: 'sup1',
  },
  {
    key: 'nyali_luxury',
    site_name: 'Nyali Luxury Apartments',
    location: 'Nyali',
    address: 'Beach Road, Nyali, Mombasa',
    client_name: 'Nyali Luxury Apartments Ltd',
    contact_number: '+254700000102',
    required_guards: 3,
    day_rate: 650.0,
    night_rate: 700.0,
    amount_offered: 38000.0,
    latitude: -4.0380,
    longitude: 39.7000,
    supervisorKey: 'sup2',
  },
  {
    key: 'moi_plaza',
    site_name: 'Moi Avenue Plaza',
    location: 'Town',
    address: 'Moi Avenue, Mombasa CBD',
    client_name: 'Moi Avenue Plaza Holdings',
    contact_number: '+254700000103',
    required_guards: 2,
    day_rate: 600.0,
    night_rate: 650.0,
    amount_offered: 34000.0,
    latitude: -4.0550,
    longitude: 39.6680, // inside the Mombasa Island polygon -> 'town'
    supervisorKey: 'sup3',
  },
  {
    key: 'business_hub',
    site_name: 'Mombasa Business Hub',
    location: 'Town',
    address: 'Digo Road, Mombasa CBD',
    client_name: 'Mombasa Business Hub Group',
    contact_number: '+254700000104',
    required_guards: 4,
    day_rate: 700.0,
    night_rate: 750.0,
    amount_offered: 40000.0,
    latitude: -4.0450,
    longitude: 39.6700,
    supervisorKey: 'sup4',
  },
  {
    key: 'town_market',
    site_name: 'Mombasa Town Market',
    location: 'Town',
    address: 'Nyerere Avenue, Mombasa CBD',
    client_name: 'Mombasa Town Market Association',
    contact_number: '+254700000105',
    required_guards: 1,
    day_rate: 600.0,
    night_rate: 700.0,
    amount_offered: 30000.0,
    latitude: -4.0520,
    longitude: 39.6710,
    supervisorKey: 'sup4',
  },
];

const UAT_SUPERVISORS = [
  {
    key: 'sup1', work_number: 'GBS-451', email: `supervisor1${UAT_EMAIL_DOMAIN}`,
    full_name: 'John Mwangi', phone_number: '+254700000001', id_number: '99000001',
    emergency_contact: 'Mary Mwangi', emergency_phone: '+254720000001',
    months_employed: 30, siteKey: 'nyali_centre',
  },
  {
    key: 'sup2', work_number: 'GBS-452', email: `supervisor2${UAT_EMAIL_DOMAIN}`,
    full_name: 'Fatuma Ali', phone_number: '+254700000002', id_number: '99000002',
    emergency_contact: 'Ahmed Ali', emergency_phone: '+254720000002',
    months_employed: 28, siteKey: 'nyali_luxury',
  },
  {
    key: 'sup3', work_number: 'GBS-453', email: `supervisor3${UAT_EMAIL_DOMAIN}`,
    full_name: 'Peter Otieno', phone_number: '+254700000003', id_number: '99000003',
    emergency_contact: 'Jane Otieno', emergency_phone: '+254720000003',
    months_employed: 26, siteKey: 'moi_plaza',
  },
  {
    key: 'sup4', work_number: 'GBS-454', email: `supervisor4${UAT_EMAIL_DOMAIN}`,
    full_name: 'Grace Njeri', phone_number: '+254700000004', id_number: '99000004',
    emergency_contact: 'Samuel Njeri', emergency_phone: '+254720000004',
    months_employed: 24, siteKey: 'business_hub',
  },
];

const UAT_GUARDS = [
  {
    key: 'g1', work_number: 'GBG-1951', email: `guard1${UAT_EMAIL_DOMAIN}`,
    full_name: 'Amina Hassan', phone_number: '+254700000005', id_number: '99000005',
    emergency_contact: 'Halima Hassan', emergency_phone: '+254720000005',
    months_employed: 25, siteKey: 'nyali_centre', supervisorKey: 'sup1',
  },
  {
    key: 'g2', work_number: 'GBG-1952', email: `guard2${UAT_EMAIL_DOMAIN}`,
    full_name: 'Brian Kimani', phone_number: '+254700000006', id_number: '99000006',
    emergency_contact: 'Rose Kimani', emergency_phone: '+254720000006',
    months_employed: 24, siteKey: 'nyali_centre', supervisorKey: 'sup1',
  },
  {
    key: 'g3', work_number: 'GBG-1953', email: `guard3${UAT_EMAIL_DOMAIN}`,
    full_name: 'Cynthia Atieno', phone_number: '+254700000007', id_number: '99000007',
    emergency_contact: 'Paul Atieno', emergency_phone: '+254720000007',
    months_employed: 23, siteKey: 'nyali_luxury', supervisorKey: 'sup2',
  },
  {
    key: 'g4', work_number: 'GBG-1954', email: `guard4${UAT_EMAIL_DOMAIN}`,
    full_name: 'David Barasa', phone_number: '+254700000008', id_number: '99000008',
    emergency_contact: 'Esther Barasa', emergency_phone: '+254720000008',
    months_employed: 22, siteKey: 'nyali_luxury', supervisorKey: 'sup2',
  },
  {
    key: 'g5', work_number: 'GBG-1955', email: `guard5${UAT_EMAIL_DOMAIN}`,
    full_name: 'Esther Nduta', phone_number: '+254700000009', id_number: '99000009',
    emergency_contact: 'Peter Nduta', emergency_phone: '+254720000009',
    months_employed: 21, siteKey: 'moi_plaza', supervisorKey: 'sup3',
  },
  {
    key: 'g6', work_number: 'GBG-1956', email: `guard6${UAT_EMAIL_DOMAIN}`,
    full_name: 'Felix Omondi', phone_number: '+254700000010', id_number: '99000010',
    emergency_contact: 'Lilian Omondi', emergency_phone: '+254720000010',
    months_employed: 20, siteKey: 'moi_plaza', supervisorKey: 'sup3',
  },
  {
    key: 'g7', work_number: 'GBG-1957', email: `guard7${UAT_EMAIL_DOMAIN}`,
    full_name: 'Gladys Wanjiru', phone_number: '+254700000011', id_number: '99000011',
    emergency_contact: 'James Wanjiru', emergency_phone: '+254720000011',
    months_employed: 19, siteKey: 'business_hub', supervisorKey: 'sup4',
  },
  {
    key: 'g8', work_number: 'GBG-1958', email: `guard8${UAT_EMAIL_DOMAIN}`,
    full_name: 'Hassan Juma', phone_number: '+254700000012', id_number: '99000012',
    emergency_contact: 'Zawadi Juma', emergency_phone: '+254720000012',
    months_employed: 18, siteKey: 'business_hub', supervisorKey: 'sup4',
  },
  {
    key: 'g9', work_number: 'GBG-1959', email: `guard9${UAT_EMAIL_DOMAIN}`,
    full_name: 'Irene Wambui', phone_number: '+254700000013', id_number: '99000013',
    emergency_contact: 'James Wambui', emergency_phone: '+254720000013',
    months_employed: 20, siteKey: 'town_market', supervisorKey: 'sup4',
  },
  {
    key: 'g10', work_number: 'GBG-1960', email: `guard10${UAT_EMAIL_DOMAIN}`,
    full_name: 'Joseph Kilonzo', phone_number: '+254700000014', id_number: '99000014',
    emergency_contact: 'Miriam Kilonzo', emergency_phone: '+254720000014',
    months_employed: 19, siteKey: 'town_market', supervisorKey: 'sup4',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Today's date (YYYY-MM-DD) in East Africa Time. */
function eatToday() {
  return new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Current moment as an EAT wall-clock timestamp string ('YYYY-MM-DD HH:MM:SS'). */
function eatNowTimestamp() {
  return new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * ISO date (YYYY-MM-DD) exactly `months` months from today (EAT calendar).
 * Negative values produce past dates, positive values future dates.
 */
function isoDateMonthsFromNow(months) {
  const d = new Date(Date.now() + EAT_OFFSET_MS);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Tenure in years (2dp) used by leave-eligibility / payroll views. */
function tenureYears(monthsEmployed) {
  return Number((monthsEmployed / 12).toFixed(2));
}

async function assertCoreTables(client) {
  const required = ['users', 'sites', 'shifts', 'allocated_work_numbers'];
  for (const table of required) {
    const result = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
    if (result.rows[0].reg === null) {
      throw new Error(
        `Required table "${table}" is missing. Run "npm run migrate" (or database/init.sql) first.`
      );
    }
  }
}

async function tableExists(client, table) {
  const result = await client.query('SELECT to_regclass($1) AS reg', [`public.${table}`]);
  return result.rows[0].reg !== null;
}

// ---------------------------------------------------------------------------
// Seed steps (insertion order respects foreign keys)
// ---------------------------------------------------------------------------

/** Step 1 — create the 4 supervisors (site binding happens after sites exist). */
async function seedSupervisors(client, passwordHash) {
  const idsByKey = {};

  for (const sup of UAT_SUPERVISORS) {
    const joinDate = isoDateMonthsFromNow(-sup.months_employed);
    const result = await client.query(
      `INSERT INTO users (
         work_number, email, password_hash, full_name, role, account_status,
         join_date, hire_date, uniform_status, last_active_date, phone_number,
         email_verified_at, id_number, emergency_contact, emergency_phone,
         shift_type, daily_rate, tenure_years, available_for_overtime
       ) VALUES (
         $1, $2, $3, $4, 'supervisor', 'active',
         $5, $5, 'allocated', CURRENT_TIMESTAMP, $6,
         CURRENT_TIMESTAMP, $7, $8, $9,
         'day', $10, $11, TRUE
       )
       RETURNING id`,
      [
        sup.work_number, sup.email, passwordHash, sup.full_name,
        joinDate, sup.phone_number,
        sup.id_number, sup.emergency_contact, sup.emergency_phone,
        SUPERVISOR_HOURLY_RATE, tenureYears(sup.months_employed),
      ]
    );

    const userId = result.rows[0].id;
    idsByKey[sup.key] = userId;

    await client.query(
      `INSERT INTO allocated_work_numbers (work_number, user_id, role)
       VALUES ($1, $2, 'supervisor')`,
      [sup.work_number, userId]
    );
  }

  return idsByKey;
}

/** Step 2 — create the 4 sites, each supervised by its own supervisor. */
async function seedSites(client, supervisorIdsByKey) {
  const idsByKey = {};

  for (const site of UAT_SITES) {
    const result = await client.query(
      `INSERT INTO sites (
         site_name, location, address, client_name, contact_number,
         required_guards, day_rate, night_rate, amount_offered,
         supervisor_id, status, contract_start, contract_end,
         latitude, longitude, geofence_radius
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, 100)
       RETURNING id`,
      [
        site.site_name, site.location, site.address, site.client_name, site.contact_number,
        site.required_guards, site.day_rate, site.night_rate, site.amount_offered,
        supervisorIdsByKey[site.supervisorKey],
        isoDateMonthsFromNow(-11), isoDateMonthsFromNow(12),
        site.latitude, site.longitude,
      ]
    );
    idsByKey[site.key] = result.rows[0].id;
  }

  return idsByKey;
}

/** Step 3 — bind supervisors to their assigned site (users.site_id). */
async function bindSupervisorsToSites(client, supervisorIdsByKey, siteIdsByKey) {
  const boundSupervisors = new Set();
  for (const site of UAT_SITES) {
    if (boundSupervisors.has(site.supervisorKey)) continue;
    boundSupervisors.add(site.supervisorKey);
    await client.query('UPDATE users SET site_id = $1 WHERE id = $2', [
      siteIdsByKey[site.key],
      supervisorIdsByKey[site.supervisorKey],
    ]);
  }
}

/** Step 4 — create the 8 guards, pre-assigned to their site (2 per site). */
async function seedGuards(client, passwordHash, siteIdsByKey) {
  const idsByKey = {};

  for (const guard of UAT_GUARDS) {
    const joinDate = isoDateMonthsFromNow(-guard.months_employed);
    const result = await client.query(
      `INSERT INTO users (
         work_number, email, password_hash, full_name, role, account_status,
         join_date, hire_date, uniform_status, last_active_date, site_id, phone_number,
         email_verified_at, id_number, emergency_contact, emergency_phone,
         shift_type, daily_rate, tenure_years, available_for_overtime
       ) VALUES (
         $1, $2, $3, $4, 'guard', 'active',
         $5, $5, 'allocated', CURRENT_TIMESTAMP, $6, $7,
         CURRENT_TIMESTAMP, $8, $9, $10,
         'day', $11, $12, TRUE
       )
       RETURNING id`,
      [
        guard.work_number, guard.email, passwordHash, guard.full_name,
        joinDate, siteIdsByKey[guard.siteKey], guard.phone_number,
        guard.id_number, guard.emergency_contact, guard.emergency_phone,
        GUARD_DAILY_RATE, tenureYears(guard.months_employed),
      ]
    );

    const userId = result.rows[0].id;
    idsByKey[guard.key] = userId;

    await client.query(
      `INSERT INTO allocated_work_numbers (work_number, user_id, role)
       VALUES ($1, $2, 'guard')`,
      [guard.work_number, userId]
    );
  }

  return idsByKey;
}

/** Step 5a — register each supervisor's area coverage (town/nyali). */
async function seedAreaAllocations(client, supervisorIdsByKey) {
  if (!(await tableExists(client, 'supervisor_allocations'))) {
    console.log('   ⚠ supervisor_allocations table missing — skipping area allocations.');
    return;
  }
  const allocatedSupervisors = new Set();
  for (const site of UAT_SITES) {
    if (allocatedSupervisors.has(site.supervisorKey)) continue;
    allocatedSupervisors.add(site.supervisorKey);
    await client.query(
      `INSERT INTO supervisor_allocations (supervisor_id, area, shift_type, motorcycle, motor_gear)
       VALUES ($1, $2, 'day', TRUE, TRUE)`,
      [supervisorIdsByKey[site.supervisorKey], site.location.toLowerCase()]
    );
  }
}

/** Step 5b — auto-allocate every guard to their site under their supervisor. */
async function seedGuardAllocations(client, siteIdsByKey, supervisorIdsByKey, guardIdsByKey) {
  if (!(await tableExists(client, 'allocations'))) {
    console.log('   ⚠ allocations table missing — skipping guard allocations.');
    return;
  }
  const today = eatToday();
  for (const guard of UAT_GUARDS) {
    const site = UAT_SITES.find((s) => s.key === guard.siteKey);
    await client.query(
      `INSERT INTO allocations (guard_id, site_id, allocated_by, date, shift_type, status, notes)
       VALUES ($1, $2, $3, $4, 'day', 'active', $5)`,
      [
        guardIdsByKey[guard.key],
        siteIdsByKey[site.key],
        supervisorIdsByKey[guard.supervisorKey],
        today,
        `UAT seed: auto-allocated to ${site.site_name} (${site.location})`,
      ]
    );
  }
}

/**
 * Step 6 — creates day and night shifts for every person:
 *   - day shifts start at 06:00 EAT and are checked in "now"
 *   - night shifts start at 18:00 EAT and remain scheduled until clock-in
 *   - guards use the 254 baseline; supervisors use the 400 baseline
 *   - daily rates follow the site's day/night rate for each shift
 * The day shift remains open so labor-cost queries accumulate live.
 */
async function seedActiveShifts(client, siteIdsByKey, supervisorIdsByKey, guardIdsByKey) {
  const today = eatToday();
  const checkInAt = eatNowTimestamp();
  const shiftTypes = ['day', 'night'];

  for (const sup of UAT_SUPERVISORS) {
    const site = UAT_SITES.find((s) => s.supervisorKey === sup.key);
    for (const shiftType of shiftTypes) {
      const isDayShift = shiftType === 'day';
      await client.query(
        `INSERT INTO shifts (
           guard_id, site_id, date, shift_type, status,
           start_time, check_in_time, end_time, check_out_time,
           hourly_rate, daily_rate, notes,
           check_in_latitude, check_in_longitude, check_in_accuracy, check_in_geofence_verified,
           clock_in_method, supervisor_clock_in, supervisor_clock_in_by
         ) VALUES (
           $1, $2, $3, $4, 'scheduled',
           $5, $6, NULL, NULL,
           $7, $8, $9,
           $10, $11, 10, $12,
           'normal', FALSE, NULL
         )`,
        [
          supervisorIdsByKey[sup.key], siteIdsByKey[site.key], today, shiftType,
          `${today} ${isDayShift ? '06:00:00' : '18:00:00'}`, isDayShift ? checkInAt : null,
          SUPERVISOR_HOURLY_RATE / 12, SUPERVISOR_HOURLY_RATE,
          `UAT seed: supervisor ${shiftType} shift at ${site.client_name}`,
          isDayShift ? site.latitude : null, isDayShift ? site.longitude : null, isDayShift,
        ]
      );
    }
  }

  for (const guard of UAT_GUARDS) {
    const site = UAT_SITES.find((s) => s.key === guard.siteKey);
    for (const shiftType of shiftTypes) {
      const isDayShift = shiftType === 'day';
      await client.query(
        `INSERT INTO shifts (
           guard_id, site_id, date, shift_type, status,
           start_time, check_in_time, end_time, check_out_time,
           hourly_rate, daily_rate, notes,
           check_in_latitude, check_in_longitude, check_in_accuracy, check_in_geofence_verified,
           clock_in_method, supervisor_clock_in, supervisor_clock_in_by
         ) VALUES (
           $1, $2, $3, $4, 'scheduled',
           $5, $6, NULL, NULL,
           $7, $8, $9,
           $10, $11, 10, $12,
           'supervisor', TRUE, $13
         )`,
        [
          guardIdsByKey[guard.key], siteIdsByKey[site.key], today, shiftType,
          `${today} ${isDayShift ? '06:00:00' : '18:00:00'}`, isDayShift ? checkInAt : null,
          GUARD_HOURLY_RATE, GUARD_SHIFT_RATE,
          `UAT seed: auto-allocated ${shiftType} shift at ${site.client_name}`,
          isDayShift ? site.latitude : null, isDayShift ? site.longitude : null, isDayShift,
          supervisorIdsByKey[guard.supervisorKey],
        ]
      );
    }
  }
}

/** Step 7 — a welcome notification per account so portals have activity. */
async function seedNotifications(client, allUserIds) {
  for (const userId of allUserIds) {
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, priority, metadata)
       VALUES ($1, 'system', 'UAT Environment Ready', $2, 'low', $3::jsonb)`,
      [
        userId,
        'Semi-UAT test account provisioned. This account is for testing only and will be removed by cleanup:uat.',
        JSON.stringify({ source: 'uat_seed', seeded_at: new Date().toISOString() }),
      ]
    );
  }
}

/** Step 8 — audit-trail entry marking the seed run. */
async function seedAuditTrail(client) {
  await client.query(
    `INSERT INTO audit_logs (user_name, user_email, action, type, description)
     VALUES ('UAT Seeder', 'uat-seeder@gatesandbarriers.test', 'UAT Seed', 'system', $1)`,
    [
      `Seeded semi-UAT dataset: ${UAT_SUPERVISORS.length} supervisors, ${UAT_GUARDS.length} guards, ` +
      `${UAT_SITES.length} sites (2 Nyali / 2 Town), active shifts and allocations.`,
    ]
  );
}

// ---------------------------------------------------------------------------
// Verification & reporting
// ---------------------------------------------------------------------------

async function collectVerification(client) {
  // Core checks (tables guaranteed by assertCoreTables).
  const core = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM users
         WHERE email LIKE '%@gatesandbarriers.test') AS uat_users,
       (SELECT COUNT(*) FROM sites
          WHERE site_name = ANY($1::varchar[])) AS uat_sites,
       (SELECT COUNT(*) FROM shifts sh
          JOIN users u ON u.id = sh.guard_id
          JOIN sites s ON s.id = sh.site_id
          WHERE u.email LIKE '%@gatesandbarriers.test'
            AND s.site_name = ANY($1::varchar[])
            AND sh.check_in_time IS NOT NULL AND sh.end_time IS NULL) AS active_shifts,
       (SELECT COUNT(*) FROM shifts sh
          JOIN users u ON u.id = sh.guard_id
          WHERE u.email LIKE '%@gatesandbarriers.test') AS total_shifts`,
    [UAT_SITES.map((s) => s.site_name)]
  );

  const verification = { ...core.rows[0] };

  // Optional checks (tables created by migrations may be absent).
  if (await tableExists(client, 'allocations')) {
    const res = await client.query(
      `SELECT COUNT(*) AS n FROM allocations a
         JOIN users u ON u.id = a.guard_id
         WHERE u.email LIKE '%@gatesandbarriers.test'`
    );
    verification.guard_allocations = res.rows[0].n;
  } else {
    verification.guard_allocations = null;
  }

  if (await tableExists(client, 'supervisor_allocations')) {
    const res = await client.query(
      `SELECT COUNT(*) AS n FROM supervisor_allocations sa
         JOIN users u ON u.id = sa.supervisor_id
         WHERE u.email LIKE '%@gatesandbarriers.test'`
    );
    verification.supervisor_area_allocations = res.rows[0].n;
  } else {
    verification.supervisor_area_allocations = null;
  }

  return verification;
}

function printCredentials() {
  const rows = [];

  for (const sup of UAT_SUPERVISORS) {
    const site = UAT_SITES.find((s) => s.supervisorKey === sup.key);
    rows.push({
      role: 'supervisor',
      work_number: sup.work_number,
      password: UAT_PASSWORD,
      name: sup.full_name,
      email: sup.email,
      site: site.site_name,
      hourly_rate: SUPERVISOR_HOURLY_RATE,
    });
  }

  for (const guard of UAT_GUARDS) {
    const site = UAT_SITES.find((s) => s.key === guard.siteKey);
    rows.push({
      role: 'guard',
      work_number: guard.work_number,
      password: UAT_PASSWORD,
      name: guard.full_name,
      email: guard.email,
      site: site.site_name,
      hourly_rate: GUARD_HOURLY_RATE,
    });
  }

  console.log('');
  console.log('==================== UAT LOGIN CREDENTIALS ===================');
  console.log('(login with work number + password)');
  console.table(rows);
}

function printSites() {
  const rows = UAT_SITES.map((site) => ({
    site: site.site_name,
    location: site.location,
    day_rate: site.day_rate,
    night_rate: site.night_rate,
    monthly_offered: site.amount_offered,
    required_guards: site.required_guards,
    supervisor: UAT_SUPERVISORS.find((s) => s.key === site.supervisorKey).full_name,
  }));
  console.log('==================== UAT SITES & RATES =======================');
  console.table(rows);
}

function printVerification(v) {
  const expected = {
    uat_users: UAT_SUPERVISORS.length + UAT_GUARDS.length,
    uat_sites: UAT_SITES.length,
    active_shifts: UAT_SUPERVISORS.length + UAT_GUARDS.length,
    total_shifts: (UAT_SUPERVISORS.length + UAT_GUARDS.length) * 2,
    guard_allocations: UAT_GUARDS.length,
    supervisor_area_allocations: UAT_SUPERVISORS.length,
  };

  console.log('==================== SEED VERIFICATION =======================');
  let passed = true;
  for (const key of Object.keys(expected)) {
    const actual = v[key];
    if (actual === null || actual === undefined) {
      console.log(`  ⏭ ${key.padEnd(32)} skipped (table not present)`);
      continue;
    }
    const ok = Number(actual) === expected[key];
    if (!ok) passed = false;
    console.log(`  ${ok ? '✅' : '❌'} ${key.padEnd(32)} ${Number(actual)}/${expected[key]}`);
  }
  console.log('-------------------------------------------------------------');
  console.log(passed
    ? '  All checks passed. Dashboards are populated and ready for UAT.'
    : '  Some checks FAILED — inspect the output above.');
  console.log('=============================================================');
  console.log('');
  if (!passed) {
    throw new Error('Seed verification failed — rolling back.');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const client = await pool.connect();
  try {
    const target = `${process.env.DB_NAME || 'gatesandbarriers'} @ ${process.env.DB_HOST || 'localhost'}`;
    console.log('');
    console.log(`🌱  Gates & Barriers — semi-UAT seeding started (database: ${target})`);

    await assertCoreTables(client);

    await client.query('BEGIN');
    await client.query("SET TIME ZONE 'Africa/Nairobi'");

    // Idempotency: remove any previous UAT dataset before inserting fresh data.
    const purged = await purgeUatData(client);
    if (purged.uat_users_found > 0) {
      console.log(`   Removed stale UAT data from a previous run (${purged.uat_users_found} users).`);
    }

    console.log('   Hashing shared UAT password with bcrypt...');
    const passwordHash = await bcrypt.hash(UAT_PASSWORD, BCRYPT_SALT_ROUNDS);

    console.log('   Creating supervisors...');
    const supervisorIdsByKey = await seedSupervisors(client, passwordHash);

    console.log(`   Creating sites (${UAT_SITES.length} across Nyali and Town)...`);
    const siteIdsByKey = await seedSites(client, supervisorIdsByKey);

    console.log('   Binding supervisors to their sites...');
    await bindSupervisorsToSites(client, supervisorIdsByKey, siteIdsByKey);

    console.log(`   Creating guards (${UAT_GUARDS.length} total)...`);
    const guardIdsByKey = await seedGuards(client, passwordHash, siteIdsByKey);

    console.log('   Allocating areas and guards...');
    await seedAreaAllocations(client, supervisorIdsByKey);
    await seedGuardAllocations(client, siteIdsByKey, supervisorIdsByKey, guardIdsByKey);

    console.log('   Starting active shifts (financial machine online)...');
    await seedActiveShifts(client, siteIdsByKey, supervisorIdsByKey, guardIdsByKey);

    const allUserIds = [...Object.values(supervisorIdsByKey), ...Object.values(guardIdsByKey)];
    console.log('   Creating notifications and audit trail...');
    await seedNotifications(client, allUserIds);
    await seedAuditTrail(client);

    const verification = await collectVerification(client);
    await client.query('COMMIT');

    printCredentials();
    printSites();
    printVerification(verification);
    console.log('✅  Semi-UAT seed complete. When finished testing, run: npm run cleanup:uat');
    console.log('');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    console.error('');
    console.error('❌  UAT seed FAILED — transaction rolled back.');
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