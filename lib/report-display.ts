export interface ReportDisplayData {
  title?: string | null;
  summary?: string | null;
  full_report?: string | null;
}

export function containsItalianText(value: string): boolean {
  return /\b(corsa|corse|correre|uscita|uscite|recupero|riposo|domani|dopodomani|oggi|ieri|seduta|sedute|allenamento|allenamenti|allenarsi|fatica|continuità|sovraccarico|consigliato|consigliata|consigliati|prossime|prossima|prossimo|riepilogo|camminata|mobilità|atleta|gambe|minuti|facile|leggera|bassa|alta|medio|media|dimagrire|competitivo|resistenza|preparazione|ottima|ottimo|buona|buono|mantieni|evita|riprendi|settimana|settimane|passo|frequenza|cardiaca|dislivello|salita|discesa|qualità|soglia|lento|lenta|veloce|progressivo|progressione|consiglio|indicazione|respirazione|sonno|segnali|rientro|sforzo)\b/i.test(value);
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
