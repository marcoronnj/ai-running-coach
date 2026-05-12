'use client';

import { useMemo, useState } from 'react';
import { calculateAge } from '@/lib/age';
import { t, type Language } from '@/lib/i18n';

export default function DateOfBirthField({
  initialBirthDate,
  language,
}: {
  initialBirthDate: string;
  language: Language;
}) {
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const calculatedAge = useMemo(() => calculateAge(birthDate), [birthDate]);

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-2">
        {t(language, 'settings.birthDate')}
      </label>
      <input
        type="date"
        name="birth_date"
        value={birthDate}
        onChange={(event) => setBirthDate(event.target.value)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="mt-2 text-sm text-app-muted">
        {calculatedAge !== null
          ? `${t(language, 'settings.calculatedAge')}: ${calculatedAge} ${t(language, 'settings.years')}`
          : t(language, 'settings.birthDateNotSet')}
      </p>
    </div>
  );
}
