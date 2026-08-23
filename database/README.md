# Database Setup Guide

## Quick Start

This project uses automatic database bootstrapping that runs on server startup. `init.sql` is the single master schema and is applied as a clean, transactional reset by the server.

## Prerequisites

- PostgreSQL 12+ installed and running
- Database created (e.g., `gatesandbarriers`)

## Automatic Database Bootstrapping (Recommended)

The server automatically initializes and validates the database schema on startup. No manual setup is required!

### How it works:

1. **Connection Wait**: The server waits for PostgreSQL to be available (up to 30 seconds with retries)
2. **Master reset**: Drops and rebuilds all application tables, indexes, and triggers
3. **Transactional safety**: Rolls back the reset if any statement fails

### To start the server:

```bash
cd server
npm start
```

The server will:
- Wait for database connection
- Run schema migration automatically
- Create all tables if they don't exist
- Start accepting requests only after database is ready

## Manual Setup Methods

### Method 1: Using PowerShell Script (Windows)

```powershell
# From the project root directory
.\database\setup.ps1
```

This interactive script will:
- Check for PostgreSQL installation
- Prompt for database credentials
- Test the connection
- Run the schema automatically

### Method 2: Using psql (Command Line)

If you have PostgreSQL installed and `psql` is in your PATH:

```bash
# Connect to PostgreSQL and run the schema
psql -U postgres -d gatesandbarriers -f database/init.sql
```

**Note for Windows users:** If `psql` is not recognized, you need to:
1. Add PostgreSQL's `bin` directory to your system PATH (e.g., `C:\Program Files\PostgreSQL\15\bin`)
2. Or use the full path: `"C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d gatesandbarriers -f database/init.sql`

### Method 3: Using pgAdmin (GUI)

1. Open pgAdmin and connect to your PostgreSQL server
2. Select the database (e.g., `gatesandbarriers`)
3. Go to **Tools > Query Tool**
4. Open the file `database/init.sql`
5. Click **Execute** (F5)

### Method 4: Using Node.js Script (Manual Schema Run)

```bash
# From the project root
# Note: This requires the database to be already set up.
# The server handles this automatically on startup.
```

## Environment Configuration

Ensure your `.env` file (in the `server/` directory) has the correct database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gatesandbarriers
DB_USER=postgres
DB_PASSWORD=your_password
```

## What Gets Created

The `init.sql` script creates the following tables:

1. **users** - All user types (admin, director, manager, supervisor, secretary, guard)
2. **sites** - Site information with client details, rates, and contract tracking
3. **shifts** - Shift scheduling, clock-in/out, verification, and rates
4. **uniforms** - Baseline inventory and 300 KES monthly deduction tracking
5. **uniform_requests** - Guard uniform requests with delivery tracking
6. **requests** - Client intake system
7. **applications** - Guard job applications
8. **financial_ledger** - Financial transactions (uniform, penalty, bonus, salary, etc.)
9. **audits** - Incident reports and audits
10. **notifications** - User notifications
11. **audit_logs** - System audit trail
12. **policies** - Company policies
13. **document_transfers** - Supervisor portal document transfers
14. **email_outbox** - Email queue for notifications

## Schema Initialization

The server applies `init.sql` only when the required application schema is missing or incomplete. A healthy database is left untouched during startup so existing users and operational data are preserved.

## Table Creation Order

Tables are created in the correct relational order to satisfy foreign key dependencies:

1. **users** - Base table (referenced by most other tables)
2. **sites** - Referenced by shifts, uniforms, financial_ledger, audits
3. **shifts** - References users and sites
4. **uniforms** - References users
5. **uniform_requests** - References users
6. **requests** - Client intake (standalone)
7. **applications** - Guard applications (standalone)
8. **financial_ledger** - References users and sites
9. **audits** - References users and sites
10. **notifications** - References users
11. **audit_logs** - References users
12. **policies** - References users
13. **document_transfers** - References users
14. **email_outbox** - Standalone (no foreign keys)

**Note**: The `users.site_id` foreign key is added after all tables are created to avoid circular dependency issues.

## Verification

After running the script, you'll see:
- A list of all created tables with column counts
- A list of all indexes
- A list of all triggers
- Success messages confirming initialization

## Next Steps

After database initialization:

1. Start the server: `npm start` or `npm run dev`
2. Create an admin user via POST request to `/api/auth/register`
3. Log in and begin using the system

## Troubleshooting

### "Database does not exist"
```bash
# Create the database first
psql -U postgres -c "CREATE DATABASE gatesandbarriers;"
```

### "Extension uuid-ossp does not exist"
```bash
# Install the extension (requires superuser privileges)
psql -U postgres -d gatesandbarriers -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### "Permission denied"
Ensure your database user has CREATE privileges on the database.

- Truncate all tables in the correct order (respecting foreign key constraints)
- Preserve all table structures, indexes, and triggers
- Reset sequences for fresh ID generation
- Leave the database 100% empty and ready for fresh data

## Migration from Old System

If you're migrating from the old multi-file migration system:

1. **Backup your existing database first!**
2. Drop all existing tables or create a new database
3. Run the new `init.sql` script
4. The old `database/migrations/` folder and migration runners have been removed

## Support

For issues or questions, refer to the main project documentation.