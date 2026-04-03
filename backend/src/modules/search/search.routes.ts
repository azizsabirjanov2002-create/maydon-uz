import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  computeFreeSlots,
  haversineKm,
  approxTravelMinutes,
  timeToMinutes,
} from '../../shared/slots';

const SearchQuerySchema = z.object({
  sport_id: z.coerce.number().int().positive(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  radius: z.coerce.number().int().min(1000).max(20000).optional().default(5000),
  sort: z.enum(['price_asc', 'price_desc', 'estimated_travel_time']).optional().default('estimated_travel_time'),
});

export async function searchRoutes(app: FastifyInstance) {
  /**
   * GET /api/v1/search
   * Поиск площадок с свободными слотами рядом.
   * Source of truth: наша БД, не карта.
   */
  app.get('/', async (req, reply) => {
    let query;
    try {
      query = SearchQuerySchema.parse(req.query);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: e.errors });
      }
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }
    const searchDate = new Date(query.date);

    // Day of week: Convert JS getDay() [0=Sun, 6=Sat] to ISO [1=Mon, 7=Sun]
    const dayOfWeek = searchDate.getDay() === 0 ? 7 : searchDate.getDay();

    // Radius expansion levels: 5→10→15→20 km
    const radiusLevels = [
      query.radius,
      Math.min(10000, query.radius * 2),
      15000,
      20000,
    ];

    let results: any[] = [];

    for (const radiusM of radiusLevels) {
      const radiusKm = radiusM / 1000;

      // ── Get all approved venues with fields of requested sport ──
      const venues = await app.prisma.venue.findMany({
        where: {
          isActive: true,
          status: 'APPROVED',
          fields: {
            some: {
              sportCategoryId: query.sport_id,
              isActive: true,
            },
          },
        },
        include: {
          fields: {
            where: { sportCategoryId: query.sport_id, isActive: true },
            include: {
              schedules: { where: { dayOfWeek } },
              blackouts: {
                where: {
                  startAt: { lte: new Date(`${query.date}T23:59:59`) },
                  endAt: { gte: new Date(`${query.date}T00:00:00`) },
                },
              },
              bookings: {
                where: {
                  date: searchDate,
                  status: { in: ['CONFIRMED'] },
                },
                select: { startTime: true, endTime: true },
              },
            },
          },
        },
      });

      // ── Filter by geo radius ───────────────────────────────
      const venuesInRadius = venues.filter((v) => {
        const dist = haversineKm(
          query.lat, query.lng,
          Number(v.lat), Number(v.lng)
        );
        return dist <= radiusKm;
      });

      // ── Build results with free slots ──────────────────────
      for (const venue of venuesInRadius) {
        const distKm = haversineKm(query.lat, query.lng, Number(venue.lat), Number(venue.lng));
        const travelMinutes = approxTravelMinutes(distKm);

        const fieldsWithSlots = venue.fields
          .map((field) => {
            const schedule = field.schedules[0];
            if (!schedule || schedule.isClosed) return null;

            const blackoutsToday = field.blackouts.map((b) => ({
              startMinutes: timeToMinutes(
                b.startAt.toTimeString().slice(0, 5)
              ),
              endMinutes: timeToMinutes(
                b.endAt.toTimeString().slice(0, 5)
              ),
            }));

            const freeSlots = computeFreeSlots({
              openTime: schedule.openTime,
              closeTime: schedule.closeTime,
              bufferMinutes: field.bufferMinutes,
              minBookingMinutes: 60,
              slotStepMinutes: 30,
              maxBookingHours: field.maxBookingHours,
              existingBookings: field.bookings,
              blackouts: blackoutsToday,
              requestDate: searchDate,
            }).filter((s) => s.isAvailable);

            if (freeSlots.length === 0) return null;

            return {
              id: field.id,
              name: field.name,
              pricePerHour: field.pricePerHour,
              bufferMinutes: field.bufferMinutes,
              coverageType: field.coverageType,
              hasLighting: field.hasLighting,
              hasLockerRoom: field.hasLockerRoom,
              hasShower: field.hasShower,
              hasParking: field.hasParking,
              cancellationPolicy: field.cancellationPolicy,
              freeSlots,
              earliestSlot: freeSlots[0]?.startTime || null,
            };
          })
          .filter(Boolean);

        if (fieldsWithSlots.length === 0) continue;

        results.push({
          venue: {
            id: venue.id,
            name: venue.name,
            address: venue.address,
            district: venue.district,
            lat: Number(venue.lat),
            lng: Number(venue.lng),
            photos: venue.photos,
          },
          distanceKm: Math.round(distKm * 10) / 10,
          estimatedTravelTimeMinutes: travelMinutes,
          fields: fieldsWithSlots,
        });
      }

      // ── Found results at this radius — stop expanding ──────
      if (results.length > 0) {
        break;
      }
    }

    // ── Sort results ───────────────────────────────────────
    if (query.sort === 'estimated_travel_time') {
      results.sort((a, b) => (a.estimatedTravelTimeMinutes || 0) - (b.estimatedTravelTimeMinutes || 0));
    } else if (query.sort === 'price_asc') {
      results.sort((a, b) => {
        const aMin = Math.min(...a.fields.map((f: any) => f.pricePerHour));
        const bMin = Math.min(...b.fields.map((f: any) => f.pricePerHour));
        return aMin - bMin;
      });
    } else if (query.sort === 'earliest_slot') {
      results.sort((a, b) => {
        const aSlot = a.fields[0]?.earliestSlot || '99:99';
        const bSlot = b.fields[0]?.earliestSlot || '99:99';
        return aSlot.localeCompare(bSlot);
      });
    }

    return reply.send({
      date: query.date,
      sportId: query.sport_id,
      totalResults: results.length,
      results,
    });
  });

  // ── GET /search/field/:id/slots ───────────────────────────
  // Подробные слоты конкретного поля на дату
  app.get('/field/:id/slots', async (req, reply) => {
    const fieldId = parseInt((req.params as any).id);
    const { date } = req.query as any;
    if (!date) return reply.status(422).send({ error: 'date is required' });

    const searchDate = new Date(date);
    const jsDow = searchDate.getDay();
    const dayOfWeek = jsDow === 0 ? 6 : jsDow - 1;

    const field = await app.prisma.field.findUnique({
      where: { id: fieldId, isActive: true },
      include: {
        venue: { select: { status: true, isActive: true } },
        schedules: { where: { dayOfWeek } },
        blackouts: {
          where: {
            startAt: { lte: new Date(`${date}T23:59:59`) },
            endAt: { gte: new Date(`${date}T00:00:00`) },
          },
        },
        bookings: {
          where: { date: searchDate, status: { in: ['CONFIRMED'] } },
          select: { startTime: true, endTime: true, id: true },
        },
      },
    });

    if (!field || !field.venue.isActive || field.venue.status !== 'APPROVED') {
      return reply.status(404).send({ error: 'Field not found' });
    }

    const schedule = field.schedules[0];
    if (!schedule || schedule.isClosed) {
      return reply.send({ date, fieldId, isClosed: true, slots: [] });
    }

    const blackoutsToday = field.blackouts.map((b) => ({
      startMinutes: timeToMinutes(b.startAt.toTimeString().slice(0, 5)),
      endMinutes: timeToMinutes(b.endAt.toTimeString().slice(0, 5)),
    }));

    const slots = computeFreeSlots({
      openTime: schedule.openTime,
      closeTime: schedule.closeTime,
      bufferMinutes: field.bufferMinutes,
      minBookingMinutes: 60,
      slotStepMinutes: 30,
      maxBookingHours: field.maxBookingHours,
      existingBookings: field.bookings,
      blackouts: blackoutsToday,
      requestDate: searchDate,
    });

    return reply.send({ date, fieldId, isClosed: false, slots });
  });
}
