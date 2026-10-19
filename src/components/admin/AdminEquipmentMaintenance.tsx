import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { GymEquipment, EquipmentReport } from '../../types';
import { Wrench, Clock, Search, Check } from 'lucide-react';

export const AdminEquipmentMaintenance: React.FC = () => {
  const {
    gymEquipment,
    equipmentReports,
    updateEquipmentStatus,
    updateEquipmentReportStatus,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'EQUIPMENT' | 'TICKETS'>('EQUIPMENT');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  const categories = ['Semua', 'Free Weights', 'Cardio', 'Machines', 'Wellness & Recovery', 'Functional'];

  const filteredEquipment = gymEquipment.filter(e => {
    if (selectedCategory !== 'Semua' && e.category !== selectedCategory) return false;
    if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const operationalCount = gymEquipment.filter(e => e.status === 'OPERATIONAL').length;
  const needsServiceCount = gymEquipment.filter(e => e.status === 'NEEDS_SERVICE').length;
  const openTicketsCount = equipmentReports.filter(r => r.status !== 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-brand" />
            <h1 className="text-2xl font-extrabold uppercase text-white">Pemeliharaan alat gym</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Status unit, jadwal servis, dan tiket kerusakan dari member.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-line rounded-2xl">
          <button
            onClick={() => setActiveTab('EQUIPMENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'EQUIPMENT'
                ? 'bg-brand text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Inventaris Alat ({gymEquipment.length})
          </button>
          <button
            onClick={() => setActiveTab('TICKETS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'TICKETS'
                ? 'bg-brand text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Tiket Kerusakan ({openTicketsCount} Aktif)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Total Peralatan</span>
          <div className="text-2xl font-black font-mono text-white mt-1">{gymEquipment.length} Unit</div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Terdata di inventaris</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">Operasional 100%</span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">{operationalCount} Unit</div>
          <span className="text-[11px] text-emerald-400 mt-0.5 block">Siap digunakan</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">Jadwal Servis</span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">{needsServiceCount} Unit</div>
          <span className="text-[11px] text-amber-400 mt-0.5 block">Perlu inspeksi teknisi</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line">
          <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider block">Tiket Keluhan</span>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">{openTicketsCount} Tiket</div>
          <span className="text-[11px] text-rose-400 mt-0.5 block">Belum diselesaikan</span>
        </div>
      </div>

      {activeTab === 'EQUIPMENT' ? (
        <div className="space-y-4">
          {/* Controls: Search & Category */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                placeholder="Cari alat gym..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface border border-line text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-white text-black font-bold'
                      : 'bg-surface text-zinc-400 hover:text-white border border-line'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Equipment Table */}
          <div className="overflow-x-auto rounded-2xl bg-surface border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/50 text-zinc-400 font-mono uppercase text-[10px] border-b border-line">
                <tr>
                  <th className="py-3 px-4">Nama Alat & Lokasi</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Status Saat Ini</th>
                  <th className="py-3 px-4">Inspeksi Terakhir</th>
                  <th className="py-3 px-4">Servis Berikutnya</th>
                  <th className="py-3 px-4 text-right">Aksi Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredEquipment.map(eq => (
                  <tr key={eq.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white leading-snug">{eq.name}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{eq.location}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 font-medium">{eq.category}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          eq.status === 'OPERATIONAL'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : eq.status === 'NEEDS_SERVICE'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        {eq.status === 'OPERATIONAL'
                          ? 'Operasional Normal'
                          : eq.status === 'NEEDS_SERVICE'
                          ? 'Perlu Servis'
                          : 'Dalam Perbaikan'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400">{eq.lastServiceDate}</td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300">{eq.nextServiceDate}</td>
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={eq.status}
                        onChange={e => updateEquipmentStatus(eq.id, e.target.value as GymEquipment['status'])}
                        aria-label={`Ubah status ${eq.name}`}
                        className="px-2.5 py-1 rounded-lg bg-black/60 border border-zinc-700 text-[11px] text-white focus:outline-none focus:border-brand"
                      >
                        <option value="OPERATIONAL">Operasional</option>
                        <option value="NEEDS_SERVICE">Perlu Servis</option>
                        <option value="UNDER_MAINTENANCE">Perbaikan</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tickets View */
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-surface border border-line space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand" />
              <span>Daftar Laporan Kendala Alat dari Member</span>
            </h3>

            {equipmentReports.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">Tidak ada laporan kerusakan aktif.</p>
            ) : (
              <div className="space-y-3">
                {equipmentReports.map(rep => (
                  <div
                    key={rep.id}
                    className="p-4 rounded-2xl bg-black/40 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{rep.equipmentName}</span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          oleh {rep.memberName} ({rep.date})
                        </span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
                        "{rep.issueDescription}"
                      </p>
                      {rep.adminNotes && (
                        <p className="text-[11px] text-zinc-300">
                          Tanggapan Admin: {rep.adminNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={rep.status}
                        onChange={e => updateEquipmentReportStatus(rep.id, e.target.value as EquipmentReport['status'])}
                        className="px-3 py-1.5 rounded-xl bg-black/60 border border-zinc-700 text-xs font-bold text-white focus:outline-none focus:border-brand"
                      >
                        <option value="PENDING">Menunggu (Pending)</option>
                        <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                        <option value="RESOLVED">Selesai (Resolved)</option>
                      </select>

                      {rep.status !== 'RESOLVED' && (
                        <button
                          onClick={() => updateEquipmentReportStatus(rep.id, 'RESOLVED', 'Teknisi telah menyelesaikan servis.')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center gap-1"
                          title="Tandai Selesai"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Selesai</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
