'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { t, type Language } from '@/lib/i18n';

type PushStatus = 'checking' | 'unsupported' | 'disabled' | 'enabled' | 'denied';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export default function PushNotificationManager({ language }: { language: Language }) {
  const [status, setStatus] = useState<PushStatus>('checking');
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!isPushSupported()) {
        setStatus('unsupported');
        return;
      }

      if (Notification.permission === 'denied') {
        setStatus('denied');
        return;
      }

      try {
        const registered = await navigator.serviceWorker.register('/sw.js');
        const currentSubscription = await registered.pushManager.getSubscription();

        if (cancelled) return;

        setRegistration(registered);
        setSubscription(currentSubscription);
        setStatus(currentSubscription ? 'enabled' : 'disabled');
      } catch (error) {
        console.warn('[PUSH] service worker registration failed', error);
        if (!cancelled) setStatus('unsupported');
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enableNotifications() {
    if (!registration || busy) return;

    setBusy(true);

    try {
      const permission = await Notification.requestPermission();

      if (permission === 'denied') {
        setStatus('denied');
        return;
      }

      if (permission !== 'granted') {
        setStatus('disabled');
        return;
      }

      const keyResponse = await fetch('/api/push/public-key', { cache: 'no-store' });
      const keyPayload = (await keyResponse.json()) as { supported?: boolean; publicKey?: string | null };

      if (!keyPayload.supported || !keyPayload.publicKey) {
        setStatus('unsupported');
        return;
      }

      const nextSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyPayload.publicKey),
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSubscription),
      });

      if (!response.ok) {
        throw new Error(`Subscribe failed: ${response.status}`);
      }

      setSubscription(nextSubscription);
      setStatus('enabled');
    } catch (error) {
      console.warn('[PUSH] enable failed', error);
      setStatus(isPushSupported() ? 'disabled' : 'unsupported');
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!subscription || busy) return;

    setBusy(true);

    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      setSubscription(null);
      setStatus('disabled');
    } catch (error) {
      console.warn('[PUSH] disable failed', error);
    } finally {
      setBusy(false);
    }
  }

  const title = t(language, 'notifications.title');
  const statusLabel = status === 'enabled'
    ? t(language, 'notifications.enabled')
    : status === 'unsupported'
      ? t(language, 'notifications.unsupported')
      : status === 'denied'
        ? t(language, 'notifications.denied')
        : t(language, 'notifications.disabled');
  const Icon = status === 'enabled' ? Bell : BellOff;

  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent-secondary">
            <Icon size={18} strokeWidth={1.8} />
          </div>
          <h2 className="text-2xl font-bold text-app-text">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-app-muted">{statusLabel}</p>
          <p className="mt-2 text-xs leading-5 text-neutral-500">{t(language, 'notifications.iosHelp')}</p>
        </div>

        {status === 'enabled' ? (
          <button
            type="button"
            onClick={disableNotifications}
            disabled={busy}
            className="pressable inline-flex h-11 w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BellOff size={16} strokeWidth={1.8} />
            {t(language, 'notifications.disable')}
          </button>
        ) : (
          <button
            type="button"
            onClick={enableNotifications}
            disabled={busy || status === 'unsupported' || status === 'denied' || status === 'checking'}
            className="pressable inline-flex h-11 w-fit items-center justify-center gap-2 rounded-xl border border-[rgba(215,255,63,0.28)] bg-[rgba(215,255,63,0.12)] px-4 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Bell size={16} strokeWidth={1.8} />
            {t(language, 'notifications.enable')}
          </button>
        )}
      </div>
    </section>
  );
}
