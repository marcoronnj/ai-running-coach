export const APP_TIMEZONE = 'Europe/Rome';

type DateInput = string | Date;

function toDate(value: DateInput): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

function getAppDateParts(value: DateInput) {
  const date = toDate(value);
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

function datePartsToUtcDate(parts: { year: number; month: number; day: number }): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function getTodayInAppTimezone(): Date {
  return startOfTodayRome();
}

export function startOfTodayRome(today: Date = new Date()): Date {
  return datePartsToUtcDate(getAppDateParts(today));
}

export function isSameDayInRome(a: DateInput, b: DateInput = new Date()): boolean {
  const first = getAppDateParts(a);
  const second = getAppDateParts(b);
  return first.year === second.year && first.month === second.month && first.day === second.day;
}

export function daysSinceInRome(value: DateInput, today: Date = new Date()): number {
  const target = datePartsToUtcDate(getAppDateParts(value));
  const current = datePartsToUtcDate(getAppDateParts(today));
  const delta = Math.round((current.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  return delta >= 0 ? delta : 0;
}

export function getDateLocale(language: unknown): 'it-IT' | 'en-US' {
  return language === 'en' ? 'en-US' : 'it-IT';
}

export function formatDateLocalized(value: DateInput, language: unknown): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat(getDateLocale(language), {
    timeZone: APP_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateIT(value: DateInput): string {
  return formatDateLocalized(value, 'it');
}

export function formatTimeIT(value: DateInput): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateTimeIT(value: DateInput): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getDaysSince(value: DateInput): number {
  return daysSinceInRome(value);
}

export function formatDaysSinceLocalized(value: DateInput, language: unknown): string {
  const days = getDaysSince(value);
  if (language === 'en') {
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }
  if (days === 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} giorni fa`;
}

export function formatDaysSince(value: DateInput): string {
  return formatDaysSinceLocalized(value, 'it');
}
