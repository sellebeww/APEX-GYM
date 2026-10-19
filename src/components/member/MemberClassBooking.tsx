import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { GroupClass } from '../../types';
import { Calendar, Clock, MapPin, Users, Flame, Ticket, ClipboardCheck, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from '../common/Modal';

const DAYS = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const CATEGORIES = ['Semua', 'Strength', 'HIIT', 'Pilates', 'Mobility', 'Powerlifting', 'Agility'];
const DAY_ORDER = DAYS.slice(1);

const pill = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
    active ? 'bg-white text-black border-white' : 'bg-surface text-zinc-400 border-line hover:text-white hover:border-line-strong'
  }`;

export const MemberClassBooking: React.FC = () => {
  const { groupClasses, bookGroupClass, cancelGroupClass, currentUser, memberProfiles, showToast, setMemberTab } = useApp();
  const [selectedDay, setSelectedDay] = useState('Semua');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [viewTab, setViewTab] = useState<'ALL' | 'MY_CLASSES'>('ALL');
  const [ticketClass, setTicketClass] = useState<GroupClass | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const memberId = currentUser?.id ?? '';
  const isExpired = memberProfiles[memberId]?.status === 'EXPIRED';

  const filteredClasses = useMemo(
    () =>
      groupClasses
        .filter(
          c =>
            (viewTab === 'ALL' || c.enrolledMemberIds.includes(memberId)) &&
            (selectedDay === 'Semua' || c.day === selectedDay) &&
            (selectedCategory === 'Semua' || c.category === selectedCategory)
        )
        .toSorted((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.time.localeCompare(b.time)),
    [groupClasses, viewTab, selectedDay, selectedCategory, memberId]
  );
  const myBookedCount = groupClasses.filter(c => c.enrolledMemberIds.includes(memberId)).length;

  const handleBook = async (cls: GroupClass) => {
    setBusyId(cls.id);
    const res = await bookGroupClass(cls.id);
    setBusyId(null);
    showToast(res.message, res.success ? 'success' : 'error');
    if (res.success) {
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 }, colors: ['#F5F5F5', '#FFFFFF'] });
      } catch {
        /* cosmetic */
      }
    }
  };

  const handleCancel = async (cls: GroupClass) => {
    setBusyId(cls.id);
    const res = await cancelGroupClass(cls.id);
    setBusyId(null);
    showToast(res.message, res.success ? 'info' : 'error');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h1 className="text-2xl font-extrabold uppercase text-white">Kelas studio</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">Termasuk dalam membership aktif tanpa biaya tambahan per sesi.</p>
        </div>

        <div role="tablist" className="flex items-center gap-1 p-1 bg-surface border border-line rounded-xl self-start sm:self-auto">
          <button
            role="tab"
            aria-selected={viewTab === 'ALL'}
            onClick={() => setViewTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${viewTab === 'ALL' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
          >
            Semua kelas ({groupClasses.length})
          </button>
          <button
            role="tab"
            aria-selected={viewTab === 'MY_CLASSES'}
            onClick={() => setViewTab('MY_CLASSES')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              viewTab === 'MY_CLASSES' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            Kelas saya ({myBookedCount})
          </button>
        </div>
      </div>

      {isExpired && (
        <div role="alert" className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-100">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            Membership Anda tidak aktif, reservasi kelas dinonaktifkan.
          </span>
          <button onClick={() => setMemberTab('membership')} className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold shrink-0">
            Perpanjang paket
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Filter hari">
          {DAYS.map(d => (
            <button key={d} onClick={() => setSelectedDay(d)} aria-pressed={selectedDay === d} className={pill(selectedDay === d)}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Filter kategori">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} aria-pressed={selectedCategory === cat} className={pill(selectedCategory === cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filteredClasses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface border border-line space-y-3">
          <Ticket className="w-10 h-10 text-zinc-600 mx-auto" />
          <h2 className="text-sm font-bold text-white">Tidak ada kelas yang sesuai</h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {viewTab === 'MY_CLASSES'
              ? 'Anda belum mendaftar di kelas mana pun. Jelajahi jadwal di tab "Semua kelas".'
              : 'Pilih hari atau kategori lain untuk melihat jadwal kelas.'}
          </p>
          {viewTab === 'MY_CLASSES' && (
            <button onClick={() => setViewTab('ALL')} className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold">
              Lihat semua kelas
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClasses.map(cls => {
            const isEnrolled = cls.enrolledMemberIds.includes(memberId);
            const spotsRemaining = cls.maxCapacity - cls.enrolledCount;
            const isFull = spotsRemaining <= 0;
            const percentFilled = Math.round((cls.enrolledCount / cls.maxCapacity) * 100);

            return (
              <article
                key={cls.id}
                className={`p-5 rounded-2xl bg-surface border transition-colors flex flex-col justify-between gap-4 ${
                  isEnrolled ? 'border-white/60' : 'border-line hover:border-line-strong'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white uppercase tracking-wider">{cls.category}</span>
                    <span className="text-xs font-mono font-bold text-white flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {cls.day}, {cls.time}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-white">{cls.name}</h2>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1 line-clamp-2">{cls.description}</p>
                  </div>

                  <dl className="p-3 rounded-xl bg-black/40 border border-line space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                        <MapPin className="w-3.5 h-3.5" /> Ruangan
                      </dt>
                      <dd className="font-semibold text-white text-right">{cls.room}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                        <Flame className="w-3.5 h-3.5" /> Intensitas
                      </dt>
                      <dd className="font-semibold text-amber-400">{cls.intensity}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-zinc-400 shrink-0">
                        <Users className="w-3.5 h-3.5" /> Instruktur
                      </dt>
                      <dd className="font-semibold text-white text-right">{cls.coachName}</dd>
                    </div>
                  </dl>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Kapasitas</span>
                      <span className="font-mono text-zinc-300">
                        {cls.enrolledCount}/{cls.maxCapacity} · {isFull ? 'penuh' : `${spotsRemaining} tersisa`}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Kapasitas kelas"
                      aria-valuenow={percentFilled}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-line"
                    >
                      <div
                        className={`h-full rounded-full ${isFull ? 'bg-rose-500' : percentFilled > 70 ? 'bg-amber-400' : 'bg-white'}`}
                        style={{ width: `${percentFilled}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-line">
                  {isEnrolled ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTicketClass(cls)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" /> Bukti reservasi
                      </button>
                      <button
                        onClick={() => void handleCancel(cls)}
                        disabled={busyId === cls.id}
                        className="py-2.5 px-4 rounded-xl border border-rose-500/40 text-rose-400 font-semibold text-xs hover:bg-rose-500/10 transition-colors"
                      >
                        Batalkan
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => void handleBook(cls)}
                      disabled={isFull || isExpired || busyId === cls.id}
                      className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors bg-white text-black hover:bg-zinc-200 disabled:bg-surface-2 disabled:text-zinc-500 disabled:cursor-not-allowed"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      {isFull ? 'Slot penuh' : isExpired ? 'Membership tidak aktif' : 'Reservasi slot'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal isOpen={!!ticketClass} onClose={() => setTicketClass(null)} label="Bukti reservasi kelas" maxWidth="max-w-sm">
        {ticketClass && (
          <div className="p-6 space-y-5 text-center">
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.2em] block">Reservasi terkonfirmasi</span>
              <h2 className="text-lg font-bold text-white mt-1">{ticketClass.name}</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {ticketClass.day}, {ticketClass.time} WIB · {ticketClass.room}
              </p>
            </div>

            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Nama Anda tercatat di daftar peserta kelas ini. Masuk gym seperti biasa dengan QR member, lalu sebutkan nama Anda ke instruktur.
            </p>

            <dl className="text-xs bg-black/40 p-3 rounded-xl border border-line text-left space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Nama member</dt>
                <dd className="text-white font-medium">{currentUser?.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Instruktur</dt>
                <dd className="text-white font-medium text-right">{ticketClass.coachName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">Akses masuk</dt>
                <dd className="text-white font-medium">Buka 15 menit sebelum sesi</dd>
              </div>
            </dl>

            <button onClick={() => setTicketClass(null)} className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors">
              Tutup
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
};
