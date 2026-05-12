'use client';

import { useEffect } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[APP_ERROR_BOUNDARY] Route render failed', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="app-screen">
      <div className="app-container flex min-h-[80vh] items-center justify-center">
        <section className="premium-card fade-in w-full max-w-md p-5 text-center sm:p-6">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,216,77,0.22)] bg-[rgba(255,216,77,0.1)] text-[var(--warning)]">
            <ShieldAlert size={24} strokeWidth={1.8} />
          </div>

          <p className="eyebrow mb-2">Veiro</p>
          <h1 className="mb-3 text-xl font-semibold tracking-tight text-app-text">
            Dati temporaneamente non disponibili
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-app-muted">
            L’app è rimasta aperta, ma questa vista non è riuscita a caricarsi. Riprova tra poco.
          </p>

          <button
            type="button"
            onClick={reset}
            className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2.5 text-sm font-bold text-black"
          >
            <RefreshCw size={16} strokeWidth={2} />
            Riprova
          </button>
        </section>
      </div>
    </main>
  );
}
