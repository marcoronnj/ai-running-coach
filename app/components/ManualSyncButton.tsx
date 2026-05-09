'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, RefreshCw, XCircle } from 'lucide-react';

type SyncState = 'idle' | 'loading' | 'success' | 'warning' | 'error';

interface ManualSyncResponse {
  ok: boolean;
  message?: string;
  warning?: string;
  newActivities?: number;
  reportsGenerated?: number;
  latestActivityId?: string;
  latestReportGenerated?: boolean;
  telegramSent?: boolean;
  retryReportsProcessed?: number;
  duration?: string;
}

function buildStatusMessage(data?: ManualSyncResponse): string {
  if (!data) return 'Errore durante la sincronizzazione';

  const newActivities = data.newActivities ?? 0;
  const reportsGenerated = data.reportsGenerated ?? 0;

  if (data.warning && newActivities > 0) {
    return newActivities === 1
      ? 'Corsa sincronizzata, sto aggiornando il coach'
      : `${newActivities} corse sincronizzate, sto aggiornando il coach`;
  }

  if (newActivities === 0 && reportsGenerated === 0) {
    return 'Nessuna nuova corsa';
  }

  if (reportsGenerated > 0) {
    return reportsGenerated === 1 ? 'Report generato' : `${reportsGenerated} report generati`;
  }

  return newActivities === 1
    ? '1 nuova corsa sincronizzata'
    : `${newActivities} nuove corse sincronizzate`;
}

export default function ManualSyncButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string>('');

  async function handleSync() {
    setState('loading');
    setMessage('');

    try {
      const response = await fetch('/api/manual-sync', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = (await response.json()) as ManualSyncResponse;

      if (!data.ok) {
        throw new Error(data.message || 'Sync non riuscito');
      }

      setState(data.warning ? 'warning' : 'success');
      setMessage(`${buildStatusMessage(data)}. Sync completato, sto aggiornando i dati.`);
      router.refresh();
      window.setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Errore durante la sincronizzazione');
    }
  }

  const label = state === 'loading'
    ? 'Sync...'
    : state === 'success'
      ? 'Aggiornato'
      : state === 'warning'
        ? 'Aggiornato'
      : state === 'error'
        ? 'Errore'
        : 'Sync';
  const Icon = state === 'success' || state === 'warning' ? Check : state === 'error' ? XCircle : RefreshCw;

  return (
    <div className="relative flex flex-col items-start">
      <button
        type="button"
        onClick={handleSync}
        disabled={state === 'loading'}
        className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
      >
        <Icon size={16} strokeWidth={1.8} className={state === 'loading' ? 'animate-spin' : ''} />
        {label}
      </button>
      {message ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-60 rounded-xl border border-white/10 bg-app-card px-3 py-2 text-xs text-neutral-200 shadow-lg shadow-black/30">
          {message}
        </div>
      ) : null}
    </div>
  );
}
