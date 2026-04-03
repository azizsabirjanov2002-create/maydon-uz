// @ts-nocheck
import cron from 'node-cron';
import { FastifyInstance } from 'fastify';

export function startCronJobs(app: FastifyInstance) {
  // ── Complete past bookings every 15 minutes ───────────────
  // Переводит confirmed брони в completed после end_time
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Get confirmed bookings where (date + endTime) is in the past
      const pastBookings = await app.prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          date: { lte: now },
        },
        select: { id: true, date: true, endTime: true },
      });

      const toComplete: bigint[] = [];
      for (const b of pastBookings) {
        const bookingDate = b.date.toISOString().split('T')[0];
        const [endH, endM] = b.endTime.split(':').map(Number);
        const endDateTime = new Date(`${bookingDate}T${b.endTime}:00`);
        if (endDateTime < now) {
          toComplete.push(b.id);
        }
      }

      if (toComplete.length > 0) {
        const result = await app.prisma.booking.updateMany({
          where: { id: { in: toComplete }, status: 'CONFIRMED' },
          data: { status: 'COMPLETED' },
        });
        if (result.count > 0) {
          app.log.info(`[CRON] Completed ${result.count} bookings`);
        }
      }
    } catch (err) {
      app.log.error('[CRON] Failed to complete bookings:', err);
    }
  });

  app.log.info('✅ Cron jobs started: booking completion every 15 min');
}
