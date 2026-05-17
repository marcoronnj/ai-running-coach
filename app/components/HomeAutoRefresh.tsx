'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/lib/i18n';

const AUTO_REFRESH_INITIAL_DELAY_MS = 500;
const AUTO_REFRESH_RETRY_DELAY_MS = 2_000;
const AUTO_REFRESH_STOP_MS = 4_000;
const AUTO_REFRESH_EXIT_MS = 300;
const AUTO_REFRESH_MAX_ATTEMPTS = 2;

function AutoRefreshPill({ language, visible }: { language: Language; visible: boolean }) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 z-50"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className={[
          'pointer-events-auto inline-flex -translate-x-1/2 items-center gap-2 rounded-full',
          'border border-[rgba(54,252,225,0.22)] bg-black/55 px-4 py-2',
          'text-xs font-medium text-neutral-100 shadow-[0_18px_54px_rgba(0,0,0,0.32)] backdrop-blur-xl',
          'transition-all duration-300 ease-out will-change-transform',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        ].join(' ')}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary opacity-45"
            style={{ animationDuration: '2.4s' }}
          />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-primary shadow-[0_0_14px_rgba(54,252,225,0.6)]" />
        </span>
        <span>{language === 'en' ? 'Live update...' : 'Aggiornamento live...'}</span>
      </div>
    </div>
  );
}

export default function HomeAutoRefresh({ language }: { language: Language }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [renderPill, setRenderPill] = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const attemptsRef = useRef(0);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    initialTimerRef.current = null;
    retryTimerRef.current = null;
    stopTimerRef.current = null;
    exitTimerRef.current = null;
  }

  function hidePill() {
    setPillVisible(false);
    exitTimerRef.current = setTimeout(() => {
      setRenderPill(false);
    }, AUTO_REFRESH_EXIT_MS);
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
    setRenderPill(true);
    requestAnimationFrame(() => setPillVisible(true));

    initialTimerRef.current = setTimeout(() => void fireRefresh('initial'), AUTO_REFRESH_INITIAL_DELAY_MS);
    retryTimerRef.current = setTimeout(() => void fireRefresh('retry'), AUTO_REFRESH_RETRY_DELAY_MS);
    stopTimerRef.current = setTimeout(() => {
      console.log('[HOME AUTO REFRESH] complete');
      hidePill();
    }, AUTO_REFRESH_STOP_MS);

    return clearTimers;
  }, []);

  if (!renderPill) return null;

  return <AutoRefreshPill language={language} visible={pillVisible} />;
}
