export const APP_TIMEZONE = 'Europe/Rome';

function getAppDateParts(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const record: Record<string, string> = {};

  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      record[part.type] = part.value;
    }
  }

  return {
    year: Number(record.year),
    month: Number(record.month),
    day: Number(record.day),
  };
}

export function getTodayInAppTimezone(): Date {
  const now = new Date();
  const { year, month, day } = getAppDateParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateIT(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getDaysSince(value: string | Date): number {
  const target = getAppDateParts(value);
  const today = getAppDateParts(getTodayInAppTimezone());
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const delta = Math.round((todayUtc - targetUtc) / (1000 * 60 * 60 * 24));
  return delta >= 0 ? delta : 0;
}

export function formatDaysSince(value: string | Date): string {
  const days = getDaysSince(value);
  if (days === 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} giorni fa`;
}
