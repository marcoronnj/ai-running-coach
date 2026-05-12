const APP_TIME_ZONE = 'Europe/Rome';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getRomeDateParts(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function parseBirthDate(value: string | Date | null | undefined): DateParts | null {
  if (!value) return null;

  const dateString = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.trim().slice(0, 10);

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function formatBirthDateInput(value: string | Date | null | undefined): string {
  const parts = parseBirthDate(value);
  if (!parts) return '';

  const year = String(parts.year).padStart(4, '0');
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateAge(
  birthDate: string | Date | null | undefined,
  referenceDate = new Date()
): number | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;

  const today = getRomeDateParts(referenceDate);
  let age = today.year - birth.year;

  const birthdayHasPassed =
    today.month > birth.month ||
    (today.month === birth.month && today.day >= birth.day);

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
