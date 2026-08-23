@echo off
REM GatesandBarriers ERP - Database Setup Script for Windows
REM This script automates the database setup process for PostgreSQL

echo =========================================
echo GatesandBarriers ERP - Database Setup
echo =========================================
echo.

REM Check if psql is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL client (psql) not found.
    echo Please install PostgreSQL from:
    echo https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)

REM Prompt for database details
echo Please enter your PostgreSQL database details:
set /p DB_HOST="Host (default: localhost): "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="Port (default: 5432): "
if "%DB_PORT%"=="" set DB_PORT=5432

set /p DB_NAME="Database name (default: gatesandbarriers): "
if "%DB_NAME%"=="" set DB_NAME=gatesandbarriers

set /p DB_USER="Username (default: postgres): "
if "%DB_USER%"=="" set DB_USER=postgres

set /p DB_PASSWORD="Password: "

REM Build connection string
set CONN=postgresql://%DB_USER%:%DB_PASSWORD%@%DB_HOST%:%DB_PORT%/%DB_NAME%

echo.
echo Testing database connection...
psql "%CONN%" -c "SELECT 1" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo. Error: Could not connect to database. Please check your credentials.
    pause
    exit /b 1
)
echo. Database connection successful

REM Run schema
echo.
echo Running database schema...
psql "%CONN%" -f database\init.sql
if %ERRORLEVEL% EQU 0 (
    echo. Schema created successfully
) else (
    echo. Error running schema
    pause
    exit /b 1
)

echo.
echo =========================================
echo Database Setup Complete!
echo =========================================
echo.
echo Next steps:
echo 1. Configure server\.env with your database credentials
echo 2. Start the backend: cd server ^&^& npm run dev
echo 3. Start the frontend: npm run dev
echo 4. Register users via: POST http://localhost:3001/api/auth/register
echo.
echo Sample registration:
echo   curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"admin@gatesandbarriers.com\",\"password\":\"password123\",\"full_name\":\"Admin User\",\"role\":\"admin\",\"work_number\":\"ADMIN-001\"}"
echo.
pause
