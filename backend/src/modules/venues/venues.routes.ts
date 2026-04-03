import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware';
import { Errors } from '../../shared/errors';
import { JwtPayload } from '../../shared/middleware';

export async function venuesRoutes(app: FastifyInstance) {
  // ── GET /venues/:id — Public venue detail ─────────────────
  app.get('/:id', async (req, reply) => {
    const id = parseInt((req.params as any).id);

    const venue = await app.prisma.venue.findFirst({
      where: { id, status: 'APPROVED', isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            sportCategory: { select: { id: true, nameRu: true, icon: true } },
            schedules: { orderBy: { dayOfWeek: 'asc' } },
          },
        },
      },
    });

    if (!venue) throw Errors.NotFound('Venue');

    return reply.send({
      venue: {
        id: venue.id,
        name: venue.name,
        description: venue.description,
        address: venue.address,
        city: venue.city,
        district: venue.district,
        lat: Number(venue.lat),
        lng: Number(venue.lng),
        photos: venue.photos,
        fields: venue.fields,
      },
    });
  });
}
