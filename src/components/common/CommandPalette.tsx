import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Globe, Timer, UserCheck, LogIn, type LucideIcon } from 'lucide-react';
import { Modal } from './Modal';
import { ADMIN_NAV, COACH_NAV, MEMBER_NAV, type PortalView } from '../../config/navigation';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
  onOpenQuickSwitcher?: () => void;
}

interface Command {
  id: string;
  title: string;
  category: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

const PUBLIC_SECTIONS = [
  { id: 'paket', title: 'Paket membership & harga' },
  { id: 'coaches', title: 'Personal trainer' },
  { id: 'fasilitas', title: 'Fasilitas & kepadatan gym' },
  { id: 'jadwal', title: 'Jadwal kelas mingguan' },
  { id: 'kontak', title: 'Lokasi, jam buka & kontak' },
];

/**
 * Ctrl/Cmd+K quick navigation. Only offers destinations the signed-in role can actually open;
 * it never switches accounts on the user's behalf.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenAuth, onOpenQuickSwitcher }) => {
  const { currentUser, setActiveView, setMemberTab, setCoachTab, setAdminTab, goToSection, setIsAudioTimerOpen, config } = useApp();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setCursor(0);
    }
  }, [isOpen]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    const close = (fn: () => void) => () => {
      fn();
      onClose();
    };

    const addPortal = (view: PortalView, items: typeof MEMBER_NAV, setTab: (t: string) => void, category: string) =>
      items.forEach(item =>
        list.push({
          id: `${view}-${item.id}`,
          title: item.label,
          category,
          icon: item.icon,
          run: close(() => {
            setActiveView(view);
            setTab(item.id);
          }),
        })
      );

    if (currentUser?.role === 'MEMBER') addPortal('member', MEMBER_NAV, setMemberTab, 'Member');
    if (currentUser?.role === 'COACH') addPortal('coach', COACH_NAV, setCoachTab, 'Coach');
    if (currentUser?.role === 'ADMIN') addPortal('admin', ADMIN_NAV, setAdminTab, 'Admin');

    list.push({
      id: 'timer',
      title: 'Buka timer latihan (Rest, Tabata, EMOM)',
      category: 'Alat',
      icon: Timer,
      keywords: 'stopwatch interval istirahat',
      run: close(() => setIsAudioTimerOpen(true)),
    });
    list.push({ id: 'home', title: 'Beranda company profile', category: 'Situs', icon: Globe, run: close(() => setActiveView('public')) });
    PUBLIC_SECTIONS.forEach(s =>
      list.push({ id: `sec-${s.id}`, title: s.title, category: 'Situs', icon: Globe, run: close(() => goToSection(s.id)) })
    );

    if (!currentUser) {
      if (onOpenAuth) list.push({ id: 'login', title: 'Masuk / daftar member', category: 'Akun', icon: LogIn, keywords: 'login gabung register', run: close(() => onOpenAuth('login')) });
    }
    if (onOpenQuickSwitcher && config.demoMode) {
      list.push({ id: 'demo', title: 'Pilih akun demo (admin, coach, member)', category: 'Akun', icon: UserCheck, keywords: 'ganti peran switch', run: close(() => onOpenQuickSwitcher()) });
    }
    return list;
  }, [currentUser, config.demoMode, onClose, onOpenAuth, onOpenQuickSwitcher, setActiveView, setMemberTab, setCoachTab, setAdminTab, goToSection, setIsAudioTimerOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c => `${c.title} ${c.category} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, search]);

  useEffect(() => setCursor(0), [search]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[cursor]?.run();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Pencarian cepat" maxWidth="max-w-lg" hideClose className="sm:mb-[10vh] sm:self-start">
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center px-4 border-b border-line">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={filtered[cursor] ? `cmd-${filtered[cursor].id}` : undefined}
            aria-label="Cari perintah atau halaman"
            placeholder="Cari halaman atau fitur (mis. QR, keuangan, workout)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent px-3 py-4 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none!"
          />
          <kbd className="text-[10px] font-mono text-zinc-500 border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <ul id="cmd-list" role="listbox" ref={listRef} className="p-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 && <li className="p-6 text-center text-xs text-zinc-500">Tidak ada hasil untuk "{search}".</li>}
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            const active = idx === cursor;
            return (
              <li key={item.id} role="presentation">
                <button
                  role="option"
                  id={`cmd-${item.id}`}
                  aria-selected={active}
                  data-idx={idx}
                  onClick={item.run}
                  onMouseMove={() => setCursor(idx)}
                  tabIndex={-1}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors ${active ? 'bg-white/10' : ''}`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="p-1.5 rounded-md bg-white/10 text-zinc-300 shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-medium text-zinc-100 truncate">{item.title}</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 shrink-0">{item.category}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-4 py-2.5 bg-ink border-t border-line flex items-center justify-between text-[11px] text-zinc-500">
          <span>↑↓ pilih · Enter buka · Esc tutup</span>
          <span className="hidden sm:inline">Ctrl/Cmd + K</span>
        </div>
      </div>
    </Modal>
  );
};
