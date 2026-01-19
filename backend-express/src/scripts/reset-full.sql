-- ============================================================================
-- FULL DATABASE RESET SCRIPT
-- 
-- This script resets all tables EXCEPT system tables (users, roles, 
-- permissions, role_permissions) and resets all sequences to start from 1.
-- 
-- WARNING: This will permanently delete all data from the specified tables!
-- ============================================================================

-- Disable foreign key checks temporarily (PostgreSQL doesn't support this directly,
-- so we delete in the correct order)

-- Step 1: Delete junction tables and highly dependent tables first
-- (These reference multiple parent tables)

DELETE FROM invoice_timesheets;
DELETE FROM task_assignments;
DELETE FROM matter_users;

-- Step 2: Delete tables that depend on invoices, timesheets, matters
DELETE FROM invoice_payments;
DELETE FROM expense_payments;
DELETE FROM onetime_expenses;
DELETE FROM timesheets;
DELETE FROM invoices;
DELETE FROM matter_conflicts;

-- Step 3: Delete contact-related CRM tables
DELETE FROM contact_interactions;
DELETE FROM contact_badges;
DELETE FROM contact_relationships;

-- Step 4: Delete user activity and notification tables
DELETE FROM user_notifications;
DELETE FROM user_activities;

-- Step 5: Delete tables that depend on clients/matters/contacts
DELETE FROM opportunities;
DELETE FROM leads;
DELETE FROM support_tickets;
DELETE FROM tasks;
DELETE FROM contacts;

-- Step 6: Delete base CRM tables
DELETE FROM clients;
DELETE FROM client_groups;
DELETE FROM matters;

-- Step 7: Delete expense and vendor tables
DELETE FROM recurring_expenses;
DELETE FROM vendors;

-- Step 8: Delete user-related tables (except users, roles, permissions)
DELETE FROM user_rate_card;
DELETE FROM leave_balances;
DELETE FROM leaves;
DELETE FROM user_invitations;
DELETE FROM holidays;

-- Step 9: Delete CRM automation tables
DELETE FROM crm_automations;

-- Step 10: Reset all sequences to start from 1
-- (Only reset sequences for tables we deleted, excluding system tables)

DO $$
DECLARE
    seq_record RECORD;
    table_name TEXT;
BEGIN
    FOR seq_record IN 
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
          AND sequence_name LIKE '%_seq'
    LOOP
        -- Extract table name from sequence (e.g., "clients_client_id_seq" -> "clients")
        table_name := SUBSTRING(seq_record.sequence_name FROM '^(.+?)_[a-z_]+_seq$');
        
        -- Only reset sequences for non-system tables
        IF table_name NOT IN ('users', 'roles', 'permissions') THEN
            BEGIN
                EXECUTE format('ALTER SEQUENCE %I RESTART WITH 1', seq_record.sequence_name);
                RAISE NOTICE 'Reset sequence: %', seq_record.sequence_name;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Could not reset sequence %: %', seq_record.sequence_name, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- Display summary
SELECT 'Database reset completed. All tables (except users, roles, permissions, role_permissions) have been cleared and sequences reset to 1.' AS status;


