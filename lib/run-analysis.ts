export interface RunAnalysisReport {
  title?: string;
  summary?: string;
  full_report?: string;
  next_48h?: string;
  suggested_focus?: string;
  readiness_score?: number;
  fatigue_score?: number;
  consistency_score?: number;
  risk_level?: string;
}

export interface RunAnalysisActivity {
  distance_m?: number;
  moving_time_s?: number;
  elapsed_time_s?: number;
  average_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
  raw_json?: any;
}

export interface RunJudgement {
  label: string;
  summary: string;
  effort: string;
  recoveryHint: string;
  formImpact: string;
}

function formatPace(speedMs?: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

function formatKm(meters?: number, language: Language = 'it'): string {
  if (!meters || meters <= 0) return language === 'en' ? 'distance unavailable' : 'distanza non disponibile';
  return `${(meters / 1000).toFixed(1)} km`;
}

function roundValue(value?: number): string {
  if (value === undefined || value === null) return 'N/A';
  return `${Math.round(value)}`;
}

export function buildRunJudgement(
  activity: RunAnalysisActivity,
  report?: RunAnalysisReport,
  language: Language = 'it'
): RunJudgement {
  const currentLanguage = normalizeLanguage(language);
  const isEnglish = currentLanguage === 'en';
  const haveReport = report && (report.summary || report.full_report || report.next_48h || report.suggested_focus || report.readiness_score !== undefined || report.fatigue_score !== undefined || report.consistency_score !== undefined);

  if (haveReport) {
    const label = report?.title ? report.title : (isEnglish ? 'Session judgement' : 'Giudizio sulla seduta');
    const summary = report?.summary
      ? report.summary
      : report?.full_report
      ? report.full_report
      : (isEnglish ? 'Coach analysis available for this run.' : 'Analisi del coach disponibile per questa corsa.');

    const effort = report?.suggested_focus
      ? (isEnglish ? `Suggested focus: ${report.suggested_focus}` : `Focus consigliato: ${report.suggested_focus}`)
      : (isEnglish ? 'Follow the coach guidance to recover or progress.' : 'Segui i suggerimenti del coach per recuperare o progredire.');

    const recoveryHint = report?.next_48h
      ? report.next_48h
      : (isEnglish ? 'Use the next sync to update recovery and the plan.' : 'Usa il prossimo sync per aggiornare il recupero e il piano.');

    const formImpactParts: string[] = [];
    if (report?.readiness_score !== undefined) {
      formImpactParts.push(`readiness ${report.readiness_score}`);
    }
    if (report?.fatigue_score !== undefined) {
      formImpactParts.push(`fatigue ${report.fatigue_score}`);
    }
    if (report?.consistency_score !== undefined) {
      formImpactParts.push(`consistency ${report.consistency_score}`);
    }
    const formImpact = formImpactParts.length > 0
      ? (isEnglish ? `Current scores: ${formImpactParts.join(', ')}.` : `Punteggi attuali: ${formImpactParts.join(', ')}.`)
      : (isEnglish ? 'Updated AI assessment available for current form.' : 'Disponibile una valutazione AI aggiornata per lo stato forma.');

    return {
      label,
      summary,
      effort,
      recoveryHint,
      formImpact,
    };
  }

  const pace = formatPace(activity.average_speed);
  const distanceLabel = formatKm(activity.distance_m, currentLanguage);
  const elevation = activity.total_elevation_gain ?? 0;
  const averageHr = activity.average_heartrate;
  const isHighHr = averageHr !== undefined && averageHr >= 155;
  const isSteep = elevation >= 150;
  const isFastPace = activity.average_speed !== undefined && activity.average_speed >= 3.0;

  let summary = isEnglish ? `Run of ${distanceLabel}` : `Corsa da ${distanceLabel}`;
  if (activity.average_speed) {
    summary += isEnglish ? ` at an average pace of ${pace}` : ` a passo medio ${pace}`;
  }
  if (isHighHr) {
    summary += isEnglish ? ' with sustained heart rate.' : ' con frequenza cardiaca sostenuta.';
  } else if (activity.average_heartrate !== undefined) {
    summary += isEnglish ? ` with average HR ${roundValue(activity.average_heartrate)} bpm.` : ` con FC media ${roundValue(activity.average_heartrate)} bpm.`;
  }

  if (isSteep) {
    summary += isEnglish ? ' Elevation gain means pace should be interpreted in context.' : ' Dislivello significa che il passo è contestualizzato alla salita.';
  }

  if (!averageHr) {
    summary = isEnglish ? `Heart-rate data unavailable. ${summary}` : `Dati cardio non disponibili. ${summary}`;
  }

  let effort = isEnglish ? 'Balanced session.' : 'Seduta equilibrata.';
  if (isHighHr && !isSteep) {
    effort = isEnglish ? 'Session was more demanding than expected.' : 'Seduta più impegnativa del previsto.';
  } else if (isFastPace && !isSteep) {
    effort = isEnglish ? 'Good faster session, pay attention to recovery.' : 'Buona seduta veloce, attenzione al recupero.';
  } else if (!averageHr && isSteep) {
    effort = isEnglish ? 'Hill session with effort inferred from elevation gain.' : 'Allenamento di salita con sforzo basato su dislivello.';
  } else if (!averageHr && !activity.average_speed) {
    effort = isEnglish ? 'Unable to determine precise effort from available data.' : 'Impossibile determinare lo sforzo preciso dai dati disponibili.';
  } else if (activity.average_speed && activity.average_speed < 2.8) {
    effort = isEnglish ? 'Controlled aerobic session.' : 'Seduta aerobica controllata.';
  }

  let recoveryHint = isEnglish ? 'Light recovery recommended.' : 'Recupero leggero consigliato.';
  if (isHighHr) {
    recoveryHint = isEnglish ? 'Take at least 24-48 hours of active recovery.' : 'Fai almeno 24-48 ore di recupero attivo.';
  } else if (isSteep) {
    recoveryHint = isEnglish ? 'Active recovery with extra care for leg muscles.' : 'Recupero attivo con attenzione ai muscoli delle gambe.';
  }

  let formImpact = isEnglish ? 'Contributes to building aerobic endurance.' : 'Contribuisce a costruire la resistenza aerobica.';
  if (isHighHr) {
    formImpact = isEnglish ? 'High impact, useful for adaptation but requires recovery.' : 'Impatto elevato, utile per adattamento ma richiede recupero.';
  } else if (activity.average_speed && activity.average_speed < 2.8) {
    formImpact = isEnglish ? 'Good base endurance session.' : 'Buona seduta base per l’endurance.';
  }

  return {
    label: isEnglish ? 'Run judgement' : 'Giudizio corsa',
    summary,
    effort,
    recoveryHint,
    formImpact,
  };
}
import { normalizeLanguage, type Language } from './i18n';
