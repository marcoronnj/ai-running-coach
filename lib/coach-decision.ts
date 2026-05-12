import { CoachReport, DBActivity } from './coach';
import { CoachingMetrics } from './coaching-metrics';
import { getDaysSince } from './date-utils';
import { normalizeLanguage, type Language } from './i18n';

/**
 * Coach Decision - practical recommendation for the next 48 hours.
 */
export interface CoachDecision {
  status: 'recovery' | 'easy' | 'progression' | 'caution' | 'insufficient_data';
  label: string;
  title: string;
  message: string;
  actionToday: string;
  actionTomorrow: string;
  nextWorkout: string;
  nextWorkoutLabel: string;
  reason: string;
  hasRunToday: boolean;
  daysSinceLatestRun: number;
}

export function buildCoachDecision(
  report?: CoachReport | null,
  metrics?: CoachingMetrics | null,
  latestActivity?: Partial<DBActivity> | null,
  language: Language = 'it'
): CoachDecision {
  const currentLanguage = normalizeLanguage(language);
  const isEnglish = currentLanguage === 'en';
  const daysSinceLatestRun = latestActivity?.start_date ? getDaysSince(latestActivity.start_date) : metrics?.daysSinceLastRun ?? 999;
  const hasRunToday = daysSinceLatestRun === 0;
  const latestDistanceKm = latestActivity?.distance_m
    ? `${(latestActivity.distance_m / 1000).toFixed(1)} km`
    : (isEnglish ? 'activity' : 'attività');

  if (!report && !metrics) {
    return {
      status: 'insufficient_data',
      label: isEnglish ? 'Insufficient data' : 'Dati insufficienti',
      title: isEnglish ? 'Sync a new run' : 'Sincronizza una nuova corsa',
      message: isEnglish ? 'The coach needs recent data to provide personalized guidance.' : 'Il coach ha bisogno di dati recenti per dare consigli personalizzati.',
      actionToday: isEnglish ? 'Rest or light walking' : 'Riposo o camminata leggera',
      actionTomorrow: isEnglish ? 'Wait for sync' : 'Attendi sincronizzazione',
      nextWorkout: isEnglish ? 'After the next run' : 'Dopo prossima corsa',
      nextWorkoutLabel: isEnglish ? 'Day after tomorrow / Next run' : 'Dopodomani / Prossima corsa',
      hasRunToday,
      daysSinceLatestRun,
      reason: isEnglish ? 'No report or metrics available' : 'Nessun report o metriche disponibili',
    };
  }

  if (!report && metrics) {
    return {
      status: 'insufficient_data',
      label: isEnglish ? 'Imported history' : 'Storico importato',
      title: isEnglish ? 'Report pending' : 'Report in attesa',
      message: isEnglish
        ? 'Metrics are up to date, but the AI report for the latest run is still missing.'
        : 'Le metriche sono aggiornate, ma manca ancora il report AI collegato all’ultima corsa.',
      actionToday: hasRunToday
        ? (isEnglish
          ? `Run completed: ${latestDistanceKm}. Now only light recovery, easy walking, or mobility.`
          : `Corsa completata: ${latestDistanceKm}. Ora solo recupero leggero, camminata facile o mobilità.`)
        : (isEnglish ? 'Rest or light activity' : 'Riposo o attività leggera'),
      actionTomorrow: hasRunToday
        ? (isEnglish ? 'Recovery or full rest if your legs feel heavy.' : 'Recupero o riposo completo se senti gambe pesanti.')
        : (isEnglish ? 'Easy run only if you feel fresh' : 'Easy run solo se ti senti fresco'),
      nextWorkout: hasRunToday
        ? (isEnglish ? 'Day after tomorrow, if legs are fresh, 30-40 minutes very easy recovery.' : 'Dopodomani, se le gambe sono fresche, 30-40 minuti recovery molto facile.')
        : (isEnglish ? 'Next easy run when recovery is good' : 'Prossima corsa facile quando il recupero è buono'),
      nextWorkoutLabel: hasRunToday
        ? (isEnglish ? 'Day after tomorrow / Next run' : 'Dopodomani / Prossima corsa')
        : (isEnglish ? 'Next run' : 'Prossima corsa'),
      hasRunToday,
      daysSinceLatestRun,
      reason: isEnglish ? 'Report unavailable, metrics calculated from history' : 'Report non disponibile, metriche calcolate da storico',
    };
  }

  let status: 'recovery' | 'easy' | 'progression' | 'caution' = 'easy';
  const reasonParts: string[] = [];

  if (metrics?.overloadRisk === 'alto' || (metrics?.fatigueScore && metrics.fatigueScore >= 60)) {
    status = 'recovery';
    reasonParts.push(isEnglish ? 'high overload risk or elevated fatigue' : 'rischio sovrallenamento alto o fatica elevata');
  } else if (metrics?.overloadRisk === 'medio') {
    status = 'caution';
    reasonParts.push(isEnglish ? 'medium overload risk' : 'rischio sovrallenamento medio');
  } else if (metrics?.readinessScore && metrics.readinessScore < 40) {
    status = 'recovery';
    reasonParts.push(isEnglish ? 'low readiness' : 'readiness bassa');
  } else if (metrics?.consistencyLabel === 'in costruzione' || (metrics?.consistencyScore && metrics.consistencyScore < 40)) {
    status = 'easy';
    reasonParts.push(isEnglish ? 'irregular consistency' : 'consistenza irregolare');
  } else if (metrics?.daysSinceLastRun && metrics.daysSinceLastRun > 5) {
    status = 'easy';
    reasonParts.push(isEnglish ? 'long break since last run' : 'pausa prolungata dall’ultima corsa');
  } else if (metrics?.daysSinceLastRun === 0) {
    status = 'recovery';
    reasonParts.push(isEnglish ? 'run completed today' : 'corsa effettuata oggi');
  } else if (metrics?.fatigueScore && metrics.fatigueScore <= 35 && metrics?.readinessScore && metrics.readinessScore >= 75 && metrics?.consistencyLabel === 'solida') {
    status = 'progression';
    reasonParts.push(isEnglish ? 'strong balance between readiness, fatigue, and consistency' : 'equilibrio perfetto tra readiness, fatica e consistenza');
  }

  let actionToday = '';
  let actionTomorrow = '';
  let nextWorkout = '';
  const nextWorkoutLabel = hasRunToday
    ? (isEnglish ? 'Day after tomorrow / Next run' : 'Dopodomani / Prossima corsa')
    : (isEnglish ? 'Next run' : 'Prossima corsa');

  if (hasRunToday) {
    actionToday = isEnglish
      ? `Run completed: ${latestDistanceKm}. Now only light recovery, easy walking, or mobility.`
      : `Corsa completata: ${latestDistanceKm}. Ora solo recupero leggero, camminata facile o mobilità.`;
    actionTomorrow = isEnglish
      ? 'No running if your legs feel heavy. Recovery or full rest.'
      : 'Niente corsa se senti gambe pesanti. Recupero o riposo completo.';
    nextWorkout = metrics?.readinessScore && metrics.readinessScore >= 60
      ? (isEnglish ? 'Day after tomorrow, if legs are fresh, 30-40 minutes very easy recovery, low HR.' : 'Dopodomani, se le gambe sono fresche, 30-40 minuti recovery molto facile, FC bassa.')
      : (isEnglish ? 'Day after tomorrow, reassess your legs: if fatigue remains high, stay with rest or mobility.' : 'Dopodomani valuta le gambe: se la fatica resta alta, resta su riposo o mobilità.');
  } else {
    const actions = {
      recovery: isEnglish
        ? ['Full rest or 20-30 minutes light walking', 'Rest or light active recovery', 'Resume with an easy run in 2-3 days']
        : ['Riposo completo o camminata leggera 20-30 minuti', 'Riposo o recupero attivo leggero', 'Riprendi con easy run tra 2-3 giorni'],
      easy: isEnglish
        ? ['30-45 minutes easy run or walking', 'Rest or light easy run', '40-50 minute easy run within 48 hours']
        : ['Easy run 30-45 minuti o camminata', 'Riposo o easy run leggero', 'Easy run 40-50 minuti entro 48 ore'],
      progression: isEnglish
        ? ['Easy run or light quality session', 'Rest or easy run', 'Quality session within 48 hours if form is good']
        : ['Easy run o quality session leggera', 'Riposo o easy run', 'Quality session entro 48 ore se forma buona'],
      caution: isEnglish
        ? ['30-40 minutes easy run', 'Mandatory rest', 'Light easy run within 48 hours']
        : ['Easy run 30-40 minuti', 'Riposo obbligatorio', 'Easy run leggero entro 48 ore'],
    }[status];
    [actionToday, actionTomorrow, nextWorkout] = actions;
  }

  const statusConfig: Record<string, { label: string; title: string }> = isEnglish
    ? {
        recovery: { label: 'Recovery', title: 'Recovery focus' },
        easy: { label: 'Easy run', title: 'Easy run recommended' },
        progression: { label: 'Progression', title: 'Controlled progression' },
        caution: { label: 'Caution', title: 'Overload caution' },
        insufficient_data: { label: 'Insufficient data', title: 'Insufficient data' },
      }
    : {
        recovery: { label: 'Recupero', title: 'Focus su Recupero' },
        easy: { label: 'Easy Run', title: 'Easy Run Consigliata' },
        progression: { label: 'Progressione', title: 'Progressione Controllata' },
        caution: { label: 'Cautela', title: 'Cautela Sovraccarico' },
        insufficient_data: { label: 'Dati Insufficienti', title: 'Dati Insufficienti' },
      };

  const config = statusConfig[status] || statusConfig.insufficient_data;
  const message = report?.next_48h || (isEnglish
    ? `The coach recommends ${config.label.toLowerCase()} based on your current metrics.`
    : `Il coach raccomanda ${config.label.toLowerCase()} basato sulle tue metriche attuali.`);

  return {
    status,
    label: config.label,
    title: config.title,
    message,
    actionToday,
    actionTomorrow,
    nextWorkout,
    nextWorkoutLabel,
    hasRunToday,
    daysSinceLatestRun,
    reason: reasonParts.length > 0 ? reasonParts.join(', ') : (isEnglish ? 'Based on current metrics' : 'Basato su metriche attuali'),
  };
}
