import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red) */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible replacement for window.confirm(). */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  danger = false,
  onConfirm,
  onCancel,
}) => (
  <Modal isOpen={isOpen} onClose={onCancel} label={title} maxWidth="max-w-sm" hideClose>
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <span className={`p-2 rounded-lg shrink-0 ${danger ? 'bg-rose-500/15 text-rose-400' : 'bg-amber-500/15 text-amber-400'}`}>
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-white">{title}</h2>
          <div className="text-xs text-zinc-400 leading-relaxed mt-1.5">{message}</div>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-line-strong text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-colors ${
            danger ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-white hover:bg-zinc-200 text-black'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);
