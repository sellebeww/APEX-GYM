import React from 'react';
import { Lock, LogOut, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VIEW_ROLE, type PortalView } from '../../config/navigation';

const AREA_LABEL: Record<PortalView, string> = {
  member: 'Area Member',
  coach: 'Panel Coach',
  admin: 'Panel Admin',
};

interface RoleGateProps {
  view: PortalView;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenQuickSwitcher: () => void;
  children: React.ReactNode;
}

/** Renders the portal only for the matching role; otherwise explains how to get access. */
export const RoleGate: React.FC<RoleGateProps> = ({ view, onOpenAuth, onOpenQuickSwitcher, children }) => {
  const { currentUser, setActiveView, config, logout } = useApp();
  const required = VIEW_ROLE[view];

  if (currentUser?.role === required) return <>{children}</>;

  const wrongRole = !!currentUser;

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-surface-2 border border-line-strong flex items-center justify-center mb-6">
        <Lock className="w-6 h-6 text-zinc-300" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">{AREA_LABEL[view]} Terkunci</h1>
      <p className="text-sm text-zinc-400 leading-relaxed mb-8">
        {wrongRole
          ? `Anda masuk sebagai ${currentUser!.name} (${currentUser!.role}). Halaman ini hanya untuk akun ${required}. Keluar lalu masuk dengan akun yang sesuai.`
          : `Silakan masuk dengan akun ${required} untuk membuka halaman ini. Pengunjung baru bisa mendaftar sebagai member.`}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {!wrongRole && (
          <button
            onClick={() => onOpenAuth('login')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand hover:bg-brand-hover text-black font-bold text-sm transition-colors"
          >
            Masuk / Gabung
          </button>
        )}
        {wrongRole && (
          <button
            onClick={() => {
              void logout().then(() => onOpenAuth('login'));
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar & masuk ulang
          </button>
        )}
        {config.demoMode && (
          <button
            onClick={onOpenQuickSwitcher}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-line-strong hover:border-zinc-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            Pilih Akun Demo
          </button>
        )}
        <button
          onClick={() => setActiveView('public')}
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-zinc-400 hover:text-white font-semibold text-sm transition-colors"
        >
          Kembali ke Beranda
        </button>
      </div>
    </div>
  );
};
