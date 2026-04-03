// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Errors } from '../../shared/errors';
import { JwtPayload, requireAuth } from '../../shared/middleware';
import { config } from '../../config';

const RegisterUserSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().regex(/^\+998\d{9}$/, 'Phone must be in format +998XXXXXXXXX'),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  phone: z.string(),
  password: z.string(),
});

const RegisterOwnerSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().regex(/^\+998\d{9}$/, 'Phone must be in format +998XXXXXXXXX'),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

function signTokens(app: FastifyInstance, payload: JwtPayload) {
  const accessToken = app.jwt.sign(payload, { expiresIn: config.JWT_ACCESS_EXPIRES });
  const refreshToken = app.jwt.sign(
    { sub: payload.sub, role: payload.role },
    { secret: config.JWT_REFRESH_SECRET, expiresIn: config.JWT_REFRESH_EXPIRES }
  );
  return { accessToken, refreshToken };
}

const VerifyPhoneSchema = z.object({
  code: z.string().length(4),
});

export async function authRoutes(app: FastifyInstance) {
  // ── User Register ─────────────────────────────────────────
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterUserSchema.parse(req.body);
    const existing = await app.prisma.user.findUnique({ where: { phone: body.phone } });
    if (existing) throw Errors.Conflict('Phone number already registered');

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await app.prisma.user.create({
      data: { fullName: body.fullName, phone: body.phone, passwordHash },
    });

    const payload: JwtPayload = { sub: user.id, role: 'USER', phone: user.phone };
    const tokens = signTokens(app, payload);
    return reply.status(201).send({ user: { id: user.id, fullName: user.fullName, phone: user.phone }, ...tokens });
  });

  // ── User Login ────────────────────────────────────────────
  app.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = LoginSchema.parse(req.body);
    const user = await app.prisma.user.findUnique({ where: { phone: body.phone } });
    if (!user || !user.passwordHash) throw Errors.Unauthorized();

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) throw Errors.Unauthorized();
    if (!user.isActive) throw Errors.Forbidden('Account is disabled');

    const payload: JwtPayload = { sub: user.id, role: 'USER', phone: user.phone };
    const tokens = signTokens(app, payload);
    return reply.send({ user: { id: user.id, fullName: user.fullName, phone: user.phone }, ...tokens });
  });

  // ── Owner Register ────────────────────────────────────────
  app.post('/owner/register', async (req, reply) => {
    const body = RegisterOwnerSchema.parse(req.body);
    const existing = await app.prisma.owner.findUnique({ where: { phone: body.phone } });
    if (existing) throw Errors.Conflict('Phone number already registered');

    const passwordHash = await bcrypt.hash(body.password, 12);
    const owner = await app.prisma.owner.create({
      data: { fullName: body.fullName, phone: body.phone, email: body.email, passwordHash },
    });

    const payload: JwtPayload = { sub: owner.id, role: 'OWNER', phone: owner.phone };
    const tokens = signTokens(app, payload);
    return reply.status(201).send({ owner: { id: owner.id, fullName: owner.fullName, phone: owner.phone }, ...tokens });
  });

  // ── Owner Login ───────────────────────────────────────────
  app.post('/owner/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const owner = await app.prisma.owner.findUnique({ where: { phone: body.phone } });
    if (!owner) throw Errors.Unauthorized();

    const valid = await bcrypt.compare(body.password, owner.passwordHash);
    if (!valid) throw Errors.Unauthorized();
    if (!owner.isActive) throw Errors.Forbidden('Account is disabled');

    const payload: JwtPayload = { sub: owner.id, role: 'OWNER', phone: owner.phone };
    const tokens = signTokens(app, payload);
    return reply.send({ owner: { id: owner.id, fullName: owner.fullName, phone: owner.phone }, ...tokens });
  });

  // ── Admin Login ───────────────────────────────────────────
  app.post('/admin/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const admin = await app.prisma.admin.findUnique({ where: { phone: body.phone } });
    if (!admin) throw Errors.Unauthorized();

    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) throw Errors.Unauthorized();
    if (!admin.isActive) throw Errors.Forbidden('Account is disabled');

    const payload: JwtPayload = { sub: admin.id, role: 'ADMIN', phone: admin.phone };
    const tokens = signTokens(app, payload);
    return reply.send({ admin: { id: admin.id, phone: admin.phone }, ...tokens });
  });

  // ── Refresh Token ─────────────────────────────────────────
  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw Errors.BadRequest('refreshToken is required');

    try {
      const decoded = app.jwt.verify(refreshToken, { secret: config.JWT_REFRESH_SECRET }) as JwtPayload;
      const payload: JwtPayload = { sub: decoded.sub, role: decoded.role, phone: decoded.phone };
      const tokens = signTokens(app, payload);
      return reply.send(tokens);
    } catch {
      throw Errors.Unauthorized();
    }
  });

  // ── Verify Phone ──────────────────────────────────────────
  app.post('/verify-phone', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as JwtPayload;
    if (req.body && (req.body as any).code !== '0000') {
      throw Errors.BadRequest('Invalid OTP code. Use 0000 for local testing.');
    }

    const updatedUser = await app.prisma.user.update({
      where: { id: user.sub },
      data: { isPhoneVerified: true },
      select: { id: true, phone: true, isPhoneVerified: true },
    });

    return reply.send({
      message: 'Phone verified successfully',
      user: { ...updatedUser, id: updatedUser.id.toString() },
    });
  });

  // Global error handler for this plugin
  app.setErrorHandler((err, req, reply) => {
    if (err.name === 'ZodError') {
      return reply.status(422).send({ error: 'Validation Error', details: (err as any).errors });
    }
    if ((err as any).statusCode) {
      return reply.status((err as any).statusCode).send({ error: err.message, code: (err as any).code });
    }
    app.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error' });
  });
}
