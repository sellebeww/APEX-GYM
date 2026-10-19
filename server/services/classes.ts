import { ID_DAY_NAMES, minutesOfDay } from '../../shared/time.ts';
import type { Actor, Deps } from '../context.ts';
import { tx, type DB } from '../db/index.ts';
import { audit } from '../lib/audit.ts';
import { newId } from '../lib/crypto.ts';
import { assertVersion, badRequest, conflict, notFound } from '../lib/errors.ts';
import { membershipState, requireMember } from './members.ts';

interface ClassRow {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  coach_id: string;
  room: string;
  max_capacity: number;
  version: number;
}

const getClass = (db: DB, id: string) => {
  const c = db.prepare('SELECT * FROM group_classes WHERE id = ?').get(id) as ClassRow | undefined;
  if (!c) throw notFound('Kelas tidak ditemukan.');
  return c;
};

export function enrollInClass(deps: Deps, actor: Actor, classId: string, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const cls = getClass(db, classId);
    const member = requireMember(db, actor.id);
    if (!membershipState(member, now).hasAccess) throw conflict('Membership tidak aktif. Perpanjang paket untuk mengikuti kelas.');
    if (db.prepare('SELECT 1 FROM class_enrollments WHERE class_id = ? AND member_id = ?').get(classId, actor.id)) {
      throw conflict('Anda sudah terdaftar di kelas ini.');
    }
    const clash = db
      .prepare(
        `SELECT g.name FROM class_enrollments e JOIN group_classes g ON g.id = e.class_id
         WHERE e.member_id = ? AND g.id <> ? AND g.day_of_week = ? AND g.start_time < ? AND g.end_time > ? LIMIT 1`
      )
      .get(actor.id, classId, cls.day_of_week, cls.end_time, cls.start_time) as { name: string } | undefined;
    if (clash) throw conflict(`Jadwal bentrok dengan kelas "${clash.name}" pada waktu yang sama.`);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ?').get(classId) as { n: number };
    if (n >= cls.max_capacity) throw conflict('Mohon maaf, kuota kelas ini sudah penuh.');
    db.prepare('INSERT INTO class_enrollments (class_id, member_id, created_at) VALUES (?, ?, ?)').run(classId, actor.id, now.toISOString());
    audit(db, actor, 'BOOK_GROUP_CLASS', `${member.name} mendaftar kelas "${cls.name}" (${ID_DAY_NAMES[cls.day_of_week]} ${cls.start_time})`, ip, now);
    return { name: cls.name };
  });
}

export function leaveClass(deps: Deps, actor: Actor, classId: string, memberId: string, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const cls = getClass(db, classId);
    const res = db.prepare('DELETE FROM class_enrollments WHERE class_id = ? AND member_id = ?').run(classId, memberId);
    if (!res.changes) throw conflict('Member tidak terdaftar di kelas ini.');
    audit(db, actor, 'CANCEL_GROUP_CLASS', `Reservasi kelas "${cls.name}" untuk member ${memberId} dibatalkan`, ip, now);
    return { name: cls.name };
  });
}

export interface ClassInput {
  name: string;
  category: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  coachId: string;
  room: string;
  maxCapacity: number;
  intensity: string;
  description: string;
}

function assertNoScheduleConflict(db: DB, input: ClassInput, excludeId?: string) {
  if (input.endTime <= input.startTime) throw badRequest('Jam selesai kelas harus setelah jam mulai.');
  const coach = db.prepare("SELECT name FROM users WHERE id = ? AND role = 'COACH' AND is_active = 1").get(input.coachId);
  if (!coach) throw badRequest('Coach tidak valid.');
  const overlap = (field: 'room' | 'coach_id', value: string) =>
    db
      .prepare(
        `SELECT name FROM group_classes WHERE ${field} = ? AND day_of_week = ? AND start_time < ? AND end_time > ? AND id <> ? LIMIT 1`
      )
      .get(value, input.dayOfWeek, input.endTime, input.startTime, excludeId ?? '') as { name: string } | undefined;
  const roomClash = overlap('room', input.room);
  if (roomClash) throw conflict(`Ruang ${input.room} sudah dipakai kelas "${roomClash.name}" pada jam tersebut.`);
  const coachClash = overlap('coach_id', input.coachId);
  if (coachClash) throw conflict(`Coach sudah mengajar kelas "${coachClash.name}" pada jam tersebut.`);
  // Upcoming 1-on-1 sessions of this coach on the same weekday/time also block the class
  const sessions = db
    .prepare("SELECT session_date, session_time FROM training_sessions WHERE coach_id = ? AND status = 'SCHEDULED'")
    .all(input.coachId) as { session_date: string; session_time: string }[];
  for (const s of sessions) {
    const [y, m, d] = s.session_date.split('-').map(Number);
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== input.dayOfWeek) continue;
    const start = minutesOfDay(s.session_time);
    if (start < minutesOfDay(input.endTime) && start + 60 > minutesOfDay(input.startTime)) {
      throw conflict(`Coach punya sesi PT terjadwal ${s.session_date} ${s.session_time} yang bentrok dengan jam kelas ini.`);
    }
  }
}

export function createClass(deps: Deps, actor: Actor, input: ClassInput, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    assertNoScheduleConflict(db, input);
    const id = newId('cls');
    db.prepare(
      `INSERT INTO group_classes (id, name, category, day_of_week, start_time, end_time, coach_id, room, max_capacity, intensity, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.name, input.category, input.dayOfWeek, input.startTime, input.endTime, input.coachId, input.room, input.maxCapacity, input.intensity, input.description, now.toISOString());
    audit(db, actor, 'ADD_GROUP_CLASS', `Kelas baru "${input.name}" (${ID_DAY_NAMES[input.dayOfWeek]} ${input.startTime}-${input.endTime}, ${input.room})`, ip, now);
    return { id };
  });
}

export function updateClass(deps: Deps, actor: Actor, classId: string, input: ClassInput, expectedVersion: number | undefined, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const cls = getClass(db, classId);
    assertVersion(cls.version, expectedVersion);
    assertNoScheduleConflict(db, input, classId);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ?').get(classId) as { n: number };
    if (input.maxCapacity < n) throw conflict(`Kapasitas tidak boleh di bawah jumlah peserta terdaftar (${n}).`);
    db.prepare(
      `UPDATE group_classes SET name = ?, category = ?, day_of_week = ?, start_time = ?, end_time = ?, coach_id = ?, room = ?, max_capacity = ?,
         intensity = ?, description = ?, version = version + 1 WHERE id = ?`
    ).run(input.name, input.category, input.dayOfWeek, input.startTime, input.endTime, input.coachId, input.room, input.maxCapacity, input.intensity, input.description, classId);
    audit(db, actor, 'UPDATE_GROUP_CLASS', `Kelas "${input.name}" diperbarui`, ip, now);
  });
}

export function deleteClass(deps: Deps, actor: Actor, classId: string, ip: string) {
  const { db } = deps;
  const now = deps.now();
  return tx(db, () => {
    const cls = getClass(db, classId);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM class_enrollments WHERE class_id = ?').get(classId) as { n: number };
    db.prepare('DELETE FROM group_classes WHERE id = ?').run(classId);
    audit(db, actor, 'DELETE_GROUP_CLASS', `Kelas "${cls.name}" dihapus (${n} reservasi dibatalkan)`, ip, now);
    return { cancelled: n };
  });
}
