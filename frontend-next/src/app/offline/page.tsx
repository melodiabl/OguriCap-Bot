'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => window.location.reload();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => window.location.reload(), 400);
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#060807] text-white px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(37,211,102,0.06),transparent_40%)]" />
      <div className="relative text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04]">
          <WifiOff className="h-9 w-9 text-white/50" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Sin conexión</h1>
        <p className="mt-3 text-sm text-white/50 leading-relaxed">
          No hay acceso a internet. El panel se reconectará automáticamente cuando vuelva la red.
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-semibold transition-all hover:bg-white/[0.1] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          Reintentar
        </button>
      </div>
    </main>
  );
}
