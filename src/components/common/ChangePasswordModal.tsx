import React, { useState } from 'react';
import { KeyRound, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from './Modal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Shown after an admin reset: the member must pick their own password before continuing */
  forced?: boolean;
}

const inputClass =
  'w-full bg-surface-2 border border-line rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-white transition-colors';

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose, forced = false }) => {
  const { changePassword, showToast, logout } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) return setError('Password baru minimal 10 karakter dan berisi huruf serta angka.');
    if (next !== confirm) return setError('Konfirmasi password baru tidak sama.');
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (!res.success) return setError(res.message);
    showToast('Password diganti. Perangkat lain telah dikeluarkan.', 'success');
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={forced ? () => undefined : () => (reset(), onClose())}
      hideClose={forced}
      label="Ganti password"
      maxWidth="max-w-md"
    >
      <form onSubmit={submit} className="p-6 sm:p-8 space-y-4" noValidate>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-zinc-300" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold uppercase text-white">Ganti password</h2>
            <p className="text-xs text-zinc-400">
              {forced ? 'Password Anda baru direset oleh resepsionis. Buat password baru untuk melanjutkan.' : 'Semua perangkat lain akan otomatis keluar.'}
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="cp-current" className="block text-xs font-semibold text-zinc-300 mb-1.5">
            {forced ? 'Password sementara' : 'Password saat ini'}
          </label>
          <input id="cp-current" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="cp-new" className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Password baru (min. 10 karakter, huruf & angka)
          </label>
          <input id="cp-new" type="password" autoComplete="new-password" required minLength={10} value={next} onChange={e => setNext(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="cp-confirm" className="block text-xs font-semibold text-zinc-300 mb-1.5">
            Ulangi password baru
          </label>
          <input id="cp-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 text-sm font-bold text-black bg-white hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {busy ? 'Menyimpan…' : 'Simpan password baru'}
        </button>
        {forced && (
          <button type="button" onClick={() => void logout()} className="w-full text-center text-xs text-zinc-400 hover:text-white">
            Keluar
          </button>
        )}
      </form>
    </Modal>
  );
};
