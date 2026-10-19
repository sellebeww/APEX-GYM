import { timingSafeEqual } from 'node:crypto';
import { hmacSha256, randomToken } from './crypto.ts';

/**
 * Gate tokens: "APX1.<payload>.<signature>"
 *   payload   = base64url(JSON {m: memberId, j: random token id, e: expiry (unix s)})
 *   signature = base64url(HMAC-SHA256(QR_SIGNING_SECRET, "APX1." + payload))
 * Only the server knows the secret, so a member (or anyone photographing the screen)
 * cannot mint a token for another identity or extend its lifetime.
 * Replay is blocked separately: each `j` is stored when used and accepted only once.
 */
const PREFIX = 'APX1';

export interface QrClaims {
  memberId: string;
  jti: string;
  expiresAt: number; // unix seconds
}

export function signQrToken(secret: string, memberId: string, ttlSeconds: number, nowMs = Date.now()): { token: string; claims: QrClaims } {
  const claims: QrClaims = { memberId, jti: randomToken(16), expiresAt: Math.floor(nowMs / 1000) + ttlSeconds };
  const payload = Buffer.from(JSON.stringify({ m: claims.memberId, j: claims.jti, e: claims.expiresAt })).toString('base64url');
  const sig = hmacSha256(secret, `${PREFIX}.${payload}`).toString('base64url');
  return { token: `${PREFIX}.${payload}.${sig}`, claims };
}

export type QrVerifyResult =
  | { ok: true; claims: QrClaims }
  | { ok: false; reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED'; claims?: QrClaims };

export function looksLikeQrToken(input: string): boolean {
  return input.startsWith(`${PREFIX}.`);
}

export function verifyQrToken(secret: string, token: string, nowMs = Date.now()): QrVerifyResult {
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: 'MALFORMED' };
  const [, payload, sig] = parts;
  const expected = hmacSha256(secret, `${PREFIX}.${payload}`);
  let given: Buffer;
  try {
    given = Buffer.from(sig, 'base64url');
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  // Constant-time comparison; length mismatch is itself a failure
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'BAD_SIGNATURE' };
  let parsed: { m?: unknown; j?: unknown; e?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (typeof parsed.m !== 'string' || typeof parsed.j !== 'string' || typeof parsed.e !== 'number') return { ok: false, reason: 'MALFORMED' };
  const claims: QrClaims = { memberId: parsed.m, jti: parsed.j, expiresAt: parsed.e };
  if (Math.floor(nowMs / 1000) > claims.expiresAt) return { ok: false, reason: 'EXPIRED', claims };
  return { ok: true, claims };
}

