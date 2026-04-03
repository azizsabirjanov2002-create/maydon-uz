import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../shared/middleware';

export async function sportsRoutes(app: FastifyInstance) {
  // ── GET /sports — Public, cached ─────────────────────────
  app.get('/', async (req, reply) => {
    const sports = await app.prisma.sportCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, nameRu: true, nameUz: true, icon: true },
    });
    return reply.send({ sports });
  });

  // ── POST /sports — Admin only ─────────────────────────────
  app.post('/', { preHandler: [requireAdmin] }, async (req, reply) => {
    const { nameRu, nameUz, icon, sortOrder } = req.body as any;
    if (!nameRu || !nameUz) {
      return reply.status(422).send({ error: 'nameRu and nameUz are required' });
    }
    const sport = await app.prisma.sportCategory.create({
      data: { nameRu, nameUz, icon, sortOrder: sortOrder || 99 },
    });
    return reply.status(201).send({ sport });
  });

  // ── PUT /sports/:id — Admin only ──────────────────────────
  app.put('/:id', { preHandler: [requireAdmin] }, async (req, reply) => {
    const id = parseInt((req.params as any).id);
    const data = req.body as any;
    const sport = await app.prisma.sportCategory.update({ where: { id }, data });
    return reply.send({ sport });
  });
}
