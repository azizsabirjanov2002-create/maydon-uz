// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding E2E users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Seed Admin
  await prisma.user.upsert({
    where: { phone: '+998900000000' },
    update: { role: 'ADMIN', password: hashedPassword },
    create: {
      fullName: 'Super Admin',
      phone: '+998900000000',
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true
    }
  });

  // Seed Sport Categoy
  await prisma.sportCategory.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nameRu: 'Футбол',
      nameUz: 'Futbol',
      slug: 'football'
    }
  });

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
