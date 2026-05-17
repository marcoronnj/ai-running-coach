'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import type { Language } from '@/lib/i18n';

const AUTO_REFRESH_INITIAL_DELAY_MS = 500;
const AUTO_REFRESH_RETRY_DELAY_MS = 2_000;
const AUTO_REFRESH_STOP_MS = 4_000;
const AUTO_REFRESH_MAX_ATTEMPTS = 2;

function AutoRefreshPill({ language, isPending }: { language: Language; isPending: boolean }) {
  return (
    <div className="mb-3 flex justify-center sm:justify-start">
      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(54,252,225,0.2)] bg-black/35 px-3 py-1.5 text-xs font-semibold text-neutral-200 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-md transition-opacity duration-300">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-primary shadow-[0_0_12px_rgba(54,252,225,0.55)]" />
        </span>
        <span>{language === 'en' ? 'Live update...' : 'Aggiornamento live...'}</span>
        {isPending ? <RotateCw size={12} strokeWidth={2} className="animate-spin text-accent-secondary" /> : null}
      </div>
    </div>
  );
}

export default function HomeAutoRefresh({ language }: { language: Language }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const attemptsRef = useRef(0);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    initialTimerRef.current = null;
    retryTimerRef.current = null;
    stopTimerRef.current = null;
  }

  async function fireRefresh(reason: 'initial' | 'retry') {
    if (attemptsRef.current >= AUTO_REFRESH_MAX_ATTEMPTS) return;

    attemptsRef.current += 1;

    try {
      console.log('[HOME AUTO REFRESH] invalidate cache');
      await fetch('/api/dashboard/invalidate-cache', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.warn('[HOME AUTO REFRESH] invalidate cache failed', error);
    }

    try {
      await fetch(`/api/dashboard/fresh?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.warn('[HOME AUTO REFRESH] fresh warmup failed', error);
    }

    console.log(reason === 'retry' ? '[HOME AUTO REFRESH] second refresh fired' : '[HOME AUTO REFRESH] router refresh fired');
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    console.log('[HOME AUTO REFRESH] mounted');
    attemptsRef.current = 0;
    setRefreshing(true);

    initialTimerRef.current = setTimeout(() => void fireRefresh('initial'), AUTO_REFRESH_INITIAL_DELAY_MS);
    retryTimerRef.current = setTimeout(() => void fireRefresh('retry'), AUTO_REFRESH_RETRY_DELAY_MS);
    stopTimerRef.current = setTimeout(() => {
      console.log('[HOME AUTO REFRESH] complete');
      setRefreshing(false);
    }, AUTO_REFRESH_STOP_MS);

    return clearTimers;
  }, []);

  if (!refreshing) return null;

  return <AutoRefreshPill language={language} isPending={isPending} />;
}
