import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isAnnouncementVisible } from '../../lib/announcements';

export const AnnouncementBanner: React.FC = () => {
  const { announcements, currentRole } = useApp();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Priority announcements only, restricted to the viewer's role and the announcement's date range
  const activeImportant = announcements.filter(
    a =>
      isAnnouncementVisible(a, currentRole) &&
      !dismissedIds.includes(a.id) &&
      (a.type === 'GYM_TUTUP' || a.isPinned || a.type === 'PENTING')
  );

  const current = activeImportant[0];
  const isGymClosed = current?.type === 'GYM_TUTUP';

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className={`relative z-40 px-4 border-b overflow-hidden ${
            isGymClosed ? 'bg-amber-950/70 border-amber-500/30 text-amber-100' : 'bg-surface-2 border-line text-zinc-200'
          }`}
        >
          <div className="max-w-7xl mx-auto py-2.5 flex items-center justify-between gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              {isGymClosed ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Bell className="w-4 h-4 text-zinc-300 shrink-0" />
              )}
              <span className="hidden sm:inline shrink-0 font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-black/30">
                {isGymClosed ? 'Operasional' : 'Penting'}
              </span>
              <span className="truncate font-medium">{current.title}</span>
              <span className="hidden xl:inline truncate text-zinc-400 text-xs">· {current.content}</span>
            </div>
            <button
              onClick={() => setDismissedIds(prev => [...prev, current.id])}
              aria-label="Tutup banner pengumuman"
              className="shrink-0 p-1.5 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
