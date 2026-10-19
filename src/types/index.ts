export type UserRole = 'PUBLIC' | 'MEMBER' | 'COACH' | 'ADMIN';

export type MembershipStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

export type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
export type PaymentProvider = 'CASH' | 'SIMULATOR' | 'MIDTRANS' | 'LEGACY';
export type PaymentSource = 'MEMBERSHIP' | 'PT_PACKAGE' | 'DAILY_PASS';
export type PaymentMethod = 'QRIS' | 'TRANSFER_BCA' | 'MANUAL_CASH';

export type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type AnnouncementType = 'INFO' | 'PENTING' | 'GYM_TUTUP' | 'PROMO';
export type AnnouncementTarget = 'ALL' | 'MEMBER' | 'COACH';

export type TicketStatus = 'BARU' | 'DIPROSES' | 'SELESAI';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface MemberProfile {
  userId: string;
  status: MembershipStatus;
  planId: string;
  planName: string;
  startDate: string;
  endDate: string;
  visitsThisMonth: number;
  workoutStreak: number;
  assignedCoachId?: string;
  healthNotes?: string;
  fitnessGoal: string;
  qrToken?: string;
  ptSessionsRemaining: number;
  /** Manual suspension by admin; overrides the date-derived status */
  suspended?: boolean;
  /** Optimistic-concurrency version; send it back when editing */
  version: number;
}

export interface CoachProfile {
  userId: string;
  fullName: string;
  title: string;
  specialties: string[];
  certifications: string[];
  experienceYears: number;
  /** Average of real session ratings; null until the coach has been rated */
  rating: number | null;
  reviewCount: number;
  bio: string;
  photoUrl: string;
  commissionRatePercent: number; // e.g. 40%
  pricePerSession: number;
  isPublicApproved: boolean;
  version: number;
}

export interface CoachAvailability {
  coachId: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  dayName: string;
  startTime: string; // "07:00"
  endTime: string;   // "21:00"
  isAvailable: boolean;
}

export interface TrainingSession {
  id: string;
  memberId: string;
  memberName: string;
  coachId: string;
  coachName: string;
  date: string; // YYYY-MM-DD
  time: string; // "10:00"
  durationMinutes: number;
  status: SessionStatus;
  notes?: string;
  coachFeedback?: string;
  rating?: number;
  reviewComment?: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  periodLabel: string;
  features: string[];
  isPopular?: boolean;
}

export interface PtPackage {
  id: string;
  name: string;
  sessionCount: number;
  price: number;
  pricePerSession: number;
  description: string;
  isPopular?: boolean;
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  amount: number;
  source: PaymentSource;
  packageName: string;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProvider;
  date: string; // ISO timestamp of the order
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
  notes?: string;
  /** Hosted payment page (payment gateway) for an unpaid digital order */
  checkoutUrl?: string;
  /** What a still-pending payment will activate once confirmed */
  planId?: string;
  ptPackageId?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'SALARY' | 'RENT' | 'ELECTRICITY' | 'EQUIPMENT_MAINTENANCE' | 'MARKETING' | 'OTHER';
  categoryLabel: string;
  date: string;
  notes?: string;
}

export interface CheckIn {
  id: string;
  memberId: string;
  memberName: string;
  timestamp: string;
  status: 'GRANTED' | 'DENIED';
  reason?: string;
  remainingDays?: number;
  method: 'QR' | 'MANUAL';
}

export interface Exercise {
  id: string;
  name: string;
  category: 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio';
  primaryMuscle: string;
  equipment: string;
  difficulty: 'Pemula' | 'Menengah' | 'Lanjutan';
  instructions: string[];
  formTips: string;
  commonMistakes: string;
}

export interface ProgramExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  targetRpe?: number;
  restSeconds: number;
  notes?: string;
}

export interface ProgramDay {
  dayNumber: number;
  dayName: string;
  focus: string;
  exercises: ProgramExercise[];
}

export interface WorkoutProgram {
  id: string;
  title: string;
  description: string;
  target: 'Hipertrofi' | 'Fat Loss' | 'Kekuatan' | 'Kebugaran Umum';
  level: 'Pemula' | 'Menengah' | 'Lanjutan';
  frequencyPerWeek: number;
  durationWeeks: number;
  isCoachAssigned?: boolean;
  assignedToMemberId?: string;
  createdByCoachId?: string;
  days: ProgramDay[];
}

export interface WorkoutSet {
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe?: number;
  isPr?: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
}

export interface WorkoutSessionLog {
  id: string;
  memberId: string;
  date: string;
  title: string;
  durationMinutes: number;
  moodRating: number; // 1-5
  notes: string;
  totalVolumeKg: number;
  exercises: LoggedExercise[];
  prAchieved: boolean;
  coachFeedback?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  indonesianName: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: 'Protein' | 'Karbohidrat' | 'Sayur & Buah' | 'Lemak Sehat' | 'Minuman';
}

export interface MealPlanItem {
  mealTime: 'Sarapan' | 'Makan Siang' | 'Snack Sore' | 'Makan Malam' | 'Pre/Post Workout';
  foodName: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlan {
  id: string;
  title: string;
  memberId: string;
  coachId: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  meals: MealPlanItem[];
  shoppingList: string[];
  hydrationTargetLiters: number;
  supplementsAdvice: string;
  disclaimer: string;
  dailyChecked: boolean[]; // 7 days of the week checked
}

export interface WeeklyCheckIn {
  id: string;
  memberId: string;
  date: string;
  weightKg: number;
  energyScore: number; // 1-5
  sleepHours: number;
  stressScore: number; // 1-5
  dietAdherencePercent: number; // 0-100
  notes: string;
  coachReply?: string;
}

export interface BodyMeasurement {
  id: string;
  memberId: string;
  date: string;
  weightKg: number;
  chestCm?: number;
  waistCm?: number;
  armCm?: number;
  thighCm?: number;
  bodyFatPercent?: number;
}

export interface ProgressPhoto {
  id: string;
  memberId: string;
  date: string;
  weightKg: number;
  photoUrl: string;
  notes: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  /** The member whose 1-on-1 coach thread this message belongs to */
  threadMemberId: string;
  text: string;
  timestamp: string;
}

export interface SatisfactionSurvey {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  cleanliness: number; // 1-5
  equipment: number;   // 1-5
  atmosphere: number;  // 1-5
  service: number;     // 1-5
  npsScore: number;    // 0-10
  suggestions: string;
  isComplaint: boolean;
}

export interface FeedbackTicket {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  category: 'Fasilitas' | 'Kebersihan' | 'Pelayanan' | 'Coach' | 'Lainnya';
  text: string;
  status: TicketStatus;
  adminResponse?: string;
  resolvedAt?: string;
}

export interface Article {
  id: string;
  title: string;
  category: 'Pemula' | 'Nutrisi' | 'Recovery' | 'Teknik' | 'Motivasi' | 'Etika Gym';
  readTimeMinutes: number;
  summary: string;
  content: string;
  publishedDate: string;
  tags: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  targetRole: AnnouncementTarget;
  startDate: string;
  endDate: string;
  isPinned: boolean;
  isPublished: boolean;
  version: number;
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  durationMember: string;
  rating: number;
  text: string;
  highlight: string;
  approvedForPublic: boolean;
  avatarUrl?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface GroupClass {
  id: string;
  name: string;
  category: 'Strength' | 'HIIT' | 'Pilates' | 'Mobility' | 'Powerlifting' | 'Agility';
  day: string; // 'Senin', 'Selasa', etc.
  dayOfWeek: number; // 0 = Minggu
  time: string; // '07:00 - 08:00'
  startTime: string;
  endTime: string;
  durationMinutes: number;
  coachId: string;
  coachName: string;
  room: string;
  maxCapacity: number;
  enrolledCount: number;
  /** Admins see the full roster; members only see themselves if enrolled */
  enrolledMemberIds: string[];
  intensity: 'Sedang' | 'Tinggi' | 'Intens';
  description: string;
  version: number;
}

export interface GymEquipment {
  id: string;
  name: string;
  category: 'Free Weights' | 'Cardio' | 'Machines' | 'Wellness & Recovery' | 'Functional';
  location: string;
  status: 'OPERATIONAL' | 'NEEDS_SERVICE' | 'UNDER_MAINTENANCE';
  lastServiceDate: string;
  nextServiceDate: string;
  reportedIssuesCount: number;
}

export interface EquipmentReport {
  id: string;
  equipmentId: string;
  equipmentName: string;
  memberId: string;
  memberName: string;
  issueDescription: string;
  date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
  adminNotes?: string;
}

export interface ReferralReward {
  id: string;
  title: string;
  pointsRequired: number;
  description: string;
  category: 'MEMBERSHIP' | 'COACHING' | 'MERCHANDISE';
}

export interface ToastNotification {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'error';
}


export interface PublicStats {
  activeMembers: number;
  /** Average of the four satisfaction scores (1-5) over real surveys; null without surveys */
  avgSatisfaction: number | null;
  surveyCount: number;
  /** Active clients per coach id */
  coachActiveClients: Record<string, number>;
}

export interface OccupancyInfo {
  count: number;
  capacity: number;
  /** Front-desk correction applied today (can be negative) */
  manualOffset: number;
  /** Average entries per hour over the last 28 days, or null when there is not enough data */
  hourlyProfile: { hour: string; avgEntries: number }[] | null;
  windowMinutes: number;
}

export interface ReferralInfo {
  code: string;
  points: number;
  claimedRewardIds: string[];
  /** Members who signed up with this code, and whether their bonus has been earned */
  referrals: { name: string; joinedAt: string; bonusEarned: boolean }[];
}

export interface ClientConfig {
  demoMode: boolean;
  paymentProvider: 'simulator' | 'midtrans';
  timeZone: string;
}

export interface CurrentUser extends User {
  mustChangePassword: boolean;
}

/** Everything the signed-in role is allowed to see, in one payload. */
export interface AppSnapshot {
  me: CurrentUser | null;
  config: ClientConfig;
  serverTime: string;
  users: User[];
  memberProfiles: Record<string, MemberProfile>;
  coachProfiles: Record<string, CoachProfile>;
  coachAvailability: Record<string, CoachAvailability[]>;
  membershipPlans: MembershipPlan[];
  ptPackages: PtPackage[];
  payments: Payment[];
  expenses: Expense[];
  checkIns: CheckIn[];
  exercises: Exercise[];
  workoutPrograms: WorkoutProgram[];
  workoutLogs: WorkoutSessionLog[];
  foodDatabase: FoodItem[];
  mealPlans: Record<string, MealPlan>;
  weeklyCheckIns: WeeklyCheckIn[];
  bodyMeasurements: BodyMeasurement[];
  progressPhotos: ProgressPhoto[];
  trainingSessions: TrainingSession[];
  satisfactionSurveys: SatisfactionSurvey[];
  feedbackTickets: FeedbackTicket[];
  testimonials: Testimonial[];
  articles: Article[];
  announcements: Announcement[];
  chatMessages: ChatMessage[];
  auditLogs: AuditLogItem[];
  groupClasses: GroupClass[];
  gymEquipment: GymEquipment[];
  equipmentReports: EquipmentReport[];
  referralRewards: ReferralReward[];
  referral: ReferralInfo | null;
  occupancy: OccupancyInfo;
  publicStats: PublicStats;
}
