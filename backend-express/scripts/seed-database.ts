import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // ============================================================================
    // 1. Create Roles
    // ============================================================================
    console.log('📋 Creating roles...');
    const roles = [
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

    const createdRoles: Record<string, number> = {};

    for (const roleName of roles) {
      const role = await prisma.roles.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      createdRoles[roleName] = role.role_id;
      console.log(`  ✓ Role "${roleName}" (ID: ${role.role_id})`);
    }

    // ============================================================================
    // 2. Create Permissions
    // ============================================================================
    console.log('\n🔐 Creating permissions...');
    const permissions = [
      // User Management
      'um:read',
      'um:create',
      'um:update',
      // CRM
      'crm:read',
      'crm:create',
      'crm:update',
      'crm:delete',
      // Matter Management
      'mm:read',
      'mm:create',
      'mm:update',
      'mm:delete',
      // Timesheets
      'ts:read',
      'ts:create',
      'ts:update',
      'ts:approve',
      // Billing & Invoices
      'bi:read',
      'bi:create',
      'bi:update',
      'bi:delete',
      // Finance Management
      'fm:read',
      'fm:create',
      'fm:update',
      'fm:delete',
      // Task Management
      'tm:read',
      'tm:create',
      'tm:update',
      'tm:delete',
      // Document Management
      'dm:read',
      'dm:create',
      'dm:update',
      'dm:delete',
      // Calendar
      'cal:read',
      'cal:create',
      'cal:update',
      'cal:delete',
      // Leave Management
      'leave:read',
      'leave:create',
      'leave:update',
      'leave:approve',
      // HR
      'hr:read',
      'hr:create',
      'hr:update',
      'hr:delete',
    ];

    const createdPermissions: Record<string, number> = {};

    for (const permName of permissions) {
      const permission = await prisma.permissions.upsert({
        where: { name: permName },
        update: {},
        create: { name: permName },
      });
      createdPermissions[permName] = permission.permission_id;
      console.log(`  ✓ Permission "${permName}" (ID: ${permission.permission_id})`);
    }

    // ============================================================================
    // 3. Assign All Permissions to Superadmin
    // ============================================================================
    console.log('\n👑 Assigning all permissions to superadmin...');
    const superadminRoleId = createdRoles['superadmin'];

    // Delete existing permissions for superadmin first
    await prisma.role_permissions.deleteMany({
      where: { role_id: superadminRoleId },
    });

    // Create all permissions for superadmin
    const permissionData = Object.values(createdPermissions).map(permId => ({
      role_id: superadminRoleId,
      permission_id: permId,
    }));

    await prisma.role_permissions.createMany({
      data: permissionData,
      skipDuplicates: true,
    });
    console.log(`  ✓ All ${Object.keys(createdPermissions).length} permissions assigned to superadmin`);

    // ============================================================================
    // 4. Create Locations
    // ============================================================================
    console.log('\n📍 Creating locations...');
    const locations = [
      {
        location_code: 'mumbai',
        location_name: 'Mumbai',
        display_name: 'Mumbai',
      },
      {
        location_code: 'delhi',
        location_name: 'Delhi',
        display_name: 'Delhi',
      },
      {
        location_code: 'bangalore',
        location_name: 'Bangalore',
        display_name: 'Bangalore',
      },
      {
        location_code: 'delhi_litigation',
        location_name: 'Delhi – Litigation',
        display_name: 'Delhi – Litigation',
      },
    ];

    const createdLocations: Record<string, number> = {};

    for (const loc of locations) {
      const location = await prisma.locations.upsert({
        where: { location_code: loc.location_code },
        update: {},
        create: loc,
      });
      createdLocations[loc.location_code] = location.location_id;
      console.log(`  ✓ Location "${loc.display_name}" (ID: ${location.location_id})`);
    }

    // ============================================================================
    // 5. Create Superadmin User
    // ============================================================================
    console.log('\n👤 Creating superadmin user...');
    const email = 'sheell@firmtalk.ai';
    const password = 'asdf1234';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`  ⚠️  User with email ${email} already exists. Updating...`);
      await prisma.users.update({
        where: { email },
        data: {
          password: hashedPassword,
          role_id: superadminRoleId,
          active_status: true,
          is_onboarded: true,
          name: 'Super Admin',
          phone: '+1234567890', // Default phone
          user_type: 'staff',
          user_code: 'SA001',
          date_of_joining: new Date(),
        },
      });
      console.log(`  ✓ Superadmin user updated`);
    } else {
      const superadmin = await prisma.users.create({
        data: {
          email,
          password: hashedPassword,
          name: 'Super Admin',
          phone: '+1234567890',
          role_id: superadminRoleId,
          active_status: true,
          is_onboarded: true,
          user_type: 'staff',
          user_code: 'SA001',
          date_of_joining: new Date(),
        },
      });
      console.log(`  ✓ Superadmin user created (ID: ${superadmin.user_id})`);
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📝 Superadmin Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDatabase()
  .then(() => {
    console.log('✨ Seeding process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding process failed:', error);
    process.exit(1);
  });

