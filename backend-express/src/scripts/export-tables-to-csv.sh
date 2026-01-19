#!/bin/bash

# =============================================================================
# Database Tables CSV Export Script
# =============================================================================
# This script exports all database tables to CSV format
# Usage: ./export-tables-to-csv.sh [--output /path/to/backup]
# Default: Creates CSV files in backend-express/backups/csv/ directory
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUPS_DIR="$BACKEND_DIR/backups"

# Default output directory (simple csv folder)
DEFAULT_OUTPUT="$BACKEND_DIR/csv"
OUTPUT_DIR="$DEFAULT_OUTPUT"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output|-o)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [--output /path/to/backup]"
      echo ""
      echo "Options:"
      echo "  --output, -o    Specify output directory path"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# Prerequisites Check
# =============================================================================

log_info "Checking prerequisites..."

# Check if psql is installed
if ! command_exists psql; then
  log_error "psql is not installed. Please install PostgreSQL client tools."
  log_error "On Ubuntu/Debian: sudo apt-get install postgresql-client"
  log_error "On macOS: brew install postgresql"
  exit 1
fi

log_info "psql found ✓"

# Check if .env file exists
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log_error ".env file not found at $ENV_FILE"
  log_error "Please create .env file with DATABASE_URL"
  exit 1
fi

log_info ".env file found ✓"

# Load DATABASE_URL from .env
set -a
source "$ENV_FILE"
set +a

if [ -z "$DATABASE_URL" ]; then
  log_error "DATABASE_URL is not set in .env file"
  exit 1
fi

log_info "DATABASE_URL loaded ✓"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get absolute path for output directory
OUTPUT_DIR=$(cd "$(dirname "$OUTPUT_DIR")" && pwd)/$(basename "$OUTPUT_DIR")

# =============================================================================
# Export Tables to CSV
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Tables CSV Export${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Database: $(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):([^@]+)@([^/]+)/(.+)|Database: \4 on \3|')"
log_info "Output directory: $OUTPUT_DIR"
echo ""

# Parse DATABASE_URL to extract connection details
# Format: postgresql://user:password@host:port/database?params
# Handle query parameters by removing them first
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/?.*$//')
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^/:]+):?([0-9]*)/(.+)"
if [[ $DB_URL_CLEAN =~ $DB_URL_REGEX ]]; then
  DB_USER="${BASH_REMATCH[1]}"
  DB_PASS="${BASH_REMATCH[2]}"
  DB_HOST="${BASH_REMATCH[3]}"
  DB_PORT="${BASH_REMATCH[4]:-5432}"
  DB_NAME="${BASH_REMATCH[5]}"
else
  log_error "Failed to parse DATABASE_URL"
  log_error "URL format: $DATABASE_URL"
  exit 1
fi

# Set PGPASSWORD environment variable for psql
export PGPASSWORD="$DB_PASS"

# Get list of all tables (excluding system tables)
log_info "Fetching list of tables..."
TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename;
")

if [ -z "$TABLES" ]; then
  log_warn "No tables found in database"
  exit 0
fi

# Count tables
TABLE_COUNT=$(echo "$TABLES" | grep -v '^$' | wc -l | tr -d ' ')
log_info "Found $TABLE_COUNT tables to export"
echo ""

# Export each table to CSV
EXPORTED=0
FAILED=0

while IFS= read -r TABLE; do
  # Skip empty lines
  [ -z "$TABLE" ] && continue
  
  # Trim whitespace
  TABLE=$(echo "$TABLE" | xargs)
  
  CSV_FILE="$OUTPUT_DIR/${TABLE}.csv"
  
  log_info "Exporting table: $TABLE"
  
  # Export table to CSV using COPY command
  if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\COPY (SELECT * FROM \"$TABLE\") TO '$CSV_FILE' WITH (FORMAT CSV, HEADER true, DELIMITER ',', ENCODING 'UTF8');" >/dev/null 2>&1; then
    # Get row count
    ROW_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM \"$TABLE\";" | xargs)
    FILE_SIZE=$(du -h "$CSV_FILE" | cut -f1)
    log_info "  ✓ Exported $ROW_COUNT rows ($FILE_SIZE)"
    ((EXPORTED++))
  else
    log_error "  ✗ Failed to export $TABLE"
    ((FAILED++))
  fi
done <<< "$TABLES"

# Unset PGPASSWORD
unset PGPASSWORD

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Export Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Tables exported: $EXPORTED"
if [ $FAILED -gt 0 ]; then
  log_warn "Tables failed: $FAILED"
fi

# Get total size of backup
TOTAL_SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
log_info "Total backup size: $TOTAL_SIZE"
log_info "Backup location: $OUTPUT_DIR"

echo ""
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ CSV export completed successfully!${NC}"
else
  echo -e "${YELLOW}⚠️  CSV export completed with $FAILED error(s)${NC}"
fi
echo ""

