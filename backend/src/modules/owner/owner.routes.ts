import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireOwner } from '../../shared/middleware';
import { Errors } from '../../shared/errors';
import { JwtPayload } from '../../shared/middleware';
import { computeFreeSlots, timeToMinutes } from '../../shared/slots';

const CreateVenueSchema = z.object({
  name: z.string().min(2).max(300),
  description: z.string().max(2000).optional(),
  address: z.string().min(5).max(500),
  city: z.string().max(100).optional().default('Tashkent'),
  district: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  photos: z.array(z.string().url()).optional(),
});

const UpdateVenueSchema = CreateVenueSchema.partial();

const CreateFieldSchema = z.object({
  sportCategoryId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  pricePerHour: z.number().int().min(1000),
  bufferMinutes: z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20)]).default(15),
  maxBookingHours: z.number().int().min(1).max(8).default(3),
  bookingHorizonDays: z.number().int().min(1).max(30).default(14),
  cancellationPolicy: z.enum(['SOFT', 'STANDARD', 'STRICT']).default('STANDARD'),
  coverageType: z.enum(['GRASS', 'ARTIFICIAL', 'PARQUET', 'CONCRETE', 'SAND', 'OTHER']).optional(),
  hasLighting: z.boolean().default(false),
  hasLockerRoom: z.boolean().default(false),
  hasShower: z.boolean().default(false),
  hasParking: z.boolean().default(false),
});

const ScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isClosed: z.boolean().default(false),
});

const BlackoutSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(300).optional(),
});

export async function ownerRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // VENUE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  // ── GET /owner/venues ─────────────────────────────────────
  app.get('/venues', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const venues = await app.prisma.venue.findMany({
      where: { ownerId: owner.sub },
      include: {
        fields: { select: { id: true, name: true, isActive: true, pricePerHour: true } },
        _count: { select: { fields: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ venues });
  });

  // ── POST /owner/venues ────────────────────────────────────
  app.post('/venues', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const body = CreateVenueSchema.parse(req.body);

    const venue = await app.prisma.venue.create({
      data: { ...body, ownerId: owner.sub, status: 'DRAFT', isActive: false },
    });
    return reply.status(201).send({ venue });
  });

  // ── GET /owner/venues/:id ─────────────────────────────────
  app.get('/venues/:id', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const venue = await app.prisma.venue.findFirst({
      where: { id, ownerId: owner.sub },
      include: {
        fields: {
          include: {
            schedules: true,
            sportCategory: true,
            _count: { select: { bookings: true } },
          },
        },
        moderationRequests: { orderBy: { submittedAt: 'desc' }, take: 1 },
      },
    });
    if (!venue) throw Errors.NotFound('Venue');
    return reply.send({ venue });
  });

  // ── PUT /owner/venues/:id ─────────────────────────────────
  app.put('/venues/:id', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const body = UpdateVenueSchema.parse(req.body);

    const venue = await app.prisma.venue.findUnique({ where: { id: parseInt(id), ownerId: owner.sub } });
    if (!venue) throw Errors.NotFound('Venue');

    // Re-moderation logic: only trigger if critical fields are changed
    const criticalFields: (keyof typeof body)[] = ['name', 'description', 'address', 'city', 'district', 'lat', 'lng', 'photos'];
    let newStatus = venue.status;
    let newIsActive = venue.isActive;
    let didReset = false;

    if (venue.status === 'APPROVED') {
      for (const field of criticalFields) {
        if (body[field] !== undefined && JSON.stringify(body[field]) !== JSON.stringify((venue as any)[field])) {
          newStatus = 'UNDER_REVIEW';
          newIsActive = false;
          didReset = true;
          break;
        }
      }
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const v = await tx.venue.update({
        where: { id: parseInt(id) },
        data: {
          ...body,
          status: newStatus as any,
          isActive: newIsActive,
        },
      });

      if (didReset) {
        await tx.moderationRequest.create({
          data: {
            venueId: v.id,
            submittedBy: owner.sub,
            status: 'UNDER_REVIEW', // Automatically under review since it was triggered by system
          },
        });
      }
      return v;
    });

    if (didReset || Object.keys(body).length > 0) {
      await app.prisma.auditLog.create({
        data: {
          entityType: 'venue',
          entityId: updated.id,
          action: didReset ? 're_moderation_triggered' : 'updated',
          actorRole: 'OWNER',
          actorId: owner.sub,
          beforePayload: JSON.parse(JSON.stringify(venue)),
          afterPayload: JSON.parse(JSON.stringify(updated)),
        },
      });
    }

    return reply.send({ venue: updated, reModerationTriggered: didReset });
  });

  // ── POST /owner/venues/:id/submit — Submit for moderation ─
  app.post('/venues/:id/submit', { preHandler: [requireOwner] }, async (req, reply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const venue = await app.prisma.venue.findFirst({ where: { id, ownerId: owner.sub } });
    if (!venue) throw Errors.NotFound('Venue');

    if (!['DRAFT', 'NEEDS_REVISION'].includes(venue.status)) {
      throw Errors.BadRequest('Venue is already submitted or approved');
    }

    // Validation: must have at least 1 field before submitting
    const fieldsCount = await app.prisma.field.count({ where: { venueId: id } });
    if (fieldsCount === 0) {
      throw Errors.BadRequest('Add at least one field before submitting for moderation');
    }

    await app.prisma.$transaction([
      app.prisma.venue.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      }),
      app.prisma.moderationRequest.create({
        data: {
          venueId: id,
          submittedBy: owner.sub,
          status: 'SUBMITTED',
        },
      }),
      app.prisma.auditLog.create({
        data: {
          entityType: 'venue',
          entityId: id,
          action: 'submitted',
          actorRole: 'OWNER',
          actorId: owner.sub,
          beforePayload: { status: venue.status },
          afterPayload: { status: 'SUBMITTED' },
        },
      }),
    ]);

    return reply.send({ message: 'Venue submitted for moderation', status: 'SUBMITTED' });
  });

  // ═══════════════════════════════════════════════════════════
  // FIELD MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  // ── GET /owner/fields ─────────────────────────────────────
  app.get('/fields', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const fields = await app.prisma.field.findMany({
      where: { venue: { ownerId: owner.sub } },
      include: {
        venue: { select: { id: true, name: true } },
        sportCategory: { select: { id: true, nameRu: true, icon: true } },
        schedules: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ fields });
  });

  // ── POST /owner/venues/:id/fields ─────────────────────────
  app.post('/venues/:id/fields', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const venueId = parseInt((req.params as any).id);

    const venue = await app.prisma.venue.findFirst({ where: { id: venueId, ownerId: owner.sub } });
    if (!venue) throw Errors.NotFound('Venue');

    const body = CreateFieldSchema.parse(req.body);

    // Validate sport category exists
    const sport = await app.prisma.sportCategory.findUnique({ where: { id: body.sportCategoryId } });
    if (!sport) throw Errors.NotFound('Sport category');

    const field = await app.prisma.field.create({
      data: { ...body, venueId },
      include: { sportCategory: true },
    });
    return reply.status(201).send({ field });
  });

  // ── PUT /owner/fields/:id ─────────────────────────────────
  app.put('/fields/:id', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const field = await app.prisma.field.findFirst({
      where: { id, venue: { ownerId: owner.sub } },
    });
    if (!field) throw Errors.NotFound('Field');

    const data = CreateFieldSchema.partial().parse(req.body);
    const updated = await app.prisma.field.update({ where: { id }, data });
    return reply.send({ field: updated });
  });

  // ═══════════════════════════════════════════════════════════
  // SCHEDULE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  // ── GET /owner/fields/:id/schedule ───────────────────────
  app.get('/fields/:id/schedule', { preHandler: [requireOwner] }, async (req, reply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const field = await app.prisma.field.findFirst({
      where: { id, venue: { ownerId: owner.sub } },
      include: { schedules: { orderBy: { dayOfWeek: 'asc' } } },
    });
    if (!field) throw Errors.NotFound('Field');
    return reply.send({ schedules: field.schedules });
  });

  // ── PUT /owner/fields/:id/schedule — Replace all schedules ─
  app.put('/fields/:id/schedule', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const field = await app.prisma.field.findFirst({
      where: { id, venue: { ownerId: owner.sub } },
    });
    if (!field) throw Errors.NotFound('Field');

    const { schedules: body } = req.body as any;
    const parsed = z.array(ScheduleItemSchema).parse(body);

    await app.prisma.$transaction(async (tx) => {
      await tx.fieldSchedule.deleteMany({ where: { fieldId: id } });
      await tx.fieldSchedule.createMany({
        data: parsed.map((s) => ({ ...s, fieldId: id })),
      });
    });

    const updated = await app.prisma.fieldSchedule.findMany({
      where: { fieldId: id },
      orderBy: { dayOfWeek: 'asc' },
    });
    return reply.send({ schedules: updated });
  });

  // ═══════════════════════════════════════════════════════════
  // BLACKOUT PERIODS
  // ═══════════════════════════════════════════════════════════

  // ── GET /owner/fields/:id/blackouts ───────────────────────
  app.get('/fields/:id/blackouts', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const fieldId = parseInt((req.params as any).id);

    const blackouts = await app.prisma.blackoutPeriod.findMany({
      where: { fieldId, field: { venue: { ownerId: owner.sub } } },
      orderBy: { startAt: 'asc' },
    });
    return reply.send({ blackouts });
  });

  // ── POST /owner/fields/:id/blackouts ─────────────────────
  app.post('/fields/:id/blackouts', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const fieldId = parseInt((req.params as any).id);

    const field = await app.prisma.field.findFirst({
      where: { id: fieldId, venue: { ownerId: owner.sub } },
    });
    if (!field) throw Errors.NotFound('Field');

    const body = BlackoutSchema.parse(req.body);
    if (new Date(body.startAt) >= new Date(body.endAt)) {
      throw Errors.BadRequest('startAt must be before endAt');
    }

    const blackout = await app.prisma.blackoutPeriod.create({
      data: { fieldId, startAt: new Date(body.startAt), endAt: new Date(body.endAt), reason: body.reason },
    });
    return reply.status(201).send({ blackout });
  });

  // ── DELETE /owner/blackouts/:id ───────────────────────────
  app.delete('/blackouts/:id', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const id = parseInt((req.params as any).id);

    const blackout = await app.prisma.blackoutPeriod.findFirst({
      where: { id, field: { venue: { ownerId: owner.sub } } },
    });
    if (!blackout) throw Errors.NotFound('Blackout period');

    await app.prisma.blackoutPeriod.delete({ where: { id } });
    return reply.send({ message: 'Blackout period deleted' });
  });

  // ═══════════════════════════════════════════════════════════
  // BOOKINGS VIEW (from owner perspective)
  // ═══════════════════════════════════════════════════════════

  // ── GET /owner/bookings ───────────────────────────────────
  app.get('/bookings', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const { fieldId, date, status, limit = '50', offset = '0' } = req.query as any;

    const bookings = await app.prisma.booking.findMany({
      where: {
        field: { venue: { ownerId: owner.sub } },
        ...(fieldId ? { fieldId: parseInt(fieldId) } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        field: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    return reply.send({ bookings: bookings.map((b) => ({ ...b, id: b.id.toString() })) });
  });

  // ── GET /owner/dashboard ──────────────────────────────────
  app.get('/dashboard', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayBookings, upcomingBookings, totalFields] = await Promise.all([
      app.prisma.booking.findMany({
        where: {
          field: { venue: { ownerId: owner.sub } },
          date: { gte: today, lt: tomorrow },
          status: 'CONFIRMED',
        },
        include: {
          user: { select: { fullName: true, phone: true } },
          field: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      app.prisma.booking.findMany({
        where: {
          field: { venue: { ownerId: owner.sub } },
          date: { gte: today },
          status: 'CONFIRMED',
        },
        include: {
          user: { select: { fullName: true, phone: true } },
          field: { select: { name: true, venue: { select: { name: true } } } },
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        take: 10,
      }),
      app.prisma.field.count({ where: { venue: { ownerId: owner.sub }, isActive: true } }),
    ]);

    const totalSum = Number(todayBookings.reduce((sum: number, b: any) => sum + Number(b.totalAmount), 0));

    return reply.send({
      dashboard: {
        todayBookingsCount: todayBookings.length,
        todayTotalAmount: totalSum,
        activeFieldsCount: totalFields,
        todayBookings: todayBookings.map((b) => ({ ...b, id: b.id.toString() })),
        upcomingBookings: upcomingBookings.map((b) => ({ ...b, id: b.id.toString() })),
      },
    });
  });

  // ── PUT /owner/bookings/:id/no-show ───────────────────────
  app.put('/bookings/:id/no-show', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const id = BigInt((req.params as any).id);

    const booking = await app.prisma.booking.findUnique({
      where: { id },
      include: { field: { select: { venueId: true } } },
    });

    if (!booking) throw Errors.NotFound('Booking');

    // Only allow owner of the venue to mark it
    const venue = await app.prisma.venue.findUnique({ where: { id: booking.field.venueId } });
    if (venue?.ownerId !== owner.sub) throw Errors.Forbidden('Not your venue');

    if (booking.status !== 'CONFIRMED' && booking.status !== 'COMPLETED') {
      throw Errors.BadRequest('Only confirmed or completed bookings can be marked as no_show');
    }

    const updated = await app.prisma.$transaction(async (tx: any) => {
      const up = await tx.booking.update({ where: { id }, data: { status: 'NO_SHOW' } });
      await tx.auditLog.create({
        data: {
          entityType: 'booking',
          entityId: id,
          action: 'no_show',
          actorRole: 'OWNER',
          actorId: owner.sub,
          beforePayload: { status: booking.status },
          afterPayload: { status: 'NO_SHOW' },
        },
      });
      return up;
    });

    return reply.send({ booking: { ...updated, id: updated.id.toString() } });
  });

  // ── PUT /owner/bookings/:id/cancel ────────────────────────
  app.put('/bookings/:id/cancel', { preHandler: [requireOwner] }, async (req, reply) => {
    const owner = req.user as JwtPayload;
    const id = BigInt((req.params as any).id);

    const booking = await app.prisma.booking.findFirst({
      where: { id, field: { venue: { ownerId: owner.sub } } },
    });
    if (!booking) throw Errors.NotFound('Booking');
    if (!['CONFIRMED'].includes(booking.status)) throw Errors.CancelNotAllowed();

    const updated = await app.prisma.$transaction(async (tx: any) => {
      const up = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledBy: 'OWNER' },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'booking',
          entityId: id,
          action: 'cancelled',
          actorRole: 'OWNER',
          actorId: owner.sub,
          beforePayload: { status: booking.status },
          afterPayload: { status: 'CANCELLED' },
        },
      });
      return up;
    });
    return reply.send({ message: 'Booking cancelled by owner', booking: { id: id.toString(), status: updated.status } });
  });

  // ── GET /owner/fields/:id/slots — schedule grid ───────────
  app.get('/fields/:id/slots', { preHandler: [requireOwner] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const owner = req.user as JwtPayload;
    const fieldId = parseInt((req.params as any).id);
    const { date } = req.query as any;
    if (!date) return reply.status(422).send({ error: 'date is required (YYYY-MM-DD)' });

    const field = await app.prisma.field.findFirst({
      where: { id: fieldId, venue: { ownerId: owner.sub } },
      include: {
        schedules: true,
        blackouts: {
          where: {
            startAt: { lte: new Date(`${date}T23:59:59`) },
            endAt: { gte: new Date(`${date}T00:00:00`) },
          },
        },
        bookings: {
          where: { date: new Date(date), status: { in: ['CONFIRMED'] } },
          include: { user: { select: { fullName: true, phone: true } } },
        },
      },
    });
    if (!field) throw Errors.NotFound('Field');

    const searchDate = new Date(date);
    const jsDow = searchDate.getDay();
    const dayOfWeek = jsDow === 0 ? 6 : jsDow - 1;
    const schedule = field.schedules.find((s) => s.dayOfWeek === dayOfWeek);

    return reply.send({
      fieldId,
      date,
      schedule: schedule || null,
      blackouts: field.blackouts,
      bookings: field.bookings.map((b) => ({ ...b, id: b.id.toString() })),
    });
  });
}
