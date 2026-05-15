'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, ExternalLink, LoaderCircle, RefreshCw, Unlink, AlertCircle, UserCircle } from 'lucide-react';
import { Card, SectionHeader } from '@/app/components/ui';
import type { PublicStravaConnectionStatus } from '@/lib/strava-connection';
import { normalizeLanguage, type Language } from '@/lib/i18n';
import { containsItalianText } from '@/lib/report-display';

type ActionState = 'idle' | 'syncing' | 'disconnecting' | 'refreshing-athlete';
type Message = { type: 'success' | 'error'; text: string } | null;

function safeActionError(value: string | undefined, language: Language, fallback: string): string {
  if (language === 'en') {
    if (!value || containsItalianText(value)) return fallback;
  }
  return value || fallback;
}

export default function StravaConnectionBox({
  status,
  initialMessage,
  language = 'it',
}: {
  status: PublicStravaConnectionStatus;
  initialMessage?: Message;
  language?: Language;
}) {
  const currentLanguage = normalizeLanguage(language);
  const router = useRouter();
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [message, setMessage] = useState<Message>(initialMessage ?? null);

  async function syncRuns() {
    setActionState('syncing');
    setMessage(null);

    try {
      const response = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; newActivities?: number };

      if (!response.ok || !data.ok) {
        throw new Error(safeActionError(data.message, currentLanguage, currentLanguage === 'en' ? 'Strava sync failed' : 'Sync Strava non riuscita'));
      }

      const newActivities = data.newActivities ?? 0;
      setMessage({
        type: 'success',
        text: newActivities === 1
          ? (currentLanguage === 'en' ? '1 new activity synced' : '1 nuova attività sincronizzata')
          : newActivities > 1
            ? (currentLanguage === 'en' ? `${newActivities} new activities synced` : `${newActivities} nuove attività sincronizzate`)
            : (currentLanguage === 'en' ? 'No new activities' : 'Nessuna nuova attività'),
      });
      router.refresh();
      window.setTimeout(() => router.refresh(), 500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: safeActionError(error instanceof Error ? error.message : undefined, currentLanguage, currentLanguage === 'en' ? 'Error during Strava sync' : 'Errore durante la sync Strava'),
      });
    } finally {
      setActionState('idle');
    }
  }

  async function disconnect() {
    setActionState('disconnecting');
    setMessage(null);

    try {
      const response = await fetch('/api/strava/disconnect', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !data.ok) {
        throw new Error(safeActionError(data.message, currentLanguage, currentLanguage === 'en' ? 'Disconnect failed' : 'Disconnessione non riuscita'));
      }

      setMessage({ type: 'success', text: currentLanguage === 'en' ? 'Strava disconnected' : 'Strava disconnesso' });
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: safeActionError(error instanceof Error ? error.message : undefined, currentLanguage, currentLanguage === 'en' ? 'Error while disconnecting' : 'Errore durante la disconnessione'),
      });
    } finally {
      setActionState('idle');
    }
  }

  async function refreshAthlete() {
    setActionState('refreshing-athlete');
    setMessage(null);

    try {
      const response = await fetch('/api/strava/refresh-athlete', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; firstname?: string | null; lastname?: string | null };

      if (!response.ok || !data.ok) {
        throw new Error(safeActionError(data.message, currentLanguage, currentLanguage === 'en' ? 'Athlete refresh failed' : 'Aggiornamento dati atleta non riuscito'));
      }

      const updatedName = [data.firstname, data.lastname].filter(Boolean).join(' ').trim();
      setMessage({
        type: 'success',
        text: updatedName
          ? (currentLanguage === 'en' ? `Athlete data updated: ${updatedName}` : `Dati atleta aggiornati: ${updatedName}`)
          : (currentLanguage === 'en' ? 'Athlete data updated' : 'Dati atleta aggiornati'),
      });
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: safeActionError(error instanceof Error ? error.message : undefined, currentLanguage, currentLanguage === 'en' ? 'Error while updating athlete data' : 'Errore durante l’aggiornamento dati atleta'),
      });
    } finally {
      setActionState('idle');
    }
  }

  const disabled = actionState !== 'idle';
  const athlete = status.athlete;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ').trim();
  const displayName = fullName || (currentLanguage === 'en' ? 'Strava athlete' : 'Atleta Strava');
  const initials = fullName
    ? fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
    : 'S';
  const profileImage = athlete?.profileMedium || athlete?.profile || null;
  const profileUrl = status.stravaAthleteId ? `https://www.strava.com/athletes/${status.stravaAthleteId}` : null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader eyebrow="integration" title="Strava" icon={RefreshCw} />

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <CheckCircle2
                size={17}
                strokeWidth={1.8}
                className={status.connected ? 'text-[var(--success)]' : 'text-app-muted'}
              />
              {status.connected
                ? (currentLanguage === 'en' ? 'Connected' : 'Collegato')
                : (currentLanguage === 'en' ? 'Not connected' : 'Non collegato')}
            </div>
            <p className="mt-1 text-xs text-app-muted">
              {status.connected
                ? (currentLanguage === 'en'
                  ? 'Strava profile connected correctly'
                  : 'Profilo Strava connesso correttamente')
                : (currentLanguage === 'en'
                  ? 'Connect your personal Strava account to sync activities.'
                  : 'Collega il tuo account Strava personale per sincronizzare le attività.')}
            </p>
          </div>
        </div>

        {message ? (
          <div
            className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-[rgba(124,255,138,0.22)] bg-[rgba(124,255,138,0.08)] text-[var(--success)]'
                : 'border-[rgba(255,98,98,0.22)] bg-[rgba(255,98,98,0.08)] text-[var(--danger)]'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 size={16} strokeWidth={1.8} />
            ) : (
              <AlertCircle size={16} strokeWidth={1.8} />
            )}
            {message.text}
          </div>
        ) : null}

        <div className={`grid gap-2 ${status.connected ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
          {!status.connected ? (
            <a
              href="/api/strava/connect"
              className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
            >
              <ExternalLink size={16} strokeWidth={1.8} />
              {currentLanguage === 'en' ? 'Connect Strava' : 'Collega Strava'}
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={syncRuns}
                disabled={disabled}
                className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionState === 'syncing' ? (
                  <LoaderCircle size={16} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} strokeWidth={1.8} />
                )}
                {actionState === 'syncing'
                  ? (currentLanguage === 'en' ? 'Syncing...' : 'Sincronizzo...')
                  : (currentLanguage === 'en' ? 'Sync runs' : 'Sincronizza corse')}
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={disabled}
                className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionState === 'disconnecting' ? (
                  <LoaderCircle size={16} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Unlink size={16} strokeWidth={1.8} />
                )}
                {currentLanguage === 'en' ? 'Disconnect' : 'Disconnetti'}
              </button>
            </>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader
          eyebrow={currentLanguage === 'en' ? 'STRAVA PROFILE' : 'PROFILO STRAVA'}
          title={status.connected ? displayName : (currentLanguage === 'en' ? 'Strava athlete' : 'Atleta Strava')}
          icon={UserCircle}
        />

        {status.connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] text-lg font-bold text-accent-primary">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={displayName}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                {athlete?.username ? (
                  <div className="mt-0.5 text-sm text-app-muted">@{athlete.username}</div>
                ) : null}
                {status.stravaAthleteId ? (
                  <div className="mt-1 text-xs text-app-muted">Athlete ID {status.stravaAthleteId}</div>
                ) : null}
              </div>
            </div>

            {profileUrl ? (
              <div className="grid gap-2 sm:min-w-52">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
                >
                  <ExternalLink size={16} strokeWidth={1.8} />
                  {currentLanguage === 'en' ? 'Open Strava profile' : 'Apri profilo Strava'}
                </a>
                <button
                  type="button"
                  onClick={refreshAthlete}
                  disabled={disabled}
                  className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionState === 'refreshing-athlete' ? (
                    <LoaderCircle size={16} strokeWidth={1.8} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} strokeWidth={1.8} />
                  )}
                  {actionState === 'refreshing-athlete'
                    ? (currentLanguage === 'en' ? 'Updating...' : 'Aggiorno...')
                    : (currentLanguage === 'en' ? 'Update athlete data' : 'Aggiorna dati atleta')}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-app-muted">
            {currentLanguage === 'en'
              ? 'Connect Strava to view athlete data.'
              : 'Collega Strava per visualizzare i dati atleta.'}
          </p>
        )}
      </Card>
    </div>
  );
}
