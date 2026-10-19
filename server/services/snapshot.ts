import type { AppSnapshot, CoachAvailability, MealPlan, MemberProfile } from '../../src/types/index.ts';
import { isAnnouncementVisible } from '../../src/lib/announcements.ts';
import { deriveMembershipStatus } from '../../shared/membership.ts';
import { minutesOfDay, toDateKey } from '../../shared/time.ts';
import type { Actor, Deps } from '../context.ts';
import type { DB } from '../db/index.ts';
import { hourlyProfile, occupancy } from './checkin.ts';
import * as M from './mappers.ts';
import { coachClientIds, pointsBalance, workoutStreak } from './members.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const placeholders = (n: number) => Array(n).fill('?').join(',');
const inList = (db: DB, sql: string, ids: string[]): Row[] => (ids.length ? (db.prepare(sql.replace('(:ids)', `(${placeholders(ids.length)})`)).all(...ids) as Row[]) : []);

function memberProfilesFor(db: DB, ids: string[] | 'ALL', now: Date): Record<string, MemberProfile> {
  const rows = ids === 'ALL' ? (db.prepare('SELECT * FROM member_profiles').all() as Row[]) : inList(db, 'SELECT * FROM member_profiles WHERE user_id IN (:ids)', ids);
  if (!rows.length) return {};
  const memberIds = rows.map(r => r.user_id);
  const monthStart = `${toDateKey(now).slice(0, 7)}-01`;
  // Visits = granted entries in the current gym-local month (UTC+7 boundary)
  const monthStartUtc = new Date(`${monthStart}T00:00:00+07:00`).toISOString();
  const visitRows = db
    .prepare(`SELECT member_id, COUNT(*) AS n FROM check_ins WHERE status = 'GRANTED' AND created_at >= ? AND member_id IN (${placeholders(memberIds.length)}) GROUP BY member_id`)
    .all(monthStartUtc, ...memberIds) as Row[];
  const visitMap = new Map(visitRows.map(r => [r.member_id, r.n as number]));
  const since = new Date(now.getTime() - 120 * 86_400_000).toISOString().slice(0, 10);
  const dayRows = db
    .prepare(`SELECT DISTINCT member_id, log_date FROM workout_logs WHERE log_date >= ? AND member_id IN (${placeholders(memberIds.length)})`)
    .all(since, ...memberIds) as Row[];
  const days = new Map<string, string[]>();
  for (const r of dayRows) days.set(r.member_id, [...(days.get(r.member_id) ?? []), r.log_date]);
  return Object.fromEntries(
    rows.map(r => [r.user_id, M.toMemberProfile(r, { visitsThisMonth: visitMap.get(r.user_id) ?? 0, workoutStreak: workoutStreak(days.get(r.user_id) ?? [], now) }, now)])
  );
}

function coachProfiles(db: DB, onlyPublic: boolean, alsoInclude: string | null = null) {
  const ratings = new Map(
    (db.prepare('SELECT coach_id, AVG(rating) AS avg, COUNT(rating) AS n FROM training_sessions WHERE rating IS NOT NULL GROUP BY coach_id').all() as Row[]).map(r => [
      r.coach_id,
      { avg: r.avg as number, count: r.n as number },
    ])
  );
  const rows = db
    .prepare(
      `SELECT cp.* FROM coach_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE u.is_active = 1 ${onlyPublic ? 'AND (cp.is_public_approved = 1 OR cp.user_id = ?)' : ''}`
    )
    .all(...(onlyPublic ? [alsoInclude ?? ''] : [])) as Row[];
  return Object.fromEntries(rows.map(r => [r.user_id, M.toCoachProfile(r, ratings.get(r.user_id) ?? { avg: null, count: 0 })]));
}

function availability(db: DB, coachIds: string[]): Record<string, CoachAvailability[]> {
  const out: Record<string, CoachAvailability[]> = {};
  for (const r of inList(db, 'SELECT * FROM coach_availability WHERE coach_id IN (:ids) ORDER BY coach_id, day_of_week', coachIds)) {
    (out[r.coach_id] ??= []).push(M.toAvailability(r));
  }
  return out;
}

const SESSION_SELECT = `SELECT ts.*, mu.name AS member_name, cu.name AS coach_name FROM training_sessions ts
  JOIN users mu ON mu.id = ts.member_id JOIN users cu ON cu.id = ts.coach_id`;
const CHAT_SELECT = `SELECT c.*, u.name AS sender_name, u.role AS sender_role FROM chat_messages c JOIN users u ON u.id = c.sender_id`;

function groupClasses(db: DB, viewer: Actor | null) {
  const rows = db
    .prepare(`SELECT g.*, u.name AS coach_name FROM group_classes g JOIN users u ON u.id = g.coach_id ORDER BY g.day_of_week, g.start_time`)
    .all() as Row[];
  const enrollments = db.prepare('SELECT class_id, member_id FROM class_enrollments').all() as Row[];
  return rows.map(r => {
    const roster = enrollments.filter(e => e.class_id === r.id).map(e => e.member_id as string);
    const visibleRoster = viewer?.role === 'ADMIN' ? roster : viewer?.role === 'MEMBER' ? roster.filter(id => id === viewer.id) : [];
    r.duration_minutes = minutesOfDay(r.end_time) - minutesOfDay(r.start_time);
    return M.toGroupClass(r, visibleRoster, roster.length);
  });
}

function equipment(db: DB) {
  const open = new Map(
    (db.prepare("SELECT equipment_id, COUNT(*) AS n FROM equipment_reports WHERE status <> 'RESOLVED' GROUP BY equipment_id").all() as Row[]).map(r => [r.equipment_id, r.n as number])
  );
  return (db.prepare('SELECT * FROM equipment ORDER BY category, name').all() as Row[]).map(r => M.toEquipment(r, open.get(r.id) ?? 0));
}

function mealPlans(rows: Row[]): Record<string, MealPlan> {
  return Object.fromEntries(rows.map(r => [r.member_id, M.toMealPlan(r)]));
}

function publicStats(db: DB, now: Date): AppSnapshot['publicStats'] {
  const members = db
    .prepare("SELECT mp.end_date, mp.suspended, mp.assigned_coach_id FROM member_profiles mp JOIN users u ON u.id = mp.user_id WHERE u.is_active = 1")
    .all() as Row[];
  const active = members.filter(m => deriveMembershipStatus({ endDate: m.end_date, suspended: m.suspended === 1 }, now) !== 'EXPIRED');
  const coachActiveClients: Record<string, number> = {};
  for (const m of active) if (m.assigned_coach_id) coachActiveClients[m.assigned_coach_id] = (coachActiveClients[m.assigned_coach_id] ?? 0) + 1;
  const s = db.prepare('SELECT COUNT(*) AS n, AVG((cleanliness + equipment + atmosphere + service) / 4.0) AS avg FROM satisfaction_surveys').get() as Row;
  return {
    activeMembers: active.length,
    avgSatisfaction: s.n ? Math.round(s.avg * 10) / 10 : null,
    surveyCount: s.n,
    coachActiveClients,
  };
}

export function buildSnapshot(deps: Deps, actor: Actor | null): AppSnapshot {
  const { db, config } = deps;
  const now = deps.now();
  const role = actor?.role ?? 'PUBLIC';
  const all = <T>(sql: string, map: (r: Row) => T, ...params: unknown[]) => (db.prepare(sql).all(...params) as Row[]).map(map);

  const occ = occupancy(db, now);
  const base: AppSnapshot = {
    me: null,
    config: { demoMode: config.demoMode, paymentProvider: config.paymentProvider, timeZone: 'Asia/Jakarta' },
    serverTime: now.toISOString(),
    users: [],
    memberProfiles: {},
    coachProfiles: coachProfiles(db, role !== 'ADMIN'),
    coachAvailability: {},
    membershipPlans: all('SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order', M.toPlan),
    ptPackages: all('SELECT * FROM pt_packages WHERE is_active = 1 ORDER BY sort_order', M.toPtPackage),
    payments: [],
    expenses: [],
    checkIns: [],
    exercises: [],
    workoutPrograms: [],
    workoutLogs: [],
    foodDatabase: [],
    mealPlans: {},
    weeklyCheckIns: [],
    bodyMeasurements: [],
    progressPhotos: [],
    trainingSessions: [],
    satisfactionSurveys: [],
    feedbackTickets: [],
    testimonials: all(`SELECT * FROM testimonials ${role === 'ADMIN' ? '' : 'WHERE approved_for_public = 1'}`, M.toTestimonial),
    articles: all('SELECT * FROM articles ORDER BY published_date DESC', M.toArticle),
    announcements: all('SELECT * FROM announcements ORDER BY is_pinned DESC, start_date DESC', M.toAnnouncement).filter(
      a => role === 'ADMIN' || isAnnouncementVisible(a, role, now)
    ),
    chatMessages: [],
    auditLogs: [],
    groupClasses: groupClasses(db, actor),
    gymEquipment: equipment(db),
    equipmentReports: [],
    referralRewards: all('SELECT * FROM referral_rewards WHERE is_active = 1 ORDER BY points_required', M.toReward),
    referral: null,
    occupancy: { count: occ.count, capacity: occ.capacity, manualOffset: occ.manualOffset, windowMinutes: occ.windowMinutes, hourlyProfile: hourlyProfile(db, now) },
    publicStats: publicStats(db, now),
  };
  // Public visitors: coach names for the class timetable come from coach profiles only
  if (!actor) return base;

  const meRow = db.prepare('SELECT * FROM users WHERE id = ?').get(actor.id) as Row;
  base.me = { ...M.toUser(meRow), mustChangePassword: meRow.must_change_password === 1 };
  const coachUsers = all("SELECT * FROM users WHERE role = 'COACH' AND is_active = 1", M.toUser);
  const coachIds = coachUsers.map(u => u.id);
  base.exercises = all('SELECT * FROM exercises ORDER BY category, name', M.toExercise);

  if (actor.role === 'MEMBER') {
    const id = actor.id;
    base.users = [base.me, ...coachUsers];
    base.memberProfiles = memberProfilesFor(db, [id], now);
    base.coachProfiles = coachProfiles(db, true, base.memberProfiles[id]?.assignedCoachId ?? null);
    base.coachAvailability = availability(db, coachIds);
    base.payments = all('SELECT * FROM payments WHERE member_id = ? ORDER BY created_at DESC', M.toPayment, id);
    base.checkIns = all('SELECT * FROM check_ins WHERE member_id = ? ORDER BY created_at DESC LIMIT 50', M.toCheckIn, id);
    base.workoutPrograms = all(
      'SELECT * FROM workout_programs WHERE assigned_to_member_id IS NULL OR assigned_to_member_id = ? ORDER BY created_at DESC',
      M.toProgram,
      id
    );
    base.workoutLogs = all('SELECT * FROM workout_logs WHERE member_id = ? ORDER BY log_date DESC, created_at DESC', M.toWorkoutLog, id);
    base.foodDatabase = all('SELECT * FROM food_items ORDER BY category, name', M.toFood);
    base.mealPlans = mealPlans(db.prepare('SELECT * FROM meal_plans WHERE member_id = ?').all(id) as Row[]);
    base.weeklyCheckIns = all('SELECT * FROM weekly_checkins WHERE member_id = ? ORDER BY checkin_date DESC', M.toWeeklyCheckIn, id);
    base.bodyMeasurements = all('SELECT * FROM body_measurements WHERE member_id = ? ORDER BY measured_date', M.toMeasurement, id);
    base.progressPhotos = all('SELECT * FROM progress_photos WHERE member_id = ? ORDER BY photo_date', M.toPhoto, id);
    base.trainingSessions = all(`${SESSION_SELECT} WHERE ts.member_id = ? ORDER BY ts.starts_at DESC`, M.toSession, id);
    base.satisfactionSurveys = all(
      'SELECT s.*, u.name AS member_name FROM satisfaction_surveys s JOIN users u ON u.id = s.member_id WHERE s.member_id = ? ORDER BY survey_date DESC',
      M.toSurvey,
      id
    );
    base.feedbackTickets = all('SELECT * FROM feedback_tickets WHERE member_id = ? ORDER BY created_at DESC', M.toTicket, id);
    base.chatMessages = all(`${CHAT_SELECT} WHERE c.thread_member_id = ? ORDER BY c.created_at`, M.toChat, id);
    base.equipmentReports = all(
      'SELECT r.*, e.name AS equipment_name FROM equipment_reports r JOIN equipment e ON e.id = r.equipment_id WHERE r.member_id = ? ORDER BY r.created_at DESC',
      M.toEquipmentReport,
      id
    );
    const profile = db.prepare('SELECT referral_code FROM member_profiles WHERE user_id = ?').get(id) as Row;
    base.referral = {
      code: profile.referral_code,
      points: pointsBalance(db, id),
      claimedRewardIds: (db.prepare('SELECT reward_id FROM reward_claims WHERE member_id = ?').all(id) as Row[]).map(r => r.reward_id),
      referrals: (
        db
          .prepare(
            `SELECT u.name, u.created_at, EXISTS(SELECT 1 FROM points_ledger p WHERE p.ref_type = 'REFERRAL_BONUS' AND p.ref_id = u.id) AS earned
             FROM member_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.referred_by = ? ORDER BY u.created_at DESC`
          )
          .all(id) as Row[]
      ).map(r => ({ name: r.name.split(' ')[0], joinedAt: r.created_at, bonusEarned: r.earned === 1 })),
    };
    return base;
  }

  if (actor.role === 'COACH') {
    const clients = coachClientIds(db, actor.id);
    base.users = [...coachUsers, ...inList(db, 'SELECT * FROM users WHERE id IN (:ids)', clients).map(M.toUser)];
    base.coachProfiles = coachProfiles(db, false);
    base.memberProfiles = memberProfilesFor(db, clients, now);
    base.coachAvailability = availability(db, coachIds);
    base.workoutPrograms = all(
      'SELECT * FROM workout_programs WHERE assigned_to_member_id IS NULL OR created_by_coach_id = ? ORDER BY created_at DESC',
      M.toProgram,
      actor.id
    );
    base.workoutLogs = inList(db, 'SELECT * FROM workout_logs WHERE member_id IN (:ids) ORDER BY log_date DESC', clients).map(M.toWorkoutLog);
    base.foodDatabase = all('SELECT * FROM food_items ORDER BY category, name', M.toFood);
    base.mealPlans = mealPlans(inList(db, 'SELECT * FROM meal_plans WHERE member_id IN (:ids)', clients));
    base.weeklyCheckIns = inList(db, 'SELECT * FROM weekly_checkins WHERE member_id IN (:ids) ORDER BY checkin_date DESC', clients).map(M.toWeeklyCheckIn);
    base.bodyMeasurements = inList(db, 'SELECT * FROM body_measurements WHERE member_id IN (:ids) ORDER BY measured_date', clients).map(M.toMeasurement);
    base.progressPhotos = inList(db, 'SELECT * FROM progress_photos WHERE member_id IN (:ids) ORDER BY photo_date', clients).map(M.toPhoto);
    base.trainingSessions = all(`${SESSION_SELECT} WHERE ts.coach_id = ? ORDER BY ts.starts_at DESC`, M.toSession, actor.id);
    base.chatMessages = inList(db, `${CHAT_SELECT} WHERE c.thread_member_id IN (:ids) ORDER BY c.created_at`, clients).map(M.toChat);
    return base;
  }

  // ADMIN: operational data. Private coach-member chats and progress photos are deliberately excluded.
  base.users = all('SELECT * FROM users ORDER BY role, name', M.toUser);
  base.memberProfiles = memberProfilesFor(db, 'ALL', now);
  base.coachAvailability = availability(db, coachIds);
  base.payments = all('SELECT * FROM payments ORDER BY created_at DESC', M.toPayment);
  base.expenses = all('SELECT * FROM expenses ORDER BY expense_date DESC', M.toExpense);
  base.checkIns = all('SELECT * FROM check_ins ORDER BY created_at DESC LIMIT 500', M.toCheckIn);
  base.workoutPrograms = all('SELECT * FROM workout_programs ORDER BY created_at DESC', M.toProgram);
  base.trainingSessions = all(`${SESSION_SELECT} ORDER BY ts.starts_at DESC LIMIT 1000`, M.toSession);
  base.satisfactionSurveys = all(
    'SELECT s.*, u.name AS member_name FROM satisfaction_surveys s JOIN users u ON u.id = s.member_id ORDER BY survey_date DESC',
    M.toSurvey
  );
  base.feedbackTickets = all('SELECT * FROM feedback_tickets ORDER BY created_at DESC', M.toTicket);
  base.auditLogs = all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500', M.toAudit);
  base.equipmentReports = all(
    'SELECT r.*, e.name AS equipment_name FROM equipment_reports r JOIN equipment e ON e.id = r.equipment_id ORDER BY r.created_at DESC',
    M.toEquipmentReport
  );
  return base;
}
