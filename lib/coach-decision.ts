import { CoachReport, DBActivity } from './coach';
import { CoachingMetrics } from './coaching-metrics';
import { getDaysSince } from './date-utils';

/**
 * Coach Decision - raccomandazione pratica per le prossime 48 ore
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

/**
 * Costruisce la decisione del coach basata su report, metriche e ultima attività
 */
export function buildCoachDecision(
  report?: CoachReport | null,
  metrics?: CoachingMetrics | null,
  latestActivity?: Partial<DBActivity> | null
): CoachDecision {
  const daysSinceLatestRun = latestActivity?.start_date ? getDaysSince(latestActivity.start_date) : metrics?.daysSinceLastRun ?? 999;
  const hasRunToday = daysSinceLatestRun === 0;
  const latestDistanceKm = latestActivity?.distance_m
    ? `${(latestActivity.distance_m / 1000).toFixed(1)} km`
    : 'attività';

  // Fallback: dati insufficienti
  if (!report && !metrics) {
    return {
      status: 'insufficient_data',
      label: 'Dati Insufficienti',
      title: 'Sincronizza una nuova corsa',
      message: 'Il coach ha bisogno di dati recenti per dare consigli personalizzati.',
      actionToday: 'Riposo o camminata leggera',
      actionTomorrow: 'Attendi sincronizzazione',
      nextWorkout: 'Dopo prossima corsa',
      nextWorkoutLabel: 'Dopodomani / Prossima corsa',
      hasRunToday,
      daysSinceLatestRun,
      reason: 'Nessun report o metriche disponibili'
    };
  }

  // Se abbiamo metriche ma nessun report recente
  if (!report && metrics) {
    return {
      status: 'insufficient_data',
      label: 'Storico Importato',
      title: 'Report in attesa',
      message: 'Le metriche sono aggiornate, ma manca ancora il report AI collegato all’ultima corsa.',
      actionToday: hasRunToday
        ? `Corsa completata: ${latestDistanceKm}. Ora solo recupero leggero, camminata facile o mobilità.`
        : 'Riposo o attività leggera',
      actionTomorrow: hasRunToday ? 'Recupero o riposo completo se senti gambe pesanti.' : 'Easy run solo se ti senti fresco',
      nextWorkout: hasRunToday ? 'Dopodomani, se le gambe sono fresche, 30-40 minuti recovery molto facile.' : 'Prossima corsa facile quando il recupero è buono',
      nextWorkoutLabel: hasRunToday ? 'Dopodomani / Prossima corsa' : 'Prossima corsa',
      hasRunToday,
      daysSinceLatestRun,
      reason: 'Report non disponibile, metriche calcolate da storico'
    };
  }

  // Da qui in poi abbiamo un report
  const reportData = report!;

  // Determina status basato su metriche e report
  let status: 'recovery' | 'easy' | 'progression' | 'caution' = 'easy';
  const reasonParts: string[] = [];

  // Priorità: overload e fatigue
  if (metrics?.overloadRisk === 'alto' || (metrics?.fatigueScore && metrics.fatigueScore >= 60)) {
    status = 'recovery';
    reasonParts.push('rischio sovrallenamento alto o fatica elevata');
  } else if (metrics?.overloadRisk === 'medio') {
    status = 'caution';
    reasonParts.push('rischio sovrallenamento medio');
  } else if (metrics?.readinessScore && metrics.readinessScore < 40) {
    status = 'recovery';
    reasonParts.push('readiness bassa');
  } else if (metrics?.consistencyLabel === 'in costruzione' || (metrics?.consistencyScore && metrics.consistencyScore < 40)) {
    status = 'easy';
    reasonParts.push('consistenza irregolare');
  } else if (metrics?.daysSinceLastRun && metrics.daysSinceLastRun > 5) {
    status = 'easy';
    reasonParts.push('pausa prolungata dall\'ultima corsa');
  } else if (metrics?.daysSinceLastRun === 0) {
    status = 'recovery';
    reasonParts.push('corsa effettuata oggi');
  } else if (metrics?.fatigueScore && metrics.fatigueScore <= 35 && metrics?.readinessScore && metrics.readinessScore >= 75 && metrics?.consistencyLabel === 'solida') {
    status = 'progression';
    reasonParts.push('equilibrio perfetto tra readiness, fatica e consistenza');
  }

  // Costruisci le azioni pratiche
  let actionToday = '';
  let actionTomorrow = '';
  let nextWorkout = '';
  const nextWorkoutLabel = hasRunToday ? 'Dopodomani / Prossima corsa' : 'Prossima corsa';

  if (hasRunToday) {
    actionToday = `Corsa completata: ${latestDistanceKm}. Ora solo recupero leggero, camminata facile o mobilità.`;
    actionTomorrow = 'Niente corsa se senti gambe pesanti. Recupero o riposo completo.';
    nextWorkout = metrics?.readinessScore && metrics.readinessScore >= 60
      ? 'Dopodomani, se le gambe sono fresche, 30-40 minuti recovery molto facile, FC bassa.'
      : 'Dopodomani valuta le gambe: se la fatica resta alta, resta su riposo o mobilità.';
  } else {
    switch (status) {
      case 'recovery':
        actionToday = 'Riposo completo o camminata leggera 20-30 minuti';
        actionTomorrow = 'Riposo o recupero attivo leggero';
        nextWorkout = 'Riprendi con easy run tra 2-3 giorni';
        break;
      case 'easy':
        actionToday = 'Easy run 30-45 minuti o camminata';
        actionTomorrow = 'Riposo o easy run leggero';
        nextWorkout = 'Easy run 40-50 minuti entro 48 ore';
        break;
      case 'progression':
        actionToday = 'Easy run o quality session leggera';
        actionTomorrow = 'Riposo o easy run';
        nextWorkout = 'Quality session entro 48 ore se forma buona';
        break;
      case 'caution':
        actionToday = 'Easy run 30-40 minuti';
        actionTomorrow = 'Riposo obbligatorio';
        nextWorkout = 'Easy run leggero entro 48 ore';
        break;
    }
  }

  // Costruisci reason completo
  const reason = reasonParts.length > 0 ? reasonParts.join(', ') : 'Basato su metriche attuali';

  // Determina label e title
  const statusConfig: Record<string, { label: string; title: string }> = {
    recovery: { label: 'Recupero', title: 'Focus su Recupero' },
    easy: { label: 'Easy Run', title: 'Easy Run Consigliata' },
    progression: { label: 'Progressione', title: 'Progressione Controllata' },
    caution: { label: 'Cautela', title: 'Cautela Sovraccarico' },
    insufficient_data: { label: 'Dati Insufficienti', title: 'Dati Insufficienti' }
  };

  const config = statusConfig[status] || statusConfig.insufficient_data;

  // Messaggio personalizzato
  let message = '';
  if (reportData?.next_48h) {
    message = reportData.next_48h;
  } else {
    message = `Il coach raccomanda ${config.label.toLowerCase()} basato sulle tue metriche attuali.`;
  }

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
    reason
  };
}
