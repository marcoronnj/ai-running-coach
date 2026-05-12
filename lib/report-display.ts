export interface ReportDisplayData {
  title?: string | null;
  summary?: string | null;
  full_report?: string | null;
}

function containsItalianText(value: string): boolean {
  return /\b(corsa|corse|recupero|riposo|domani|dopodomani|oggi|seduta|allenamento|fatica|continuità|sovraccarico|consigliato|prossime|riepilogo|camminata|mobilità|atleta)\b/i.test(value);
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
