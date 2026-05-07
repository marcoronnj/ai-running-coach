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

function formatKm(meters?: number): string {
  if (!meters || meters <= 0) return 'distanza non disponibile';
  return `${(meters / 1000).toFixed(1)} km`;
}

function roundValue(value?: number): string {
  if (value === undefined || value === null) return 'N/A';
  return `${Math.round(value)}`;
}

export function buildRunJudgement(
  activity: RunAnalysisActivity,
  report?: RunAnalysisReport
): RunJudgement {
  const haveReport = report && (report.summary || report.full_report || report.next_48h || report.suggested_focus || report.readiness_score !== undefined || report.fatigue_score !== undefined || report.consistency_score !== undefined);

  if (haveReport) {
    const label = report?.title ? report.title : 'Giudizio sulla seduta';
    const summary = report?.summary
      ? report.summary
      : report?.full_report
      ? report.full_report
      : 'Analisi del coach disponibile per questa corsa.';

    const effort = report?.suggested_focus
      ? `Focus consigliato: ${report.suggested_focus}`
      : 'Segui i suggerimenti del coach per recuperare o progredire.';

    const recoveryHint = report?.next_48h
      ? report.next_48h
      : 'Usa il prossimo sync per aggiornare il recupero e il piano.';

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
      ? `Punteggi attuali: ${formImpactParts.join(', ')}.`
      : 'Disponibile una valutazione AI aggiornata per lo stato forma.';

    return {
      label,
      summary,
      effort,
      recoveryHint,
      formImpact,
    };
  }

  const pace = formatPace(activity.average_speed);
  const distanceLabel = formatKm(activity.distance_m);
  const elevation = activity.total_elevation_gain ?? 0;
  const averageHr = activity.average_heartrate;
  const isHighHr = averageHr !== undefined && averageHr >= 155;
  const isSteep = elevation >= 150;
  const isFastPace = activity.average_speed !== undefined && activity.average_speed >= 3.0;

  let summary = `Corsa da ${distanceLabel}`;
  if (activity.average_speed) {
    summary += ` a passo medio ${pace}`;
  }
  if (isHighHr) {
    summary += ' con frequenza cardiaca sostenuta.';
  } else if (activity.average_heartrate !== undefined) {
    summary += ` con FC media ${roundValue(activity.average_heartrate)} bpm.`;
  }

  if (isSteep) {
    summary += ' Dislivello significa che il passo è contestualizzato alla salita.';
  }

  if (!averageHr) {
    summary = `Dati cardio non disponibili. ${summary}`;
  }

  let effort = 'Seduta equilibrata.';
  if (isHighHr && !isSteep) {
    effort = 'Seduta più impegnativa del previsto.';
  } else if (isFastPace && !isSteep) {
    effort = 'Buona seduta veloce, attenzione al recupero.';
  } else if (!averageHr && isSteep) {
    effort = 'Allenamento di salita con sforzo basato su dislivello.';
  } else if (!averageHr && !activity.average_speed) {
    effort = 'Impossibile determinare lo sforzo preciso dai dati disponibili.';
  } else if (activity.average_speed && activity.average_speed < 2.8) {
    effort = 'Seduta aerobica controllata.';
  }

  let recoveryHint = 'Recupero leggero consigliato.';
  if (isHighHr) {
    recoveryHint = 'Fai almeno 24-48 ore di recupero attivo.';
  } else if (isSteep) {
    recoveryHint = 'Recupero attivo con attenzione ai muscoli delle gambe.';
  }

  let formImpact = 'Contribuisce a costruire la resistenza aerobica.';
  if (isHighHr) {
    formImpact = 'Impatto elevato, utile per adattamento ma richiede recupero.';
  } else if (activity.average_speed && activity.average_speed < 2.8) {
    formImpact = 'Buona seduta base per l’endurance.';
  }

  return {
    label: 'Giudizio corsa',
    summary,
    effort,
    recoveryHint,
    formImpact,
  };
}
