'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, XCircle } from 'lucide-react';
import { normalizeLanguage, type Language } from '@/lib/i18n';
import { containsItalianText } from '@/lib/report-display';

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

function buildStatusMessage(data: ManualSyncResponse | undefined, language: Language): string {
  if (!data) return language === 'en' ? 'Sync error' : 'Errore durante la sincronizzazione';

  const newActivities = data.newActivities ?? 0;
  const reportsGenerated = data.reportsGenerated ?? 0;

  if (data.warning && newActivities > 0) {
    return newActivities === 1
      ? (language === 'en' ? 'New run synced' : 'Corsa sincronizzata, sto aggiornando il coach')
      : (language === 'en' ? `${newActivities} runs synced` : `${newActivities} corse sincronizzate, sto aggiornando il coach`);
  }

  if (newActivities === 0 && reportsGenerated === 0) {
    return language === 'en' ? 'No new activities' : 'Nessuna nuova attività';
  }

  if (reportsGenerated > 0) {
    return reportsGenerated === 1
      ? (language === 'en' ? 'Report generated' : 'Report generato')
      : (language === 'en' ? `${reportsGenerated} reports generated` : `${reportsGenerated} report generati`);
  }

  return newActivities === 1
    ? (language === 'en' ? 'New activity synced, no run report' : '1 nuova attività sincronizzata, nessun report corsa')
    : (language === 'en' ? `${newActivities} new activities synced, no run reports` : `${newActivities} nuove attività sincronizzate, nessun report corsa`);
}

function safeErrorMessage(value: string | undefined, language: Language): string {
  if (language === 'en') {
    if (!value || containsItalianText(value)) return 'Sync failed';
  }
  return value || (language === 'en' ? 'Sync failed' : 'Sync non riuscito');
}

export default function ManualSyncButton({ language = 'it', iconOnly = false }: { language?: Language; iconOnly?: boolean }) {
  const currentLanguage = normalizeLanguage(language);
  const router = useRouter();
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string>('');
  const [latestActivityId, setLatestActivityId] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleSync() {
    if (state === 'loading') return;

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    setState('loading');
    setMessage('');
    setLatestActivityId(null);

    try {
      const response = await fetch('/api/manual-sync', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = (await response.json().catch(() => null)) as ManualSyncResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(safeErrorMessage(data?.message, currentLanguage));
      }

      setState(data.warning ? 'warning' : 'success');
      setMessage(buildStatusMessage(data, currentLanguage));
      setLatestActivityId(data.latestActivityId ?? null);
      router.refresh();

      resetTimerRef.current = setTimeout(() => {
        setState('idle');
        setMessage('');
        setLatestActivityId(null);
      }, 4500);
    } catch (error) {
      setState('error');
      setMessage(safeErrorMessage(error instanceof Error ? error.message : undefined, currentLanguage));

      resetTimerRef.current = setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 4500);
    }
  }

  const label = state === 'loading'
    ? 'Sync...'
    : state === 'success'
        ? (currentLanguage === 'en' ? 'Updated' : 'Aggiornato')
      : state === 'warning'
        ? (currentLanguage === 'en' ? 'Updated' : 'Aggiornato')
      : state === 'error'
        ? (currentLanguage === 'en' ? 'Error' : 'Errore')
        : (currentLanguage === 'en' ? 'Sync' : 'Sincronizza');
  const ariaLabel = currentLanguage === 'en' ? 'Sync' : 'Sincronizza';
  const Icon = state === 'success' || state === 'warning' ? Check : state === 'error' ? XCircle : RefreshCw;

  return (
    <div className="relative flex flex-col items-start">
      <button
        type="button"
        onClick={handleSync}
        disabled={state === 'loading'}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={iconOnly
          ? 'pressable inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-app-text disabled:cursor-not-allowed disabled:opacity-60'
          : 'pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-60 sm:px-4'}
      >
        <Icon size={16} strokeWidth={1.8} className={state === 'loading' ? 'animate-spin' : ''} />
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </button>
      {message ? (
        <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-white/10 bg-app-card px-3 py-2 text-xs text-neutral-200 shadow-lg shadow-black/30">
          <div>{message}</div>
          {latestActivityId ? (
            <Link href={`/runs/${latestActivityId}`} className="mt-2 inline-flex font-semibold text-accent-primary">
              {currentLanguage === 'en' ? 'Open analysis' : 'Apri analisi'}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
