import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { Avatar } from './Avatar';
import { formatDateTimeId } from '../../lib/membership';

interface ChatThreadProps {
  messages: ChatMessage[];
  meId: string;
  /** Name shown in the header, e.g. the coach or client the conversation is with */
  partnerName: string;
  partnerPhoto?: string;
  onSend: (text: string) => Promise<{ success: boolean; message: string }>;
  className?: string;
}

/** 1-on-1 coach ⇄ member conversation, shared by both sides. */
export const ChatThread: React.FC<ChatThreadProps> = ({ messages, meId, partnerName, partnerPhoto, onSend, className = '' }) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await onSend(draft.trim());
    setSending(false);
    // Keep the text if sending failed so nothing the user typed is lost
    if (res.success) setDraft('');
    else setError(res.message);
  };

  return (
    <div className={`bg-surface rounded-2xl border border-line p-5 sm:p-6 flex flex-col h-[520px] ${className}`}>
      <div className="flex items-center gap-3 pb-3 border-b border-line">
        <Avatar name={partnerName} src={partnerPhoto} size={34} />
        <div>
          <span className="font-bold text-white text-sm block">{partnerName}</span>
          <span className="text-[10px] text-zinc-500">Percakapan pribadi · hanya Anda dan {partnerName.split(' ')[0]}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1" role="log" aria-live="polite" aria-label={`Percakapan dengan ${partnerName}`}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 gap-2">
            <MessageSquare className="w-8 h-8 text-zinc-700" />
            <p className="text-xs">Belum ada pesan. Mulai percakapan dengan menulis di bawah.</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === meId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                  isMe ? 'bg-white text-black rounded-tr-sm font-medium' : 'bg-surface-2 text-zinc-200 border border-line rounded-tl-sm'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] text-zinc-600 mt-1">
                {isMe ? 'Anda' : msg.senderName} ·{' '}
                {formatDateTimeId(msg.timestamp, { year: undefined })}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-rose-300 pb-2">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="pt-3 border-t border-line flex items-center gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Tulis pesan
        </label>
        <input
          id="chat-input"
          type="text"
          maxLength={2000}
          autoComplete="off"
          placeholder="Tulis pesan…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="flex-1 bg-surface-2 border border-line-strong rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Kirim pesan"
          className="p-3 rounded-xl bg-white hover:bg-zinc-200 text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
