#!/bin/bash

# GatesandBarriers ERP - Database Setup Script
# This script automates the database setup process for PostgreSQL

echo "========================================="
echo "GatesandBarriers ERP - Database Setup"
echo "========================================="
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null
then
    echo "PostgreSQL client (psql) not found. Please install PostgreSQL."
    echo "Windows: https://www.postgresql.org/download/windows/"
    echo "Mac: brew install postgresql"
    echo "Linux: sudo apt-get install postgresql postgresql-contrib"
    exit 1
fi

# Prompt for database details
echo "Please enter your PostgreSQL database details:"
read -p "Host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name (default: gatesandbarriers): " DB_NAME
DB_NAME=${DB_NAME:-gatesandbarriers}

read -p "Username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -p "Password: " DB_PASSWORD

# Build connection string
CONN="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

echo ""
echo "Testing database connection..."
if ! psql "$CONN" -c "SELECT 1" &> /dev/null
then
    echo "✗ Could not connect to database. Please check your credentials."
    exit 1
fi
echo "✓ Database connection successful"

# Run schema
echo ""
echo "Running database schema..."
psql "$CONN" -f database/init.sql

# Check if schema ran successfully
if [ $? -eq 0 ]
then
    echo "✓ Schema created successfully"
else
    echo "✗ Error running schema"
    exit 1
fi

echo ""
echo "========================================="
echo "Database Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Configure server/.env with your database credentials"
echo "2. Start the backend: cd server && npm run dev"
echo "3. Start the frontend: npm run dev"
echo "4. Register users via: POST http://localhost:3001/api/auth/register"
echo ""
echo "Sample registration:"
echo '  curl -X POST http://localhost:3001/api/auth/register \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"email":"admin@gatesandbarriers.com","password":"password123","full_name":"Admin User","role":"admin","work_number":"ADMIN-001}"'"'"'
