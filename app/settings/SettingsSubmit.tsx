'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, CheckCircle2, LoaderCircle, Save } from 'lucide-react';

type SaveStatus = 'success' | 'error' | null;

export default function SettingsSubmit({ status }: { status: SaveStatus }) {
  const { pending } = useFormStatus();
  const [visibleStatus, setVisibleStatus] = useState<SaveStatus>(status);

  useEffect(() => {
    setVisibleStatus(status);

    if (!status) return;

    const timeout = window.setTimeout(() => {
      setVisibleStatus(null);
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (pending) {
      setVisibleStatus(null);
    }
  }, [pending]);

  return (
    <div className="space-y-3">
      {visibleStatus ? (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            visibleStatus === 'success'
              ? 'border-[rgba(124,255,138,0.22)] bg-[rgba(124,255,138,0.08)] text-[var(--success)]'
              : 'border-[rgba(255,98,98,0.22)] bg-[rgba(255,98,98,0.08)] text-[var(--danger)]'
          }`}
          role="status"
          aria-live="polite"
        >
          {visibleStatus === 'success' ? (
            <CheckCircle2 className="mt-0.5 shrink-0" size={17} strokeWidth={1.8} />
          ) : (
            <AlertCircle className="mt-0.5 shrink-0" size={17} strokeWidth={1.8} />
          )}
          <span>
            {visibleStatus === 'success'
              ? 'Impostazioni aggiornate con successo'
              : 'Errore durante il salvataggio. Riprova.'}
          </span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {pending ? (
            <LoaderCircle size={17} strokeWidth={2} className="animate-spin" />
          ) : (
            <Save size={17} strokeWidth={2} />
          )}
          {pending ? 'Salvando...' : 'Salva impostazioni'}
        </button>
      </div>
    </div>
  );
}
