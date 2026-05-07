'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type SyncState = 'idle' | 'loading' | 'success' | 'error';

interface ManualSyncResponse {
  ok: boolean;
  message?: string;
  newActivities?: number;
  reportsGenerated?: number;
  duration?: string;
}

function buildStatusMessage(data?: ManualSyncResponse): string {
  if (!data) return 'Errore durante la sincronizzazione';

  const newActivities = data.newActivities ?? 0;
  const reportsGenerated = data.reportsGenerated ?? 0;

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

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Sync non riuscito');
      }

      setState('success');
      setMessage(`${buildStatusMessage(data)}. Sync completato, sto aggiornando i dati.`);
      router.refresh();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Errore durante la sincronizzazione');
    }
  }

  const label = state === 'loading'
    ? 'Sync...'
    : state === 'success'
      ? 'Aggiornato'
      : state === 'error'
        ? 'Errore'
        : '🔄 Sync';

  return (
    <div className="relative flex flex-col items-start">
      <button
        type="button"
        onClick={handleSync}
        disabled={state === 'loading'}
        className="inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-colors duration-200 text-sm"
      >
        {label}
      </button>
      {message ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
