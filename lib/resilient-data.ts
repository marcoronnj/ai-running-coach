import { normalizeLanguage, type Language } from '@/lib/i18n';
import type { DynamicAthleteState } from '@/lib/dynamic-athlete-state';

export function logServerError(scope: string, error: unknown): void {
  console.error(`[RESILIENCE] ${scope} failed`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export async function safeResolve<T>(
  scope: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    logServerError(scope, error);
    return fallback;
  }
}

export interface SafeResult<T> {
  data: T;
  failed: boolean;
}

export async function safeResult<T>(
  scope: string,
  loader: () => Promise<T>,
  fallback: T
): Promise<SafeResult<T>> {
  try {
    return { data: await loader(), failed: false };
  } catch (error) {
    logServerError(scope, error);
    return { data: fallback, failed: true };
  }
}

export function fallbackDynamicAthleteState(language: Language = 'it'): DynamicAthleteState {
  const currentLanguage = normalizeLanguage(language);
  const isEnglish = currentLanguage === 'en';

  return {
    hasRunToday: false,
    daysSinceLatestRun: null,
    readinessScore: null,
    readinessLabel: isEnglish ? 'insufficient data' : 'dati insufficienti',
    fatigueScore: null,
    fatigueLabel: isEnglish ? 'insufficient data' : 'dati insufficienti',
    consistencyScore: null,
    consistencyLabel: isEnglish ? 'insufficient data' : 'dati insufficienti',
    overloadRisk: 'dati insufficienti',
    recoveryStatus: isEnglish ? 'temporarily unavailable' : 'temporaneamente non disponibile',
    suggestedFocus: isEnglish
      ? 'Data is temporarily unavailable. Keep activity light until the app refreshes.'
      : 'Dati temporaneamente non disponibili. Mantieni attività leggera finché l’app si aggiorna.',
    todayAction: isEnglish
      ? 'Data is temporarily unavailable. Try again shortly.'
      : 'Dati temporaneamente non disponibili. Riprova tra poco.',
    tomorrowAction: isEnglish
      ? 'Keep the plan conservative until updated data is available.'
      : 'Mantieni il piano prudente finché i dati aggiornati non sono disponibili.',
    nextAction: isEnglish
      ? 'Refresh or sync manually when the connection is stable.'
      : 'Aggiorna o sincronizza manualmente quando la connessione è stabile.',
    timeline: [
      {
        label: isEnglish ? 'Now' : 'Ora',
        title: isEnglish ? 'Data unavailable' : 'Dati non disponibili',
        description: isEnglish
          ? 'The app is open, but some training data could not be loaded.'
          : 'L’app è aperta, ma alcuni dati di allenamento non sono stati caricati.',
      },
      {
        label: isEnglish ? 'Next' : 'Dopo',
        title: isEnglish ? 'Retry softly' : 'Riprova senza forzare',
        description: isEnglish
          ? 'Use refresh or manual sync once the connection is stable.'
          : 'Usa aggiorna o sync manuale quando la connessione è stabile.',
      },
    ],
    explanation: isEnglish
      ? 'Some data is temporarily unavailable. Veiro is keeping the page usable instead of interrupting the session.'
      : 'Alcuni dati sono temporaneamente non disponibili. Veiro mantiene la pagina utilizzabile senza interrompere la sessione.',
  };
}
