import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import type { NavItem } from '../../config/navigation';

interface PortalShellProps {
  /** Unique key per portal so animated indicators don't cross-animate */
  id: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  /** Identity card rendered at the top of the sidebar */
  header: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared chrome for the Member / Coach / Admin portals:
 * desktop sidebar + mobile bottom bar with a "Menu" sheet for the full navigation.
 */
export const PortalShell: React.FC<PortalShellProps> = ({
  id,
  navItems,
  activeTab,
  onTabChange,
  header,
  children,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeItem = navItems.find(i => i.id === activeTab) ?? navItems[0];
  const primary = navItems.filter(i => i.primary);
  const activeIsSecondary = !primary.some(i => i.id === activeItem.id);

  // Close the sheet on Escape and lock background scroll while it is open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const go = (tab: string) => {
    onTabChange(tab);
    setMenuOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-28 md:pb-12">
      <div className="flex flex-col md:flex-row gap-6 lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-24 space-y-5">
            {header}
            <nav aria-label="Navigasi portal" className="space-y-0.5">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeItem.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`group w-full relative flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive ? 'text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={`${id}-sidebar-active`}
                        className="absolute inset-0 rounded-lg bg-surface-2 border border-line-strong"
                        transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                      />
                    )}
                    {isActive && (
                      <motion.span
                        layoutId={`${id}-sidebar-bar`}
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-brand"
                        transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-3 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="relative z-10 shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-line-strong text-zinc-300">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile: current section label */}
        <div className="md:hidden flex items-center gap-2.5 -mb-2">
          <activeItem.icon className="w-4 h-4 text-brand" />
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{activeItem.label}</span>
        </div>

        <main id="main-content" className="flex-1 min-w-0" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Navigasi utama"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink/95 backdrop-blur-lg border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex items-stretch justify-around px-1 pt-1">
          {primary.map(item => {
            const Icon = item.icon;
            const isActive = activeItem.id === item.id;
            return (
              <li key={item.id} className="flex-1">
                <button
                  onClick={() => go(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-lg transition-colors ${
                    isActive ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-tight">{item.short}</span>
                  <span className={`h-[2px] w-5 rounded-full transition-colors ${isActive ? 'bg-brand' : 'bg-transparent'}`} />
                </button>
              </li>
            );
          })}
          {navItems.length > primary.length && (
            <li className="flex-1">
              <button
                onClick={() => setMenuOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                className={`w-full flex flex-col items-center justify-center gap-0.5 min-h-[52px] rounded-lg transition-colors ${
                  activeIsSecondary ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
                }`}
              >
                <Menu className="w-5 h-5" />
                <span className="text-[10px] font-semibold tracking-tight">Menu</span>
                <span className={`h-[2px] w-5 rounded-full ${activeIsSecondary ? 'bg-brand' : 'bg-transparent'}`} />
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Mobile menu sheet */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="md:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Semua menu"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="md:hidden fixed bottom-0 inset-x-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface border-t border-line-strong p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Semua Menu</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeItem.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-white text-black border-white'
                          : 'bg-surface-2 border-line text-zinc-300 hover:border-line-strong'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
