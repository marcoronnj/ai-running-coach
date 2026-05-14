import { getRecoveryTimelineState } from './recovery-timeline';

export interface ReportDisplayData {
  title?: string | null;
  summary?: string | null;
  full_report?: string | null;
  next_48h?: string | null;
  start_date?: string | null;
  distance_m?: number | null;
  readiness_score?: number | null;
  fatigue_score?: number | null;
  risk_level?: string | null;
  suggested_focus?: string | null;
}

export function containsItalianText(value: string): boolean {
  return /\b(corsa|corse|correre|corri|correrai|uscita|uscite|recupero|riposo|domani|dopodomani|oggi|ieri|seduta|sedute|allenamento|allenamenti|allenarsi|allenati|fatica|continuità|sovraccarico|consigliato|consigliata|consigliati|prossime|prossima|prossimo|riepilogo|camminata|mobilità|atleta|gambe|minuti|facile|leggera|leggero|bassa|basso|alta|alto|medio|media|dimagrire|dimagrimento|competitivo|competitività|resistenza|preparazione|preparare|ottima|ottimo|buona|buono|mantieni|mantenere|evita|evitare|riprendi|riprendere|settimana|settimane|passo|frequenza|cardiaca|cardio|dislivello|salita|discesa|qualità|soglia|lento|lenta|veloce|progressivo|progressione|consiglio|consigli|indicazione|indicazioni|respirazione|sonno|segnali|rientro|sforzo|sforzi|andatura|ritmo|chilometri|mattutino|mattutina|pomeridiano|pomeridiana|serale|pranzo|gara|gare|obiettivo|obiettivi|forma|carico|scarico|sovrallenamento|dolore|infortunio|infortuni)\b/i.test(value);
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasCoachReport(report?: ReportDisplayData | null): boolean {
  return Boolean(report?.title || report?.summary || report?.full_report);
}

export function getCoachReportExcerpt(report?: ReportDisplayData | null, maxLength = 220, language: 'it' | 'en' = 'it'): string | null {
  if (!report) return null;

  if (report.start_date) {
    const temporalSource = [report.summary, report.full_report, report.next_48h].filter(Boolean).join(' ');
    const hasTemporalGuidance = /\b(oggi|domani|dopodomani|today|tomorrow|day after tomorrow|next 48h|prossime 48)\b/i.test(temporalSource);
    const timeline = getRecoveryTimelineState({
      runDate: report.start_date,
      distanceMeters: report.distance_m,
      readinessScore: report.readiness_score,
      fatigueScore: report.fatigue_score,
      overloadRisk: report.risk_level,
      focus: report.suggested_focus,
      language,
    });

    if (hasTemporalGuidance || timeline.hasRunToday || (timeline.daysSinceRun !== null && timeline.daysSinceRun >= 3)) {
      return timeline.excerpt.length <= maxLength
        ? timeline.excerpt
        : `${timeline.excerpt.slice(0, maxLength).replace(/\s+\S*$/, '').trim()}...`;
    }
  }

  const source = report.summary || report.full_report || [report.title, report.summary].filter(Boolean).join('. ');
  if (!source) return null;

  const cleaned = cleanMarkdown(source);
  if (language === 'en' && containsItalianText(cleaned)) {
    return 'Historical analysis available. Open the run for details or use the live coach for current guidance.';
  }
  if (cleaned.length <= maxLength) return cleaned;

  const truncated = cleaned.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${truncated}...`;
}
