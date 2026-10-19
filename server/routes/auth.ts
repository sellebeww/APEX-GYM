import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppConfig } from '../config.ts';
import { requireActor, type AppEnv, type Ctx } from '../context.ts';
import { body, email, password, phone, text } from '../lib/validate.ts';
import { changePassword, login, logout, registerMember } from '../services/auth.ts';

/** `__Host-` binds the cookie to this exact origin over HTTPS (no Domain, Path=/, Secure). */
export const sessionCookieName = (config: AppConfig) => (config.cookieSecure ? '__Host-apex_sid' : 'apex_sid');

export function setSessionCookie(c: Ctx, token: string, expires: Date) {
  const { config } = c.get('deps');
  setCookie(c, sessionCookieName(config), token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    expires,
  });
}

const meta = (c: Ctx) => ({ ip: c.get('ip'), userAgent: c.req.header('user-agent') ?? '' });

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async c => {
    const deps = c.get('deps');
    const input = await body(c, z.object({ email, password: z.string().min(1).max(200) }));
    deps.limiters.loginIp.consume(c.get('ip'));
    deps.limiters.loginAccount.consume(input.email);
    const { session, user } = await login(deps, input.email, input.password, meta(c));
    deps.limiters.loginAccount.reset(input.email);
    setSessionCookie(c, session.token, session.expires);
    return c.json({ ok: true, role: user.role, name: user.name, mustChangePassword: user.must_change_password === 1 });
  })
  .post('/register', async c => {
    const deps = c.get('deps');
    deps.limiters.register.consume(c.get('ip'));
    const input = await body(
      c,
      z.object({
        name: text(2, 120),
        email,
        phone,
        password,
        referralCode: z.string().trim().max(20).optional(),
      })
    );
    const res = await registerMember(deps, { ...input, referralCode: input.referralCode || undefined }, meta(c));
    setSessionCookie(c, res.session.token, res.session.expires);
    return c.json({ ok: true, referrerName: res.referrerName ?? null }, 201);
  })
  .post('/logout', c => {
    const actor = c.get('actor');
    if (actor) logout(c.get('deps').db, actor);
    deleteCookie(c, sessionCookieName(c.get('deps').config), { path: '/', secure: c.get('deps').config.cookieSecure });
    return c.json({ ok: true });
  })
  .post('/change-password', async c => {
    const actor = requireActor(c);
    const deps = c.get('deps');
    deps.limiters.loginAccount.consume(`pw:${actor.id}`);
    const input = await body(c, z.object({ currentPassword: z.string().min(1).max(200), newPassword: password }));
    const session = await changePassword(deps, actor, input.currentPassword, input.newPassword, meta(c));
    setSessionCookie(c, session.token, session.expires);
    return c.json({ ok: true });
  })
  .post('/forgot', async c => {
    // No e-mail provider is configured, so self-service reset is not possible. The response is identical
    // for every address (no account enumeration) and points to the front-desk reset done by an admin.
    c.get('deps').limiters.register.consume(`forgot:${c.get('ip')}`);
    await body(c, z.object({ email }));
    return c.json({
      ok: true,
      message: 'Reset password dilakukan oleh resepsionis APEX Gym. Datang ke meja depan atau hubungi WhatsApp kami dengan email terdaftar Anda.',
    });
  });
