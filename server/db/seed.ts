/**
 * Development seed: synthetic people and data only (no real customers).
 * Dates in seed-data.ts were authored relative to 12 Oct 2026 and are shifted so that, whenever you
 * seed, "active", "expiring soon" and "expired" members still look the way the seed intends.
 */
import { addDaysToKey, daysBetweenKeys, gymInstant, ID_DAY_NAMES, toDateKey } from '../../shared/time.ts';
import { hashPasswordSync, newId, randomCode } from '../lib/crypto.ts';
import { tx, type DB } from './index.ts';
import * as S from './seed-data.ts';

export const SEED_REFERENCE_DATE = '2026-10-12';
/** Development-only password shared by every demo account (override with SEED_PASSWORD). */
export const DEFAULT_DEMO_PASSWORD = 'ApexDemo2026';

const j = (v: unknown) => JSON.stringify(v ?? null);

export function seedDatabase(db: DB, opts: { now: Date; password?: string }) {
  const shift = daysBetweenKeys(SEED_REFERENCE_DATE, toDateKey(opts.now));
  const day = (k: string | undefined | null) => (k ? addDaysToKey(k.slice(0, 10), shift) : null);
  const ts = (iso: string) => new Date(Date.parse(iso) + shift * 86_400_000).toISOString();
  /** Historical events must stay in the past after shifting (a "future" check-in would block real ones). */
  const past = (iso: string) => (iso > opts.now.toISOString() ? new Date(Date.parse(iso) - 86_400_000).toISOString() : iso);
  const passwordHash = hashPasswordSync(opts.password ?? process.env.SEED_PASSWORD ?? DEFAULT_DEMO_PASSWORD);
  const iso = opts.now.toISOString();
  const userIds = new Set(S.INITIAL_USERS.map(u => u.id));

  tx(db, () => {
    const insUser = db.prepare(
      `INSERT INTO users (id, role, name, email, phone, phone_digits, password_hash, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of S.INITIAL_USERS) {
      insUser.run(u.id, u.role, u.name, u.email, u.phone, u.phone.replace(/\D/g, ''), passwordHash, u.avatarUrl ?? null, ts(u.createdAt), iso);
    }

    S.INITIAL_MEMBERSHIP_PLANS.forEach((p, i) =>
      db
        .prepare('INSERT INTO membership_plans (id, name, duration_days, price, period_label, features, is_popular, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, p.name, p.durationDays, p.price, p.periodLabel, j(p.features), p.isPopular ? 1 : 0, i)
    );
    S.INITIAL_PT_PACKAGES.forEach((p, i) =>
      db
        .prepare('INSERT INTO pt_packages (id, name, session_count, price, description, is_popular, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(p.id, p.name, p.sessionCount, p.price, p.description, p.isPopular ? 1 : 0, i)
    );

    for (const c of Object.values(S.INITIAL_COACH_PROFILES)) {
      db.prepare(
        `INSERT INTO coach_profiles (user_id, full_name, title, specialties, certifications, experience_years, bio, photo_url, commission_rate_percent, price_per_session, is_public_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(c.userId, c.fullName, c.title, j(c.specialties), j(c.certifications), c.experienceYears, c.bio, c.photoUrl, c.commissionRatePercent, c.pricePerSession, c.isPublicApproved ? 1 : 0);
      for (let dow = 0; dow < 7; dow++) {
        db.prepare('INSERT INTO coach_availability (coach_id, day_of_week, start_time, end_time, is_available) VALUES (?, ?, ?, ?, ?)').run(
          c.userId,
          dow,
          '07:00',
          '21:00',
          dow === 0 ? 0 : 1
        );
      }
    }

    const usedCodes = new Set<string>();
    for (const m of Object.values(S.INITIAL_MEMBER_PROFILES)) {
      const user = S.INITIAL_USERS.find(u => u.id === m.userId)!;
      let code: string;
      do code = `${user.name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '')}-${randomCode(4)}`;
      while (usedCodes.has(code));
      usedCodes.add(code);
      const plan = S.INITIAL_MEMBERSHIP_PLANS.find(p => p.id === m.planId);
      db.prepare(
        `INSERT INTO member_profiles (user_id, plan_id, plan_name, start_date, end_date, suspended, assigned_coach_id, health_notes, fitness_goal, pt_sessions_remaining, referral_code, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(m.userId, plan ? m.planId : null, m.planName, day(m.startDate), day(m.endDate), m.suspended ? 1 : 0, m.assignedCoachId ?? null, m.healthNotes ?? null, m.fitnessGoal, m.ptSessionsRemaining, code, iso);
    }
    // Reza starts with points so the rewards page can be explored
    db.prepare("INSERT INTO points_ledger (id, member_id, delta, reason, ref_type, ref_id, created_at) VALUES (?, 'member-reza', 250, 'Saldo awal data demo', 'SEED', 'seed', ?)").run(
      newId('pts'),
      iso
    );

    for (const e of S.INITIAL_EXERCISES) {
      db.prepare(
        'INSERT INTO exercises (id, name, category, primary_muscle, equipment, difficulty, instructions, form_tips, common_mistakes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(e.id, e.name, e.category, e.primaryMuscle, e.equipment, e.difficulty, j(e.instructions), e.formTips, e.commonMistakes);
    }
    for (const p of S.INITIAL_PROGRAMS) {
      db.prepare(
        `INSERT INTO workout_programs (id, title, description, target, level, frequency_per_week, duration_weeks, assigned_to_member_id, created_by_coach_id, days, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(p.id, p.title, p.description, p.target, p.level, p.frequencyPerWeek, p.durationWeeks, p.assignedToMemberId ?? null, p.createdByCoachId ?? null, j(p.days), iso);
    }
    for (const f of S.INITIAL_FOOD_DATABASE) {
      db.prepare('INSERT INTO food_items (id, name, indonesian_name, serving_size, calories, protein, carbs, fat, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        f.id,
        f.name,
        f.indonesianName,
        f.servingSize,
        f.calories,
        f.protein,
        f.carbs,
        f.fat,
        f.category
      );
    }
    const mp = S.INITIAL_MEAL_PLAN;
    db.prepare(
      `INSERT INTO meal_plans (member_id, id, title, coach_id, target_calories, target_protein, target_carbs, target_fat, meals, shopping_list, hydration_target_liters, supplements_advice, disclaimer, daily_checked, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(mp.memberId, mp.id, mp.title, mp.coachId, mp.targetCalories, mp.targetProtein, mp.targetCarbs, mp.targetFat, j(mp.meals), j(mp.shoppingList), mp.hydrationTargetLiters, mp.supplementsAdvice, mp.disclaimer, j(mp.dailyChecked), iso);

    for (const w of S.INITIAL_WEEKLY_CHECKINS) {
      db.prepare(
        `INSERT INTO weekly_checkins (id, member_id, checkin_date, weight_kg, energy_score, sleep_hours, stress_score, diet_adherence_percent, notes, coach_reply, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(w.id, w.memberId, day(w.date), w.weightKg, w.energyScore, w.sleepHours, w.stressScore, w.dietAdherencePercent, w.notes, w.coachReply ?? null, iso);
    }
    for (const b of S.INITIAL_BODY_MEASUREMENTS) {
      db.prepare(
        `INSERT INTO body_measurements (id, member_id, measured_date, weight_kg, chest_cm, waist_cm, arm_cm, thigh_cm, body_fat_percent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(b.id, b.memberId, day(b.date), b.weightKg, b.chestCm ?? null, b.waistCm ?? null, b.armCm ?? null, b.thighCm ?? null, b.bodyFatPercent ?? null, iso);
    }
    for (const w of S.INITIAL_WORKOUT_LOGS) {
      db.prepare(
        `INSERT INTO workout_logs (id, member_id, log_date, title, duration_minutes, mood_rating, notes, total_volume_kg, exercises, pr_achieved, coach_feedback, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(w.id, w.memberId, day(w.date), w.title, w.durationMinutes, w.moodRating, w.notes, w.totalVolumeKg, j(w.exercises), w.prAchieved ? 1 : 0, w.coachFeedback ?? null, iso);
    }
    for (const s of S.INITIAL_TRAINING_SESSIONS) {
      const date = day(s.date)!;
      const start = gymInstant(date, s.time);
      db.prepare(
        `INSERT INTO training_sessions (id, member_id, coach_id, session_date, session_time, starts_at, ends_at, duration_minutes, status, notes, coach_feedback, rating, review_comment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        s.id,
        s.memberId,
        s.coachId,
        date,
        s.time,
        start.toISOString(),
        new Date(start.getTime() + s.durationMinutes * 60_000).toISOString(),
        s.durationMinutes,
        s.status,
        s.notes ?? null,
        s.coachFeedback ?? null,
        s.rating ?? null,
        s.reviewComment ?? null,
        iso
      );
    }

    let invoiceSeq = 0;
    for (const p of S.INITIAL_PAYMENTS) {
      const plan = S.INITIAL_MEMBERSHIP_PLANS.find(x => x.name === p.packageName);
      const pack = S.INITIAL_PT_PACKAGES.find(x => x.sessionCount && p.packageName.includes(`${x.sessionCount} Sesi`));
      const created = ts(p.date);
      db.prepare(
        `INSERT INTO payments (id, invoice_number, member_id, customer_name, amount, source, item_id, package_name, item_quantity, status, method, provider, notes, created_at, paid_at, applied_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        p.id,
        `INV-APX-SEED-${String(++invoiceSeq).padStart(4, '0')}`,
        userIds.has(p.memberId) ? p.memberId : null,
        p.memberName,
        p.amount,
        p.source,
        plan?.id ?? pack?.id ?? null,
        p.packageName,
        plan?.durationDays ?? pack?.sessionCount ?? null,
        p.status,
        p.method,
        p.method === 'MANUAL_CASH' ? 'CASH' : 'LEGACY',
        p.notes ?? null,
        created,
        p.status === 'SUCCESS' ? created : null,
        p.status === 'SUCCESS' ? created : null,
        iso
      );
    }
    for (const e of S.INITIAL_EXPENSES) {
      db.prepare('INSERT INTO expenses (id, title, amount, category, expense_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        e.id,
        e.title,
        e.amount,
        e.category,
        day(e.date),
        'user-admin',
        iso
      );
    }
    for (const c of S.INITIAL_CHECKINS) {
      db.prepare(
        "INSERT INTO check_ins (id, member_id, member_name, created_at, status, reason, remaining_days, method, scanned_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'QR', 'user-admin')"
      ).run(c.id, userIds.has(c.memberId) ? c.memberId : null, c.memberName, past(ts(c.timestamp)), c.status, c.reason ?? null, c.remainingDays ?? null);
    }
    for (const a of S.INITIAL_ANNOUNCEMENTS) {
      db.prepare(
        `INSERT INTO announcements (id, title, content, type, target_role, start_date, end_date, is_pinned, is_published, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(a.id, a.title, a.content, a.type, a.targetRole, day(a.startDate), day(a.endDate), a.isPinned ? 1 : 0, a.isPublished ? 1 : 0, iso);
    }
    for (const a of S.INITIAL_ARTICLES) {
      db.prepare('INSERT INTO articles (id, title, category, read_time_minutes, summary, content, published_date, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        a.id,
        a.title,
        a.category,
        a.readTimeMinutes,
        a.summary,
        a.content,
        day(a.publishedDate),
        j(a.tags)
      );
    }
    for (const s of S.INITIAL_SATISFACTION_SURVEYS) {
      const date = day(s.date)!;
      db.prepare(
        `INSERT INTO satisfaction_surveys (id, member_id, survey_month, survey_date, cleanliness, equipment, atmosphere, service, nps_score, suggestions, is_complaint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(s.id, s.memberId, date.slice(0, 7), date, s.cleanliness, s.equipment, s.atmosphere, s.service, s.npsScore, s.suggestions, s.isComplaint ? 1 : 0);
    }
    for (const t of S.INITIAL_FEEDBACK_TICKETS) {
      db.prepare(
        `INSERT INTO feedback_tickets (id, member_id, member_name, ticket_date, category, text, status, admin_response, resolved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(t.id, userIds.has(t.memberId) ? t.memberId : null, t.memberName, day(t.date), t.category, t.text, t.status, t.adminResponse ?? null, day(t.resolvedAt), iso);
    }
    for (const t of S.INITIAL_TESTIMONIALS) {
      db.prepare(
        'INSERT INTO testimonials (id, name, role, duration_member, rating, text, highlight, approved_for_public, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)'
      ).run(t.id, t.name, t.role, t.durationMember, t.rating, t.text, t.highlight, t.approvedForPublic ? 1 : 0);
    }
    for (const m of S.INITIAL_CHAT_MESSAGES) {
      db.prepare('INSERT INTO chat_messages (id, thread_member_id, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)').run(m.id, m.threadMemberId, m.senderId, m.text, past(ts(m.timestamp)));
    }
    for (const c of S.INITIAL_GROUP_CLASSES) {
      const [start, end] = c.time.split(' - ').map(x => x.trim());
      db.prepare(
        `INSERT INTO group_classes (id, name, category, day_of_week, start_time, end_time, coach_id, room, max_capacity, intensity, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(c.id, c.name, c.category, ID_DAY_NAMES.indexOf(c.day as (typeof ID_DAY_NAMES)[number]), start, end, c.coachId, c.room, c.maxCapacity, c.intensity, c.description, iso);
      for (const mid of c.enrolledMemberIds) {
        if (userIds.has(mid)) db.prepare('INSERT INTO class_enrollments (class_id, member_id, created_at) VALUES (?, ?, ?)').run(c.id, mid, iso);
      }
    }
    for (const e of S.INITIAL_EQUIPMENT) {
      db.prepare('INSERT INTO equipment (id, name, category, location, status, last_service_date, next_service_date) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        e.id,
        e.name,
        e.category,
        e.location,
        e.status,
        day(e.lastServiceDate),
        day(e.nextServiceDate)
      );
    }
    for (const r of S.INITIAL_EQUIPMENT_REPORTS) {
      db.prepare(
        `INSERT INTO equipment_reports (id, equipment_id, member_id, member_name, issue_description, report_date, status, admin_notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(r.id, r.equipmentId, userIds.has(r.memberId) ? r.memberId : null, r.memberName, r.issueDescription, day(r.date), r.status, r.adminNotes ?? null, iso);
    }
    for (const r of S.INITIAL_REFERRAL_REWARDS) {
      db.prepare('INSERT INTO referral_rewards (id, title, points_required, description, category) VALUES (?, ?, ?, ?, ?)').run(r.id, r.title, r.pointsRequired, r.description, r.category);
    }
  });
}
