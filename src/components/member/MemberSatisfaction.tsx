import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Star, CheckCircle } from 'lucide-react';
import type { FeedbackTicket } from '../../types';
import { formatDateId, toDateKey } from '../../lib/membership';

const fieldClass =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white';

const RATING_LABELS = ['', 'Buruk', 'Kurang', 'Cukup', 'Baik', 'Luar biasa'];

const RatingRow: React.FC<{ id: string; label: string; value: number; onChange: (v: number) => void }> = ({ id, label, value, onChange }) => (
  <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-2.5">
    <span id={id} className="font-bold text-white block text-xs">
      {label}
    </span>
    <div role="radiogroup" aria-labelledby={id} className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={`${v} bintang, ${RATING_LABELS[v]}`}
          onClick={() => onChange(v)}
          className={`flex-1 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1 text-xs ${
            value === v ? 'bg-white text-black' : 'bg-black/40 border border-line text-zinc-400 hover:text-white hover:border-line-strong'
          }`}
        >
          {v}
          <Star className={`w-3 h-3 ${value === v ? 'fill-black' : ''}`} />
        </button>
      ))}
    </div>
    <p className="text-[10px] text-zinc-500">{RATING_LABELS[value]}</p>
  </div>
);

export const MemberSatisfaction: React.FC = () => {
  const { currentUser, submitSurvey, submitComplaint, satisfactionSurveys, feedbackTickets, showToast } = useApp();

  const [ratings, setRatings] = useState({ cleanliness: 5, equipment: 5, atmosphere: 5, service: 5 });
  const [npsScore, setNpsScore] = useState(8);
  const [suggestions, setSuggestions] = useState('');
  const [isComplaint, setIsComplaint] = useState(false);
  const [surveyError, setSurveyError] = useState('');

  const [complaintCategory, setComplaintCategory] = useState<FeedbackTicket['category']>('Fasilitas');
  const [complaintText, setComplaintText] = useState('');
  const [complaintError, setComplaintError] = useState('');

  const thisMonth = toDateKey().slice(0, 7);
  const alreadySubmitted = useMemo(
    () => satisfactionSurveys.some(x => x.memberId === currentUser?.id && x.date.startsWith(thisMonth)),
    [satisfactionSurveys, currentUser?.id, thisMonth]
  );
  const myTickets = useMemo(
    () => feedbackTickets.filter(t => t.memberId === currentUser?.id).toSorted((a, b) => b.date.localeCompare(a.date)),
    [feedbackTickets, currentUser?.id]
  );

  const handleSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (isComplaint && suggestions.trim().length < 10) return setSurveyError('Jelaskan keluhan Anda (minimal 10 karakter) agar bisa ditindaklanjuti.');
    setSurveyError('');
    const res = await submitSurvey({
      ...ratings,
      npsScore,
      suggestions: suggestions.trim(),
      isComplaint,
    });
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      setSuggestions('');
      setIsComplaint(false);
    }
  };

  const handleComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (complaintText.trim().length < 10) return setComplaintError('Jelaskan kendala minimal 10 karakter.');
    setComplaintError('');
    const res = await submitComplaint(complaintCategory, complaintText.trim());
    showToast(res.success ? 'Tiket keluhan dibuat. Tim kami akan segera menangani.' : res.message, res.success ? 'success' : 'error');
    if (res.success) setComplaintText('');
  };

  const npsTone = npsScore >= 9 ? 'text-emerald-400' : npsScore >= 7 ? 'text-zinc-300' : 'text-rose-400';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Suara member</h1>
        <p className="text-xs text-zinc-400 mt-1">Bantu kami menjaga APEX Gym sebagai pusat kebugaran terbersih dan paling suportif di Jakarta.</p>
      </div>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-6">
        <div>
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.2em]">Evaluasi bulanan</span>
          <h2 className="text-lg font-bold text-white mt-0.5">Survei kualitas fasilitas & layanan</h2>
          <p className="text-xs text-zinc-400 mt-1">Beri nilai 1 (buruk) sampai 5 (luar biasa). Satu survei per bulan.</p>
        </div>

        {alreadySubmitted ? (
          <div role="status" className="p-6 rounded-2xl bg-surface-2 border border-line-strong text-center space-y-1">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="font-bold text-white text-sm">Survei bulan ini sudah terkirim</div>
            <p className="text-xs text-zinc-400">Terima kasih. Survei berikutnya dibuka bulan depan; untuk masalah mendesak gunakan tiket keluhan di bawah.</p>
          </div>
        ) : (
          <form onSubmit={handleSurvey} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RatingRow id="r-clean" label="1. Kebersihan gym, shower & sauna" value={ratings.cleanliness} onChange={v => setRatings({ ...ratings, cleanliness: v })} />
              <RatingRow id="r-equip" label="2. Kelengkapan & kondisi mesin / beban" value={ratings.equipment} onChange={v => setRatings({ ...ratings, equipment: v })} />
              <RatingRow id="r-atmo" label="3. Suasana, musik & tata udara" value={ratings.atmosphere} onChange={v => setRatings({ ...ratings, atmosphere: v })} />
              <RatingRow id="r-serv" label="4. Keramahan & kecekatan staf" value={ratings.service} onChange={v => setRatings({ ...ratings, service: v })} />
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span id="nps-label" className="font-bold text-white text-xs">
                  Seberapa besar kemungkinan Anda merekomendasikan APEX Gym ke teman atau keluarga?
                </span>
                <span className={`font-mono text-base font-black ${npsTone}`}>{npsScore} / 10</span>
              </div>
              <div role="radiogroup" aria-labelledby="nps-label" className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, score) => (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={npsScore === score}
                    onClick={() => setNpsScore(score)}
                    className={`py-2 rounded font-bold font-mono text-xs transition-colors ${
                      npsScore === score ? 'bg-white text-black' : 'bg-black/40 border border-line text-zinc-400 hover:text-white'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>0 = sangat tidak mungkin</span>
                <span>10 = sangat merekomendasikan</span>
              </div>
            </div>

            <div>
              <label htmlFor="suggestions" className="block text-zinc-400 text-xs font-semibold mb-1.5">
                Kritik, pujian, atau saran perbaikan {isComplaint ? '*' : <span className="font-normal text-zinc-600">(opsional)</span>}
              </label>
              <textarea
                id="suggestions"
                rows={3}
                maxLength={500}
                placeholder="Misal: tambah magnesium di platform deadlift, atau atur AC dekat turf"
                value={suggestions}
                onChange={e => setSuggestions(e.target.value)}
                className={`${fieldClass} resize-none`}
              />
            </div>

            {surveyError && (
              <p role="alert" className="text-xs text-rose-400">
                {surveyError}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <label className="flex items-start gap-2 cursor-pointer text-zinc-300 text-xs">
                <input type="checkbox" checked={isComplaint} onChange={e => setIsComplaint(e.target.checked)} className="w-4 h-4 mt-0.5 accent-amber-400" />
                <span>Tandai sebagai keluhan yang perlu tindak lanjut manajemen</span>
              </label>
              <button type="submit" className="px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-sm transition-colors shrink-0">
                Kirim survei
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <div>
          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-[0.2em]">Tiket keluhan</span>
          <h2 className="text-base font-bold text-white mt-0.5">Lapor kendala langsung ke admin</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Tiket masuk ke dashboard admin dengan target respons maksimal 1x24 jam kerja.</p>
        </div>

        <form onSubmit={handleComplaint} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="c-cat" className="block text-zinc-400 text-xs font-semibold mb-1.5">
                Kategori
              </label>
              <select id="c-cat" value={complaintCategory} onChange={e => setComplaintCategory(e.target.value as FeedbackTicket['category'])} className={fieldClass}>
                <option value="Fasilitas">Fasilitas / alat rusak</option>
                <option value="Kebersihan">Kebersihan kamar mandi / sauna</option>
                <option value="Pelayanan">Pelayanan staf / resepsionis</option>
                <option value="Coach">Komunikasi / jadwal coach</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="c-text" className="block text-zinc-400 text-xs font-semibold mb-1.5">
                Jelaskan kendala
              </label>
              <input
                id="c-text"
                type="text"
                maxLength={300}
                placeholder="Misal: kabel cable machine sisi kanan tersendat"
                value={complaintText}
                onChange={e => setComplaintText(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>
          {complaintError && (
            <p role="alert" className="text-xs text-rose-400">
              {complaintError}
            </p>
          )}
          <div className="flex justify-end">
            <button type="submit" className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">
              Kirim tiket
            </button>
          </div>
        </form>
      </section>

      <section className="bg-surface rounded-2xl border border-line p-6 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white">Riwayat tiket Anda</h2>
        {myTickets.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">Belum ada tiket keluhan.</p>
        ) : (
          <ul className="divide-y divide-line">
            {myTickets.map(t => (
              <li key={t.id} className="py-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-white">
                    {t.category} <span className="text-zinc-500 font-normal">· {formatDateId(t.date, 'short')}</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      t.status === 'SELESAI'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : t.status === 'DIPROSES'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-white/5 text-zinc-300 border-line-strong'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-zinc-300 text-[11px]">{t.text}</p>
                {t.adminResponse && (
                  <div className="p-2.5 rounded-lg bg-surface-2 border border-line text-[11px] text-zinc-200">
                    <strong>Tanggapan admin:</strong> {t.adminResponse}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
