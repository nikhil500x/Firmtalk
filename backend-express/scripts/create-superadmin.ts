import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperadmin() {
  try {
    const email = 'sheell@firmtalk.ai';
    const password = 'asdf1234';
    const hashedPassword = await bcrypt.hash(password, 10);

    const role = await prisma.roles.upsert({
      where: { name: 'superadmin' },
      update: {},
      create: { name: 'superadmin' },
    });

    const existingUser = await prisma.users.findUnique({ where: { email } });

    if (existingUser) {
      await prisma.users.update({
        where: { email },
        data: { password: hashedPassword, role_id: role.role_id, active_status: true, is_onboarded: true },
      });
      console.log('✓ Superadmin updated');
    } else {
      await prisma.users.create({
        data: {
          email, password: hashedPassword, name: 'Super Admin', phone: '+1234567890',
          role_id: role.role_id, active_status: true, is_onboarded: true,
          user_type: 'staff', user_code: 'SA001', date_of_joining: new Date(),
        },
      });
      console.log('✓ Superadmin created');
    }
    console.log('Email: sheell@firmtalk.ai');
    console.log('Password: asdf1234');
  } finally {
    await prisma.$disconnect();
  }
}

createSuperadmin();
