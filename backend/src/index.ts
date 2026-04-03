import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { prismaPlugin } from './plugins/prisma';
import { authRoutes } from './modules/auth/auth.routes';
import { sportsRoutes } from './modules/sports/sports.routes';
import { venuesRoutes } from './modules/venues/venues.routes';
import { searchRoutes } from './modules/search/search.routes';
import { bookingsRoutes } from './modules/bookings/bookings.routes';
import { ownerRoutes } from './modules/owner/owner.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { startCronJobs } from './shared/cron';
import { config } from './config';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'development' ? 'info' : 'warn',
    transport: config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

async function bootstrap() {
  // ── Plugins ──────────────────────────────────────────────
  await app.register(cors, {
    origin: (origin, cb) => {
      if (config.NODE_ENV === 'development' || !origin) {
        return cb(null, true);
      }
      
      const allowedOrigins = [
        'https://maydon.uz',
        'https://staging.maydon.uz'
      ];
      
      // Allow Vercel preview environments and explicit origins
      if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed"), false);
    },
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRES },
  });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: { title: 'Maydon.uz API', description: 'Sports Venue Booking Platform', version: '1.0.0' },
      tags: [
        { name: 'Auth', description: 'Authentication' },
        { name: 'Sports', description: 'Sport categories' },
        { name: 'Search', description: 'Search venues & slots' },
        { name: 'Bookings', description: 'Booking management' },
        { name: 'Owner', description: 'Owner cabinet' },
        { name: 'Admin', description: 'Platform admin' },
      ],
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  await app.register(prismaPlugin);

  // ── Routes (prefixed /api/v1) ─────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(sportsRoutes, { prefix: '/api/v1/sports' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(bookingsRoutes, { prefix: '/api/v1/bookings' });
  await app.register(venuesRoutes, { prefix: '/api/v1/venues' });
  await app.register(ownerRoutes, { prefix: '/api/v1/owner' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  // ── Health check ─────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'maydon-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }));

  // ── Start cron jobs ───────────────────────────────────────
  startCronJobs(app);

  // ── Start server ──────────────────────────────────────────
  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`🚀 Maydon API running at http://${config.HOST}:${config.PORT}`);
  console.log(`📖 Swagger docs: http://localhost:${config.PORT}/docs`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
