import React from 'react';
import { RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

/** Catches render errors so a single broken screen never blanks the whole app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('APEX UI error:', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen bg-ink text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-extrabold uppercase mb-3">Terjadi Kesalahan</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Halaman ini gagal ditampilkan. Data Anda tersimpan di server; muat ulang untuk mencoba lagi.
          </p>
          <button
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }
}
