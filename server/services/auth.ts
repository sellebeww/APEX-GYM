import type { Actor, Deps, Role } from '../context.ts';
import { tx, type DB } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { hashPassword, newId, randomCode, randomToken, sha256, verifyAgainstDummy, verifyPassword } from '../lib/crypto.ts';
import { badRequest, conflict, HttpError, unauthorized } from '../lib/errors.ts';

export const MAX_FAILED_LOGINS = 8;
export const LOCK_MINUTES = 15;

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  password_hash: string;
  is_active: number;
  failed_logins: number;
  locked_until: string | null;
  must_change_password: number;
}

export function createSession(db: DB, userId: string, ttlHours: number, now: Date, meta: { ip: string; userAgent: string }) {
  const token = randomToken(32);
  const expires = new Date(now.getTime() + ttlHours * 3_600_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now.toISOString(),
    expires.toISOString(),
    now.toISOString(),
    meta.ip,
    meta.userAgent.slice(0, 300)
  );
  // Opportunistic cleanup of expired sessions
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now.toISOString());
  return { token, expires };
}

/** Resolves a session cookie to an actor; expired or disabled accounts resolve to null. */
export function resolveSession(db: DB, token: string | undefined, now: Date): Actor | null {
  if (!token || token.length > 200) return null;
  const hash = sha256(token);
  const row = db
    .prepare(
      `SELECT s.expires_at, s.last_seen_at, u.id, u.name, u.role, u.email, u.is_active, u.must_change_password
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
    )
    .get(hash) as (UserRow & { expires_at: string; last_seen_at: string }) | undefined;
  if (!row || row.expires_at <= now.toISOString() || !row.is_active) return null;
  if (now.getTime() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(now.toISOString(), hash);
  }
  return { id: row.id, name: row.name, role: row.role, email: row.email, mustChangePassword: row.must_change_password === 1, sessionHash: hash };
}

export async function login(deps: Deps, emailInput: string, password: string, meta: { ip: string; userAgent: string }) {
  const { db } = deps;
  const now = deps.now();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailInput) as UserRow | undefined;
  const generic = unauthorized('Email atau password salah.');

  if (!user) {
    await verifyAgainstDummy(password);
    throw generic;
  }
  if (user.locked_until && user.locked_until > now.toISOString()) {
    await verifyAgainstDummy(password);
    throw new HttpError(423, `Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi setelah ${LOCK_MINUTES} menit atau hubungi resepsionis.`, 'LOCKED');
  }
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok || !user.is_active) {
    const failed = user.failed_logins + 1;
    const lock = failed >= MAX_FAILED_LOGINS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null;
    db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : failed, lock, user.id);
    if (lock) audit(db, { id: user.id, name: user.name, role: user.role }, 'ACCOUNT_LOCKED', `Akun dikunci ${LOCK_MINUTES} menit setelah ${MAX_FAILED_LOGINS} percobaan gagal`, meta.ip, now);
    throw generic;
  }
  return tx(db, () => {
    db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
    const session = createSession(db, user.id, deps.config.sessionTtlHours, now, meta);
    audit(db, { id: user.id, name: user.name, role: user.role }, 'LOGIN', 'Masuk ke aplikasi', meta.ip, now);
    return { session, user };
  });
}

export function logout(db: DB, actor: Actor) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(actor.sessionHash);
}

/** Unique code like "REZA-7KQ2": readable, but not derivable from the member id. */
export function generateReferralCode(db: DB, name: string): string {
  const stem = (name.split(' ')[0] ?? '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 8) || 'APEX';
  for (let i = 0; i < 20; i++) {
    const code = `${stem}-${randomCode(4)}`;
    if (!db.prepare('SELECT 1 FROM member_profiles WHERE referral_code = ?').get(code)) return code;
  }
  return `${stem}-${randomCode(8)}`;
}

export async function registerMember(
  deps: Deps,
  input: { name: string; email: string; phone: string; password: string; referralCode?: string },
  meta: { ip: string; userAgent: string }
) {
  const { db } = deps;
  const now = deps.now();
  const digits = input.phone.replace(/\D/g, '');
  const passwordHash = await hashPassword(input.password);

  return tx(db, () => {
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)) throw conflict('Email sudah terdaftar. Silakan masuk.');
    if (db.prepare('SELECT 1 FROM users WHERE phone_digits = ?').get(digits)) throw conflict('Nomor WhatsApp sudah terdaftar.');
    let referrer: { user_id: string; name: string } | undefined;
    if (input.referralCode) {
      referrer = db
        .prepare('SELECT mp.user_id, u.name FROM member_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.referral_code = ? AND u.is_active = 1')
        .get(input.referralCode.trim().toUpperCase()) as { user_id: string; name: string } | undefined;
      if (!referrer) throw badRequest('Kode referral tidak ditemukan. Periksa kembali atau kosongkan kolom ini.');
    }
    const id = newId('mbr');
    const iso = now.toISOString();
    db.prepare(
      `INSERT INTO users (id, role, name, email, phone, phone_digits, password_hash, created_at, updated_at)
       VALUES (?, 'MEMBER', ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.name, input.email, input.phone, digits, passwordHash, iso, iso);
    db.prepare(
      `INSERT INTO member_profiles (user_id, plan_name, referral_code, referred_by, updated_at) VALUES (?, 'Belum ada paket', ?, ?, ?)`
    ).run(id, generateReferralCode(db, input.name), referrer?.user_id ?? null, iso);
    const session = createSession(db, id, deps.config.sessionTtlHours, now, meta);
    audit(
      db,
      { id, name: input.name, role: 'MEMBER' },
      'REGISTER_MEMBER',
      `Member baru terdaftar (${input.email})${referrer ? `, kode referral milik ${referrer.name}` : ''}`,
      meta.ip,
      now
    );
    return { id, session, referrerName: referrer?.name };
  });
}

export async function changePassword(deps: Deps, actor: Actor, current: string, next: string, meta: { ip: string; userAgent: string }) {
  const { db } = deps;
  const now = deps.now();
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(actor.id) as { password_hash: string };
  if (!(await verifyPassword(current, row.password_hash))) throw badRequest('Password saat ini salah.');
  if (current === next) throw badRequest('Password baru harus berbeda dari password lama.');
  const hash = await hashPassword(next);
  return tx(db, () => {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(hash, now.toISOString(), actor.id);
    // Sign out every other device; keep the current browser signed in with a fresh session
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(actor.id);
    const session = createSession(db, actor.id, deps.config.sessionTtlHours, now, meta);
    audit(db, actor, 'CHANGE_PASSWORD', 'Password diganti; sesi di perangkat lain dikeluarkan', meta.ip, now);
    return session;
  });
}
