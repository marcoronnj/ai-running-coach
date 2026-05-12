'use client';

import { type ReactNode, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RefreshCw } from 'lucide-react';
import { normalizeLanguage, type Language } from '@/lib/i18n';

type PullState = 'idle' | 'pulling' | 'ready' | 'loading' | 'success';

interface PullToRefreshProps {
  children: ReactNode;
  language?: Language;
}

const THRESHOLD_PX = 70;
const MAX_PULL_PX = 108;

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, button, a, label, [role="button"], [contenteditable="true"]'));
}

function isInsideScrollableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  let element: HTMLElement | null = target;
  while (element && element !== document.body && element !== document.documentElement) {
    const style = window.getComputedStyle(element);
    const canScrollY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;

    if (canScrollY) {
      return true;
    }

    element = element.parentElement;
  }

  return false;
}

function getPullMessage(state: PullState, language: Language) {
  if (language === 'en') {
    switch (state) {
      case 'ready':
        return 'Release to refresh';
      case 'loading':
        return 'Refreshing...';
      case 'success':
        return 'Updated';
      case 'pulling':
        return 'Pull to refresh';
      default:
        return '';
    }
  }

  switch (state) {
    case 'ready':
      return 'Rilascia per aggiornare';
    case 'loading':
      return 'Aggiornamento...';
    case 'success':
      return 'Aggiornato';
    case 'pulling':
      return 'Trascina per aggiornare';
    default:
      return '';
  }
}

export default function PullToRefresh({ children, language = 'it' }: PullToRefreshProps) {
  const currentLanguage = normalizeLanguage(language);
  const router = useRouter();
  const [state, setState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);
  const loadingRef = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runRefresh() {
    loadingRef.current = true;
    setState('loading');
    setPullDistance(THRESHOLD_PX);

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    try {
      router.refresh();
      window.setTimeout(() => {
        setState('success');
        setPullDistance(48);
      }, 300);
    } catch (error) {
      console.error('[PULL TO REFRESH] Refresh failed:', error);
      window.location.reload();
    }

    resetTimerRef.current = setTimeout(() => {
      loadingRef.current = false;
      activeRef.current = false;
      setState('idle');
      setPullDistance(0);
    }, 1200);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (loadingRef.current || window.scrollY > 0 || isInteractiveElement(event.target) || isInsideScrollableElement(event.target)) {
      activeRef.current = false;
      return;
    }

    startYRef.current = event.touches[0]?.clientY ?? 0;
    activeRef.current = true;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!activeRef.current || loadingRef.current) return;

    const currentY = event.touches[0]?.clientY ?? 0;
    const deltaY = currentY - startYRef.current;

    if (deltaY <= 0 || window.scrollY > 0) {
      setState('idle');
      setPullDistance(0);
      return;
    }

    const dampenedDistance = Math.min(MAX_PULL_PX, deltaY * 0.55);
    setPullDistance(dampenedDistance);
    setState(dampenedDistance >= THRESHOLD_PX ? 'ready' : 'pulling');

    if (dampenedDistance > 12) {
      event.preventDefault();
    }
  }

  function handleTouchEnd() {
    if (!activeRef.current || loadingRef.current) return;

    const shouldRefresh = pullDistance >= THRESHOLD_PX;
    activeRef.current = false;

    if (shouldRefresh) {
      runRefresh();
      return;
    }

    setState('idle');
    setPullDistance(0);
  }

  const visible = state !== 'idle';
  const progress = Math.min(1, pullDistance / THRESHOLD_PX);
  const Icon = state === 'success' ? Check : RefreshCw;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        aria-live="polite"
        className="pointer-events-none fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-app-card/95 px-3 py-2 text-xs font-semibold text-app-text shadow-lg shadow-black/30 backdrop-blur transition-all duration-200 sm:hidden"
        style={{
          opacity: visible ? 1 : 0,
          transform: `translate(-50%, ${visible ? Math.max(0, pullDistance - 42) : -24}px) scale(${visible ? 1 : 0.96})`,
        }}
      >
        <Icon
          size={15}
          strokeWidth={1.9}
          className={state === 'loading' ? 'animate-spin text-accent-secondary' : 'text-accent-primary'}
          style={state === 'pulling' || state === 'ready' ? { transform: `rotate(${progress * 160}deg)` } : undefined}
        />
        <span>{getPullMessage(state, currentLanguage)}</span>
      </div>
      {children}
    </div>
  );
}
