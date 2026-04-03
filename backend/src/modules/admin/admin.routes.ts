import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAdmin, JwtPayload } from '../../shared/middleware';
import { Errors } from '../../shared/errors';

export async function adminRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // MODERATION
  // ═══════════════════════════════════════════════════════════

  // ── GET /admin/moderation — queue ─────────────────────────
  app.get('/moderation', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { status = 'SUBMITTED' } = req.query as { status?: string };

    const requests = await app.prisma.moderationRequest.findMany({
      where: status !== 'ALL' ? { status: status as any } : {},
      include: {
        venue: {
          include: {
            owner: { select: { id: true, fullName: true, phone: true } },
            fields: { select: { id: true, name: true, pricePerHour: true } },
            _count: { select: { fields: true } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return reply.send({ requests });
  });

  // ── GET /admin/moderation/:id — detail ────────────────────
  app.get('/moderation/:id', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const request = await app.prisma.moderationRequest.findUnique({
      where: { id: parseInt(id) },
      include: {
        venue: {
          include: {
            owner: { select: { id: true, fullName: true, phone: true } },
            fields: {
              include: { schedules: true, sportCategory: true },
            },
            moderationRequests: { orderBy: { submittedAt: 'desc' }, take: 5 },
          },
        },
      },
    });

    if (!request) throw Errors.NotFound('Moderation request');
    return reply.send({ request });
  });

  // ── POST /admin/moderation/:id/approve ───────────────────
  app.post('/moderation/:id/approve', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminUser = req.user as JwtPayload;
    const { id } = req.params as { id: string };

    const modReq = await app.prisma.moderationRequest.findUnique({
      where: { id: parseInt(id) },
      include: { venue: true },
    });
    if (!modReq) throw Errors.NotFound('Moderation request');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(modReq.status)) {
      throw Errors.BadRequest('Request is not in a reviewable status');
    }

    await app.prisma.$transaction([
      app.prisma.moderationRequest.update({
        where: { id: parseInt(id) },
        data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: adminUser.sub },
      }),
      app.prisma.venue.update({
        where: { id: modReq.venueId },
        data: { status: 'APPROVED', isActive: true, moderationNote: null },
      }),
      app.prisma.auditLog.create({
        data: {
          entityType: 'venue',
          entityId: modReq.venueId,
          action: 'approved',
          actorRole: 'ADMIN',
          actorId: adminUser.sub,
          beforePayload: { status: 'SUBMITTED' },
          afterPayload: { status: 'APPROVED', isActive: true },
        },
      }),
    ]);

    return reply.send({ message: 'Venue approved and activated', venueId: modReq.venueId });
  });

  // ── POST /admin/moderation/:id/reject ────────────────────
  app.post('/moderation/:id/reject', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminUser = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const { note } = req.body as { note?: string };

    const modReq = await app.prisma.moderationRequest.findUnique({ where: { id: parseInt(id) } });
    if (!modReq) throw Errors.NotFound('Moderation request');

    await app.prisma.$transaction([
      app.prisma.moderationRequest.update({
        where: { id: parseInt(id) },
        data: { status: 'REJECTED', adminNote: note, reviewedAt: new Date(), reviewedBy: adminUser.sub },
      }),
      app.prisma.venue.update({
        where: { id: modReq.venueId },
        data: { status: 'REJECTED', isActive: false, moderationNote: note },
      }),
      app.prisma.auditLog.create({
        data: {
          entityType: 'venue',
          entityId: modReq.venueId,
          action: 'rejected',
          actorRole: 'ADMIN',
          actorId: adminUser.sub,
          beforePayload: { status: 'SUBMITTED' },
          afterPayload: { status: 'REJECTED', note },
        },
      }),
    ]);

    return reply.send({ message: 'Venue rejected', venueId: modReq.venueId });
  });

  // ── POST /admin/moderation/:id/revision ──────────────────
  app.post('/moderation/:id/revision', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminUser = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const { note } = req.body as { note?: string };

    if (!note) throw Errors.BadRequest('Revision note is required');

    const modReq = await app.prisma.moderationRequest.findUnique({ where: { id: parseInt(id) } });
    if (!modReq) throw Errors.NotFound('Moderation request');

    await app.prisma.$transaction([
      app.prisma.moderationRequest.update({
        where: { id: parseInt(id) },
        data: { status: 'NEEDS_REVISION', adminNote: note, reviewedAt: new Date(), reviewedBy: adminUser.sub },
      }),
      app.prisma.venue.update({
        where: { id: modReq.venueId },
        data: { status: 'NEEDS_REVISION', isActive: false, moderationNote: note },
      }),
      app.prisma.auditLog.create({
        data: {
          entityType: 'venue',
          entityId: modReq.venueId,
          action: 'needs_revision',
          actorRole: 'ADMIN',
          actorId: adminUser.sub,
          beforePayload: { status: 'SUBMITTED' },
          afterPayload: { status: 'NEEDS_REVISION', note },
        },
      }),
    ]);

    return reply.send({ message: 'Revision requested', venueId: modReq.venueId, note });
  });

  // ── POST /admin/moderation/:id/under-review ──────────────
  app.post('/moderation/:id/under-review', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const modReq = await app.prisma.moderationRequest.findUnique({ where: { id: parseInt(id) } });
    if (!modReq) throw Errors.NotFound('Moderation request');

    await app.prisma.$transaction([
      app.prisma.moderationRequest.update({ where: { id: parseInt(id) }, data: { status: 'UNDER_REVIEW' } }),
      app.prisma.venue.update({ where: { id: modReq.venueId }, data: { status: 'UNDER_REVIEW' } }),
    ]);

    return reply.send({ message: 'Moderation started', venueId: modReq.venueId });
  });

  // ═══════════════════════════════════════════════════════════
  // VENUES
  // ═══════════════════════════════════════════════════════════

  // ── GET /admin/venues ─────────────────────────────────────
  app.get('/venues', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { status, isActive, limit = '50', offset = '0' } = req.query as {
      status?: string;
      isActive?: string;
      limit?: string;
      offset?: string;
    };

    const venues = await app.prisma.venue.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, phone: true } },
        _count: {
          select: {
            fields: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    return reply.send({ venues });
  });

  // ── PUT /admin/venues/:id/toggle — Enable/disable venue ──
  app.put('/venues/:id/toggle', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminUser = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const venue = await app.prisma.venue.findUnique({ where: { id: parseInt(id) } });
    if (!venue) throw Errors.NotFound('Venue');

    if (venue.status !== 'APPROVED') {
      throw Errors.BadRequest('Only approved venues can be toggled');
    }

    const updated = await app.prisma.venue.update({
      where: { id: parseInt(id) },
      data: { isActive: !venue.isActive },
    });

    await app.prisma.auditLog.create({
      data: {
        entityType: 'venue',
        entityId: updated.id,
        action: 'toggled',
        actorRole: 'ADMIN',
        actorId: adminUser.sub,
        beforePayload: { isActive: venue.isActive },
        afterPayload: { isActive: updated.isActive },
      },
    });

    return reply.send({
      message: updated.isActive ? 'Venue activated' : 'Venue deactivated',
      venueId: parseInt(id),
      isActive: updated.isActive,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // BOOKINGS — Platform-wide view
  // ═══════════════════════════════════════════════════════════

  // ── GET /admin/bookings ───────────────────────────────────
  app.get('/bookings', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { status, date, venueId, limit = '50', offset = '0' } = req.query as {
      status?: string;
      date?: string;
      venueId?: string;
      limit?: string;
      offset?: string;
    };

    const bookings = await app.prisma.booking.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(venueId ? { field: { venueId: parseInt(venueId) } } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        field: {
          include: {
            venue: { select: { id: true, name: true, address: true } },
            sportCategory: { select: { nameRu: true, icon: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await app.prisma.booking.count({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(date ? { date: new Date(date) } : {}),
      },
    });

    return reply.send({
      total,
      bookings: bookings.map((b) => ({ ...b, id: b.id.toString() })),
    });
  });

  // ── PUT /admin/bookings/:id/cancel — Force cancel ─────────
  app.put('/bookings/:id/cancel', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminUser = req.user as JwtPayload;
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason?: string };

    const bookingId = BigInt(id);
    const booking = await app.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw Errors.NotFound('Booking');
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
      throw Errors.CancelNotAllowed();
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', cancelledBy: 'ADMIN', notes: reason },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'booking',
          entityId: bookingId,
          action: 'cancelled',
          actorRole: 'ADMIN',
          actorId: adminUser.sub,
          beforePayload: { status: 'CONFIRMED' },
          afterPayload: { status: 'CANCELLED', reason },
        },
      });
      return b;
    });

    return reply.send({
      message: 'Booking force-cancelled by admin',
      booking: { id: id.toString(), status: updated.status },
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PLATFORM STATS
  // ═══════════════════════════════════════════════════════════

  // ── GET /admin/stats ──────────────────────────────────────
  app.get('/stats', { preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalVenues,
      activeVenues,
      pendingModeration,
      totalBookings,
      todayBookings,
      totalUsers,
      totalOwners,
    ] = await Promise.all([
      app.prisma.venue.count(),
      app.prisma.venue.count({ where: { isActive: true } }),
      app.prisma.moderationRequest.count({
        where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      app.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      app.prisma.booking.count({ where: { date: { gte: today }, status: 'CONFIRMED' } }),
      app.prisma.user.count(),
      app.prisma.owner.count(),
    ]);

    return reply.send({
      stats: {
        venues: { total: totalVenues, active: activeVenues, pendingModeration },
        bookings: { totalConfirmed: totalBookings, today: todayBookings },
        users: { total: totalUsers },
        owners: { total: totalOwners },
      },
    });
  });
}
