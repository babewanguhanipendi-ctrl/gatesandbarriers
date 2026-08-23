'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

// The reset schema is the single source of truth for application objects.
const MASTER_SCHEMA_PATH = path.resolve(__dirname, '..', '..', '..', 'database', 'init.sql');

async function runMigration() {
  const schema = fs.readFileSync(MASTER_SCHEMA_PATH, 'utf8');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    console.log(`[Migration] Master schema applied from ${MASTER_SCHEMA_PATH}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Migration] Master schema failed; transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkSchemaHealth() {
  const result = await pool.query(`
    SELECT COUNT(*)::int AS table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'sites', 'shifts', 'clock_ins', 'leave_records', 'pay_rates', 'financial_ledgers')
  `);

  return {
    healthy: result.rows[0].table_count === 7,
    tableCount: result.rows[0].table_count,
  };
}

module.exports = {
  runMigration,
  checkSchemaHealth,
  MASTER_SCHEMA_PATH,
};
