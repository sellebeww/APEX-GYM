import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { ReferralReward } from '../../types';
import { Gift, Copy, Check, Share2, Trophy, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { REFERRAL_BONUS_POINTS } from '../../../shared/rules';
import { formatDateId } from '../../lib/membership';

const CATEGORY_LABEL: Record<ReferralReward['category'], string> = {
  MEMBERSHIP: 'Membership',
  COACHING: 'Coaching',
  MERCHANDISE: 'Merchandise',
};

export const MemberReferralRewards: React.FC = () => {
  const { referral, referralRewards, memberReferralPoints, claimedRewardIds, claimReferralReward, showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [claimTarget, setClaimTarget] = useState<ReferralReward | null>(null);
  const [busy, setBusy] = useState(false);

  const referralCode = referral?.code ?? '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Salin otomatis tidak didukung browser ini. Salin kode secara manual.', 'error');
    }
  };

  const handleShare = () => {
    const text = encodeURIComponent(
      `Yuk gabung ke APEX Gym Jakarta! Daftar pakai kode referral saya ${referralCode} dan saya dapat poin reward.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleClaim = async (reward: ReferralReward) => {
    setBusy(true);
    const res = await claimReferralReward(reward.id);
    setBusy(false);
    setClaimTarget(null);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#F5F5F5', '#F59E0B', '#FFFFFF'] });
      } catch {
        /* cosmetic */
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-zinc-400" />
            <h1 className="text-2xl font-extrabold uppercase text-white">Referral & poin reward</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Ajak teman berlatih, kumpulkan poin, dan tukarkan dengan hadiah.</p>
        </div>

        <div className="p-3 px-5 rounded-2xl bg-surface border border-line-strong flex items-center gap-3 self-start sm:self-auto">
          <Trophy className="w-6 h-6 text-amber-400" />
          <div>
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Saldo poin</span>
            <div className="text-2xl font-black font-mono text-white">{memberReferralPoints}</div>
          </div>
        </div>
      </div>

      <section className="p-6 rounded-3xl bg-surface border border-line-strong">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-200 uppercase tracking-wider">Kode unik Anda</span>
            <h2 className="text-lg font-bold text-white">Dapatkan {REFERRAL_BONUS_POINTS} poin untuk setiap teman yang bergabung</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Teman Anda memasukkan kode ini saat mendaftar. {REFERRAL_BONUS_POINTS} poin masuk ke saldo Anda satu kali, setelah pembayaran membership pertama teman
              Anda lunas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="px-5 py-3 rounded-2xl bg-black/60 border border-line-strong font-mono text-base font-bold text-white tracking-widest text-center" aria-label="Kode referral">
              {referralCode}
            </div>
            <button onClick={handleCopy} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Tersalin' : 'Salin kode'}
            </button>
            <button onClick={handleShare} className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-500 transition-colors">
              <Share2 className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>
      </section>

      {referral && referral.referrals.length > 0 && (
        <section className="p-6 rounded-2xl bg-surface border border-line space-y-3">
          <h2 className="text-sm font-bold text-white">Teman yang memakai kode Anda</h2>
          <ul className="divide-y divide-line text-xs">
            {referral.referrals.map((r, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-zinc-200">
                  {r.name} <span className="text-zinc-500">· daftar {formatDateId(r.joinedAt.slice(0, 10), 'short')}</span>
                </span>
                {r.bonusEarned ? (
                  <span className="font-bold text-emerald-300">+{REFERRAL_BONUS_POINTS} poin</span>
                ) : (
                  <span className="text-amber-300">Menunggu pembayaran pertama</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-zinc-400" />
            Katalog hadiah
          </h2>
          <span className="text-xs text-zinc-500">Setiap hadiah dapat ditukar satu kali</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {referralRewards.map(reward => {
            const isClaimed = claimedRewardIds.includes(reward.id);
            const canAfford = memberReferralPoints >= reward.pointsRequired;
            const missing = reward.pointsRequired - memberReferralPoints;
            return (
              <article
                key={reward.id}
                className={`p-5 rounded-2xl bg-surface border flex flex-col justify-between gap-4 transition-colors ${
                  isClaimed ? 'border-emerald-700/50' : canAfford ? 'border-line-strong hover:border-white' : 'border-line'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white">{reward.pointsRequired} poin</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{CATEGORY_LABEL[reward.category]}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{reward.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{reward.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-line">
                  {isClaimed ? (
                    <div className="py-2 text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" /> Sudah diklaim
                    </div>
                  ) : (
                    <button
                      onClick={() => setClaimTarget(reward)}
                      disabled={!canAfford || busy}
                      className="w-full py-2.5 rounded-xl font-bold text-xs transition-colors bg-white text-black hover:bg-zinc-200 disabled:bg-surface-2 disabled:text-zinc-500 disabled:cursor-not-allowed"
                    >
                      {canAfford ? 'Klaim hadiah' : `Kurang ${missing} poin`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        isOpen={!!claimTarget}
        title="Tukar poin?"
        confirmLabel={busy ? 'Memproses…' : 'Ya, tukar poin'}
        cancelLabel="Batal"
        message={claimTarget && `${claimTarget.pointsRequired} poin akan dipotong untuk "${claimTarget.title}". Penukaran tidak dapat dibatalkan.`}
        onConfirm={() => claimTarget && void handleClaim(claimTarget)}
        onCancel={() => setClaimTarget(null)}
      />
    </div>
  );
};
