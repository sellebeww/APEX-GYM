import type { Context } from 'hono';
import type { AppConfig } from './config.ts';
import type { DB } from './db/index.ts';
import { forbidden, unauthorized } from './lib/errors.ts';
import type { RateLimiter } from './lib/rateLimit.ts';
import type { PaymentGateway } from './payments/types.ts';
import type { PhotoStorage } from './lib/storage.ts';

export type Role = 'MEMBER' | 'COACH' | 'ADMIN';

export interface Actor {
  id: string;
  name: string;
  role: Role;
  email: string;
  mustChangePassword: boolean;
  sessionHash: string;
}

export interface Limiters {
  loginIp: RateLimiter;
  loginAccount: RateLimiter;
  register: RateLimiter;
  qrIssue: RateLimiter;
  checkIn: RateLimiter;
  chat: RateLimiter;
  upload: RateLimiter;
  writes: RateLimiter;
}

export interface Deps {
  db: DB;
  config: AppConfig;
  /** Injectable clock so tests can travel in time */
  now: () => Date;
  gateway: PaymentGateway;
  storage: PhotoStorage;
  limiters: Limiters;
}

export type AppEnv = {
  Variables: {
    deps: Deps;
    actor: Actor | null;
    ip: string;
  };
};

export type Ctx = Context<AppEnv>;

export function requireActor(c: Ctx): Actor {
  const actor = c.get('actor');
  if (!actor) throw unauthorized();
  return actor;
}

export function requireRole(c: Ctx, ...roles: Role[]): Actor {
  const actor = requireActor(c);
  if (!roles.includes(actor.role)) throw forbidden('Fitur ini tidak tersedia untuk peran akun Anda.');
  return actor;
}
