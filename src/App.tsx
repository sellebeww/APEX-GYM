import React, { Suspense, lazy, useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AnnouncementBanner } from './components/common/AnnouncementBanner';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { RoleGate } from './components/common/RoleGate';
import { AuthModal } from './components/common/AuthModal';
import { DemoSwitcherModal } from './components/common/DemoSwitcherModal';
import { CommandPalette } from './components/common/CommandPalette';
import { PublicCompanyProfile } from './components/public/PublicCompanyProfile';
import { WorkoutAudioTimer } from './components/common/WorkoutAudioTimer';
import { ToastContainer } from './components/common/ToastContainer';
import { ChangePasswordModal } from './components/common/ChangePasswordModal';
import { BrandLogo } from './components/common/BrandLogo';
import { motion, AnimatePresence } from 'motion/react';

// Each portal is a separate chunk: visitors never download admin/coach code
const MemberLayout = lazy(() => import('./components/member/MemberLayout').then(m => ({ default: m.MemberLayout })));
const CoachLayout = lazy(() => import('./components/coach/CoachLayout').then(m => ({ default: m.CoachLayout })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));

const PortalFallback: React.FC = () => (
  <div role="status" aria-live="polite" className="flex items-center justify-center py-32 text-xs text-zinc-500">
    <span className="w-4 h-4 mr-3 rounded-full border-2 border-zinc-700 border-t-white animate-spin" aria-hidden />
    Memuat…
  </div>
);

/** First load of the server snapshot: a branded loader, or a retry screen if the API is unreachable. */
const BootScreen: React.FC<{ error: string | null; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="min-h-screen bg-ink text-white flex flex-col items-center justify-center gap-6 px-6 text-center">
    <BrandLogo variant="vertical" size="md" />
    {error ? (
      <div role="alert" className="max-w-sm space-y-4">
        <p className="text-sm text-zinc-300">{error}</p>
        <button onClick={onRetry} className="px-6 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors">
          Coba lagi
        </button>
      </div>
    ) : (
      <p role="status" aria-live="polite" className="flex items-center text-xs text-zinc-500">
        <span className="w-4 h-4 mr-3 rounded-full border-2 border-zinc-700 border-t-white animate-spin" aria-hidden />
        Memuat APEX Gym…
      </p>
    )}
  </div>
);

const MainAppContent: React.FC = () => {
  const { activeView, setActiveView, setMemberTab, isAudioTimerOpen, setIsAudioTimerOpen, status, loadError, refresh, currentUser } = useApp();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reflect the current area in the browser tab title
  useEffect(() => {
    const titles: Record<string, string> = {
      public: 'APEX Gym | Pusat Kebugaran & Performa, Jakarta',
      member: 'Area Member | APEX Gym',
      coach: 'Panel Coach | APEX Gym',
      admin: 'Panel Admin | APEX Gym',
    };
    document.title = titles[activeView] ?? titles.public;
  }, [activeView]);

  if (status !== 'ready') return <BootScreen error={status === 'error' ? loadError : null} onRetry={() => void refresh()} />;

  const handleOpenAuth = (mode: 'login' | 'register' = 'login') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  };

  const handleSelectPlanFromPublic = (_planId: string) => {
    setActiveView('member');
    setMemberTab('membership');
  };

  return (
    <div className="min-h-screen flex flex-col bg-ink text-white selection:bg-brand selection:text-black">
      {/* 1. Global Announcement Banner (Gym Tutup / Maintenance) */}
      <AnnouncementBanner />

      {/* 2. Top Header with Strict 3-Zone Contract */}
      <Header
        onOpenAuth={handleOpenAuth}
        onOpenQuickSwitcher={() => setIsSwitcherOpen(true)}
        onOpenCommandPalette={() => setIsCmdOpen(true)}
        onOpenChangePassword={() => setIsPasswordOpen(true)}
      />

      {/* 3. Main Views with Smooth Page Transition */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeView === 'public' && (
            <motion.div
              key="view-public"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <PublicCompanyProfile
                onOpenAuth={handleOpenAuth}
                onSelectPlan={handleSelectPlanFromPublic}
              />
            </motion.div>
          )}

          {activeView === 'member' && (
            <motion.div
              key="view-member"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <RoleGate view="member" onOpenAuth={handleOpenAuth} onOpenQuickSwitcher={() => setIsSwitcherOpen(true)}>
                <Suspense fallback={<PortalFallback />}>
                  <MemberLayout />
                </Suspense>
              </RoleGate>
            </motion.div>
          )}

          {activeView === 'coach' && (
            <motion.div
              key="view-coach"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <RoleGate view="coach" onOpenAuth={handleOpenAuth} onOpenQuickSwitcher={() => setIsSwitcherOpen(true)}>
                <Suspense fallback={<PortalFallback />}>
                  <CoachLayout />
                </Suspense>
              </RoleGate>
            </motion.div>
          )}

          {activeView === 'admin' && (
            <motion.div
              key="view-admin"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <RoleGate view="admin" onOpenAuth={handleOpenAuth} onOpenQuickSwitcher={() => setIsSwitcherOpen(true)}>
                <Suspense fallback={<PortalFallback />}>
                  <AdminLayout />
                </Suspense>
              </RoleGate>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Footer */}
      <Footer />

      {/* 6. Modals & Overlays */}
      <WorkoutAudioTimer
        isOpen={isAudioTimerOpen}
        onClose={() => setIsAudioTimerOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        initialMode={authMode}
        onClose={() => setIsAuthOpen(false)}
      />

      <DemoSwitcherModal
        isOpen={isSwitcherOpen}
        onClose={() => setIsSwitcherOpen(false)}
      />

      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onOpenAuth={handleOpenAuth}
        onOpenQuickSwitcher={() => setIsSwitcherOpen(true)}
      />

      <ChangePasswordModal
        isOpen={isPasswordOpen || !!currentUser?.mustChangePassword}
        forced={!!currentUser?.mustChangePassword}
        onClose={() => setIsPasswordOpen(false)}
      />

      {/* Global In-App Toasts */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
