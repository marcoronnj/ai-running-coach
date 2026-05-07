export interface ReportDisplayData {
  title?: string | null;
  summary?: string | null;
  full_report?: string | null;
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

export function getCoachReportExcerpt(report?: ReportDisplayData | null, maxLength = 220): string | null {
  if (!report) return null;

  const source = report.summary || report.full_report || [report.title, report.summary].filter(Boolean).join('. ');
  if (!source) return null;

  const cleaned = cleanMarkdown(source);
  if (cleaned.length <= maxLength) return cleaned;

  const truncated = cleaned.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${truncated}...`;
}
