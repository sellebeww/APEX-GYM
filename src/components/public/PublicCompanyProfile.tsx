import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Check,
  Dumbbell,
  Clock,
  MapPin,
  Phone,
  Star,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Send,
  MessageCircle,
  Loader2,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { GymCrowdMeter } from '../common/GymCrowdMeter';
import { ApexEmblem } from '../common/BrandLogo';
import { SectionHeading } from '../common/SectionHeading';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { FacilityShowcaseCarousel } from './FacilityShowcaseCarousel';
import { IMAGES } from '../../assets/images';
import { GYM_CAPACITY, GYM_CONTACT } from '../../config/gym';
import type { Article } from '../../types';

interface PublicCompanyProfileProps {
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onSelectPlan: (planId: string) => void;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const COACH_FILTERS = ['Semua', 'Strength', 'Fat Loss', 'Mobility', 'Pilates', 'Agility'];

const FAQ = [
  {
    q: 'Bagaimana cara masuk gym menggunakan QR Code?',
    a: 'Setelah membership aktif, buka menu "QR Masuk Gym" di area member. Kode QR dinamis akan muncul dan otomatis diperbarui setiap 60 detik demi keamanan akun Anda.',
  },
  {
    q: 'Apakah ada biaya registrasi tambahan di luar harga paket?',
    a: 'Tidak ada. Harga paket bersifat all-in dan sudah mencakup akses loker harian, shower air panas, air minum, dan fasilitas sauna.',
  },
  {
    q: 'Apakah pemula yang belum pernah angkat beban aman berlatih di sini?',
    a: 'Sangat aman. Setiap member baru mendapat sesi orientasi mengenai etika dan biomekanik alat dasar, dan pelatih kami siap memandu agar latihan berjalan tanpa risiko cedera.',
  },
  {
    q: 'Bagaimana jadwal ulang sesi Personal Trainer jika ada keperluan mendadak?',
    a: 'Pembatalan atau penjadwalan ulang dapat dilakukan lewat aplikasi paling lambat 12 jam sebelum sesi, tanpa kehilangan kuota.',
  },
  {
    q: 'Apakah saya bisa membayar lewat QRIS atau transfer bank?',
    a: 'Ya. Sistem mendukung QRIS dari semua bank dan e-wallet, transfer virtual account BCA dan Mandiri, serta pembayaran tunai di kasir gym.',
  },
];

/** Count-up number that only animates once it scrolls into view */
const CountUp: React.FC<{ target: number; decimals?: number; suffix?: string }> = ({ target, decimals = 0, suffix = '' }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const duration = 1400;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setValue((p === 1 ? 1 : 1 - Math.pow(2, -10 * p)) * target);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <span>
      {decimals > 0 ? value.toFixed(decimals).replace('.', ',') : Math.round(value).toLocaleString('id-ID')}
      {suffix}
    </span>
  );
};

export const PublicCompanyProfile: React.FC<PublicCompanyProfileProps> = ({ onOpenAuth, onSelectPlan }) => {
  const {
    membershipPlans,
    ptPackages,
    coachProfiles,
    memberProfiles,
    groupClasses,
    satisfactionSurveys,
    gymEquipment,
    liveGymOccupancy,
    testimonials,
    articles,
    currentUser,
    setActiveView,
    setMemberTab,
    setCheckoutIntent,
    showToast,
  } = useApp();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [coachFilter, setCoachFilter] = useState('Semua');
  const [scheduleDay, setScheduleDay] = useState('Semua');
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  // ---- Derived, data-backed figures (no hard-coded marketing numbers) ----
  const activeMembers = useMemo(
    () => Object.values(memberProfiles).filter(p => p.status !== 'EXPIRED').length,
    [memberProfiles]
  );
  const avgRating = useMemo(() => {
    if (satisfactionSurveys.length === 0) return null;
    const total = satisfactionSurveys.reduce((s, x) => s + (x.cleanliness + x.equipment + x.atmosphere + x.service) / 4, 0);
    return total / satisfactionSurveys.length;
  }, [satisfactionSurveys]);
  const occupancyPct = Math.min(100, Math.round((liveGymOccupancy / GYM_CAPACITY) * 100));

  const allCoaches = Object.values(coachProfiles).filter(c => c.isPublicApproved);
  const filteredCoaches =
    coachFilter === 'Semua'
      ? allCoaches
      : allCoaches.filter(
          c =>
            c.specialties.some(s => s.toLowerCase().includes(coachFilter.toLowerCase())) ||
            c.title.toLowerCase().includes(coachFilter.toLowerCase())
        );
  const clientsOf = (coachId: string) =>
    Object.values(memberProfiles).filter(p => p.assignedCoachId === coachId && p.status !== 'EXPIRED').length;

  const approvedTestimonials = testimonials.filter(t => t.approvedForPublic);

  const scheduleDays = DAYS.filter(d => groupClasses.some(c => c.day === d));
  const filteredClasses = (scheduleDay === 'Semua' ? groupClasses : groupClasses.filter(c => c.day === scheduleDay))
    .slice()
    .toSorted((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.time.localeCompare(b.time));

  const openMember = (tab: string) => {
    setActiveView('member');
    setMemberTab(tab);
  };

  const handleChoosePlan = (planId: string) => {
    setCheckoutIntent({ type: 'plan', id: planId });
    onSelectPlan(planId);
  };

  const handleChoosePt = (pkgId: string) => {
    setCheckoutIntent({ type: 'pt', id: pkgId });
    onSelectPlan(pkgId);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = contactPhone.replace(/\D/g, '');
    if (contactName.trim().length < 2) return setContactError('Masukkan nama lengkap Anda.');
    if (digits.length < 9 || digits.length > 15) return setContactError('Nomor WhatsApp tidak valid (9-15 digit).');
    setContactError('');
    setIsSubmittingContact(true);

    // Hand the enquiry to the real WhatsApp line with the details pre-filled
    const text = encodeURIComponent(
      `Halo APEX Gym, saya ${contactName.trim()} (${contactPhone.trim()}).${contactMsg.trim() ? `\n${contactMsg.trim()}` : ''}`
    );
    window.open(`https://wa.me/${GYM_CONTACT.whatsappIntl}?text=${text}`, '_blank', 'noopener,noreferrer');

    setTimeout(() => {
      setIsSubmittingContact(false);
      setContactSubmitted(true);
      showToast('Pertanyaan Anda diteruskan ke WhatsApp APEX Gym.', 'success');
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: ['#F5F5F5', '#FFFFFF', '#A1A1AA'] });
      } catch {
        /* confetti is cosmetic */
      }
      setContactName('');
      setContactPhone('');
      setContactMsg('');
    }, 500);
  };

  const fieldClass =
    'w-full bg-surface-2 border border-line rounded-lg px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white transition-colors';

  return (
    <div id="main-content" tabIndex={-1} className="relative overflow-hidden outline-none">
      {/* ================= HERO ================= */}
      <section className="relative min-h-[88vh] flex items-center border-b border-line overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <motion.img
            src={IMAGES.hero}
            alt=""
            className="w-full h-full object-cover object-center grayscale brightness-[0.38] contrast-125"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/40 to-ink/60" />
          <div className="absolute inset-0 bg-linear-to-r from-ink/90 via-ink/40 to-transparent" />
          {/* Oversized summit mark as a watermark */}
          <ApexEmblem
            sizePx={760}
            className="absolute -right-32 top-1/2 -translate-y-1/2 text-white/[0.06] hidden lg:block"
          />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 border border-line-strong text-xs font-medium text-zinc-300 backdrop-blur-md mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-radar-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="font-semibold text-white">Live Floor</span>
            <span className="text-zinc-400">
              {liveGymOccupancy} member di gym · {occupancyPct}% kapasitas
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-[2.1rem] leading-[1.05] sm:text-6xl lg:text-7xl font-extrabold uppercase text-white max-w-4xl"
          >
            Bangun tubuh terkuat.
            <span className="block text-zinc-400">Tanpa kompromi.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl text-base sm:text-lg text-zinc-300 leading-relaxed mt-6 mb-10"
          >
            Power rack standar kompetisi, Personal Trainer bersertifikasi, dan aplikasi pelacak latihan, semuanya di satu
            tempat di Jakarta Barat.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4"
          >
            <a
              href="#paket"
              onClick={e => {
                e.preventDefault();
                document.getElementById('paket')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="clip-apex group inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-black bg-white hover:bg-zinc-200 transition-colors"
            >
              Lihat Paket Membership
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <button
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center justify-center px-8 py-4 text-sm font-bold text-white border border-line-strong hover:border-white hover:bg-white/5 rounded-sm transition-colors"
            >
              Daftar Jadi Member
            </button>
          </motion.div>

          {/* Proof strip: every figure is computed from app data */}
          <motion.dl
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 pt-8 border-t border-line-strong/60 max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6"
          >
            {[
              { v: <CountUp target={activeMembers} />, l: 'Member aktif' },
              {
                v: avgRating ? <CountUp target={avgRating} decimals={1} suffix="/5" /> : <span>–</span>,
                l: `Penilaian member${satisfactionSurveys.length ? ` (${satisfactionSurveys.length} survei)` : ''}`,
              },
              { v: <CountUp target={allCoaches.length} />, l: 'Coach bersertifikasi' },
              { v: <span>06–22</span>, l: 'WIB, setiap hari' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col-reverse">
                <dt className="text-xs text-zinc-400 mt-1">{s.l}</dt>
                <dd className="text-3xl sm:text-4xl font-extrabold font-display text-white tabular-nums">{s.v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </section>

      {/* ================= MARQUEE ================= */}
      <div className="bg-surface border-b border-line py-3.5 overflow-hidden select-none" aria-hidden>
        <div className="animate-marquee whitespace-nowrap text-[11px] font-semibold tracking-[0.3em] text-zinc-400 items-center gap-8">
          {[0, 1].map(k => (
            <React.Fragment key={k}>
              {['STRONGER', 'FASTER', 'EVERY DAY', 'SPORTS SCIENCE NUTRITION', 'CERTIFIED COACHING', 'QR INSTANT ENTRY', 'COMPETITION PLATES'].map(
                t => (
                  <React.Fragment key={`${k}-${t}`}>
                    <span>{t}</span>
                    <span className="text-zinc-700">/</span>
                  </React.Fragment>
                )
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ================= FASILITAS ================= */}
      <section id="fasilitas" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          index="01"
          eyebrow="Fasilitas"
          title="Didesain untuk performa nyata"
          description="Setiap dumbbell, barbel, dan kabel pulley dipilih berdasarkan standar biomekanik internasional, bukan sekadar yang murah."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FacilityShowcaseCarousel />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between hover:border-line-strong transition-colors"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center text-white mb-5">
                <Dumbbell className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Dumbbell lengkap hingga 60 kg</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Tiga set dumbbell uretana presisi dari 2 kg hingga 60 kg, kenaikan 2 kg, sehingga Anda tidak perlu antre di jam sibuk.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-xs text-zinc-500 font-mono">
              {gymEquipment.length} unit alat terdata
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between hover:border-line-strong transition-colors"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-surface-2 border border-line-strong flex items-center justify-center text-white mb-5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Sauna & area recovery</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Relaksasikan otot setelah angkat beban berat dengan sauna kering dan kamar bilas bertekanan tinggi yang selalu terjaga higienis.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-xs text-zinc-500 font-mono">Termasuk di semua paket bulanan</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="md:col-span-2 rounded-2xl border border-line bg-surface p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-line-strong transition-colors"
          >
            <div>
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.25em] mb-2">Aplikasi terintegrasi</div>
              <h3 className="text-xl font-bold text-white mb-2">Kartu digital QR & auto-track</h3>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                Pindai kode QR yang selalu diperbarui untuk masuk gym. Catat beban, volume, rekor PR, dan pantau nutrisi harian dalam satu tempat.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('register')}
              className="px-6 py-3.5 text-sm font-bold text-black bg-white hover:bg-zinc-200 rounded-lg shrink-0 transition-colors whitespace-nowrap"
            >
              Coba Aplikasi Sekarang
            </button>
          </motion.div>
        </div>

        <div className="mt-10">
          <GymCrowdMeter />
        </div>
      </section>

      {/* ================= PAKET ================= */}
      <section id="paket" className="py-24 bg-surface/40 border-y border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            index="02"
            eyebrow="Investasi tubuh"
            title="Paket membership transparan"
            description="Tanpa biaya pendaftaran tersembunyi. Akses ke seluruh fasilitas gym, loker, shower, dan aplikasi pelacak latihan."
            align="center"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16 items-stretch">
            {membershipPlans.map((plan, idx) => {
              const months = Math.max(1, Math.round(plan.durationDays / 30.4));
              const perMonth = plan.durationDays >= 30 ? Math.round(plan.price / months) : null;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: idx * 0.06 }}
                  className={`relative rounded-2xl p-5 flex flex-col justify-between ${
                    plan.isPopular
                      ? 'bg-surface-2 border-2 border-white lg:-translate-y-2'
                      : 'bg-surface border border-line hover:border-line-strong transition-colors'
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap">
                      Paling populer
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 mb-5">{plan.periodLabel}</p>

                    <div className="mb-1 font-display tabular-nums whitespace-nowrap text-2xl leading-none font-extrabold text-white">
                      Rp {plan.price.toLocaleString('id-ID')}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mb-6 min-h-4">
                      {perMonth ? `≈ Rp ${perMonth.toLocaleString('id-ID')} / bulan` : ''}
                    </p>

                    <ul className="space-y-2.5 text-xs text-zinc-300 mb-7">
                      {plan.features.map(feat => (
                        <li key={feat} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleChoosePlan(plan.id)}
                    className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
                      plan.isPopular
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'bg-surface-2 border border-line-strong text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    Pilih paket
                  </button>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="bg-surface rounded-2xl border border-line p-6 sm:p-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-line">
              <div>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.25em]">Bimbingan 1-on-1</span>
                <h3 className="text-xl sm:text-2xl font-extrabold uppercase text-white mt-2">Paket personal training</h3>
                <p className="text-sm text-zinc-400 mt-2 max-w-xl">
                  Dampingi setiap repetisi dengan teknik aman, meal plan makro presisi, dan evaluasi berkala.
                </p>
              </div>
              <p className="text-xs text-zinc-500">Sesi berlaku fleksibel hingga 3 bulan</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ptPackages.map(pkg => (
                <div
                  key={pkg.id}
                  className={`p-5 rounded-xl border flex flex-col justify-between transition-colors ${
                    pkg.isPopular ? 'bg-surface-2 border-white' : 'bg-surface-2 border-line hover:border-line-strong'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-bold text-sm text-white">{pkg.name}</span>
                      {pkg.isPopular && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-black uppercase shrink-0">
                          Rekomendasi
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black font-tabular text-white">Rp {pkg.price.toLocaleString('id-ID')}</div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-1 mb-4">
                      Rp {pkg.pricePerSession.toLocaleString('id-ID')} / sesi
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-6">{pkg.description}</p>
                  </div>
                  <button
                    onClick={() => handleChoosePt(pkg.id)}
                    className="w-full py-3 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors"
                  >
                    Beli paket ({pkg.sessionCount} sesi)
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= COACHES ================= */}
      <section id="coaches" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          index="03"
          eyebrow="Tim pelatih"
          title="Coach bersertifikasi internasional"
          description="Bukan sekadar penghitung repetisi. Pelatih kami mendalami biomekanik dan nutrisi olahraga berbasis bukti ilmiah."
          aside={
            <div role="group" aria-label="Filter spesialisasi coach" className="flex flex-wrap gap-2">
              {COACH_FILTERS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCoachFilter(cat)}
                  aria-pressed={coachFilter === cat}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    coachFilter === cat
                      ? 'bg-white text-black border-white'
                      : 'text-zinc-400 border-line bg-surface hover:text-white hover:border-line-strong'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          }
        />

        {filteredCoaches.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-16 border border-dashed border-line rounded-2xl">
            Belum ada coach dengan spesialisasi "{coachFilter}".
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredCoaches.map((coach, cidx) => (
                <motion.article
                  key={coach.userId}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, delay: cidx * 0.04 }}
                  className="rounded-2xl border border-line bg-surface overflow-hidden flex flex-col hover:border-line-strong transition-colors group"
                >
                  <div className="relative h-72 overflow-hidden bg-zinc-900">
                    <img
                      src={coach.photoUrl}
                      alt={coach.fullName}
                      loading="lazy"
                      className="w-full h-full object-cover object-top grayscale-[0.35] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-surface to-transparent" />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1 font-tabular">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {coach.rating}
                      <span className="text-zinc-400 font-normal">({coach.reviewCount})</span>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-white">{coach.fullName}</h3>
                    <p className="text-xs text-zinc-400 font-medium mb-3">{coach.title}</p>
                    <p className="text-sm text-zinc-400 leading-relaxed mb-5">{coach.bio}</p>

                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-ink border border-line mb-5 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Pengalaman</span>
                        <span className="font-bold text-white">{coach.experienceYears} tahun</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Klien aktif</span>
                        <span className="font-bold text-white inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-zinc-400" />
                          {clientsOf(coach.userId)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs mb-6">
                      <div>
                        <span className="text-zinc-500 font-semibold text-[10px] uppercase tracking-wider block mb-1.5">Sertifikasi</span>
                        <div className="flex flex-wrap gap-1.5">
                          {coach.certifications.map(cert => (
                            <span key={cert} className="text-[11px] px-2 py-0.5 rounded bg-surface-2 border border-line text-zinc-300">
                              {cert}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-semibold text-[10px] uppercase tracking-wider block mb-1.5">Spesialisasi</span>
                        <div className="flex flex-wrap gap-1.5">
                          {coach.specialties.map(spec => (
                            <span key={spec} className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white">
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => (currentUser ? openMember('coaching') : onOpenAuth('register'))}
                      className="mt-auto w-full py-3 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      Konsultasi & booking sesi
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ================= JADWAL ================= */}
      <section id="jadwal" className="py-24 bg-surface/40 border-y border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            index="04"
            eyebrow="Kelas komunitas"
            title="Jadwal kelas mingguan"
            description="Gratis untuk semua member aktif. Kuota terbatas di setiap kelas agar gerakan tetap nyaman dan aman."
            aside={
              <div role="group" aria-label="Filter hari" className="flex flex-wrap gap-1 p-1 rounded-xl bg-surface border border-line">
                {['Semua', ...scheduleDays].map(day => (
                  <button
                    key={day}
                    onClick={() => setScheduleDay(day)}
                    aria-pressed={scheduleDay === day}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      scheduleDay === day ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredClasses.map(item => {
                const left = item.maxCapacity - item.enrolledMemberIds.length;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="p-5 rounded-xl bg-surface border border-line hover:border-line-strong transition-colors flex flex-col gap-4"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/10 text-white">
                        {item.day} · {item.time}
                      </span>
                      <h4 className="text-base font-bold text-white mt-3 mb-1">{item.name}</h4>
                      <p className="text-xs text-zinc-400">
                        {item.coachName} · {item.room}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3">
                      <span className={`text-[11px] font-mono ${left === 0 ? 'text-rose-400' : left <= 3 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {left === 0 ? 'Kelas penuh' : `${left} slot tersisa`}
                      </span>
                      <button
                        onClick={() => (currentUser ? openMember('classes') : onOpenAuth('login'))}
                        className="px-3.5 py-2 rounded-lg bg-surface-2 border border-line-strong hover:bg-white hover:text-black text-xs font-semibold text-white whitespace-nowrap transition-colors"
                      >
                        Booking slot
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ================= TESTIMONI ================= */}
      {approvedTestimonials.length > 0 && (
        <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            index="05"
            eyebrow="Cerita transformasi"
            title="Hasil nyata member APEX"
            description="Ulasan dari member yang rutin mencatat progres latihan di aplikasi kami, dan disetujui admin untuk ditampilkan."
            align="center"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {approvedTestimonials.map((t, idx) => (
              <motion.figure
                key={t.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className="p-6 rounded-2xl bg-surface border border-line flex flex-col justify-between hover:border-line-strong transition-colors"
              >
                <div>
                  <div className="flex items-center gap-0.5 mb-4" role="img" aria-label={`Rating ${t.rating} dari 5`}>
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-zinc-300 leading-relaxed mb-4">"{t.text}"</blockquote>
                  <p className="text-xs font-bold text-white mb-5">{t.highlight}</p>
                </div>
                <figcaption className="pt-4 border-t border-line flex items-center gap-3">
                  <Avatar name={t.name} src={t.avatarUrl} size={36} />
                  <div>
                    <div className="text-xs font-bold text-white">{t.name}</div>
                    <div className="text-[11px] text-zinc-400">
                      {t.role} · {t.durationMember}
                    </div>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </section>
      )}

      {/* ================= ARTIKEL ================= */}
      <section className="py-24 bg-surface/40 border-y border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            index="06"
            eyebrow="Edukasi"
            title="Tips gym & panduan nutrisi"
            aside={
              <button
                onClick={() => (currentUser ? openMember('articles') : onOpenAuth('login'))}
                className="text-sm font-bold text-white hover:text-zinc-300 inline-flex items-center gap-1.5 transition-colors"
              >
                Semua artikel <ArrowRight className="w-4 h-4" />
              </button>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.slice(0, 3).map((art, idx) => (
              <motion.button
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, delay: idx * 0.07 }}
                onClick={() => setPreviewArticle(art)}
                className="text-left p-6 rounded-xl bg-surface border border-line hover:border-line-strong transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                    <span className="text-white font-semibold">{art.category}</span>
                    <span>·</span>
                    <span>{art.readTimeMinutes} menit baca</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 line-clamp-2">{art.title}</h3>
                  <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed mb-5">{art.summary}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white group-hover:translate-x-1 transition-transform">
                  Baca ringkasan <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <Modal isOpen={!!previewArticle} onClose={() => setPreviewArticle(null)} label={previewArticle?.title ?? 'Artikel'} maxWidth="max-w-xl">
        {previewArticle && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
              <span className="text-white font-semibold">{previewArticle.category}</span>
              <span>·</span>
              <span>{previewArticle.readTimeMinutes} menit baca</span>
            </div>
            <h3 className="text-xl font-extrabold text-white mb-4 pr-8">{previewArticle.title}</h3>
            <p className="text-sm text-zinc-300 leading-relaxed mb-6">{previewArticle.summary}</p>
            <button
              onClick={() => {
                setPreviewArticle(null);
                if (currentUser) openMember('articles');
                else onOpenAuth('register');
              }}
              className="w-full py-3 rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors"
            >
              {currentUser ? 'Baca artikel lengkap' : 'Daftar untuk membaca artikel lengkap'}
            </button>
          </div>
        )}
      </Modal>

      {/* ================= FAQ ================= */}
      <section className="py-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading index="07" eyebrow="Pertanyaan umum" title="FAQ seputar APEX Gym" align="center" />
        <div className="space-y-3">
          {FAQ.map((item, idx) => {
            const open = activeFaq === idx;
            return (
              <div key={item.q} className="rounded-xl border border-line bg-surface overflow-hidden hover:border-line-strong transition-colors">
                <h3>
                  <button
                    onClick={() => setActiveFaq(open ? null : idx)}
                    aria-expanded={open}
                    aria-controls={`faq-${idx}`}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180 text-white' : 'text-zinc-500'}`} />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`faq-${idx}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 sm:px-5 pb-5 text-sm text-zinc-400 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* ================= KONTAK ================= */}
      <section id="kontak" className="py-24 bg-surface/40 border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <div>
            <SectionHeading
              index="08"
              eyebrow="Kunjungi kami"
              title="Lokasi & konsultasi langsung"
              description="Ingin melihat fasilitas sebelum bergabung? Tim kami siap menyambut Anda untuk tur gym gratis dan konsultasi komposisi tubuh."
              className="mb-8!"
            />
            <ul className="space-y-5 text-sm text-zinc-300 mb-8">
              <li className="flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">APEX Gym</span>
                  {GYM_CONTACT.address}
                </div>
              </li>
              <li className="flex items-start gap-3.5">
                <Clock className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">Jam operasional</span>
                  Senin–Jumat 06.00–22.00 WIB
                  <br />
                  Sabtu–Minggu 07.00–21.00 WIB
                </div>
              </li>
              <li className="flex items-start gap-3.5">
                <Phone className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">WhatsApp resmi</span>
                  {GYM_CONTACT.whatsappDisplay}
                </div>
              </li>
            </ul>
            <a
              href={`https://wa.me/${GYM_CONTACT.whatsappIntl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-emerald-700 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Chat via WhatsApp
            </a>
          </div>

          <div className="bg-surface rounded-2xl border border-line p-6 sm:p-8 self-start">
            <h3 className="text-lg font-bold text-white mb-1">Tanya konsultan kebugaran</h3>
            <p className="text-sm text-zinc-400 mb-6">Isi data singkat, kami lanjutkan percakapan lewat WhatsApp.</p>

            {contactSubmitted ? (
              <div role="status" className="p-5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-sm text-center">
                <p className="font-bold mb-3">Terima kasih! Pertanyaan Anda sudah diteruskan ke WhatsApp.</p>
                <button onClick={() => setContactSubmitted(false)} className="text-xs underline underline-offset-4 hover:text-white">
                  Kirim pertanyaan lain
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Nama lengkap
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Nama Anda"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Nomor WhatsApp
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="0812-xxxx-xxxx"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-msg" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Tujuan atau pertanyaan <span className="text-zinc-500 font-normal">(opsional)</span>
                  </label>
                  <textarea
                    id="contact-msg"
                    rows={3}
                    maxLength={500}
                    placeholder="Contoh: Ingin trial hari Sabtu dan konsultasi fat loss dengan Coach Sarah"
                    value={contactMsg}
                    onChange={e => setContactMsg(e.target.value)}
                    className={`${fieldClass} resize-none`}
                  />
                </div>

                {contactError && (
                  <p role="alert" className="text-xs text-rose-400">
                    {contactError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full py-3.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmittingContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membuka WhatsApp…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Kirim via WhatsApp
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
