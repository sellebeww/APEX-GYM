import { randomBytes } from 'node:crypto';
import path from 'node:path';

export type PaymentProviderName = 'simulator' | 'midtrans';

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  host: string;
  port: number;
  databasePath: string;
  uploadDir: string;
  /** Origins allowed to make state-changing requests (CSRF defence) */
  allowedOrigins: string[];
  /** Public base URL, used for payment-provider redirects */
  publicUrl: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  qrSigningSecret: string;
  /** Development-only conveniences: one-click demo accounts and payment simulator controls */
  demoMode: boolean;
  paymentProvider: PaymentProviderName;
  midtrans: { serverKey: string; isProduction: boolean };
  sessionTtlHours: number;
  serveStatic: boolean;
  staticDir: string;
}

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

/**
 * Reads configuration from the environment and refuses unsafe production setups
 * (missing secrets, demo mode, payment simulator) instead of silently degrading.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV === 'production' ? 'production' : env.NODE_ENV === 'test' ? 'test' : 'development';
  const isProduction = nodeEnv === 'production';
  const root = process.cwd();
  const publicUrl = (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  const errors: string[] = [];

  let qrSigningSecret = env.QR_SIGNING_SECRET ?? '';
  if (qrSigningSecret.length < 32) {
    if (isProduction) errors.push('QR_SIGNING_SECRET wajib diisi (minimal 32 karakter acak).');
    else qrSigningSecret = randomBytes(32).toString('hex'); // ephemeral: QR codes reset on restart in dev
  }

  const paymentProvider = (env.PAYMENT_PROVIDER || (isProduction ? 'midtrans' : 'simulator')) as PaymentProviderName;
  if (!['simulator', 'midtrans'].includes(paymentProvider)) errors.push(`PAYMENT_PROVIDER tidak dikenal: ${paymentProvider}`);
  if (isProduction && paymentProvider === 'simulator') errors.push('PAYMENT_PROVIDER=simulator dilarang di production.');
  const midtransServerKey = env.MIDTRANS_SERVER_KEY ?? '';
  if (paymentProvider === 'midtrans' && !midtransServerKey) errors.push('MIDTRANS_SERVER_KEY wajib diisi untuk PAYMENT_PROVIDER=midtrans.');

  const demoMode = bool(env.DEMO_MODE, !isProduction);
  if (isProduction && demoMode) errors.push('DEMO_MODE tidak boleh aktif di production.');

  const allowedOrigins = (env.ALLOWED_ORIGINS || publicUrl)
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!isProduction) {
    // Vite moves to the next free port (3001, 3002, ...) when 3000 is taken, so allow a small local range
    const devPorts = [...Array.from({ length: 10 }, (_, i) => 3000 + i), 8787];
    for (const o of devPorts.flatMap(port => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])) {
      if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    }
  }
  if (isProduction && !publicUrl.startsWith('https://')) errors.push('PUBLIC_URL harus memakai https:// di production.');

  if (errors.length) {
    throw new Error(`Konfigurasi tidak valid:\n- ${errors.join('\n- ')}`);
  }

  return {
    env: nodeEnv,
    isProduction,
    host: env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
    port: Number(env.PORT) || 8787,
    databasePath: env.DATABASE_PATH || path.join(root, 'data', 'apex.db'),
    uploadDir: env.UPLOAD_DIR || path.join(root, 'data', 'uploads'),
    allowedOrigins,
    publicUrl,
    cookieSecure: bool(env.COOKIE_SECURE, isProduction),
    trustProxy: bool(env.TRUST_PROXY, false),
    qrSigningSecret,
    demoMode,
    paymentProvider,
    midtrans: { serverKey: midtransServerKey, isProduction: bool(env.MIDTRANS_IS_PRODUCTION, false) },
    sessionTtlHours: Number(env.SESSION_TTL_HOURS) || 24 * 7,
    serveStatic: bool(env.SERVE_STATIC, isProduction),
    staticDir: env.STATIC_DIR || path.join(root, 'dist'),
  };
}
