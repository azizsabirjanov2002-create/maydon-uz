import { PrismaClient, CancellationPolicy, CoverageType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Maydon.uz database...');

  // ============================================================
  // 1. Sport Categories (Source of Truth — Admin managed)
  // ============================================================
  const sports = [
    { nameRu: 'Футбол', nameUz: 'Futbol', icon: '⚽', sortOrder: 1 },
    { nameRu: 'Баскетбол', nameUz: 'Basketbol', icon: '🏀', sortOrder: 2 },
    { nameRu: 'Волейбол', nameUz: 'Voleybol', icon: '🏐', sortOrder: 3 },
    { nameRu: 'Теннис', nameUz: 'Tennis', icon: '🎾', sortOrder: 4 },
    { nameRu: 'Бадминтон', nameUz: 'Badminton', icon: '🏸', sortOrder: 5 },
    { nameRu: 'Настольный теннис', nameUz: 'Stol tennisi', icon: '🏓', sortOrder: 6 },
    { nameRu: 'Мини-футбол', nameUz: 'Mini-futbol', icon: '🥅', sortOrder: 7 },
    { nameRu: 'Хоккей на траве', nameUz: 'Xokkey', icon: '🏑', sortOrder: 8 },
  ];

  for (const sport of sports) {
    await prisma.sportCategory.upsert({
      where: { id: sports.indexOf(sport) + 1 },
      create: sport,
      update: sport,
    });
  }
  console.log(`✅ ${sports.length} sport categories seeded`);

  // ============================================================
  // 2. Admin Account
  // ============================================================
  const adminPhone = process.env.ADMIN_PHONE || '+998901234567';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminMaydon2026!';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({
    where: { phone: adminPhone },
    create: {
      phone: adminPhone,
      email: 'admin@maydon.uz',
      passwordHash: adminHash,
    },
    update: {},
  });
  console.log(`✅ Admin seeded: ${adminPhone}`);

  // ============================================================
  // 3. Global Commission (5% — Phase 2 will use this)
  // ============================================================
  const existingCommission = await prisma.commission.findFirst({
    where: { scope: 'GLOBAL', effectiveTo: null },
  });

  if (!existingCommission) {
    await prisma.commission.create({
      data: {
        scope: 'GLOBAL',
        ratePercent: 5.0,
        effectiveFrom: new Date(),
      },
    });
    console.log('✅ Default global commission (5%) seeded');
  }

  // ============================================================
  // 4. Demo Owner + Venue + Field (for development testing)
  // ============================================================
  if (process.env.NODE_ENV !== 'production') {
    const demoOwnerPhone = '+998901111111';
    const demoHash = await bcrypt.hash('Demo1234!', 12);

    const demoOwner = await prisma.owner.upsert({
      where: { phone: demoOwnerPhone },
      create: {
        fullName: 'Demo Owner',
        phone: demoOwnerPhone,
        email: 'owner@maydon.uz',
        passwordHash: demoHash,
      },
      update: {},
    });

    const demoVenue = await prisma.venue.upsert({
      where: { id: 1 },
      create: {
        ownerId: demoOwner.id,
        name: 'Экопарк Арена',
        description: 'Современный спорткомплекс с натуральным газоном',
        address: 'Мирзо-Улугбекский район, ул. Спортивная 12',
        city: 'Tashkent',
        district: 'Мирзо-Улугбекский',
        lat: 41.3111,
        lng: 69.2797,
        photos: ['https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800'],
        status: 'APPROVED',
        isActive: true,
      },
      update: { status: 'APPROVED', isActive: true },
    });

    const footballCategory = await prisma.sportCategory.findFirst({
      where: { nameRu: 'Футбол' },
    });

    if (footballCategory) {
      const demoField = await prisma.field.upsert({
        where: { id: 1 },
        create: {
          venueId: demoVenue.id,
          sportCategoryId: footballCategory.id,
          name: 'Поле 1 — Большое',
          pricePerHour: 250000,
          bufferMinutes: 15,
          maxBookingHours: 3,
          coverageType: CoverageType.ARTIFICIAL,
          hasLighting: true,
          hasLockerRoom: true,
          hasShower: true,
          hasParking: true,
          cancellationPolicy: CancellationPolicy.STANDARD,
        },
        update: {},
      });

      // Schedule: Mon-Fri 08:00-22:00, Sat-Sun 09:00-23:00
      const weekdaySchedule = { openTime: '08:00', closeTime: '22:00', isClosed: false };
      const weekendSchedule = { openTime: '09:00', closeTime: '23:00', isClosed: false };

      for (let day = 0; day <= 6; day++) {
        const schedule = day >= 5 ? weekendSchedule : weekdaySchedule;
        await prisma.fieldSchedule.upsert({
          where: { fieldId_dayOfWeek: { fieldId: demoField.id, dayOfWeek: day } },
          create: { fieldId: demoField.id, dayOfWeek: day, ...schedule },
          update: schedule,
        });
      }

      // Moderation request for demo venue
      await prisma.moderationRequest.upsert({
        where: { id: 1 },
        create: {
          venueId: demoVenue.id,
          submittedBy: demoOwner.id,
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
        update: {},
      });
    }

    console.log('✅ Demo owner + venue + field seeded (dev only)');
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
