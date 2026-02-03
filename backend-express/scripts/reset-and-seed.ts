import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function resetAndSeed() {
  try {
    console.log('🔄 Starting FULL database reset and seed...\n');

    // ============================================================================
    // STEP 1: DELETE ALL DATA (in correct order to respect foreign keys)
    // ============================================================================
    console.log('🗑️  Deleting all existing data...');

    // Junction tables first
    await prisma.invoice_timesheets.deleteMany();
    await prisma.invoice_expenses.deleteMany();
    await prisma.invoice_matters.deleteMany();
    await prisma.invoice_partner_shares.deleteMany();
    await prisma.task_assignments.deleteMany();
    await prisma.matter_users.deleteMany();
    await prisma.role_permissions.deleteMany();
    console.log('  ✓ Junction tables cleared');

    // Payment tables
    await prisma.invoice_payments.deleteMany();
    await prisma.expense_payments.deleteMany();
    console.log('  ✓ Payment tables cleared');

    // Expense tables
    await prisma.onetime_expenses.deleteMany();
    await prisma.recurring_expenses.deleteMany();
    console.log('  ✓ Expense tables cleared');

    // Time and billing
    await prisma.timesheets.deleteMany();
    await prisma.user_rate_card.deleteMany();
    await prisma.invoices.deleteMany();
    console.log('  ✓ Time and billing cleared');

    // Matter related
    await prisma.matter_conflicts.deleteMany();
    await prisma.matters.deleteMany();
    console.log('  ✓ Matters cleared');

    // Contact CRM
    await prisma.contact_interactions.deleteMany();
    await prisma.contact_badges.deleteMany();
    await prisma.contact_relationships.deleteMany();
    console.log('  ✓ Contact CRM cleared');

    // User activities
    await prisma.user_notifications.deleteMany();
    await prisma.user_activities.deleteMany();
    console.log('  ✓ User activities cleared');

    // CRM Pipeline
    await prisma.opportunities.deleteMany();
    await prisma.leads.deleteMany();
    await prisma.crm_automations.deleteMany();
    console.log('  ✓ CRM pipeline cleared');

    // Support and tasks
    await prisma.support_tickets.deleteMany();
    await prisma.tasks.deleteMany();
    console.log('  ✓ Support and tasks cleared');

    // Contacts and clients
    await prisma.contacts.deleteMany();
    await prisma.clients.deleteMany();
    await prisma.client_groups.deleteMany();
    console.log('  ✓ Clients and contacts cleared');

    // Vendors
    await prisma.vendors.deleteMany();
    console.log('  ✓ Vendors cleared');

    // User related
    await prisma.leave_balances.deleteMany();
    await prisma.leaves.deleteMany();
    await prisma.user_invitations.deleteMany();
    await prisma.holidays.deleteMany();
    console.log('  ✓ Leave and HR data cleared');

    // Audit logs
    await prisma.audit_logs.deleteMany();
    console.log('  ✓ Audit logs cleared');

    // Users (after all dependencies)
    await prisma.users.deleteMany();
    console.log('  ✓ Users cleared');

    // Locations
    await prisma.locations.deleteMany();
    console.log('  ✓ Locations cleared');

    // Configuration tables
    await prisma.practice_areas.deleteMany();
    await prisma.matter_types.deleteMany();
    await prisma.matter_statuses.deleteMany();
    await prisma.activity_types.deleteMany();
    await prisma.expense_categories.deleteMany();
    await prisma.leave_types.deleteMany();
    await prisma.industries.deleteMany();
    await prisma.currencies.deleteMany();
    await prisma.billing_types.deleteMany();
    await prisma.firm_settings.deleteMany();
    console.log('  ✓ Configuration tables cleared');

    // Roles and permissions
    await prisma.permissions.deleteMany();
    await prisma.roles.deleteMany();
    console.log('  ✓ Roles and permissions cleared');

    console.log('\n✅ All data deleted successfully!\n');

    // ============================================================================
    // STEP 2: CREATE CONFIGURATION DATA
    // ============================================================================
    console.log('⚙️  Creating configuration data...');

    // Practice Areas
    const practiceAreasData = [
      { name: 'Corporate M&A', display_order: 1 },
      { name: 'Competition & Antitrust', display_order: 2 },
      { name: 'PE, VC & Alternative Investment', display_order: 3 },
      { name: 'Employment, Pensions & Benefits', display_order: 4 },
      { name: 'Data Privacy & Security', display_order: 5 },
      { name: 'Dispute Resolution & Investigations', display_order: 6 },
      { name: 'Banking & Finance', display_order: 7 },
      { name: 'Intellectual Property', display_order: 8 },
      { name: 'Real Estate', display_order: 9 },
      { name: 'Tax', display_order: 10 },
      { name: 'Regulatory & Compliance', display_order: 11 },
      { name: 'Healthcare & Pharma', display_order: 12 },
    ];
    for (const pa of practiceAreasData) {
      await prisma.practice_areas.create({ data: pa });
    }
    console.log('  ✓ Practice areas created');

    // Matter Types
    const matterTypesData = [
      { name: 'Advisory', display_order: 1 },
      { name: 'Transactional', display_order: 2 },
      { name: 'Litigation', display_order: 3 },
      { name: 'Compliance', display_order: 4 },
      { name: 'Dispute Resolution', display_order: 5 },
      { name: 'Due Diligence', display_order: 6 },
      { name: 'Regulatory', display_order: 7 },
      { name: 'General Counsel', display_order: 8 },
    ];
    for (const mt of matterTypesData) {
      await prisma.matter_types.create({ data: mt });
    }
    console.log('  ✓ Matter types created');

    // Matter Statuses
    const matterStatusesData = [
      { name: 'Active', code: 'active', color: '#22c55e', display_order: 1, is_final: false },
      { name: 'On Hold', code: 'on_hold', color: '#f59e0b', display_order: 2, is_final: false },
      { name: 'Pending Review', code: 'pending_review', color: '#3b82f6', display_order: 3, is_final: false },
      { name: 'Completed', code: 'completed', color: '#6b7280', display_order: 4, is_final: true },
      { name: 'Closed', code: 'closed', color: '#ef4444', display_order: 5, is_final: true },
      { name: 'Cancelled', code: 'cancelled', color: '#dc2626', display_order: 6, is_final: true },
    ];
    for (const ms of matterStatusesData) {
      await prisma.matter_statuses.create({ data: ms });
    }
    console.log('  ✓ Matter statuses created');

    // Activity Types
    const activityTypesData = [
      { name: 'Client Meeting', category: 'billable', is_billable: true, display_order: 1 },
      { name: 'Strategy Discussion', category: 'billable', is_billable: true, display_order: 2 },
      { name: 'Document Review', category: 'billable', is_billable: true, display_order: 3 },
      { name: 'Research', category: 'billable', is_billable: true, display_order: 4 },
      { name: 'Drafting', category: 'billable', is_billable: true, display_order: 5 },
      { name: 'Court Appearance', category: 'billable', is_billable: true, display_order: 6 },
      { name: 'Phone Call', category: 'billable', is_billable: true, display_order: 7 },
      { name: 'Email Communication', category: 'billable', is_billable: true, display_order: 8 },
      { name: 'Negotiation', category: 'billable', is_billable: true, display_order: 9 },
      { name: 'Travel', category: 'non-billable', is_billable: false, display_order: 10 },
      { name: 'Training', category: 'non-billable', is_billable: false, display_order: 11 },
      { name: 'Administrative', category: 'admin', is_billable: false, display_order: 12 },
      { name: 'Business Development', category: 'admin', is_billable: false, display_order: 13 },
      { name: 'Other', category: 'billable', is_billable: true, display_order: 99 },
    ];
    for (const at of activityTypesData) {
      await prisma.activity_types.create({ data: at });
    }
    console.log('  ✓ Activity types created');

    // Expense Categories
    const expenseCategoriesData = [
      { name: 'Legal Services', code: 'legal_services', is_billable: true, display_order: 1 },
      { name: 'Court Fees', code: 'court_fees', is_billable: true, display_order: 2 },
      { name: 'Filing Fees', code: 'filing_fees', is_billable: true, display_order: 3 },
      { name: 'Travel', code: 'travel', is_billable: true, display_order: 4 },
      { name: 'Accommodation', code: 'accommodation', is_billable: true, display_order: 5 },
      { name: 'Meals', code: 'meals', is_billable: true, display_order: 6 },
      { name: 'Courier & Postage', code: 'courier', is_billable: true, display_order: 7 },
      { name: 'Printing & Copying', code: 'printing', is_billable: true, display_order: 8 },
      { name: 'Expert Witness Fees', code: 'expert_fees', is_billable: true, display_order: 9 },
      { name: 'Office Supplies', code: 'office_supplies', is_billable: false, display_order: 10 },
      { name: 'Software & Subscriptions', code: 'software', is_billable: false, display_order: 11 },
      { name: 'Equipment', code: 'equipment', is_billable: false, display_order: 12 },
      { name: 'Consulting', code: 'consulting', is_billable: true, display_order: 13 },
      { name: 'Miscellaneous', code: 'misc', is_billable: true, display_order: 99 },
    ];
    for (const ec of expenseCategoriesData) {
      await prisma.expense_categories.create({ data: ec });
    }
    console.log('  ✓ Expense categories created');

    // Leave Types
    const leaveTypesData = [
      { name: 'Privilege Leave', code: 'privilege', days_per_year: 21, carry_forward: true, max_carry_days: 10, min_notice_days: 7, display_order: 1 },
      { name: 'Sick Leave', code: 'sick', days_per_year: 12, carry_forward: false, requires_doc: true, min_notice_days: 0, display_order: 2 },
      { name: 'Casual Leave', code: 'casual', days_per_year: 12, carry_forward: false, min_notice_days: 1, display_order: 3 },
      { name: 'Earned Leave', code: 'earned', days_per_year: 15, carry_forward: true, max_carry_days: 30, min_notice_days: 15, display_order: 4 },
      { name: 'Maternity Leave', code: 'maternity', days_per_year: 182, carry_forward: false, requires_doc: true, min_notice_days: 30, display_order: 5 },
      { name: 'Paternity Leave', code: 'paternity', days_per_year: 15, carry_forward: false, requires_doc: true, min_notice_days: 7, display_order: 6 },
      { name: 'Unpaid Leave', code: 'unpaid', days_per_year: 0, carry_forward: false, min_notice_days: 7, display_order: 7 },
      { name: 'Compensatory Off', code: 'comp_off', days_per_year: 0, carry_forward: false, min_notice_days: 1, display_order: 8 },
    ];
    for (const lt of leaveTypesData) {
      await prisma.leave_types.create({ data: lt });
    }
    console.log('  ✓ Leave types created');

    // Industries
    const industriesData = [
      { name: 'Technology', display_order: 1 },
      { name: 'Finance & Banking', display_order: 2 },
      { name: 'Healthcare & Pharma', display_order: 3 },
      { name: 'Manufacturing', display_order: 4 },
      { name: 'Retail & E-commerce', display_order: 5 },
      { name: 'Real Estate', display_order: 6 },
      { name: 'Energy & Utilities', display_order: 7 },
      { name: 'Media & Entertainment', display_order: 8 },
      { name: 'Telecommunications', display_order: 9 },
      { name: 'Education', display_order: 10 },
      { name: 'Government & Public Sector', display_order: 11 },
      { name: 'Non-Profit', display_order: 12 },
      { name: 'Hospitality & Tourism', display_order: 13 },
      { name: 'Automotive', display_order: 14 },
      { name: 'Logistics & Transportation', display_order: 15 },
      { name: 'Other', display_order: 99 },
    ];
    for (const ind of industriesData) {
      await prisma.industries.create({ data: ind });
    }
    console.log('  ✓ Industries created');

    // Currencies
    const currenciesData = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimal_places: 2, is_default: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_default: false },
      { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_default: false },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2, is_default: false },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimal_places: 2, is_default: false },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2, is_default: false },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0, is_default: false },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimal_places: 2, is_default: false },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2, is_default: false },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2, is_default: false },
    ];
    for (const curr of currenciesData) {
      await prisma.currencies.create({ data: curr });
    }
    console.log('  ✓ Currencies created');

    // Billing Types
    const billingTypesData = [
      { name: 'Hourly', code: 'hourly', description: 'Bill by the hour', display_order: 1 },
      { name: 'Fixed Fee', code: 'fixed', description: 'Fixed project fee', display_order: 2 },
      { name: 'Retainer', code: 'retainer', description: 'Monthly retainer', display_order: 3 },
      { name: 'Contingency', code: 'contingency', description: 'Success-based fee', display_order: 4 },
      { name: 'Blended Rate', code: 'blended', description: 'Blended team rate', display_order: 5 },
      { name: 'Pro Bono', code: 'pro_bono', description: 'No charge', display_order: 6 },
    ];
    for (const bt of billingTypesData) {
      await prisma.billing_types.create({ data: bt });
    }
    console.log('  ✓ Billing types created');

    // Firm Settings
    const firmSettingsData = [
      { setting_key: 'firm_name', setting_value: 'Firmtalk Legal', setting_type: 'string', category: 'general', label: 'Firm Name', is_public: true },
      { setting_key: 'firm_email', setting_value: 'contact@firmtalk.ai', setting_type: 'string', category: 'general', label: 'Contact Email', is_public: true },
      { setting_key: 'firm_phone', setting_value: '+91 22 1234 5678', setting_type: 'string', category: 'general', label: 'Contact Phone', is_public: true },
      { setting_key: 'firm_website', setting_value: 'https://firmtalk.ai', setting_type: 'string', category: 'general', label: 'Website', is_public: true },
      { setting_key: 'default_currency', setting_value: 'INR', setting_type: 'string', category: 'billing', label: 'Default Currency', is_public: true },
      { setting_key: 'invoice_prefix', setting_value: 'FT', setting_type: 'string', category: 'billing', label: 'Invoice Prefix', is_public: false },
      { setting_key: 'fiscal_year_start', setting_value: '04-01', setting_type: 'string', category: 'finance', label: 'Fiscal Year Start (MM-DD)', is_public: false },
      { setting_key: 'max_file_size_mb', setting_value: '10', setting_type: 'number', category: 'uploads', label: 'Max File Size (MB)', is_public: true },
      { setting_key: 'working_hours_per_day', setting_value: '8', setting_type: 'number', category: 'timesheet', label: 'Standard Working Hours/Day', is_public: true },
      { setting_key: 'max_hours_per_day', setting_value: '16', setting_type: 'number', category: 'timesheet', label: 'Max Hours/Day Allowed', is_public: true },
      { setting_key: 'timesheet_lock_days', setting_value: '7', setting_type: 'number', category: 'timesheet', label: 'Days After Which Timesheets Lock', is_public: false },
      { setting_key: 'leave_approval_required', setting_value: 'true', setting_type: 'boolean', category: 'hr', label: 'Leave Approval Required', is_public: false },
      { setting_key: 'allow_future_timesheets', setting_value: 'false', setting_type: 'boolean', category: 'timesheet', label: 'Allow Future Dated Timesheets', is_public: true },
    ];
    for (const fs of firmSettingsData) {
      await prisma.firm_settings.create({ data: fs });
    }
    console.log('  ✓ Firm settings created');

    // ============================================================================
    // STEP 3: CREATE ROLES
    // ============================================================================
    console.log('\n📋 Creating roles...');
    const roleNames = [
      'superadmin',
      'admin',
      'partner',
      'hr',
      'it',
      'accountant',
      'support',
      'sr-associate',
      'associate',
      'counsel',
      'intern',
    ];

    const roles: Record<string, number> = {};
    for (const name of roleNames) {
      const role = await prisma.roles.create({ data: { name } });
      roles[name] = role.role_id;
      console.log(`  ✓ ${name} (ID: ${role.role_id})`);
    }

    // ============================================================================
    // STEP 4: CREATE PERMISSIONS
    // ============================================================================
    console.log('\n🔐 Creating permissions...');
    const permissionNames = [
      'um:read', 'um:create', 'um:update',
      'crm:read', 'crm:create', 'crm:update', 'crm:delete',
      'mm:read', 'mm:create', 'mm:update', 'mm:delete',
      'ts:read', 'ts:create', 'ts:update', 'ts:approve',
      'bi:read', 'bi:create', 'bi:update', 'bi:delete',
      'fm:read', 'fm:create', 'fm:update', 'fm:delete',
      'tm:read', 'tm:create', 'tm:update', 'tm:delete',
      'dm:read', 'dm:create', 'dm:update', 'dm:delete',
      'cal:read', 'cal:create', 'cal:update', 'cal:delete',
      'leave:read', 'leave:create', 'leave:update', 'leave:approve',
      'hr:read', 'hr:create', 'hr:update', 'hr:delete',
      'config:read', 'config:create', 'config:update', 'config:delete',
    ];

    const permissions: Record<string, number> = {};
    for (const name of permissionNames) {
      const perm = await prisma.permissions.create({ data: { name } });
      permissions[name] = perm.permission_id;
    }
    console.log(`  ✓ Created ${permissionNames.length} permissions`);

    // Assign all permissions to superadmin
    for (const permId of Object.values(permissions)) {
      await prisma.role_permissions.create({
        data: { role_id: roles['superadmin'], permission_id: permId },
      });
    }
    console.log('  ✓ All permissions assigned to superadmin');

    // ============================================================================
    // STEP 5: CREATE LOCATIONS
    // ============================================================================
    console.log('\n📍 Creating locations...');
    const locationData = [
      { location_code: 'mumbai', location_name: 'Mumbai', display_name: 'Mumbai', office_code: 'M', invoice_prefix: 'MUM', is_billing_location: true, default_currency: 'INR' },
      { location_code: 'delhi', location_name: 'Delhi', display_name: 'Delhi', office_code: 'D', invoice_prefix: 'DEL', is_billing_location: true, default_currency: 'INR' },
      { location_code: 'bangalore', location_name: 'Bangalore', display_name: 'Bangalore', office_code: 'B', invoice_prefix: 'BLR', is_billing_location: true, default_currency: 'INR' },
      { location_code: 'delhi_litigation', location_name: 'Delhi Litigation', display_name: 'Delhi – Litigation', office_code: 'LT', invoice_prefix: 'DLT', is_billing_location: false, default_currency: 'INR' },
    ];

    const locations: Record<string, number> = {};
    for (const loc of locationData) {
      const location = await prisma.locations.create({ data: loc });
      locations[loc.location_code] = location.location_id;
      console.log(`  ✓ ${loc.display_name}`);
    }

    // ============================================================================
    // STEP 6: CREATE ADMIN USER
    // ============================================================================
    console.log('\n👤 Creating admin user...');
    const adminPassword = await bcrypt.hash('Admin@123', 10);

    const admin = await prisma.users.create({
      data: {
        email: 'admin@firmtalk.ai',
        password: adminPassword,
        name: 'Admin User',
        phone: '+91 9876543210',
        role_id: roles['superadmin'],
        active_status: true,
        is_onboarded: true,
        user_type: 'staff',
        user_code: 'ADM001',
        location_id: locations['mumbai'],
        practice_area: 'Corporate M&A',
        date_of_joining: new Date('2024-01-01'),
      },
    });
    console.log(`  ✓ Admin created (ID: ${admin.user_id})`);

    // ============================================================================
    // STEP 7: CREATE MOCK USERS
    // ============================================================================
    console.log('\n👥 Creating mock users...');
    const mockUsers = [
      { email: 'partner1@firmtalk.ai', name: 'Rajesh Sharma', role: 'partner', code: 'PTN001', location: 'mumbai', practice: 'Corporate M&A' },
      { email: 'partner2@firmtalk.ai', name: 'Priya Mehta', role: 'partner', code: 'PTN002', location: 'delhi', practice: 'Dispute Resolution & Investigations' },
      { email: 'associate1@firmtalk.ai', name: 'Amit Kumar', role: 'sr-associate', code: 'ASC001', location: 'mumbai', practice: 'Intellectual Property' },
      { email: 'associate2@firmtalk.ai', name: 'Sneha Patel', role: 'associate', code: 'ASC002', location: 'bangalore', practice: 'Corporate M&A' },
      { email: 'hr@firmtalk.ai', name: 'Kavita Singh', role: 'hr', code: 'HR001', location: 'mumbai', practice: null },
      { email: 'accountant@firmtalk.ai', name: 'Vikram Joshi', role: 'accountant', code: 'ACC001', location: 'mumbai', practice: null },
    ];

    const users: Record<string, number> = { admin: admin.user_id };
    const defaultPassword = await bcrypt.hash('Password@123', 10);

    for (const u of mockUsers) {
      const user = await prisma.users.create({
        data: {
          email: u.email,
          password: defaultPassword,
          name: u.name,
          phone: '+91 98765' + Math.floor(10000 + Math.random() * 90000),
          role_id: roles[u.role],
          active_status: true,
          is_onboarded: true,
          user_type: 'staff',
          user_code: u.code,
          location_id: locations[u.location],
          practice_area: u.practice,
          date_of_joining: new Date('2024-01-15'),
        },
      });
      users[u.code] = user.user_id;
      console.log(`  ✓ ${u.name} (${u.role})`);
    }

    // ============================================================================
    // STEP 8: CREATE CLIENT GROUPS
    // ============================================================================
    console.log('\n🏢 Creating client groups...');
    const groupData = [
      { name: 'Technology', description: 'Technology and IT companies' },
      { name: 'Finance', description: 'Banks and financial institutions' },
      { name: 'Manufacturing', description: 'Manufacturing and industrial clients' },
      { name: 'Healthcare', description: 'Healthcare and pharmaceutical companies' },
    ];

    const groups: Record<string, number> = {};
    for (const g of groupData) {
      const group = await prisma.client_groups.create({
        data: { ...g, created_by: admin.user_id },
      });
      groups[g.name] = group.group_id;
      console.log(`  ✓ ${g.name}`);
    }

    // ============================================================================
    // STEP 9: CREATE CLIENTS
    // ============================================================================
    console.log('\n🏛️  Creating clients...');
    const clientData = [
      { name: 'TechCorp India Pvt Ltd', code: 'TCH001', industry: 'Technology', group: 'Technology', user: users['PTN001'] },
      { name: 'Global Finance Ltd', code: 'GFL001', industry: 'Finance & Banking', group: 'Finance', user: users['PTN001'] },
      { name: 'MediCare Hospitals', code: 'MCH001', industry: 'Healthcare & Pharma', group: 'Healthcare', user: users['PTN002'] },
      { name: 'Steel Industries Ltd', code: 'STL001', industry: 'Manufacturing', group: 'Manufacturing', user: users['PTN002'] },
      { name: 'Innovate Solutions', code: 'INV001', industry: 'Technology', group: 'Technology', user: users['ASC001'] },
      { name: 'Phoenix Retail', code: 'PHX001', industry: 'Retail & E-commerce', group: null, user: users['ASC002'] },
    ];

    const clients: Record<string, number> = {};
    for (const c of clientData) {
      const client = await prisma.clients.create({
        data: {
          client_name: c.name,
          client_code: c.code,
          industry: c.industry,
          group_id: c.group ? groups[c.group] : null,
          user_id: c.user,
          active_status: true,
        },
      });
      clients[c.code] = client.client_id;
      console.log(`  ✓ ${c.name}`);
    }

    // ============================================================================
    // STEP 10: CREATE CONTACTS
    // ============================================================================
    console.log('\n📇 Creating contacts...');
    const contactData = [
      { name: 'John Smith', email: 'john@techcorp.com', phone: '+91 9876500001', designation: 'CEO', client: 'TCH001', primary: true },
      { name: 'Sarah Johnson', email: 'sarah@techcorp.com', phone: '+91 9876500002', designation: 'Legal Head', client: 'TCH001', primary: false },
      { name: 'Vikram Reddy', email: 'vikram@globalfinance.com', phone: '+91 9876500003', designation: 'CFO', client: 'GFL001', primary: true },
      { name: 'Dr. Meera Nair', email: 'meera@medicare.com', phone: '+91 9876500004', designation: 'Director', client: 'MCH001', primary: true },
      { name: 'Arun Gupta', email: 'arun@steelindustries.com', phone: '+91 9876500005', designation: 'Managing Director', client: 'STL001', primary: true },
      { name: 'Neha Kapoor', email: 'neha@innovate.com', phone: '+91 9876500006', designation: 'Founder', client: 'INV001', primary: true },
    ];

    for (const c of contactData) {
      await prisma.contacts.create({
        data: {
          name: c.name,
          email: c.email,
          number: c.phone,
          designation: c.designation,
          client_id: clients[c.client],
          is_primary: c.primary,
          created_by: admin.user_id,
        },
      });
      console.log(`  ✓ ${c.name}`);
    }

    // ============================================================================
    // STEP 11: CREATE MATTERS
    // ============================================================================
    console.log('\n📁 Creating matters...');
    const matterData = [
      { title: 'TechCorp M&A Advisory', code: 'TCH001-M001', client: 'TCH001', type: 'Advisory', practice: 'Corporate M&A', lawyer: users['PTN001'], value: 5000000 },
      { title: 'TechCorp IP Licensing', code: 'TCH001-M002', client: 'TCH001', type: 'Transactional', practice: 'Intellectual Property', lawyer: users['ASC001'], value: 1500000 },
      { title: 'Global Finance Regulatory', code: 'GFL001-M001', client: 'GFL001', type: 'Advisory', practice: 'Banking & Finance', lawyer: users['PTN001'], value: 3000000 },
      { title: 'MediCare Compliance Review', code: 'MCH001-M001', client: 'MCH001', type: 'Compliance', practice: 'Healthcare & Pharma', lawyer: users['PTN002'], value: 2000000 },
      { title: 'Steel Industries Dispute', code: 'STL001-M001', client: 'STL001', type: 'Litigation', practice: 'Dispute Resolution & Investigations', lawyer: users['PTN002'], value: 4000000 },
      { title: 'Innovate Funding Round', code: 'INV001-M001', client: 'INV001', type: 'Transactional', practice: 'PE, VC & Alternative Investment', lawyer: users['ASC002'], value: 800000 },
    ];

    const matters: Record<string, number> = {};
    for (const m of matterData) {
      const matter = await prisma.matters.create({
        data: {
          matter_title: m.title,
          matter_code: m.code,
          client_id: clients[m.client],
          matter_type: m.type,
          practice_area: m.practice,
          assigned_lawyer: m.lawyer,
          created_by: admin.user_id,
          start_date: new Date('2024-06-01'),
          estimated_value: m.value,
          status: 'active',
          billing_rate_type: 'hourly',
          currency: 'INR',
          matter_location_id: locations['mumbai'],
        },
      });
      matters[m.code] = matter.matter_id;
      console.log(`  ✓ ${m.title}`);
    }

    // ============================================================================
    // STEP 12: CREATE VENDORS
    // ============================================================================
    console.log('\n🏪 Creating vendors...');
    const vendorData = [
      { name: 'LegalTech Solutions', contact: 'Rahul', email: 'rahul@legaltech.com', phone: '+91 9876500010' },
      { name: 'Office Supplies Co', contact: 'Amit', email: 'amit@officesupplies.com', phone: '+91 9876500011' },
      { name: 'Cloud Services India', contact: 'Priya', email: 'priya@cloudservices.in', phone: '+91 9876500012' },
    ];

    for (const v of vendorData) {
      await prisma.vendors.create({
        data: {
          vendor_name: v.name,
          contact_person: v.contact,
          email: v.email,
          phone: v.phone,
          active_status: true,
        },
      });
      console.log(`  ✓ ${v.name}`);
    }

    // ============================================================================
    // STEP 13: CREATE SAMPLE TIMESHEETS
    // ============================================================================
    console.log('\n⏱️  Creating sample timesheets...');
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    for (let i = 0; i < 15; i++) {
      const date = new Date(lastMonth);
      date.setDate(date.getDate() + i);

      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const matterCodes = Object.keys(matters);
      const matterCode = matterCodes[i % matterCodes.length];

      await prisma.timesheets.create({
        data: {
          user_id: users['ASC001'],
          matter_id: matters[matterCode],
          date: date,
          hours_worked: 480 + Math.floor(Math.random() * 120),
          billable_hours: 360 + Math.floor(Math.random() * 120),
          non_billable_hours: 60,
          activity_type: ['Research', 'Drafting', 'Client Meeting', 'Document Review'][i % 4],
          description: `Work on ${matterCode}`,
          hourly_rate: 5000,
          calculated_amount: (360 + Math.floor(Math.random() * 120)) / 60 * 5000,
        },
      });
    }
    console.log('  ✓ Created 15 sample timesheets');

    // ============================================================================
    // STEP 14: CREATE SAMPLE TASKS
    // ============================================================================
    console.log('\n📝 Creating sample tasks...');
    const taskData = [
      { name: 'Review M&A documents', matter: 'TCH001-M001', priority: 'high', status: 'in_progress' },
      { name: 'Draft IP license agreement', matter: 'TCH001-M002', priority: 'medium', status: 'todo' },
      { name: 'Prepare regulatory filing', matter: 'GFL001-M001', priority: 'high', status: 'todo' },
      { name: 'Client meeting preparation', matter: 'MCH001-M001', priority: 'medium', status: 'completed' },
      { name: 'Research case law', matter: 'STL001-M001', priority: 'low', status: 'todo' },
    ];

    for (const t of taskData) {
      const task = await prisma.tasks.create({
        data: {
          task_name: t.name,
          matter_id: matters[t.matter],
          assigned_by: admin.user_id,
          priority: t.priority,
          status: t.status,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.task_assignments.create({
        data: {
          task_id: task.task_id,
          user_id: users['ASC001'],
          status: t.status,
        },
      });
      console.log(`  ✓ ${t.name}`);
    }

    // ============================================================================
    // DONE!
    // ============================================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ DATABASE RESET AND SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📝 Admin Credentials:');
    console.log('   Email:    admin@firmtalk.ai');
    console.log('   Password: Admin@123');
    console.log('\n📝 Other Users (Password: Password@123):');
    for (const u of mockUsers) {
      console.log(`   - ${u.email} (${u.role})`);
    }
    console.log('\n⚙️  Configuration Data Created:');
    console.log('   - 12 Practice Areas');
    console.log('   - 8 Matter Types');
    console.log('   - 6 Matter Statuses');
    console.log('   - 14 Activity Types');
    console.log('   - 14 Expense Categories');
    console.log('   - 8 Leave Types');
    console.log('   - 16 Industries');
    console.log('   - 10 Currencies');
    console.log('   - 6 Billing Types');
    console.log('   - 13 Firm Settings');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetAndSeed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
