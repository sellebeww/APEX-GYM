import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  QrCode,
  Shield,
  Dumbbell,
  UserCheck,
  ChevronDown,
  LogOut,
  Timer,
  Ticket,
  Calculator,
  Wrench,
  Search,
  Menu,
  X,
  Globe,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenQuickSwitcher: () => void;
  onOpenCommandPalette: () => void;
  onOpenChangePassword: () => void;
}

const NAV_LINKS = [
  { id: 'paket', label: 'Membership' },
  { id: 'coaches', label: 'Personal Trainer' },
  { id: 'fasilitas', label: 'Fasilitas' },
  { id: 'jadwal', label: 'Jadwal Kelas' },
  { id: 'kontak', label: 'Lokasi & Jam' },
];

export const Header: React.FC<HeaderProps> = ({ onOpenAuth, onOpenQuickSwitcher, onOpenCommandPalette, onOpenChangePassword }) => {
  const {
    currentUser,
    setActiveView,
    setMemberTab,
    setCoachTab,
    setAdminTab,
    goToSection,
    logout,
    liveGymOccupancy,
    setIsAudioTimerOpen,
    config,
  } = useApp();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the user dropdown on outside click / Escape
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsDropdownOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isDropdownOpen]);

  // Lock scroll + close on Escape while the mobile menu is open
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  const menuItem = (Icon: LucideIcon, label: string, action: () => void) => (
    <button
      key={label}
      role="menuitem"
      onClick={() => {
        action();
        setIsDropdownOpen(false);
      }}
      className="w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-2.5 text-zinc-300 hover:text-white transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      {label}
    </button>
  );

  const iconBtn =
    'items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-line bg-surface text-zinc-300 hover:text-white hover:border-line-strong transition-colors text-xs font-semibold';

  return (
    <>
    <header className="sticky top-0 z-50 bg-ink/85 backdrop-blur-xl border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Brand */}
        <button
          onClick={() => setActiveView('public')}
          className="shrink-0 text-left rounded-md"
          aria-label="APEX Gym, kembali ke beranda"
        >
          <BrandLogo variant="horizontal" size="md" />
        </button>

        {/* Primary public navigation */}
        <nav aria-label="Navigasi situs" className="hidden xl:flex items-center gap-1 text-sm font-medium">
          {NAV_LINKS.map(link => (
            <button
              key={link.id}
              onClick={() => goToSection(link.id)}
              className="px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => goToSection('fasilitas')}
            title="Perkiraan jumlah member di gym (check-in 2 jam terakhir + koreksi resepsionis)"
            className={`${iconBtn} hidden 2xl:inline-flex`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="font-mono">{liveGymOccupancy}</span>
            <span className="text-zinc-500 font-medium">di gym</span>
          </button>

          <button
            onClick={onOpenCommandPalette}
            aria-label="Buka pencarian cepat (Ctrl+K)"
            title="Pencarian cepat (Ctrl+K)"
            className={`${iconBtn} hidden sm:inline-flex`}
          >
            <Search className="w-3.5 h-3.5" />
            <kbd className="hidden 2xl:inline font-mono text-[10px] text-zinc-500">⌘K</kbd>
          </button>

          <button
            onClick={() => setIsAudioTimerOpen(true)}
            aria-label="Buka timer latihan"
            title="Timer latihan (Tabata, EMOM, Rest)"
            className={`${iconBtn} hidden sm:inline-flex`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Timer</span>
          </button>

          {config.demoMode && (
            <button
              onClick={onOpenQuickSwitcher}
              title="Ganti peran akun demo (hanya mode development)"
              className={`${iconBtn} hidden sm:inline-flex`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">Akun Demo</span>
            </button>
          )}

          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(prev => !prev)}
                aria-haspopup="menu"
                aria-expanded={isDropdownOpen}
                className="flex items-center gap-2 h-9 pl-1.5 pr-2 sm:pr-2.5 rounded-lg bg-surface border border-line hover:border-line-strong transition-colors text-sm font-medium"
              >
                <span className="w-6 h-6 rounded-full bg-brand text-black font-bold flex items-center justify-center text-xs">
                  {currentUser.name.charAt(0)}
                </span>
                <span className="hidden xl:inline text-zinc-200 truncate max-w-[170px]" title={currentUser.name}>{currentUser.name}</span>
                <span className="hidden sm:inline text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                  {currentUser.role}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    className="absolute right-0 mt-2 w-60 rounded-xl bg-surface border border-line-strong shadow-2xl shadow-black/60 py-1.5 z-50 text-xs"
                  >
                    <div className="px-4 py-2.5 border-b border-line mb-1">
                      <p className="font-semibold text-white truncate">{currentUser.name}</p>
                      <p className="text-zinc-500 text-[11px] truncate">{currentUser.email}</p>
                    </div>

                    {currentUser.role === 'MEMBER' && (
                      <>
                        {menuItem(Dumbbell, 'Area Member', () => {
                          setActiveView('member');
                          setMemberTab('dashboard');
                        })}
                        {menuItem(QrCode, 'QR Masuk Gym', () => {
                          setActiveView('member');
                          setMemberTab('qr');
                        })}
                        {menuItem(Ticket, 'Booking Kelas Studio', () => {
                          setActiveView('member');
                          setMemberTab('classes');
                        })}
                        {menuItem(Calculator, 'Kalkulator 1RM & Gizi', () => {
                          setActiveView('member');
                          setMemberTab('tools');
                        })}
                      </>
                    )}

                    {currentUser.role === 'COACH' &&
                      menuItem(UserCheck, 'Panel Coach', () => {
                        setActiveView('coach');
                        setCoachTab('dashboard');
                      })}

                    {currentUser.role === 'ADMIN' && (
                      <>
                        {menuItem(Shield, 'Panel Admin', () => {
                          setActiveView('admin');
                          setAdminTab('dashboard');
                        })}
                        {menuItem(Ticket, 'Jadwal Kelas Studio', () => {
                          setActiveView('admin');
                          setAdminTab('classes');
                        })}
                        {menuItem(Wrench, 'Pemeliharaan Alat', () => {
                          setActiveView('admin');
                          setAdminTab('equipment');
                        })}
                      </>
                    )}

                    {menuItem(Globe, 'Lihat Company Profile', () => setActiveView('public'))}
                    {menuItem(KeyRound, 'Ganti password', onOpenChangePassword)}

                    <div className="border-t border-line mt-1 pt-1">
                      <button
                        role="menuitem"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          void logout();
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-rose-950/30 text-rose-400 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Keluar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="h-9 px-3.5 sm:px-4 text-xs font-bold text-black bg-brand hover:bg-brand-hover rounded-lg transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">Masuk</span>
              <span className="hidden sm:inline">Masuk / Gabung</span>
            </button>
          )}

          <button
            onClick={() => setIsMobileOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={isMobileOpen}
            className={`${iconBtn} inline-flex xl:hidden`}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>

      {/* Mobile / tablet menu (outside <header>: backdrop-filter would trap fixed positioning) */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="xl:hidden fixed inset-0 top-0 z-[60] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="xl:hidden fixed top-0 right-0 bottom-0 z-[70] w-[min(20rem,88vw)] bg-surface border-l border-line-strong p-5 flex flex-col gap-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <BrandLogo variant="horizontal" size="sm" />
                <button
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Tutup menu"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav aria-label="Navigasi situs" className="flex flex-col">
                {NAV_LINKS.map(link => (
                  <button
                    key={link.id}
                    onClick={() => {
                      setIsMobileOpen(false);
                      goToSection(link.id);
                    }}
                    className="text-left py-3 border-b border-line text-sm font-semibold text-zinc-200 hover:text-white"
                  >
                    {link.label}
                  </button>
                ))}
              </nav>

              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    onOpenCommandPalette();
                  }}
                  className={`${iconBtn} flex justify-start h-11`}
                >
                  <Search className="w-4 h-4" /> Pencarian cepat
                </button>
                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    setIsAudioTimerOpen(true);
                  }}
                  className={`${iconBtn} flex justify-start h-11`}
                >
                  <Timer className="w-4 h-4" /> Timer latihan
                </button>
                {config.demoMode && (
                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      onOpenQuickSwitcher();
                    }}
                    className={`${iconBtn} flex justify-start h-11`}
                  >
                    <UserCheck className="w-4 h-4" /> Pilih akun demo
                  </button>
                )}
                {currentUser && (
                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      void logout();
                    }}
                    className={`${iconBtn} flex justify-start h-11 text-rose-300`}
                  >
                    <LogOut className="w-4 h-4" /> Keluar
                  </button>
                )}
                {!currentUser && (
                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      onOpenAuth('login');
                    }}
                    className="h-11 rounded-lg bg-brand text-black text-sm font-bold"
                  >
                    Masuk / Gabung
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
