const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'gatesandbarriers',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

async function checkDatabaseConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

/**
 * Check if the database is ready (just connection - schema will be created by migration)
 */
async function isDatabaseReady() {
  const client = await pool.connect();
  try {
    // Check connection - just need to verify database is accessible
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  } finally {
    client.release();
  }
}

/**
 * Wait for database to be ready with retries
 * This is useful for Docker environments where the database may not be immediately available
 */
async function waitForDatabase(maxRetries = 30, retryInterval = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const ready = await isDatabaseReady();
      if (ready) {
        return true;
      }
    } catch (error) {
      // Database not ready yet
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  return false;
}

module.exports = {
  pool,
  checkDatabaseConnection,
  isDatabaseReady,
  waitForDatabase,
};