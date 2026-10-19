import type { CheckIn } from '../../src/types/index.ts';
import { DOUBLE_CHECKIN_WINDOW_MIN, OCCUPANCY_WINDOW_MIN, GYM_CAPACITY, QR_TOKEN_TTL_SECONDS } from '../../shared/rules.ts';
import { formatDateId, toDateKey, toTimeKey } from '../../shared/time.ts';
import type { Actor, Deps } from '../context.ts';
import { tx, type DB } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { conflict } from '../lib/errors.ts';
import { looksLikeQrToken, signQrToken, verifyQrToken } from '../lib/qr.ts';
import { toCheckIn } from './mappers.ts';
import { membershipState, requireMember } from './members.ts';

export function issueQrToken(deps: Deps, memberId: string) {
  const now = deps.now();
  const m = requireMember(deps.db, memberId);
  const state = membershipState(m, now);
  if (!state.hasAccess) {
    throw conflict(m.suspended ? 'Keanggotaan sedang ditangguhkan. Hubungi resepsionis.' : 'Membership tidak aktif. Perpanjang paket untuk membuka QR masuk.');
  }
  const { token, claims } = signQrToken(deps.config.qrSigningSecret, memberId, QR_TOKEN_TTL_SECONDS, now.getTime());
  return { token, expiresAt: new Date(claims.expiresAt * 1000).toISOString(), ttlSeconds: QR_TOKEN_TTL_SECONDS };
}

export interface CheckInResult {
  success: boolean;
  message: string;
  checkIn: CheckIn;
}

/**
 * Validates a scanned QR token (or, for the front desk, an exact member ID / email / phone) and
 * records the attempt. Everything happens in one IMMEDIATE transaction so two scanners cannot
 * both accept the same token or double-admit the same member.
 */
export function processCheckIn(deps: Deps, scanner: Actor, rawInput: string, ip: string): CheckInResult {
  const { db } = deps;
  const now = deps.now();
  const input = rawInput.trim();

  return tx(db, () => {
    const record = (memberId: string | null, memberName: string, status: 'GRANTED' | 'DENIED', method: 'QR' | 'MANUAL', reason?: string, remainingDays?: number) => {
      const id = newId('chk');
      db.prepare(
        `INSERT INTO check_ins (id, member_id, member_name, created_at, status, reason, remaining_days, method, scanned_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, memberId, memberName, now.toISOString(), status, reason ?? null, remainingDays ?? null, method, scanner.id);
      const row = db.prepare('SELECT * FROM check_ins WHERE id = ?').get(id) as Record<string, unknown>;
      return toCheckIn(row);
    };
    const deny = (memberId: string | null, memberName: string, method: 'QR' | 'MANUAL', reason: string): CheckInResult => ({
      success: false,
      message: reason,
      checkIn: record(memberId, memberName, 'DENIED', method, reason),
    });

    let memberId: string | null = null;
    let method: 'QR' | 'MANUAL' = 'MANUAL';

    if (looksLikeQrToken(input)) {
      method = 'QR';
      const v = verifyQrToken(deps.config.qrSigningSecret, input, now.getTime());
      if (!v.ok) {
        const known = v.claims ? lookupName(db, v.claims.memberId) : null;
        const reason =
          v.reason === 'EXPIRED'
            ? 'Kode QR sudah kedaluwarsa. Minta member membuka ulang QR di aplikasi.'
            : 'Kode QR tidak sah (tanda tangan tidak cocok). Akses ditolak.';
        return deny(known ? v.claims!.memberId : null, known ?? 'Tidak dikenal', method, reason);
      }
      memberId = v.claims.memberId;
      const used = db
        .prepare('INSERT INTO qr_tokens_used (jti, member_id, used_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(jti) DO NOTHING')
        .run(v.claims.jti, memberId, now.toISOString(), new Date(v.claims.expiresAt * 1000).toISOString());
      if (!used.changes) {
        return deny(memberId, lookupName(db, memberId) ?? 'Tidak dikenal', method, 'Kode QR ini sudah dipakai. Setiap kode hanya berlaku satu kali.');
      }
    } else {
      // Front-desk fallback: exact match only, never partial
      const q = input.toLowerCase();
      const digits = q.replace(/\D/g, '');
      const row = q
        ? (db
            .prepare(
              `SELECT id FROM users WHERE role = 'MEMBER' AND (lower(id) = ? OR email = ? OR (? <> '' AND phone_digits = ?))`
            )
            .get(q, q, digits.length >= 9 ? digits : '', digits) as { id: string } | undefined)
        : undefined;
      memberId = row?.id ?? null;
    }

    if (!memberId) return deny(null, 'Tidak dikenal', method, 'ID member atau QR tidak terdaftar di APEX Gym.');
    const member = db
      .prepare(
        `SELECT mp.*, u.name, u.is_active FROM member_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.user_id = ? AND u.role = 'MEMBER'`
      )
      .get(memberId) as { name: string; is_active: number; end_date: string | null; suspended: number } | undefined;
    if (!member || !member.is_active) return deny(null, 'Tidak dikenal', method, 'ID member atau QR tidak terdaftar di APEX Gym.');

    const state = membershipState(member, now);
    if (!state.hasAccess) {
      return deny(
        memberId,
        member.name,
        method,
        member.suspended
          ? 'Keanggotaan sedang ditangguhkan. Hubungi resepsionis APEX.'
          : member.end_date
          ? `Membership berakhir pada ${formatDateId(member.end_date)}. Perpanjang untuk akses masuk.`
          : 'Member belum memiliki paket aktif.'
      );
    }

    const since = new Date(now.getTime() - DOUBLE_CHECKIN_WINDOW_MIN * 60_000).toISOString();
    const recent = db
      .prepare("SELECT 1 FROM check_ins WHERE member_id = ? AND status = 'GRANTED' AND created_at >= ? AND created_at <= ? LIMIT 1")
      .get(memberId, since, now.toISOString());
    if (recent) {
      return deny(memberId, member.name, method, `Sudah tercatat masuk dalam ${DOUBLE_CHECKIN_WINDOW_MIN} menit terakhir (double check-in).`);
    }

    const checkIn = record(memberId, member.name, 'GRANTED', method, undefined, state.daysRemaining);
    audit(db, scanner, 'CHECKIN_GRANTED', `${member.name} masuk via ${method === 'QR' ? 'QR' : 'input manual'} (${state.daysRemaining} hari tersisa)`, ip, now);
    return { success: true, message: `Akses diterima. Selamat berlatih, ${member.name.split(' ')[0]}!`, checkIn };
  });
}

function lookupName(db: DB, memberId: string): string | null {
  const r = db.prepare("SELECT name FROM users WHERE id = ? AND role = 'MEMBER'").get(memberId) as { name: string } | undefined;
  return r?.name ?? null;
}

/** Live headcount: unique members admitted in the last window + today's front-desk correction. */
export function occupancy(db: DB, now: Date) {
  const since = new Date(now.getTime() - OCCUPANCY_WINDOW_MIN * 60_000).toISOString();
  const turnstile = (
    db
      .prepare("SELECT COUNT(DISTINCT member_id) AS n FROM check_ins WHERE status = 'GRANTED' AND created_at >= ? AND created_at <= ?")
      .get(since, now.toISOString()) as { n: number }
  ).n;
  const raw = db.prepare("SELECT value FROM settings WHERE key = 'occupancy_offset'").get() as { value: string } | undefined;
  let manualOffset = 0;
  if (raw) {
    try {
      const v = JSON.parse(raw.value) as { offset: number; date: string };
      if (v.date === toDateKey(now)) manualOffset = v.offset;
    } catch {
      /* ignore corrupt setting */
    }
  }
  return { turnstile, manualOffset, count: Math.max(0, turnstile + manualOffset), capacity: GYM_CAPACITY, windowMinutes: OCCUPANCY_WINDOW_MIN };
}

export function setOccupancy(db: DB, actor: Actor, desired: number, now: Date, ip: string) {
  tx(db, () => {
    const { turnstile } = occupancy(db, now);
    const offset = Math.round(desired) - turnstile;
    db.prepare("INSERT INTO settings (key, value) VALUES ('occupancy_offset', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
      JSON.stringify({ offset, date: toDateKey(now) })
    );
    audit(db, actor, 'OCCUPANCY_CORRECTION', `Koreksi kepadatan menjadi ${desired} orang (turnstile ${turnstile})`, ip, now);
  });
}

/**
 * Average admissions per hour of day over the last 28 days. Returns null until there is enough data
 * to be meaningful, so the UI never shows an invented traffic curve.
 */
export function hourlyProfile(db: DB, now: Date): { hour: string; avgEntries: number }[] | null {
  const since = new Date(now.getTime() - 28 * 86_400_000).toISOString();
  const rows = db
    .prepare("SELECT created_at FROM check_ins WHERE status = 'GRANTED' AND created_at >= ? AND created_at <= ?")
    .all(since, now.toISOString()) as { created_at: string }[];
  if (rows.length < 50) return null;
  const days = new Set(rows.map(r => toDateKey(new Date(r.created_at)))).size || 1;
  const byHour = new Map<string, number>();
  for (const r of rows) {
    const h = `${toTimeKey(new Date(r.created_at)).slice(0, 2)}:00`;
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
  }
  return [...byHour.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([hour, n]) => ({ hour, avgEntries: Math.round((n / days) * 10) / 10 }));
}

/** Housekeeping: used-token rows are only needed until the token would have expired anyway. */
export function purgeUsedQrTokens(db: DB, now: Date) {
  db.prepare('DELETE FROM qr_tokens_used WHERE expires_at < ?').run(new Date(now.getTime() - 3_600_000).toISOString());
}
