import React from 'react';

interface PortalIdentityProps {
  name: string;
  subtitle: string;
  /** Right-aligned status chip text, e.g. "AKTIF" */
  statusLabel?: string;
  statusTone?: 'success' | 'warning' | 'danger' | 'neutral';
  /** Mono detail line under the name (plan, title, scope) */
  detail?: string;
}

const TONES: Record<NonNullable<PortalIdentityProps['statusTone']>, string> = {
  success: 'text-emerald-300 bg-emerald-950/60 border-emerald-800',
  warning: 'text-amber-300 bg-amber-950/60 border-amber-800',
  danger: 'text-rose-300 bg-rose-950/60 border-rose-800',
  neutral: 'text-zinc-300 bg-white/5 border-line-strong',
};

/** Identity card shown at the top of every portal sidebar. */
export const PortalIdentity: React.FC<PortalIdentityProps> = ({
  name,
  subtitle,
  statusLabel,
  statusTone = 'neutral',
  detail,
}) => (
  <div className="p-4 rounded-2xl bg-surface border border-line space-y-3">
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="w-10 h-10 shrink-0 rounded-full bg-brand text-black font-display font-extrabold flex items-center justify-center text-sm"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white truncate">{name}</p>
        <p className="text-[11px] text-zinc-400 truncate">{subtitle}</p>
      </div>
    </div>
    {(detail || statusLabel) && (
      <div className="flex items-center justify-between gap-2 text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-black/40 border border-line text-zinc-300">
        <span className="truncate" title={detail}>{detail}</span>
        {statusLabel && (
          <span className={`shrink-0 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${TONES[statusTone]}`}>
            {statusLabel}
          </span>
        )}
      </div>
    )}
  </div>
);
