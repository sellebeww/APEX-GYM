import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Mail, Phone, User, CheckCircle2, AlertCircle, Ticket, Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { Modal } from './Modal';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

type Mode = 'login' | 'register' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  'w-full bg-surface-2 border border-line rounded-lg pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors';
const labelClass = 'block text-xs font-semibold text-zinc-300 mb-1.5';
const primaryBtn =
  'w-full py-3 text-sm font-bold text-black bg-white hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-wait';
const linkBtn = 'text-white font-semibold hover:underline underline-offset-4';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, initialMode = 'login', onClose }) => {
  const { login, register, requestPasswordReset, showToast } = useApp();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start in the requested mode each time the dialog opens, never carrying old input over
  const [lastOpen, setLastOpen] = useState(false);
  if (isOpen !== lastOpen) {
    setLastOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      setSuccessMsg(null);
      setEmail('');
      setPassword('');
      setPassword2('');
      setName('');
      setPhone('');
      setReferral('');
      setShowPassword(false);
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setPassword2('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError('Masukkan alamat email yang valid.');
    if (!password) return setError('Masukkan password Anda.');
    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (!res.success) {
      setPassword('');
      return setError(res.message);
    }
    showToast('Berhasil masuk. Selamat datang kembali!', 'success');
    onClose();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return setError('Masukkan nama lengkap Anda.');
    if (!EMAIL_RE.test(email.trim())) return setError('Masukkan alamat email yang valid.');
    if (digits.length < 9 || digits.length > 15) return setError('Nomor WhatsApp tidak valid (9-15 digit).');
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('Password minimal 10 karakter dan berisi huruf serta angka.');
    }
    if (password !== password2) return setError('Konfirmasi password tidak sama.');
    setBusy(true);
    const res = await register({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      referralCode: referral.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) return setError(res.message);
    showToast(
      res.data?.referrerName
        ? `Pendaftaran berhasil. ${res.data.referrerName.split(' ')[0]} akan mendapat poin setelah pembayaran pertama Anda.`
        : 'Pendaftaran berhasil. Pilih paket untuk mulai berlatih.',
      'success'
    );
    onClose();
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!EMAIL_RE.test(email.trim())) return setError('Masukkan alamat email yang valid.');
    setError(null);
    setBusy(true);
    const res = await requestPasswordReset(email.trim());
    setBusy(false);
    if (!res.success) return setError(res.message);
    setSuccessMsg(res.message);
  };

  const field = (id: string, label: string, icon: React.ReactNode, input: React.ReactNode) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">{icon}</span>
        {input}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Masuk atau daftar" maxWidth="max-w-md">
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="vertical" size="sm" subtitleText="MEMBER ACCESS" />
          <h2 className="text-xl font-extrabold uppercase text-white mt-5">
            {mode === 'login' && 'Masuk akun'}
            {mode === 'register' && 'Daftar member baru'}
            {mode === 'forgot' && 'Reset kata sandi'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs">
            {mode === 'login' && 'Akses dashboard latihan, QR masuk gym, dan booking coach.'}
            {mode === 'register' && 'Mulai perjalanan Anda bersama APEX Gym.'}
            {mode === 'forgot' && 'Reset password dibantu resepsionis untuk menjaga keamanan akun Anda.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div role="status" className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {field(
              'auth-email',
              'Alamat email',
              <Mail className="w-4 h-4" />,
              <input id="auth-email" type="email" autoComplete="email" required placeholder="nama@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="text-xs font-semibold text-zinc-300">
                  Password
                </label>
                <button type="button" onClick={() => switchMode('forgot')} className="text-[11px] text-zinc-400 hover:text-white">
                  Lupa password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
            <p className="text-center text-xs text-zinc-400 pt-1">
              Belum punya akun?{' '}
              <button type="button" onClick={() => switchMode('register')} className={linkBtn}>
                Daftar member
              </button>
            </p>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5" noValidate>
            {field(
              'reg-name',
              'Nama lengkap',
              <User className="w-4 h-4" />,
              <input id="reg-name" type="text" autoComplete="name" required placeholder="Dimas Saputra" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
            )}
            {field(
              'reg-email',
              'Email',
              <Mail className="w-4 h-4" />,
              <input id="reg-email" type="email" autoComplete="email" required placeholder="nama@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            )}
            {field(
              'reg-phone',
              'Nomor WhatsApp',
              <Phone className="w-4 h-4" />,
              <input id="reg-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="0812-xxxx-xxxx" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
            )}
            {field(
              'reg-password',
              'Password (min. 10 karakter, huruf & angka)',
              <Lock className="w-4 h-4" />,
              <input id="reg-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={10} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
            )}
            {field(
              'reg-password2',
              'Ulangi password',
              <Lock className="w-4 h-4" />,
              <input id="reg-password2" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password2} onChange={e => setPassword2(e.target.value)} className={inputClass} />
            )}
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
              <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} className="accent-white" />
              Tampilkan password
            </label>
            {field(
              'reg-ref',
              'Kode referral (opsional)',
              <Ticket className="w-4 h-4" />,
              <input id="reg-ref" type="text" autoComplete="off" placeholder="NAMA-AB12" value={referral} onChange={e => setReferral(e.target.value.toUpperCase())} className={`${inputClass} font-mono`} />
            )}
            <button type="submit" disabled={busy} className={`${primaryBtn} mt-2`}>
              {busy ? 'Mendaftarkan…' : 'Selesaikan pendaftaran'}
            </button>
            <p className="text-center text-xs text-zinc-400 pt-1">
              Sudah punya akun?{' '}
              <button type="button" onClick={() => switchMode('login')} className={linkBtn}>
                Masuk
              </button>
            </p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4" noValidate>
            {field(
              'forgot-email',
              'Email terdaftar',
              <Mail className="w-4 h-4" />,
              <input id="forgot-email" type="email" autoComplete="email" required placeholder="nama@email.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            )}
            <button type="submit" disabled={busy} className={primaryBtn}>
              Cara reset password
            </button>
            <button type="button" onClick={() => switchMode('login')} className="w-full text-center text-xs text-zinc-400 hover:text-white">
              Kembali ke login
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
