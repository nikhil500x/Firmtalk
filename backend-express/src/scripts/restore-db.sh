#!/bin/bash

# =============================================================================
# Database Restore Script
# =============================================================================
# This script restores a database from a backup file
# After restore, it resets all sequences to start from 1 (fresh auto-increment IDs)
# Usage: ./restore-db.sh <backup_file.sql> [--no-reset-sequences]
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

RESET_SEQUENCES=true
BACKUP_FILE=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-reset-sequences)
      RESET_SEQUENCES=false
      shift
      ;;
    --help|-h)
      echo "Usage: $0 <backup_file.sql> [--no-reset-sequences]"
      echo ""
      echo "Arguments:"
      echo "  backup_file.sql        Path to the SQL backup file to restore"
      echo ""
      echo "Options:"
      echo "  --no-reset-sequences   Don't reset sequences after restore (keep existing IDs)"
      echo "  --help, -h             Show this help message"
      exit 0
      ;;
    *)
      if [ -z "$BACKUP_FILE" ]; then
        BACKUP_FILE="$1"
      else
        echo -e "${RED}Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
      fi
      shift
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
# Validation
# =============================================================================

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
  log_error "Backup file is required"
  echo "Usage: $0 <backup_file.sql> [--no-reset-sequences]"
  echo "Use --help for more information"
  exit 1
fi

# Convert to absolute path
if [[ "$BACKUP_FILE" != /* ]]; then
  BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

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

# =============================================================================
# Confirmation
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Restore${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
log_info "Database: $(echo $DATABASE_URL | sed -E 's|postgresql://([^:]+):([^@]+)@([^/]+)/(.+)|Database: \4 on \3|')"
log_info "Backup file: $BACKUP_FILE"
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_info "Backup size: $FILE_SIZE"

if [ "$RESET_SEQUENCES" = true ]; then
  log_info "ID reassignment: Enabled (all IDs will be reassigned starting from 1)"
else
  log_info "Sequence reset: Disabled (sequences will keep current values)"
fi

echo ""
log_warn "⚠️  WARNING: This will replace ALL data in the database!"
log_warn "⚠️  All existing data will be permanently deleted!"
echo ""

read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  log_info "Restore cancelled."
  exit 0
fi

# =============================================================================
# Restore Database
# =============================================================================

log_info "Restoring database from backup..."
log_info "This may take a while depending on backup size..."

# Restore from backup file
if psql "$DATABASE_URL" < "$BACKUP_FILE" > /dev/null 2>&1; then
  log_info "Database restored successfully!"
else
  log_error "Database restore failed!"
  log_error "Check the error messages above for details"
  exit 1
fi

# =============================================================================
# Reassign IDs and Reset Sequences (if enabled)
# =============================================================================

if [ "$RESET_SEQUENCES" = true ]; then
  echo ""
  log_info "Reassigning all IDs starting from 1..."
  log_info "This may take a while depending on data size..."
  
  # Create a temporary SQL file to reassign IDs and reset sequences
  TEMP_SQL=$(mktemp)
  
  cat > "$TEMP_SQL" << 'EOF'
-- This script reassigns all IDs starting from 1 and resets sequences
-- It handles foreign key relationships by updating them accordingly

DO $$
DECLARE
    table_rec RECORD;
    seq_rec RECORD;
    id_column TEXT;
    table_name TEXT;
    seq_name TEXT;
    fk_rec RECORD;
    old_id INTEGER;
    new_id INTEGER;
    row_count INTEGER;
    counter INTEGER;
BEGIN
    -- Get all tables with sequences (tables with auto-increment IDs)
    -- Process them in reverse dependency order (children first, then parents)
    FOR table_rec IN
        SELECT DISTINCT 
            t.table_name,
            REPLACE(s.sequence_name, t.table_name || '_', '') as id_col,
            REPLACE(REPLACE(s.sequence_name, t.table_name || '_', ''), '_seq', '') as id_column
        FROM information_schema.tables t
        JOIN information_schema.sequences s ON s.sequence_name LIKE t.table_name || '_%_seq'
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND s.sequence_schema = 'public'
        ORDER BY t.table_name
    LOOP
        table_name := table_rec.table_name;
        id_column := table_rec.id_column;
        seq_name := table_name || '_' || id_column || '_seq';
        
        -- Skip system tables
        IF table_name IN ('users', 'roles', 'permissions', 'role_permissions') THEN
            CONTINUE;
        END IF;
        
        -- Check if table has data
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
        
        IF row_count = 0 THEN
            -- No data, just reset sequence to 1
            BEGIN
                EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq_name);
                RAISE NOTICE 'Reset sequence % (table % is empty)', seq_name, table_name;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not reset sequence %: %', seq_name, SQLERRM;
            END;
            CONTINUE;
        END IF;
        
        -- Create temporary mapping table
        EXECUTE format('CREATE TEMP TABLE IF NOT EXISTS %I_id_mapping (old_id INTEGER, new_id INTEGER)', table_name || '_map');
        EXECUTE format('TRUNCATE TABLE %I_id_mapping', table_name || '_map');
        
        -- Create mapping: old_id -> new_id (1, 2, 3, ...)
        counter := 1;
        FOR old_id IN EXECUTE format('SELECT %I FROM %I ORDER BY %I', id_column, table_name, id_column)
        LOOP
            EXECUTE format('INSERT INTO %I_id_mapping (old_id, new_id) VALUES ($1, $2)', 
                table_name || '_map') USING old_id, counter;
            counter := counter + 1;
        END LOOP;
        
        -- Update foreign keys in other tables that reference this table
        FOR fk_rec IN
            SELECT 
                tc.table_name as referencing_table,
                kcu.column_name as referencing_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu 
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND ccu.table_name = table_name
              AND ccu.column_name = id_column
        LOOP
            -- Update foreign key references using the mapping
            BEGIN
                EXECUTE format('
                    UPDATE %I fk
                    SET %I = m.new_id
                    FROM %I_id_mapping m
                    WHERE fk.%I = m.old_id',
                    fk_rec.referencing_table,
                    fk_rec.referencing_column,
                    table_name || '_map',
                    fk_rec.referencing_column
                );
                RAISE NOTICE 'Updated foreign keys in % referencing %', 
                    fk_rec.referencing_table, table_name;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not update foreign keys in %: %', 
                        fk_rec.referencing_table, SQLERRM;
            END;
        END LOOP;
        
        -- Update IDs in the main table
        BEGIN
            EXECUTE format('
                UPDATE %I t
                SET %I = m.new_id
                FROM %I_id_mapping m
                WHERE t.%I = m.old_id',
                table_name,
                id_column,
                table_name || '_map',
                id_column
            );
            RAISE NOTICE 'Reassigned IDs in % (1 to %)', table_name, counter - 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not reassign IDs in %: %', table_name, SQLERRM;
        END;
        
        -- Reset sequence to max(new_id) + 1, or 1 if empty
        BEGIN
            EXECUTE format('ALTER SEQUENCE %I RESTART WITH %s', 
                seq_name, GREATEST(1, counter));
            RAISE NOTICE 'Reset sequence % to start at %', seq_name, GREATEST(1, counter);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not reset sequence %: %', seq_name, SQLERRM;
        END;
        
        -- Drop temporary mapping table
        EXECUTE format('DROP TABLE IF EXISTS %I_id_mapping', table_name || '_map');
    END LOOP;
    
    -- Reset all sequences to 1 (they're already set above, but ensure they're at least 1)
    FOR seq_rec IN 
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
          AND sequence_name LIKE '%_seq'
    LOOP
        BEGIN
            -- Get current sequence value and reset to max of 1 and current value
            EXECUTE format('
                DO $inner$
                DECLARE
                    current_val INTEGER;
                BEGIN
                    SELECT last_value INTO current_val FROM %I;
                    PERFORM setval(%L, GREATEST(1, current_val), false);
                END $inner$',
                seq_rec.sequence_name,
                seq_rec.sequence_name
            );
        EXCEPTION
            WHEN OTHERS THEN
                -- Just reset to 1 if we can't get current value
                BEGIN
                    EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq_rec.sequence_name);
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE 'Could not reset sequence %: %', seq_rec.sequence_name, SQLERRM;
                END;
        END;
    END LOOP;
    
    RAISE NOTICE 'All IDs reassigned and sequences reset!';
END $$;
EOF

  # Execute ID reassignment and sequence reset
  log_info "Reassigning IDs and resetting sequences..."
  if psql "$DATABASE_URL" -f "$TEMP_SQL" > /dev/null 2>&1; then
    log_info "All IDs reassigned starting from 1!"
    log_info "All sequences reset to start from 1"
  else
    log_warn "ID reassignment completed with some warnings (check output above)"
    log_warn "Sequences have been reset"
  fi
  
  # Clean up temp file
  rm -f "$TEMP_SQL"
fi

echo ""
echo -e "${GREEN}✅ Database restore completed successfully!${NC}"
echo ""

