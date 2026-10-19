import type { AppConfig } from './config.ts';
import type { Deps } from './context.ts';
import type { DB } from './db/index.ts';
import { RateLimiter } from './lib/rateLimit.ts';
import { diskStorage, type PhotoStorage } from './lib/storage.ts';
import { midtransGateway } from './payments/midtrans.ts';
import { simulatorGateway } from './payments/simulator.ts';
import type { PaymentGateway } from './payments/types.ts';

const MIN = 60_000;

export function createLimiters(): Deps['limiters'] {
  return {
    loginIp: new RateLimiter(30, 15 * MIN),
    loginAccount: new RateLimiter(10, 15 * MIN),
    register: new RateLimiter(10, 60 * MIN),
    qrIssue: new RateLimiter(20, MIN),
    checkIn: new RateLimiter(120, MIN),
    chat: new RateLimiter(30, MIN),
    upload: new RateLimiter(20, 60 * MIN),
    writes: new RateLimiter(60, MIN),
  };
}

export function createGateway(config: AppConfig): PaymentGateway {
  return config.paymentProvider === 'midtrans'
    ? midtransGateway({ serverKey: config.midtrans.serverKey, isProduction: config.midtrans.isProduction })
    : simulatorGateway();
}

export function createDeps(
  config: AppConfig,
  db: DB,
  overrides: Partial<{ now: () => Date; gateway: PaymentGateway; storage: PhotoStorage }> = {}
): Deps {
  return {
    db,
    config,
    now: overrides.now ?? (() => new Date()),
    gateway: overrides.gateway ?? createGateway(config),
    storage: overrides.storage ?? diskStorage(config.uploadDir),
    limiters: createLimiters(),
  };
}
