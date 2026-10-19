import type {
  Announcement,
  Article,
  AuditLogItem,
  BodyMeasurement,
  ChatMessage,
  CheckIn,
  CoachAvailability,
  CoachProfile,
  EquipmentReport,
  Exercise,
  Expense,
  FeedbackTicket,
  FoodItem,
  GroupClass,
  GymEquipment,
  MealPlan,
  MemberProfile,
  MembershipPlan,
  Payment,
  ProgressPhoto,
  PtPackage,
  ReferralReward,
  SatisfactionSurvey,
  Testimonial,
  TrainingSession,
  User,
  WeeklyCheckIn,
  WorkoutProgram,
  WorkoutSessionLog,
} from '../../src/types/index.ts';
import { deriveMembershipStatus } from '../../shared/membership.ts';
import { ID_DAY_NAMES } from '../../shared/time.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const json = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string') return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const bool = (v: unknown) => v === 1 || v === true;

export const EXPENSE_LABELS: Record<Expense['category'], string> = {
  SALARY: 'Gaji & Komisi Staff',
  RENT: 'Sewa Gedung',
  ELECTRICITY: 'Listrik & Utilitas',
  EQUIPMENT_MAINTENANCE: 'Perawatan Alat',
  MARKETING: 'Pemasaran & Digital Ads',
  OTHER: 'Lain-lain',
};

export const toUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  phone: r.phone,
  avatarUrl: opt(r.avatar_url),
  createdAt: r.created_at,
});

export function toMemberProfile(r: Row, extras: { visitsThisMonth: number; workoutStreak: number }, now: Date): MemberProfile {
  return {
    userId: r.user_id,
    status: deriveMembershipStatus({ endDate: r.end_date, suspended: bool(r.suspended) }, now),
    planId: r.plan_id ?? '',
    planName: r.plan_name,
    startDate: r.start_date ?? '',
    endDate: r.end_date ?? '',
    visitsThisMonth: extras.visitsThisMonth,
    workoutStreak: extras.workoutStreak,
    assignedCoachId: opt(r.assigned_coach_id),
    healthNotes: opt(r.health_notes),
    fitnessGoal: r.fitness_goal,
    ptSessionsRemaining: r.pt_sessions_remaining,
    suspended: bool(r.suspended),
    version: r.version,
  };
}

export const toCoachProfile = (r: Row, rating: { avg: number | null; count: number }): CoachProfile => ({
  userId: r.user_id,
  fullName: r.full_name,
  title: r.title,
  specialties: json(r.specialties, []),
  certifications: json(r.certifications, []),
  experienceYears: r.experience_years,
  rating: rating.avg === null ? null : Math.round(rating.avg * 10) / 10,
  reviewCount: rating.count,
  bio: r.bio,
  photoUrl: r.photo_url ?? '',
  commissionRatePercent: r.commission_rate_percent,
  pricePerSession: r.price_per_session,
  isPublicApproved: bool(r.is_public_approved),
  version: r.version,
});

export const toAvailability = (r: Row): CoachAvailability => ({
  coachId: r.coach_id,
  dayOfWeek: r.day_of_week,
  dayName: ID_DAY_NAMES[r.day_of_week],
  startTime: r.start_time,
  endTime: r.end_time,
  isAvailable: bool(r.is_available),
});

export const toPlan = (r: Row): MembershipPlan => ({
  id: r.id,
  name: r.name,
  durationDays: r.duration_days,
  price: r.price,
  periodLabel: r.period_label,
  features: json(r.features, []),
  isPopular: bool(r.is_popular),
});

export const toPtPackage = (r: Row): PtPackage => ({
  id: r.id,
  name: r.name,
  sessionCount: r.session_count,
  price: r.price,
  pricePerSession: Math.round(r.price / r.session_count),
  description: r.description,
  isPopular: bool(r.is_popular),
});

export const toPayment = (r: Row): Payment => ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  memberId: r.member_id ?? '',
  memberName: r.customer_name,
  amount: r.amount,
  source: r.source,
  packageName: r.package_name,
  status: r.status,
  method: r.method,
  provider: r.provider,
  date: r.created_at,
  paidAt: opt(r.paid_at),
  refundedAt: opt(r.refunded_at),
  refundReason: opt(r.refund_reason),
  notes: opt(r.notes),
  checkoutUrl: r.status === 'PENDING' ? opt(r.checkout_url) : undefined,
  planId: r.source === 'MEMBERSHIP' ? opt(r.item_id) : undefined,
  ptPackageId: r.source === 'PT_PACKAGE' ? opt(r.item_id) : undefined,
});

export const toExpense = (r: Row): Expense => ({
  id: r.id,
  title: r.title,
  amount: r.amount,
  category: r.category,
  categoryLabel: EXPENSE_LABELS[r.category as Expense['category']] ?? 'Lain-lain',
  date: r.expense_date,
  notes: opt(r.notes),
});

export const toCheckIn = (r: Row): CheckIn => ({
  id: r.id,
  memberId: r.member_id ?? 'UNKNOWN',
  memberName: r.member_name,
  timestamp: r.created_at,
  status: r.status,
  reason: opt(r.reason),
  remainingDays: opt(r.remaining_days),
  method: r.method,
});

export const toExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  category: r.category,
  primaryMuscle: r.primary_muscle,
  equipment: r.equipment,
  difficulty: r.difficulty,
  instructions: json(r.instructions, []),
  formTips: r.form_tips,
  commonMistakes: r.common_mistakes,
});

export const toProgram = (r: Row): WorkoutProgram => ({
  id: r.id,
  title: r.title,
  description: r.description,
  target: r.target,
  level: r.level,
  frequencyPerWeek: r.frequency_per_week,
  durationWeeks: r.duration_weeks,
  isCoachAssigned: !!r.assigned_to_member_id,
  assignedToMemberId: opt(r.assigned_to_member_id),
  createdByCoachId: opt(r.created_by_coach_id),
  days: json(r.days, []),
});

export const toWorkoutLog = (r: Row): WorkoutSessionLog => ({
  id: r.id,
  memberId: r.member_id,
  date: r.log_date,
  title: r.title,
  durationMinutes: r.duration_minutes,
  moodRating: r.mood_rating,
  notes: r.notes,
  totalVolumeKg: r.total_volume_kg,
  exercises: json(r.exercises, []),
  prAchieved: bool(r.pr_achieved),
  coachFeedback: opt(r.coach_feedback),
});

export const toFood = (r: Row): FoodItem => ({
  id: r.id,
  name: r.name,
  indonesianName: r.indonesian_name,
  servingSize: r.serving_size,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  category: r.category,
});

export const toMealPlan = (r: Row): MealPlan => ({
  id: r.id,
  title: r.title,
  memberId: r.member_id,
  coachId: r.coach_id ?? '',
  targetCalories: r.target_calories,
  targetProtein: r.target_protein,
  targetCarbs: r.target_carbs,
  targetFat: r.target_fat,
  meals: json(r.meals, []),
  shoppingList: json(r.shopping_list, []),
  hydrationTargetLiters: r.hydration_target_liters,
  supplementsAdvice: r.supplements_advice,
  disclaimer: r.disclaimer,
  dailyChecked: json(r.daily_checked, Array(7).fill(false)),
});

export const toWeeklyCheckIn = (r: Row): WeeklyCheckIn => ({
  id: r.id,
  memberId: r.member_id,
  date: r.checkin_date,
  weightKg: r.weight_kg,
  energyScore: r.energy_score,
  sleepHours: r.sleep_hours,
  stressScore: r.stress_score,
  dietAdherencePercent: r.diet_adherence_percent,
  notes: r.notes,
  coachReply: opt(r.coach_reply),
});

export const toMeasurement = (r: Row): BodyMeasurement => ({
  id: r.id,
  memberId: r.member_id,
  date: r.measured_date,
  weightKg: r.weight_kg,
  chestCm: opt(r.chest_cm),
  waistCm: opt(r.waist_cm),
  armCm: opt(r.arm_cm),
  thighCm: opt(r.thigh_cm),
  bodyFatPercent: opt(r.body_fat_percent),
});

export const toPhoto = (r: Row): ProgressPhoto => ({
  id: r.id,
  memberId: r.member_id,
  date: r.photo_date,
  weightKg: r.weight_kg,
  // Served only through the authorised route; never a public file path
  photoUrl: `/api/photos/${r.id}`,
  notes: r.notes,
});

export const toSession = (r: Row): TrainingSession => ({
  id: r.id,
  memberId: r.member_id,
  memberName: r.member_name ?? '',
  coachId: r.coach_id,
  coachName: r.coach_name ?? '',
  date: r.session_date,
  time: r.session_time,
  durationMinutes: r.duration_minutes,
  status: r.status,
  notes: opt(r.notes),
  coachFeedback: opt(r.coach_feedback),
  rating: opt(r.rating),
  reviewComment: opt(r.review_comment),
});

export const toChat = (r: Row): ChatMessage => ({
  id: r.id,
  senderId: r.sender_id,
  senderName: r.sender_name,
  senderRole: r.sender_role,
  threadMemberId: r.thread_member_id,
  text: r.text,
  timestamp: r.created_at,
});

export const toSurvey = (r: Row): SatisfactionSurvey => ({
  id: r.id,
  memberId: r.member_id,
  memberName: r.member_name ?? '',
  date: r.survey_date,
  cleanliness: r.cleanliness,
  equipment: r.equipment,
  atmosphere: r.atmosphere,
  service: r.service,
  npsScore: r.nps_score,
  suggestions: r.suggestions,
  isComplaint: bool(r.is_complaint),
});

export const toTicket = (r: Row): FeedbackTicket => ({
  id: r.id,
  memberId: r.member_id ?? '',
  memberName: r.member_name,
  date: r.ticket_date,
  category: r.category,
  text: r.text,
  status: r.status,
  adminResponse: opt(r.admin_response),
  resolvedAt: opt(r.resolved_at),
});

export const toArticle = (r: Row): Article => ({
  id: r.id,
  title: r.title,
  category: r.category,
  readTimeMinutes: r.read_time_minutes,
  summary: r.summary,
  content: r.content,
  publishedDate: r.published_date,
  tags: json(r.tags, []),
});

export const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  content: r.content,
  type: r.type,
  targetRole: r.target_role,
  startDate: r.start_date,
  endDate: r.end_date,
  isPinned: bool(r.is_pinned),
  isPublished: bool(r.is_published),
  version: r.version,
});

export const toAudit = (r: Row): AuditLogItem => ({
  id: r.id,
  actorId: r.actor_id ?? 'sys',
  actorName: r.actor_name,
  actorRole: r.actor_role,
  action: r.action,
  details: r.details,
  timestamp: r.created_at,
});

export const toTestimonial = (r: Row): Testimonial => ({
  id: r.id,
  name: r.name,
  role: r.role,
  durationMember: r.duration_member,
  rating: r.rating,
  text: r.text,
  highlight: r.highlight,
  approvedForPublic: bool(r.approved_for_public),
  avatarUrl: opt(r.avatar_url),
});

export const toGroupClass = (r: Row, roster: string[], enrolledCount: number): GroupClass => ({
  id: r.id,
  name: r.name,
  category: r.category,
  day: ID_DAY_NAMES[r.day_of_week],
  dayOfWeek: r.day_of_week,
  time: `${r.start_time} - ${r.end_time}`,
  startTime: r.start_time,
  endTime: r.end_time,
  durationMinutes: r.duration_minutes ?? 0,
  coachId: r.coach_id,
  coachName: r.coach_name ?? '',
  room: r.room,
  maxCapacity: r.max_capacity,
  enrolledCount,
  enrolledMemberIds: roster,
  intensity: r.intensity,
  description: r.description,
  version: r.version,
});

export const toEquipment = (r: Row, openReports: number): GymEquipment => ({
  id: r.id,
  name: r.name,
  category: r.category,
  location: r.location,
  status: r.status,
  lastServiceDate: r.last_service_date ?? '',
  nextServiceDate: r.next_service_date ?? '',
  reportedIssuesCount: openReports,
});

export const toEquipmentReport = (r: Row): EquipmentReport => ({
  id: r.id,
  equipmentId: r.equipment_id,
  equipmentName: r.equipment_name ?? '',
  memberId: r.member_id ?? '',
  memberName: r.member_name,
  issueDescription: r.issue_description,
  date: r.report_date,
  status: r.status,
  adminNotes: opt(r.admin_notes),
});

export const toReward = (r: Row): ReferralReward => ({
  id: r.id,
  title: r.title,
  pointsRequired: r.points_required,
  description: r.description,
  category: r.category,
});
