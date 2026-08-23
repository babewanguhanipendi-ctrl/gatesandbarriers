# GatesandBarriers ERP - Database Setup Script for PowerShell
# This script automates the database setup process for PostgreSQL

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "GatesandBarriers ERP - Database Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is installed
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "PostgreSQL client (psql) not found." -ForegroundColor Red
    Write-Host "Please install PostgreSQL from:"
    Write-Host "https://www.postgresql.org/download/windows/"
    Read-Host "Press Enter to exit"
    exit 1
}

# Prompt for database details
Write-Host "Please enter your PostgreSQL database details:" -ForegroundColor Yellow
$DB_HOST = Read-Host "Host (default: localhost)"
if ([string]::IsNullOrEmpty($DB_HOST)) { $DB_HOST = "localhost" }

$DB_PORT = Read-Host "Port (default: 5432)"
if ([string]::IsNullOrEmpty($DB_PORT)) { $DB_PORT = "5432" }

$DB_NAME = Read-Host "Database name (default: gatesandbarriers)"
if ([string]::IsNullOrEmpty($DB_NAME)) { $DB_NAME = "gatesandbarriers" }

$DB_USER = Read-Host "Username (default: postgres)"
if ([string]::IsNullOrEmpty($DB_USER)) { $DB_USER = "postgres" }

$DB_PASSWORD = Read-Host "Password"

# Build connection string
$CONN = "postgresql://$DB_USER`:$DB_PASSWORD@$DB_HOST`:$DB_PORT/$DB_NAME"

Write-Host ""
Write-Host "Testing database connection..." -ForegroundColor Yellow
try {
    $testResult = psql $CONN -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connection failed"
    }
    Write-Host "Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "Error: Could not connect to database. Please check your credentials." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Run schema
Write-Host ""
Write-Host "Running database schema..." -ForegroundColor Yellow
try {
    psql $CONN -f "database\init.sql"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Schema created successfully" -ForegroundColor Green
    } else {
        throw "Schema creation failed"
    }
} catch {
    Write-Host "Error running schema" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Database Setup Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure server\.env with your database credentials"
Write-Host "2. Start the backend: cd server && npm run dev"
Write-Host "3. Start the frontend: npm run dev"
Write-Host "4. Register users via: POST http://localhost:3001/api/auth/register"
Write-Host ""
Write-Host "Sample registration:"
Write-Host '  curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@gatesandbarriers.com\",\"password\":\"password123\",\"full_name\":\"Admin User\",\"role\":\"admin\",\"work_number\":\"ADMIN-001\"}"'
Write-Host ""
Read-Host "Press Enter to exit"
