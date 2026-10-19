import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Download, ScrollText } from 'lucide-react';
import { downloadCsv } from '../../lib/finance';
import { toDateKey } from '../../lib/membership';

const ROLES = ['ALL', 'ADMIN', 'COACH', 'MEMBER'] as const;
const ROLE_LABEL: Record<(typeof ROLES)[number], string> = { ALL: 'Semua', ADMIN: 'Admin', COACH: 'Coach', MEMBER: 'Member' };
const PAGE = 50;

export const AdminAuditLog: React.FC = () => {
  const { auditLogs, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('ALL');
  const [visible, setVisible] = useState(PAGE);

  const q = search.trim().toLowerCase();
  const logs = useMemo(
    () =>
      auditLogs
        .filter(l => (role === 'ALL' || l.actorRole === role) && (!q || `${l.action} ${l.actorName} ${l.details}`.toLowerCase().includes(q)))
        .toSorted((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [auditLogs, q, role]
  );

  const exportCsv = () => {
    downloadCsv(`audit-log-apex-${toDateKey()}.csv`, [
      ['Waktu', 'Aksi', 'Peran', 'Pelaku', 'Detail'],
      ...logs.map(l => [l.timestamp, l.action, l.actorRole, l.actorName, l.details]),
    ]);
    showToast(`${logs.length} catatan diekspor.`, 'success');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase text-white">Audit log</h1>
          <p className="text-xs text-zinc-400 mt-1">Riwayat tindakan penting: transaksi, perubahan data, check-in, dan pengelolaan akun. Disimpan selama sesi berjalan.</p>
        </div>
        <button onClick={exportCsv} disabled={logs.length === 0} className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-xs font-bold text-black transition-colors flex items-center gap-1.5 self-start disabled:opacity-40">
          <Download className="w-4 h-4" /> Ekspor CSV
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            aria-label="Cari log"
            placeholder="Cari aksi, nama pelaku, atau detail"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setVisible(PAGE);
            }}
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
          />
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter peran">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setVisible(PAGE);
              }}
              aria-pressed={role === r}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${role === r ? 'bg-white text-black border-white' : 'bg-surface border-line text-zinc-400 hover:text-white hover:border-line-strong'}`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="p-4 border-b border-line text-xs text-zinc-400 font-mono">{logs.length} aksi tercatat</div>
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText className="w-9 h-9 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Tidak ada catatan yang cocok.</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {logs.slice(0, visible).map(log => (
                <li key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-white">{log.action}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">{log.actorRole}</span>
                      <span className="text-zinc-400">oleh {log.actorName}</span>
                    </div>
                    <p className="text-zinc-300 text-[11px] leading-relaxed break-words">{log.details}</p>
                  </div>
                  <time dateTime={log.timestamp} className="font-mono text-zinc-500 text-[11px] shrink-0 sm:text-right">
                    {new Date(log.timestamp).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                  </time>
                </li>
              ))}
            </ul>
            {logs.length > visible && (
              <div className="p-4 border-t border-line text-center">
                <button onClick={() => setVisible(v => v + PAGE)} className="px-4 py-2 rounded-lg border border-line-strong hover:border-white text-xs font-semibold text-white transition-colors">
                  Tampilkan lebih banyak ({logs.length - visible} lagi)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
