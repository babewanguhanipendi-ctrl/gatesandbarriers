require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, checkDatabaseConnection, waitForDatabase } = require('./db/pool');
const { runMigration, checkSchemaHealth } = require('./db/migrate');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const sitesRoutes = require('./routes/sites');
const shiftsRoutes = require('./routes/shifts');
const financialRoutes = require('./routes/financial');
const auditsRoutes = require('./routes/audits');
const notificationsRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const businessRoutes = require('./routes/business');
const requestsRoutes = require('./routes/requests');
const applicationsRoutes = require('./routes/applications');
const directorRoutes = require('./routes/director');
const managerRoutes = require('./routes/manager');
const supervisorRoutes = require('./routes/supervisor');
const secretaryRoutes = require('./routes/secretary');
const uniformRequestsRoutes = require('./routes/uniform-requests');
const meetingsRoutes = require('./routes/meetings');
const { reconcileOverdueShifts } = require('./services/attendanceService');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Track database initialization status
let dbInitialized = false;
let dbInitializationError = null;

// Run database migration on startup
async function initializeDatabase() {
  try {
    console.log('[Startup] Initializing database...');
    const schemaHealth = await checkSchemaHealth();
    if (schemaHealth.healthy) {
      dbInitialized = true;
      console.log('[Startup] Existing database schema is healthy; reset migration skipped');
      return true;
    }

    await runMigration();
    dbInitialized = true;
    console.log('[Startup] Database initialized successfully');
    return true;
  } catch (error) {
    dbInitializationError = error.message;
    console.error('[Startup] Database initialization failed:', error.message);
    throw error;
  }
}

// Make database pool available to routes
app.set('db', pool);

// Middleware
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check with schema validation
app.get('/health', async (req, res) => {
  try {
    await checkDatabaseConnection();
    
    // Check schema health
    const schemaHealth = await checkSchemaHealth();
    
    if (schemaHealth.healthy) {
      res.json({ 
        status: 'ok', 
        database: 'ok', 
        schema: 'valid',
        timestamp: new Date().toISOString() 
      });
    } else {
      res.status(503).json({
        status: 'degraded',
        database: 'ok',
        schema: 'invalid',
        issues: schemaHealth.issues,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      database: 'unavailable',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Database status check endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get table count
      const tableResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      // Get index count
      const indexResult = await client.query(`
        SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'
      `);
      
      res.json({
        status: 'ok',
        tables: tableResult.rows.map(r => r.table_name),
        tableCount: tableResult.rows.length,
        indexCount: parseInt(indexResult.rows[0].count)
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Serve static files in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../../dist')));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/audits', auditsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/director', directorRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/supervisor', supervisorRoutes);
app.use('/api/secretary', secretaryRoutes);
app.use('/api/uniform-requests', uniformRequestsRoutes);
app.use('/api/meetings', meetingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Catch-all route for client-side routing (must be after API routes)
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Start server only after database is initialized
async function startServer() {
  try {
    console.log('[Startup] Waiting for database to be ready...');
    
    // Wait for database to be ready (with retries for Docker environments)
    const dbReady = await waitForDatabase(30, 1000);
    if (!dbReady) {
      throw new Error('Database not ready after 30 seconds. Please ensure PostgreSQL is running.');
    }
    
    console.log('[Startup] Database connection pool created successfully');
    
    // Run migration to ensure schema is up-to-date
    await initializeDatabase();

    await reconcileOverdueShifts(pool);
    setInterval(() => {
      reconcileOverdueShifts(pool).catch((error) => console.error('[Attendance] Reconciliation failed:', error));
    }, 60 * 1000);
    
    // Finally, start the server
    const server = app.listen(PORT, '0.0.0.0', () => {
      const networkInterfaces = require('os').networkInterfaces();
      const addresses = [];
      Object.keys(networkInterfaces).forEach((iface) => {
        networkInterfaces[iface].forEach((info) => {
          if (info.family === 'IPv4' && !info.internal) {
            addresses.push(info.address);
          }
        });
      });
      console.log(`GatesandBarriers server running on port ${PORT}`);
      console.log(`Local:    http://localhost:${PORT}`);
      addresses.forEach((addr) => {
        console.log(`Network:  http://${addr}:${PORT}`);
      });
      console.log(`Database: ${process.env.DB_NAME || 'gatesandbarriers'} at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);
      if (isProduction) {
        console.log(`Serving static files from: ${path.join(__dirname, '../../dist')}`);
      }
    });

    server.on('error', (error) => {
      console.error(`[Startup] Failed to listen on port ${PORT}:`, error.message);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('[Startup] Failed to start server due to database error:', error.message);
    console.error('[Startup] Please ensure PostgreSQL is running and the database exists.');
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = { app, pool };