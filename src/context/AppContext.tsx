import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSnapshot,
  CheckIn,
  CoachAvailability,
  CurrentUser,
  Expense,
  FeedbackTicket,
  GroupClass,
  MealPlan,
  SatisfactionSurvey,
  ToastNotification,
  TrainingSession,
  WeeklyCheckIn,
  WorkoutProgram,
  WorkoutSessionLog,
  Announcement,
  BodyMeasurement,
  EquipmentReport,
  GymEquipment,
} from '../types';
import { api, ApiError } from '../lib/api';
import { resolveImage } from '../lib/images';
import { type AppView, isPortalView, isValidTab, VIEW_ROLE } from '../config/navigation';

export type ActiveRole = 'PUBLIC' | 'MEMBER' | 'COACH' | 'ADMIN';

export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  /** Machine-readable error code from the API (e.g. STALE_VERSION) */
  code?: string;
}

type PayMethod = 'QRIS' | 'TRANSFER_BCA' | 'MANUAL_CASH';

export interface CheckInResult {
  success: boolean;
  message: string;
  checkIn?: CheckIn;
}

export interface MemberPatch {
  suspended?: boolean;
  assignedCoachId?: string | null;
  extendDays?: number;
  reason?: string;
  version?: number;
}

export type ClassInput = Pick<GroupClass, 'name' | 'category' | 'dayOfWeek' | 'startTime' | 'endTime' | 'coachId' | 'room' | 'maxCapacity' | 'intensity' | 'description'>;

const EMPTY_SNAPSHOT: AppSnapshot = {
  me: null,
  config: { demoMode: false, paymentProvider: 'simulator', timeZone: 'Asia/Jakarta' },
  serverTime: new Date(0).toISOString(),
  users: [],
  memberProfiles: {},
  coachProfiles: {},
  coachAvailability: {},
  membershipPlans: [],
  ptPackages: [],
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
  testimonials: [],
  articles: [],
  announcements: [],
  chatMessages: [],
  auditLogs: [],
  groupClasses: [],
  gymEquipment: [],
  equipmentReports: [],
  referralRewards: [],
  referral: null,
  occupancy: { count: 0, capacity: 100, manualOffset: 0, hourlyProfile: null, windowMinutes: 120 },
  publicStats: { activeMembers: 0, avgSatisfaction: null, surveyCount: 0, coachActiveClients: {} },
};

type SnapshotData = Omit<AppSnapshot, 'me'>;

interface AppContextType extends SnapshotData {
  /** Loading state of the server snapshot */
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  refresh: () => Promise<void>;

  // Auth
  currentUser: CurrentUser | null;
  currentRole: ActiveRole;
  login: (email: string, password: string) => Promise<ActionResult<{ role: ActiveRole; mustChangePassword: boolean }>>;
  register: (input: { name: string; email: string; phone: string; password: string; referralCode?: string }) => Promise<ActionResult<{ referrerName: string | null }>>;
  demoLogin: (userId: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<ActionResult>;
  requestPasswordReset: (email: string) => Promise<ActionResult>;

  // Navigation
  suggestedProgramId: string | null;
  setSuggestedProgramId: (id: string | null) => void;
  /** Plan / PT package chosen on the public site; consumed by the membership checkout */
  checkoutIntent: { type: 'plan' | 'pt'; id: string } | null;
  setCheckoutIntent: (intent: { type: 'plan' | 'pt'; id: string } | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  goToSection: (sectionId: string) => void;
  memberTab: string;
  setMemberTab: (tab: string) => void;
  coachTab: string;
  setCoachTab: (tab: string) => void;
  adminTab: string;
  setAdminTab: (tab: string) => void;

  // Derived convenience values
  liveGymOccupancy: number;
  memberReferralPoints: number;
  claimedRewardIds: string[];

  // Member actions
  createOrder: (kind: 'MEMBERSHIP' | 'PT_PACKAGE', itemId: string, method: PayMethod) => Promise<ActionResult<{ paymentId: string; invoiceNumber: string }>>;
  cancelOrder: (paymentId: string) => Promise<ActionResult>;
  refreshPaymentStatus: (paymentId: string) => Promise<ActionResult<{ status: string }>>;
  simulatePayment: (paymentId: string, outcome: 'SUCCESS' | 'FAILED') => Promise<ActionResult>;
  getQrToken: () => Promise<{ token: string; expiresAt: string; ttlSeconds: number }>;
  logWorkoutSession: (session: Omit<WorkoutSessionLog, 'id' | 'memberId' | 'totalVolumeKg' | 'prAchieved' | 'coachFeedback'>) => Promise<ActionResult<WorkoutSessionLog>>;
  savePersonalRecord: (exerciseName: string, weightKg: number, reps: number) => Promise<ActionResult<{ estimatedOneRepMax: number }>>;
  updateMealPlanChecked: (dayIndex: number, checked: boolean) => Promise<ActionResult>;
  updateDailyNutritionTargets: (calories: number, protein: number, carbs: number, fat: number) => Promise<ActionResult>;
  submitWeeklyCheckIn: (data: Omit<WeeklyCheckIn, 'id' | 'memberId' | 'date' | 'coachReply'>) => Promise<ActionResult>;
  addBodyMeasurement: (data: Omit<BodyMeasurement, 'id' | 'memberId'>) => Promise<ActionResult>;
  addProgressPhoto: (data: { dataUrl: string; notes: string; weightKg?: number }) => Promise<ActionResult>;
  deleteProgressPhoto: (photoId: string) => Promise<ActionResult>;
  bookTrainingSession: (input: { coachId: string; date: string; time: string; notes?: string }) => Promise<ActionResult>;
  cancelTrainingSession: (sessionId: string) => Promise<ActionResult<{ refunded: boolean }>>;
  submitSessionRating: (sessionId: string, rating: number, comment: string) => Promise<ActionResult>;
  submitSurvey: (data: Omit<SatisfactionSurvey, 'id' | 'memberId' | 'memberName' | 'date'>) => Promise<ActionResult>;
  submitComplaint: (category: FeedbackTicket['category'], text: string) => Promise<ActionResult>;
  sendChatMessage: (text: string, threadMemberId?: string) => Promise<ActionResult>;
  bookGroupClass: (classId: string) => Promise<ActionResult>;
  cancelGroupClass: (classId: string) => Promise<ActionResult>;
  reportEquipmentIssue: (equipmentId: string, issue: string) => Promise<ActionResult>;
  claimReferralReward: (rewardId: string) => Promise<ActionResult>;

  // Coach actions
  addCoachProgram: (program: Omit<WorkoutProgram, 'id' | 'isCoachAssigned' | 'createdByCoachId'>) => Promise<ActionResult>;
  assignProgram: (programId: string, memberId: string | null) => Promise<ActionResult>;
  addCoachCommentToWorkout: (sessionId: string, comment: string) => Promise<ActionResult>;
  updateMealPlan: (plan: MealPlan) => Promise<ActionResult>;
  replyWeeklyCheckIn: (checkInId: string, reply: string) => Promise<ActionResult>;
  setCoachAvailability: (availability: CoachAvailability[]) => Promise<ActionResult>;
  closeTrainingSession: (sessionId: string, status: Extract<TrainingSession['status'], 'COMPLETED' | 'NO_SHOW'>, feedback?: string) => Promise<ActionResult>;

  // Admin actions
  processCheckIn: (code: string) => Promise<CheckInResult>;
  setLiveGymOccupancy: (count: number) => Promise<ActionResult>;
  updateMember: (memberId: string, patch: MemberPatch) => Promise<ActionResult>;
  resetUserPassword: (userId: string) => Promise<ActionResult<{ temporaryPassword: string }>>;
  updateCoach: (coachId: string, patch: { commissionRatePercent?: number; isPublicApproved?: boolean; version?: number }) => Promise<ActionResult>;
  addExpense: (expense: Omit<Expense, 'id' | 'categoryLabel'>) => Promise<ActionResult>;
  deleteExpense: (expenseId: string) => Promise<ActionResult>;
  confirmManualPayment: (paymentId: string) => Promise<ActionResult>;
  refundPayment: (paymentId: string, reason: string) => Promise<ActionResult>;
  updateTicketStatus: (ticketId: string, status: FeedbackTicket['status'], adminResponse?: string) => Promise<ActionResult>;
  toggleTestimonialPublic: (id: string) => Promise<ActionResult>;
  addAnnouncement: (a: Omit<Announcement, 'id' | 'version'>) => Promise<ActionResult>;
  toggleAnnouncementPublish: (id: string) => Promise<ActionResult>;
  deleteAnnouncement: (id: string) => Promise<ActionResult>;
  addGroupClass: (data: ClassInput) => Promise<ActionResult>;
  updateGroupClass: (classId: string, data: ClassInput) => Promise<ActionResult>;
  deleteGroupClass: (classId: string) => Promise<ActionResult>;
  removeClassEnrollment: (classId: string, memberId: string) => Promise<ActionResult>;
  updateEquipmentStatus: (equipmentId: string, status: GymEquipment['status']) => Promise<ActionResult>;
  updateEquipmentReportStatus: (reportId: string, status: EquipmentReport['status'], notes?: string) => Promise<ActionResult>;

  // Local UI state
  justFinishedWorkout: WorkoutSessionLog | null;
  setJustFinishedWorkout: (log: WorkoutSessionLog | null) => void;
  isAudioTimerOpen: boolean;
  setIsAudioTimerOpen: (open: boolean) => void;
  toasts: ToastNotification[];
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** Hash routes: `#/` public, `#/member/<tab>`, `#/coach/<tab>`, `#/admin/<tab>` */
function parseHash(): { view: AppView; tab: string } {
  if (typeof window === 'undefined') return { view: 'public', tab: 'dashboard' };
  const [, view = '', tab = 'dashboard'] = window.location.hash.replace(/^#/, '').split('/');
  if (isPortalView(view)) return { view, tab: isValidTab(view, tab) ? tab : 'dashboard' };
  return { view: 'public', tab: 'dashboard' };
}

const buildHash = (view: string, tab: string) => (isPortalView(view) ? `#/${view}/${tab}` : '#/');

const POLL_MS = 30_000;

function withResolvedImages(s: AppSnapshot): AppSnapshot {
  return {
    ...s,
    me: s.me ? { ...s.me, avatarUrl: resolveImage(s.me.avatarUrl) } : null,
    users: s.users.map(u => ({ ...u, avatarUrl: resolveImage(u.avatarUrl) })),
    coachProfiles: Object.fromEntries(Object.entries(s.coachProfiles).map(([id, c]) => [id, { ...c, photoUrl: resolveImage(c.photoUrl) ?? '' }])),
    testimonials: s.testimonials.map(t => ({ ...t, avatarUrl: resolveImage(t.avatarUrl) })),
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const initialRoute = useMemo(() => parseHash(), []);
  const [activeView, setActiveViewState] = useState<string>(initialRoute.view);
  const [memberTab, setMemberTab] = useState<string>(initialRoute.view === 'member' ? initialRoute.tab : 'dashboard');
  const [coachTab, setCoachTab] = useState<string>(initialRoute.view === 'coach' ? initialRoute.tab : 'dashboard');
  const [adminTab, setAdminTab] = useState<string>(initialRoute.view === 'admin' ? initialRoute.tab : 'dashboard');
  const [suggestedProgramId, setSuggestedProgramId] = useState<string | null>(null);
  const [checkoutIntent, setCheckoutIntent] = useState<{ type: 'plan' | 'pt'; id: string } | null>(null);
  const [justFinishedWorkout, setJustFinishedWorkout] = useState<WorkoutSessionLog | null>(null);
  const [isAudioTimerOpen, setIsAudioTimerOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  /** Fetches the role-scoped snapshot; out-of-order responses are discarded. */
  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const next = await api<AppSnapshot>('GET', '/api/state');
      if (seq !== requestSeq.current) return;
      setSnapshot(withResolvedImages(next));
      setStatus('ready');
      setLoadError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data.');
      // Keep showing the last good data; only a failed first load blocks the app
      setStatus(prev => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep data fresh while the tab is visible (chat replies, check-ins, payment confirmations)
  const signedIn = !!snapshot.me;
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = window.setInterval(tick, signedIn ? POLL_MS : POLL_MS * 4);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh, signedIn]);

  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev.slice(-3), { id, message, type }]);
    window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'error' ? 6000 : 3800);
  }, []);

  const setActiveView = useCallback((view: string) => {
    setActiveViewState(view);
    window.scrollTo({ top: 0 });
  }, []);

  const goToSection = useCallback(
    (sectionId: string) => {
      const scroll = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (activeView !== 'public') {
        setActiveViewState('public');
        window.setTimeout(scroll, 200);
      } else {
        scroll();
      }
    },
    [activeView]
  );

  // Keep the URL hash in sync with navigation state (deep links, back/forward, refresh)
  const currentTab = activeView === 'member' ? memberTab : activeView === 'coach' ? coachTab : adminTab;
  useEffect(() => {
    const next = buildHash(activeView, currentTab);
    if (window.location.hash !== next && !(next === '#/' && window.location.hash === '')) {
      window.history.pushState(null, '', next);
    }
  }, [activeView, currentTab]);

  useEffect(() => {
    const onHashChange = () => {
      const { view, tab } = parseHash();
      setActiveViewState(view);
      if (view === 'member') setMemberTab(tab);
      if (view === 'coach') setCoachTab(tab);
      if (view === 'admin') setAdminTab(tab);
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  /** Runs an API call, reloads the snapshot and converts failures into a readable result. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, fallbackMessage = 'Berhasil disimpan.'): Promise<ActionResult<T>> => {
      try {
        const data = await fn();
        await refresh();
        const message = (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : fallbackMessage) as string;
        return { success: true, message, data };
      } catch (err) {
        if (err instanceof ApiError) {
          // Session gone or data changed elsewhere: resync so the UI reflects reality
          if (err.status === 401 || err.code === 'STALE_VERSION' || err.status === 409) void refresh();
          return { success: false, message: err.message, code: err.code };
        }
        return { success: false, message: 'Terjadi kesalahan tak terduga. Coba lagi.' };
      }
    },
    [refresh]
  );

  const goToPortalFor = useCallback(
    (role: ActiveRole) => {
      // Keep a deep link the user was trying to reach if their role allows it
      if (isPortalView(activeView) && VIEW_ROLE[activeView] === role) return;
      if (role === 'MEMBER') {
        setActiveView('member');
        setMemberTab('dashboard');
      } else if (role === 'COACH') {
        setActiveView('coach');
        setCoachTab('dashboard');
      } else if (role === 'ADMIN') {
        setActiveView('admin');
        setAdminTab('dashboard');
      }
    },
    [activeView, setActiveView]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await run(() => api<{ role: ActiveRole; mustChangePassword: boolean }>('POST', '/api/auth/login', { email, password }));
      if (res.success && res.data) goToPortalFor(res.data.role);
      return res;
    },
    [run, goToPortalFor]
  );

  const register = useCallback(
    async (input: { name: string; email: string; phone: string; password: string; referralCode?: string }) => {
      const res = await run(() => api<{ referrerName: string | null }>('POST', '/api/auth/register', input));
      if (res.success) {
        setActiveView('member');
        setMemberTab('membership');
      }
      return res;
    },
    [run, setActiveView]
  );

  const demoLogin = useCallback(
    async (userId: string) => {
      const res = await run(() => api<{ role: ActiveRole }>('POST', '/api/dev/login-as', { userId }));
      if (res.success && res.data) goToPortalFor(res.data.role);
      return res;
    },
    [run, goToPortalFor]
  );

  const logout = useCallback(async () => {
    try {
      await api('POST', '/api/auth/logout');
    } catch {
      /* the session is gone either way once we drop local state */
    }
    setJustFinishedWorkout(null);
    setCheckoutIntent(null);
    setActiveView('public');
    await refresh();
  }, [refresh, setActiveView]);

  const post = (path: string, body?: unknown) => () => api('POST', path, body ?? {});
  const put = (path: string, body: unknown) => () => api('PUT', path, body);
  const patch = (path: string, body: unknown) => () => api('PATCH', path, body);
  const del = (path: string) => () => api('DELETE', path);
  const enc = encodeURIComponent;
  const versionOfAnnouncement = (id: string) => snapshot.announcements.find(a => a.id === id)?.version;

  const value: AppContextType = {
    ...snapshot,
    status,
    loadError,
    refresh,
    currentUser: snapshot.me,
    currentRole: snapshot.me?.role ?? 'PUBLIC',
    login,
    register,
    demoLogin,
    logout,
    changePassword: (currentPassword, newPassword) => run(post('/api/auth/change-password', { currentPassword, newPassword }), 'Password berhasil diganti.'),
    requestPasswordReset: email => run(post('/api/auth/forgot', { email })),

    suggestedProgramId,
    setSuggestedProgramId,
    checkoutIntent,
    setCheckoutIntent,
    activeView,
    setActiveView,
    goToSection,
    memberTab,
    setMemberTab,
    coachTab,
    setCoachTab,
    adminTab,
    setAdminTab,

    liveGymOccupancy: snapshot.occupancy.count,
    memberReferralPoints: snapshot.referral?.points ?? 0,
    claimedRewardIds: snapshot.referral?.claimedRewardIds ?? [],

    createOrder: (kind, itemId, method) => run(() => api<{ paymentId: string; invoiceNumber: string }>('POST', '/api/payments/orders', { kind, itemId, method }), 'Pesanan dibuat.'),
    cancelOrder: id => run(post(`/api/payments/${enc(id)}/cancel`), 'Pesanan dibatalkan.'),
    refreshPaymentStatus: id => run(() => api<{ status: string }>('POST', `/api/payments/${enc(id)}/refresh`, {}), 'Status pembayaran diperbarui.'),
    simulatePayment: (id, outcome) => run(post(`/api/dev/payments/${enc(id)}/simulate`, { outcome }), outcome === 'SUCCESS' ? 'Simulasi: pembayaran berhasil.' : 'Simulasi: pembayaran gagal.'),
    getQrToken: () => api<{ token: string; expiresAt: string; ttlSeconds: number }>('POST', '/api/member/qr-token', {}),
    logWorkoutSession: async session => {
      const res = await run(() => api<{ id: string; totalVolumeKg: number }>('POST', '/api/member/workouts', session), 'Sesi latihan tersimpan.');
      if (!res.success || !res.data) return { success: false, message: res.message };
      const log: WorkoutSessionLog = {
        ...session,
        id: res.data.id,
        memberId: snapshot.me?.id ?? '',
        totalVolumeKg: res.data.totalVolumeKg,
        prAchieved: session.exercises.some(e => e.sets.some(s => s.isPr)),
      };
      setJustFinishedWorkout(log);
      return { success: true, message: res.message, data: log };
    },
    savePersonalRecord: (exerciseName, weightKg, reps) =>
      run(() => api<{ estimatedOneRepMax: number }>('POST', '/api/member/personal-records', { exerciseName, weightKg, reps }), 'Rekor pribadi tersimpan.'),
    updateMealPlanChecked: (day, checked) => run(put(`/api/member/meal-plan/checks/${day}`, { checked })),
    updateDailyNutritionTargets: (calories, protein, carbs, fat) => run(put('/api/member/nutrition-targets', { calories, protein, carbs, fat }), 'Target makro tersimpan.'),
    submitWeeklyCheckIn: data => run(post('/api/member/weekly-checkins', data), 'Check-in mingguan terkirim ke coach.'),
    addBodyMeasurement: data => run(post('/api/member/measurements', data), 'Ukuran tubuh tersimpan.'),
    addProgressPhoto: data => run(post('/api/member/photos', data), 'Foto progres tersimpan.'),
    deleteProgressPhoto: id => run(del(`/api/member/photos/${enc(id)}`), 'Foto dihapus.'),
    bookTrainingSession: input => run(post('/api/member/pt-sessions', input), 'Sesi PT berhasil dijadwalkan.'),
    cancelTrainingSession: id => run(() => api<{ refunded: boolean; message: string }>('POST', `/api/pt-sessions/${enc(id)}/cancel`, {})),
    submitSessionRating: (id, rating, comment) => run(post(`/api/member/pt-sessions/${enc(id)}/rating`, { rating, comment }), 'Terima kasih atas penilaian Anda.'),
    submitSurvey: data => run(post('/api/member/surveys', data), 'Survei terkirim. Terima kasih atas masukan Anda!'),
    submitComplaint: (category, text) => run(post('/api/member/tickets', { category, text }), 'Keluhan terkirim. Tim kami akan menindaklanjuti.'),
    sendChatMessage: (text, threadMemberId) => run(post('/api/chat/messages', { text, ...(threadMemberId ? { threadMemberId } : {}) }), 'Pesan terkirim.'),
    bookGroupClass: id => run(post(`/api/member/classes/${enc(id)}/enrollment`)),
    cancelGroupClass: id => run(del(`/api/member/classes/${enc(id)}/enrollment`)),
    reportEquipmentIssue: (equipmentId, issue) => run(post('/api/member/equipment-reports', { equipmentId, issue }), 'Laporan terkirim ke tim teknisi.'),
    claimReferralReward: id => run(post(`/api/member/rewards/${enc(id)}/claim`)),

    addCoachProgram: program => run(post('/api/coach/programs', program), 'Program tersimpan.'),
    assignProgram: (id, memberId) => run(post(`/api/coach/programs/${enc(id)}/assign`, { memberId }), memberId ? 'Program ditugaskan ke klien.' : 'Program dijadikan template umum.'),
    addCoachCommentToWorkout: (id, comment) => run(post(`/api/coach/workouts/${enc(id)}/feedback`, { comment }), 'Komentar terkirim ke klien.'),
    updateMealPlan: plan =>
      run(
        put(`/api/coach/meal-plans/${enc(plan.memberId)}`, {
          title: plan.title,
          targetCalories: Math.round(plan.targetCalories),
          targetProtein: Math.round(plan.targetProtein),
          targetCarbs: Math.round(plan.targetCarbs),
          targetFat: Math.round(plan.targetFat),
          meals: plan.meals,
          shoppingList: plan.shoppingList,
          hydrationTargetLiters: plan.hydrationTargetLiters,
          supplementsAdvice: plan.supplementsAdvice,
          disclaimer: plan.disclaimer,
        }),
        'Meal plan tersimpan.'
      ),
    replyWeeklyCheckIn: (id, reply) => run(post(`/api/coach/weekly-checkins/${enc(id)}/reply`, { reply }), 'Balasan terkirim.'),
    setCoachAvailability: availability =>
      run(
        put('/api/coach/availability', {
          days: availability.map(a => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime, isAvailable: a.isAvailable })),
        }),
        'Jam ketersediaan tersimpan.'
      ),
    closeTrainingSession: (id, sessionStatus, feedback) => run(post(`/api/coach/pt-sessions/${enc(id)}/close`, { status: sessionStatus, feedback }), 'Status sesi diperbarui.'),

    processCheckIn: async code => {
      try {
        const res = await api<CheckInResult>('POST', '/api/admin/check-ins', { code });
        void refresh();
        return res;
      } catch (err) {
        return { success: false, message: err instanceof ApiError ? err.message : 'Gagal memproses check-in.' };
      }
    },
    setLiveGymOccupancy: count => run(put('/api/admin/occupancy', { count }), 'Kepadatan diperbarui.'),
    updateMember: (memberId, p) => run(patch(`/api/admin/members/${enc(memberId)}`, p)),
    resetUserPassword: userId => run(() => api<{ temporaryPassword: string }>('POST', `/api/admin/users/${enc(userId)}/reset-password`, {}), 'Password sementara dibuat.'),
    updateCoach: (coachId, p) => run(patch(`/api/admin/coaches/${enc(coachId)}`, p), 'Profil coach diperbarui.'),
    addExpense: e => run(post('/api/admin/expenses', { title: e.title, amount: e.amount, category: e.category, date: e.date, notes: e.notes || undefined }), 'Pengeluaran dicatat.'),
    deleteExpense: id => run(del(`/api/admin/expenses/${enc(id)}`), 'Pengeluaran dihapus.'),
    confirmManualPayment: id => run(post(`/api/admin/payments/${enc(id)}/confirm-cash`)),
    refundPayment: (id, reason) => run(post(`/api/admin/payments/${enc(id)}/refund`, { reason })),
    updateTicketStatus: (id, ticketStatus, adminResponse) => run(patch(`/api/admin/tickets/${enc(id)}`, { status: ticketStatus, adminResponse }), 'Tiket diperbarui.'),
    toggleTestimonialPublic: id => run(post(`/api/admin/testimonials/${enc(id)}/toggle`), 'Visibilitas testimoni diperbarui.'),
    addAnnouncement: a => run(post('/api/admin/announcements', a), 'Pengumuman dibuat.'),
    toggleAnnouncementPublish: id => run(post(`/api/admin/announcements/${enc(id)}/toggle-publish`, { version: versionOfAnnouncement(id) }), 'Status pengumuman diperbarui.'),
    deleteAnnouncement: id => run(del(`/api/admin/announcements/${enc(id)}`), 'Pengumuman dihapus.'),
    addGroupClass: data => run(post('/api/admin/classes', data), 'Kelas baru ditambahkan.'),
    updateGroupClass: (id, data) => run(put(`/api/admin/classes/${enc(id)}`, { ...data, version: snapshot.groupClasses.find(c => c.id === id)?.version }), 'Kelas diperbarui.'),
    deleteGroupClass: id => run(del(`/api/admin/classes/${enc(id)}`)),
    removeClassEnrollment: (classId, memberId) => run(del(`/api/admin/classes/${enc(classId)}/enrollments/${enc(memberId)}`), 'Reservasi peserta dibatalkan.'),
    updateEquipmentStatus: (id, s) => run(patch(`/api/admin/equipment/${enc(id)}`, { status: s }), 'Status alat diperbarui.'),
    updateEquipmentReportStatus: (id, s, notes) => run(patch(`/api/admin/equipment-reports/${enc(id)}`, { status: s, adminNotes: notes }), 'Laporan diperbarui.'),

    justFinishedWorkout,
    setJustFinishedWorkout,
    isAudioTimerOpen,
    setIsAudioTimerOpen,
    toasts,
    showToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
