// @ts-nocheck
import { FastifyRequest, FastifyReply } from 'fastify';

export type JwtPayload = {
  sub: number;           // user/owner/admin id
  role: 'USER' | 'OWNER' | 'ADMIN';
  phone: string;
};

// Extend Fastify request with decoded user
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
  }
}

export async function requireOwner(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  const payload = request.user as JwtPayload;
  if (payload.role !== 'OWNER') {
    reply.status(403).send({ error: 'Forbidden', message: 'Owner access required' });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  const payload = request.user as JwtPayload;
  if (payload.role !== 'ADMIN') {
    reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
  }
}
