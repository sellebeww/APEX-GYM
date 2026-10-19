import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Shield, Dumbbell, UserCheck, LogOut, AlertTriangle, type LucideIcon } from 'lucide-react';
import { Modal } from './Modal';
import { Avatar } from './Avatar';
import { api } from '../../lib/api';
import { resolveImage } from '../../lib/images';
import type { MembershipStatus } from '../../types';

interface DemoSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DemoAccount {
  id: string;
  name: string;
  role: 'ADMIN' | 'COACH' | 'MEMBER';
  avatarUrl?: string;
  title?: string;
  planName?: string;
  status?: MembershipStatus;
  daysRemaining?: number;
}

const STATUS_CHIP = {
  ACTIVE: { label: 'Aktif', cls: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  EXPIRING_SOON: { label: 'Segera habis', cls: 'bg-amber-950 text-amber-300 border-amber-800' },
  EXPIRED: { label: 'Kedaluwarsa', cls: 'bg-rose-950 text-rose-300 border-rose-800' },
} as const;

/** Development-only account picker. The list comes from the demo endpoint, which does not exist in production. */
export const DemoSwitcherModal: React.FC<DemoSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { demoLogin, logout, currentUser, config, showToast } = useApp();
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !config.demoMode) return;
    let cancelled = false;
    api<DemoAccount[]>('GET', '/api/dev/accounts')
      .then(list => !cancelled && (setAccounts(list), setError(null)))
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Gagal memuat akun demo.'));
    return () => {
      cancelled = true;
    };
  }, [isOpen, config.demoMode]);

  const groups: { title: string; icon: LucideIcon; list: DemoAccount[] }[] = [
    { title: 'Admin', icon: Shield, list: accounts?.filter(u => u.role === 'ADMIN') ?? [] },
    { title: 'Coach', icon: UserCheck, list: accounts?.filter(u => u.role === 'COACH') ?? [] },
    { title: 'Member', icon: Dumbbell, list: accounts?.filter(u => u.role === 'MEMBER') ?? [] },
  ];

  const subtitle = (u: DemoAccount) => {
    if (u.role === 'ADMIN') return 'Keuangan, scanner QR, kelola member & coach';
    if (u.role === 'COACH') return u.title ?? 'Personal trainer';
    return `${u.planName ?? 'Belum ada paket'}${u.status && u.status !== 'EXPIRED' ? ` · ${u.daysRemaining} hari lagi` : ''}`;
  };

  const choose = async (u: DemoAccount) => {
    setBusyId(u.id);
    const res = await demoLogin(u.id);
    setBusyId(null);
    if (!res.success) return showToast(res.message, 'error');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Pilih akun demo" maxWidth="max-w-2xl">
      <div className="p-6 flex flex-col max-h-[90vh]">
        <div className="pb-4 border-b border-line pr-8">
          <h2 className="text-lg font-extrabold uppercase text-white">Pilih akun demo</h2>
          <p className="text-xs text-zinc-400 mt-1">Hanya tersedia di mode development dengan data sintetis. Fitur ini tidak ada di production.</p>
        </div>

        <div className="overflow-y-auto py-4 pr-1 space-y-6" aria-busy={!accounts && !error}>
          {!config.demoMode && (
            <p className="text-sm text-zinc-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Mode demo tidak aktif di server ini.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
          {config.demoMode && !accounts && !error && <p className="text-xs text-zinc-500">Memuat akun…</p>}
          {groups.map(group => {
            const GroupIcon = group.icon;
            if (group.list.length === 0) return null;
            return (
              <section key={group.title} aria-label={group.title}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 flex items-center gap-2">
                  <GroupIcon className="w-3.5 h-3.5" /> {group.title}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.list.map(u => {
                    const isCurrent = currentUser?.id === u.id;
                    const chip = u.status ? STATUS_CHIP[u.status] : null;
                    return (
                      <li key={u.id}>
                        <button
                          onClick={() => void choose(u)}
                          disabled={busyId !== null}
                          aria-current={isCurrent ? 'true' : undefined}
                          className={`w-full text-left p-3 rounded-xl border transition-colors flex items-center gap-3 disabled:opacity-60 ${
                            isCurrent ? 'bg-surface-2 border-white' : 'bg-surface-2 border-line hover:border-line-strong'
                          }`}
                        >
                          <Avatar name={u.name} src={resolveImage(u.avatarUrl)} size={38} />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm text-white truncate">{u.name}</span>
                              {isCurrent && <span className="text-[10px] font-bold text-white shrink-0">AKTIF</span>}
                              {busyId === u.id && <span className="text-[10px] text-zinc-400 shrink-0">Masuk…</span>}
                            </span>
                            <span className="block text-[11px] text-zinc-400 truncate">{subtitle(u)}</span>
                            {chip && <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${chip.cls}`}>{chip.label}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <span>Ingin melihat sebagai pengunjung publik?</span>
          <button
            onClick={() => {
              void logout();
              onClose();
            }}
            className="px-4 py-2 rounded-lg border border-line-strong hover:border-white text-zinc-200 font-semibold transition-colors inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Mode publik (keluar)
          </button>
        </div>
      </div>
    </Modal>
  );
};
