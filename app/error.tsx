'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Home, RefreshCw, ShieldAlert } from 'lucide-react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [isEnglish, setIsEnglish] = useState(false);

  useEffect(() => {
    setIsEnglish(navigator.language.toLowerCase().startsWith('en'));
    console.error('[APP_ERROR_BOUNDARY] Route render failed', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const title = isEnglish
    ? 'We couldn’t load your data right now.'
    : 'Non siamo riusciti a caricare temporaneamente i dati.';
  const body = isEnglish
    ? 'Veiro is still available. Try again or return to the dashboard.'
    : 'Veiro resta disponibile. Riprova oppure torna alla dashboard.';
  const retryLabel = isEnglish ? 'Try again' : 'Riprova';
  const dashboardLabel = isEnglish ? 'Dashboard' : 'Dashboard';

  return (
    <main className="min-h-dvh bg-app-bg text-app-text" style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
      <div className="flex min-h-dvh items-center justify-center px-4 py-[calc(env(safe-area-inset-top,0px)+2rem)]">
        <section className="premium-card fade-in w-full max-w-md p-5 text-center sm:p-6">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,216,77,0.22)] bg-[rgba(255,216,77,0.1)] text-[var(--warning)]">
            <ShieldAlert size={24} strokeWidth={1.8} />
          </div>

          <Image
            src="/logo.svg"
            alt="Veiro"
            width={80}
            height={30}
            priority
            className="mx-auto mb-3 block h-6 w-auto sm:h-[30px]"
          />
          <h1 className="mb-3 text-xl font-semibold tracking-tight text-app-text">
            {title}
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-app-muted">
            {body}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={unstable_retry}
              className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2.5 text-sm font-bold text-black"
            >
              <RefreshCw size={16} strokeWidth={2} />
              {retryLabel}
            </button>
            <Link
              href="/"
              className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
            >
              <Home size={16} strokeWidth={1.8} />
              {dashboardLabel}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
