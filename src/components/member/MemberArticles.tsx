import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Article } from '../../types';
import { Search, Clock, ArrowLeft, Bookmark, Tag, ArrowRight } from 'lucide-react';
import { readJson, writeJson } from '../../lib/storage';
import { formatDateId } from '../../lib/membership';

const CATEGORIES = ['Semua', 'Pemula', 'Nutrisi', 'Recovery', 'Teknik', 'Motivasi', 'Etika Gym'];

export const MemberArticles: React.FC = () => {
  const { articles, currentUser } = useApp();
  const storageKey = `apex.bookmarks.${currentUser?.id ?? 'guest'}`;

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [onlySaved, setOnlySaved] = useState(false);
  const [selected, setSelected] = useState<Article | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>(() => readJson<string[]>(storageKey, []));

  useEffect(() => writeJson(storageKey, bookmarks), [bookmarks, storageKey]);

  const toggleBookmark = (id: string) => setBookmarks(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const open = (a: Article) => {
    setSelected(a);
    window.scrollTo({ top: 0 });
  };

  const q = search.trim().toLowerCase();
  const filtered = articles.filter(
    a =>
      (category === 'Semua' || a.category === category) &&
      (!onlySaved || bookmarks.includes(a.id)) &&
      (!q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q)))
  );

  if (selected) {
    const saved = bookmarks.includes(selected.id);
    return (
      <article className="max-w-3xl mx-auto bg-surface rounded-2xl border border-line p-6 sm:p-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Kembali ke daftar
          </button>
          <button
            onClick={() => toggleBookmark(selected.id)}
            aria-pressed={saved}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              saved ? 'bg-white text-black border-white' : 'border-line text-zinc-300 hover:border-line-strong'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-black' : ''}`} />
            {saved ? 'Tersimpan' : 'Simpan'}
          </button>
        </div>

        <header>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mb-3">
            <span className="text-white font-bold">{selected.category}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {selected.readTimeMinutes} menit baca
            </span>
            {selected.publishedDate && <span>{formatDateId(selected.publishedDate)}</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase text-white leading-tight">{selected.title}</h1>
        </header>

        <p className="p-4 rounded-xl bg-surface-2 border border-line text-sm text-zinc-300 italic">{selected.summary}</p>

        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line border-t border-line pt-6">{selected.content}</div>

        <div className="pt-6 border-t border-line flex flex-wrap gap-2">
          {selected.tags.map(t => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-line text-zinc-300 flex items-center gap-1">
              <Tag className="w-3 h-3 text-zinc-500" /> {t}
            </span>
          ))}
        </div>
      </article>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold uppercase text-white">Tips gym & edukasi</h1>
        <p className="text-xs text-zinc-400 mt-1">Panduan praktis berbasis sains: teknik angkat beban, pola makan lokal, hingga etika gym.</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            aria-label="Cari artikel"
            placeholder="Cari artikel (mis. nasi, DOMS, squat)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter kategori">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                category === cat ? 'bg-white text-black border-white' : 'bg-surface border-line text-zinc-400 hover:text-white hover:border-line-strong'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            onClick={() => setOnlySaved(v => !v)}
            aria-pressed={onlySaved}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              onlySaved ? 'bg-white text-black border-white' : 'bg-surface border-line text-zinc-400 hover:text-white hover:border-line-strong'
            }`}
          >
            <Bookmark className="w-3 h-3" /> Tersimpan ({bookmarks.length})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-line rounded-2xl">
          <p className="text-sm text-zinc-400 mb-3">{onlySaved && bookmarks.length === 0 ? 'Belum ada artikel tersimpan.' : 'Tidak ada artikel yang cocok.'}</p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('Semua');
              setOnlySaved(false);
            }}
            className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-zinc-200"
          >
            Atur ulang filter
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(art => {
            const saved = bookmarks.includes(art.id);
            return (
              <li key={art.id} className="relative">
                <button
                  onClick={() => open(art)}
                  className="w-full h-full text-left p-5 rounded-2xl bg-surface border border-line hover:border-white transition-colors flex flex-col justify-between group"
                >
                  <div>
                    <div className="text-xs text-zinc-300 font-semibold mb-2 pr-8">{art.category}</div>
                    <h2 className="text-sm font-bold text-white mb-2 line-clamp-2">{art.title}</h2>
                    <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-4">{art.summary}</p>
                  </div>
                  <div className="pt-3 border-t border-line flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>{art.readTimeMinutes} menit baca</span>
                    <span className="text-white font-sans font-bold inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Baca <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => toggleBookmark(art.id)}
                  aria-pressed={saved}
                  aria-label={saved ? `Hapus ${art.title} dari simpanan` : `Simpan ${art.title}`}
                  className={`absolute top-3.5 right-3.5 p-1.5 rounded ${saved ? 'text-white' : 'text-zinc-600 hover:text-zinc-300'}`}
                >
                  <Bookmark className={`w-4 h-4 ${saved ? 'fill-white' : ''}`} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
