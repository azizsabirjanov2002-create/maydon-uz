import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, JwtPayload } from '../../shared/middleware';
import { Errors } from '../../shared/errors';
import { config } from '../../config';
import { timeToMinutes, timesOverlap, minutesToTime } from '../../shared/slots';

const CreateBookingSchema = z.object({
  fieldId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
  durationMinutes: z.number().int().refine(
    (v) => v >= 60 && v % 30 === 0,
    'duration must be at least 60 minutes and a multiple of 30'
  ),
  totalAmount: z.number().int().min(0).optional().default(0),
  notes: z.string().max(500).optional(),
});

export async function bookingsRoutes(app: FastifyInstance) {
  // ── POST /bookings — Create booking ───────────────────────
  // The core: slot conflict prevention using DB-level locking
  app.post('/', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JwtPayload;
    if (user.role !== 'USER') throw Errors.Forbidden('Only users can create bookings');

    const body = CreateBookingSchema.parse(req.body);
    const bookingDate = new Date(body.date);
    const startMinutes = timeToMinutes(body.startTime);
    const endMinutes = startMinutes + body.durationMinutes;
    const endTime = minutesToTime(endMinutes);

    const userRecord = await app.prisma.user.findUnique({ where: { id: user.sub } });
    if (!userRecord?.isPhoneVerified) {
      throw Errors.Forbidden('Phone verification is required to create bookings');
    }

    // ── Check Anti-fake: Max 3 active bookings limits ──────
    const activeBookingsCount = await app.prisma.booking.count({
      where: {
        userId: user.sub,
        status: 'CONFIRMED',
        date: { gte: bookingDate },
      },
    });

    if (activeBookingsCount >= config.MAX_ACTIVE_BOOKINGS_PER_USER) {
      throw Errors.BadRequest(`You can only have up to ${config.MAX_ACTIVE_BOOKINGS_PER_USER} active bookings at a time`);
    }

    // ── Validate booking horizon ───────────────────────────
    const now = new Date();
    const minBookAt = new Date(now.getTime() + 30 * 60 * 1000); // now + 30 min
    const maxBookAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // now + 14 days

    const bookingDateTime = new Date(`${body.date}T${body.startTime}:00`);
    if (bookingDateTime < minBookAt || bookingDate > maxBookAt) {
      throw Errors.BookingHorizon();
    }

    // ── Fetch field with venue ─────────────────────────────
    const field = await app.prisma.field.findUnique({
      where: { id: body.fieldId },
      include: {
        venue: { select: { status: true, isActive: true } },
        schedules: {
          where: {
            dayOfWeek: bookingDate.getDay() === 0 ? 6 : bookingDate.getDay() - 1,
          },
        },
      },
    });

    if (!field || !field.isActive) throw Errors.NotFound('Field');
    if (!field.venue.isActive || field.venue.status !== 'APPROVED') {
      throw Errors.NotFound('Field');
    }

    // ── Validate working hours & No midnight crossing ──────
    const schedule = field.schedules[0];
    if (!schedule || schedule.isClosed) throw Errors.SlotOutsideSchedule();

    const openMin = timeToMinutes(schedule.openTime);
    const closeMin = timeToMinutes(schedule.closeTime);
    
    // System rule: No midnight crossing.
    if (endMinutes > 24 * 60) {
      throw Errors.BadRequest('Booking cannot span across midnight');
    }

    if (startMinutes < openMin || endMinutes > closeMin) {
      throw Errors.SlotOutsideSchedule();
    }

    // ── Check maximum booking duration ─────────────────────
    if (body.durationMinutes > field.maxBookingHours * 60) {
      throw Errors.BadRequest(`Maximum booking duration is ${field.maxBookingHours} hours`);
    }

    // ── Check blackout periods ─────────────────────────────
    const blackoutsOnDate = await app.prisma.blackoutPeriod.findMany({
      where: {
        fieldId: body.fieldId,
        startAt: { lte: new Date(`${body.date}T${endTime}:00`) },
        endAt: { gte: new Date(`${body.date}T${body.startTime}:00`) },
      },
    });
    if (blackoutsOnDate.length > 0) throw Errors.SlotInBlackout();

    // ── CORE: Atomic conflict check using raw SQL transaction ──
    // This is the critical section — prevents double booking
    // Uses PostgreSQL advisory lock + conflict query
    const booking = await app.prisma.$transaction(async (tx: any) => {
      // Find ALL confirmed bookings for this field on this date
      // that overlap with our requested window (including buffer)
      const conflicting = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM bookings
        WHERE field_id = ${body.fieldId}
          AND date = ${bookingDate}::date
          AND status = 'CONFIRMED'
          AND NOT (
            to_timestamp(end_time, 'HH24:MI') + (${field.bufferMinutes} || ' minutes')::interval
              <= to_timestamp(${body.startTime}, 'HH24:MI')
            OR
            to_timestamp(start_time, 'HH24:MI') - (${field.bufferMinutes} || ' minutes')::interval
              >= to_timestamp(${endTime}, 'HH24:MI')
          )
        FOR UPDATE
      `;

      if (conflicting.length > 0) {
        throw Errors.SlotTaken();
      }

      // ── Create the booking (immediately CONFIRMED) ─────
      const newBooking = await tx.booking.create({
        data: {
          fieldId: body.fieldId,
          userId: user.sub,
          date: bookingDate,
          startTime: body.startTime,
          endTime,
          durationMinutes: body.durationMinutes,
          bufferMinutes: field.bufferMinutes,
          status: 'CONFIRMED',
          totalAmount: body.totalAmount,
          notes: body.notes,
        },
        include: {
          field: {
            include: {
              venue: {
                select: { id: true, name: true, address: true, district: true },
              },
            },
          },
        },
      });

      // ── Audit Log ──────────────────────────────────────
      await tx.auditLog.create({
        data: {
          entityType: 'booking',
          entityId: newBooking.id,
          action: 'created',
          actorRole: 'USER',
          actorId: user.sub,
          afterPayload: { status: 'CONFIRMED' },
        },
      });

      return newBooking;
    });

    return reply.status(201).send({
      message: 'Booking confirmed',
      booking: {
        id: booking.id.toString(),
        status: booking.status,
        date: body.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        durationMinutes: booking.durationMinutes,
        totalAmount: booking.totalAmount,
        field: {
          id: booking.field.id,
          name: booking.field.name,
          pricePerHour: booking.field.pricePerHour,
          venue: booking.field.venue,
        },
        createdAt: booking.createdAt,
      },
    });
  });

  // ── GET /bookings/my — User's booking history ─────────────
  app.get('/my', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JwtPayload;
    if (user.role !== 'USER') throw Errors.Forbidden('Only users can access booking history');

    const { status, limit = '20', offset = '0' } = req.query as any;

    const bookings = await app.prisma.booking.findMany({
      where: {
        userId: user.sub,
        ...(status ? { status } : {}),
      },
      include: {
        field: {
          select: {
            id: true,
            name: true,
            pricePerHour: true,
            sportCategory: { select: { id: true, nameRu: true, icon: true } },
            venue: { select: { id: true, name: true, address: true, district: true, photos: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    return reply.send({
      bookings: bookings.map((b: any) => ({
        ...b,
        id: b.id.toString(),
      })),
    });
  });

  // ── GET /bookings/:id — Booking detail ────────────────────
  app.get('/:id', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const id = BigInt((req.params as any).id);
    const caller = req.user as JwtPayload;

    const booking = await app.prisma.booking.findUnique({
      where: { id },
      include: {
        field: {
          include: {
            sportCategory: true,
            venue: {
              select: {
                id: true, name: true, address: true,
                district: true, lat: true, lng: true, photos: true,
                owner: { select: { fullName: true, phone: true } },
              },
            },
          },
        },
        user: { select: { id: true, fullName: true, phone: true } },
      },
    });

    if (!booking) throw Errors.NotFound('Booking');

    // Access control: user sees own bookings, owner sees their venue's bookings
    const isOwner = caller.role === 'OWNER' && booking.field.venue.owner !== null;
    const isUser = caller.role === 'USER' && booking.userId === caller.sub;
    const isAdmin = caller.role === 'ADMIN';

    if (!isUser && !isOwner && !isAdmin) throw Errors.Forbidden();

    return reply.send({ booking: { ...booking, id: id.toString() } });
  });

  // ── DELETE /bookings/:id/cancel ──────────────────────────
  app.delete('/:id/cancel', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const id = BigInt((req.params as any).id);
    const caller = req.user as JwtPayload;

    const booking = await app.prisma.booking.findUnique({
      where: { id },
      include: { field: { include: { venue: { select: { ownerId: true } } } } },
    });

    if (!booking) throw Errors.NotFound('Booking');

    // Cannot cancel completed or no_show bookings
    if (['COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED'].includes(booking.status)) {
      throw Errors.CancelNotAllowed();
    }

    // Access control
    const isBookingUser = caller.role === 'USER' && booking.userId === caller.sub;
    const isVenueOwner = caller.role === 'OWNER' && booking.field.venue.ownerId === caller.sub;
    const isAdmin = caller.role === 'ADMIN';

    if (!isBookingUser && !isVenueOwner && !isAdmin) throw Errors.Forbidden();

    const cancelledBy = isBookingUser ? 'USER' : isVenueOwner ? 'OWNER' : 'ADMIN';

    const updated = await app.prisma.$transaction(async (tx: any) => {
      const up = await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledBy: cancelledBy as any },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'booking',
          entityId: id,
          action: 'cancelled',
          actorRole: cancelledBy,
          actorId: caller.sub,
          beforePayload: { status: booking.status },
          afterPayload: { status: 'CANCELLED', cancelledBy },
        },
      });

      return up;
    });

    return reply.send({
      message: 'Booking cancelled',
      booking: { id: id.toString(), status: updated.status, cancelledBy: updated.cancelledBy },
    });
  });
}
