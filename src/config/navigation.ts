import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  QrCode,
  CreditCard,
  Dumbbell,
  Apple,
  Calendar,
  Scale,
  BookOpen,
  Heart,
  Library,
  Ticket,
  Calculator,
  Wrench,
  Gift,
  Users,
  UserCheck,
  Bell,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

export type AppView = 'public' | 'member' | 'coach' | 'admin';
export type PortalView = Exclude<AppView, 'public'>;

export interface NavItem {
  id: string;
  label: string;
  /** Short label for the mobile bottom bar */
  short: string;
  icon: LucideIcon;
  badge?: string;
  /** Shown in the mobile bottom bar; the rest live under "Menu" */
  primary?: boolean;
}

export const MEMBER_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', short: 'Beranda', icon: LayoutDashboard, primary: true },
  { id: 'qr', label: 'QR Masuk Gym', short: 'QR', icon: QrCode, badge: 'Akses', primary: true },
  { id: 'workout-log', label: 'Catat Latihan & PR', short: 'Latihan', icon: Dumbbell, primary: true },
  { id: 'classes', label: 'Booking Kelas Studio', short: 'Kelas', icon: Ticket },
  { id: 'program', label: 'Program & Nutrisi', short: 'Program', icon: Apple, primary: true },
  { id: 'coaching', label: 'Coach & Booking PT', short: 'Coach', icon: Calendar },
  { id: 'tools', label: 'Kalkulator 1RM & Gizi', short: 'Kalkulator', icon: Calculator },
  { id: 'body-progress', label: 'Progres & Ukuran Tubuh', short: 'Progres', icon: Scale },
  { id: 'membership', label: 'Membership & Tagihan', short: 'Membership', icon: CreditCard },
  { id: 'referral', label: 'Referral & Hadiah Poin', short: 'Referral', icon: Gift },
  { id: 'equipment', label: 'Status Alat & Fasilitas', short: 'Alat', icon: Wrench },
  { id: 'exercises', label: 'Pustaka Latihan', short: 'Pustaka', icon: Library },
  { id: 'articles', label: 'Tips & Edukasi', short: 'Edukasi', icon: BookOpen },
  { id: 'satisfaction', label: 'Penilaian & Saran', short: 'Saran', icon: Heart },
];

export const COACH_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard Coach', short: 'Dashboard', icon: LayoutDashboard, primary: true },
  { id: 'clients', label: 'Manajemen Klien', short: 'Klien', icon: Users, primary: true },
  { id: 'schedule', label: 'Jadwal & Ketersediaan', short: 'Jadwal', icon: Calendar, primary: true },
  { id: 'builder', label: 'Program Builder', short: 'Builder', icon: Dumbbell, primary: true },
  { id: 'nutrition', label: 'Nutrisi & Meal Planner', short: 'Nutrisi', icon: Apple },
];

export const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Ikhtisar Utama', short: 'Ikhtisar', icon: LayoutDashboard, primary: true },
  { id: 'checkin', label: 'Scanner QR Masuk', short: 'Scan QR', icon: QrCode, badge: 'Gerbang', primary: true },
  { id: 'classes', label: 'Jadwal Kelas Studio', short: 'Kelas', icon: Calendar },
  { id: 'equipment', label: 'Pemeliharaan Alat Gym', short: 'Alat', icon: Wrench },
  { id: 'keuangan', label: 'Keuangan & Laba', short: 'Keuangan', icon: Wallet, primary: true },
  { id: 'kepuasan', label: 'Kepuasan & Keluhan', short: 'Kepuasan', icon: Heart },
  { id: 'members', label: 'Manajemen Member', short: 'Member', icon: Users, primary: true },
  { id: 'coaches', label: 'Manajemen Coach', short: 'Coach', icon: UserCheck },
  { id: 'announcements', label: 'Pengumuman & Banner', short: 'Info', icon: Bell },
  { id: 'audit', label: 'Audit Log Sistem', short: 'Audit', icon: ShieldAlert },
];

export const PORTAL_NAV: Record<PortalView, NavItem[]> = {
  member: MEMBER_NAV,
  coach: COACH_NAV,
  admin: ADMIN_NAV,
};

/** Which user role may open each portal view. */
export const VIEW_ROLE: Record<PortalView, 'MEMBER' | 'COACH' | 'ADMIN'> = {
  member: 'MEMBER',
  coach: 'COACH',
  admin: 'ADMIN',
};

export const isPortalView = (v: string): v is PortalView => v === 'member' || v === 'coach' || v === 'admin';

export const isValidTab = (view: PortalView, tab: string) => PORTAL_NAV[view].some(i => i.id === tab);
