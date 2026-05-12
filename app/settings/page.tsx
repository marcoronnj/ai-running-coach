import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { getAthleteSettings, updateAthleteSettings, type AthleteSettings } from '@/lib/athlete-settings';
import { isAdminUser, verifySession } from '@/lib/auth';
import { getPublicStravaConnectionStatus } from '@/lib/strava-connection';
import { formatBirthDateInput } from '@/lib/age';
import { normalizeLanguage, t } from '@/lib/i18n';
import DateOfBirthField from './DateOfBirthField';
import SettingsSubmit from './SettingsSubmit';
import StravaConnectionBox from './StravaConnectionBox';

export const dynamic = 'force-dynamic';

const DAYS_OPTIONS = [
  { value: 'Lunedì', en: 'Monday' },
  { value: 'Martedì', en: 'Tuesday' },
  { value: 'Mercoledì', en: 'Wednesday' },
  { value: 'Giovedì', en: 'Thursday' },
  { value: 'Venerdì', en: 'Friday' },
  { value: 'Sabato', en: 'Saturday' },
  { value: 'Domenica', en: 'Sunday' },
];

const EXPERIENCE_LEVELS = [
  { value: 'Principiante', en: 'Beginner' },
  { value: 'Intermedio', en: 'Intermediate' },
  { value: 'Avanzato', en: 'Advanced' },
  { value: 'Ex runner forte, ora in ripresa', en: 'Former strong runner, now rebuilding' },
  { value: 'Competitivo', en: 'Competitive' },
];

async function updateSettings(formData: FormData) {
  'use server';

  const data: Partial<AthleteSettings> = {};
  const language = formData.get('language');
  data.language = normalizeLanguage(language);

  // Campi numerici
  const weightKg = formData.get('weight_kg');
  if (weightKg && typeof weightKg === 'string') {
    const weight = parseFloat(weightKg);
    if (!isNaN(weight) && weight > 0) {
      data.weight_kg = weight;
    }
  }

  const heightCm = formData.get('height_cm');
  if (heightCm && typeof heightCm === 'string') {
    const height = parseInt(heightCm);
    if (!isNaN(height) && height > 0) {
      data.height_cm = height;
    }
  }

  const birthDate = formData.get('birth_date');
  if (typeof birthDate === 'string') {
    const rawBirthDate = birthDate.trim();
    const normalizedBirthDate = formatBirthDateInput(birthDate);
    console.log('[SETTINGS] birth_date ricevuta dal form:', rawBirthDate || null);
    if (rawBirthDate && !normalizedBirthDate) {
      console.error('[SETTINGS] birth_date non valida:', rawBirthDate);
      redirect('/settings?error=true');
    }
    data.birth_date = normalizedBirthDate || null;
  }

  const targetRuns = formData.get('target_runs_per_week');
  if (targetRuns && typeof targetRuns === 'string') {
    const runs = parseInt(targetRuns);
    if (!isNaN(runs) && runs >= 0) {
      data.target_runs_per_week = runs;
    }
  }

  const targetVolume = formData.get('target_weekly_volume_km');
  if (targetVolume && typeof targetVolume === 'string') {
    const volume = parseFloat(targetVolume);
    if (!isNaN(volume) && volume >= 0) {
      data.target_weekly_volume_km = volume;
    }
  }

  // Campi stringa
  const profileSummary = formData.get('profile_summary');
  if (profileSummary && typeof profileSummary === 'string') {
    data.profile_summary = profileSummary.trim();
  }

  const mainGoal = formData.get('main_goal');
  if (mainGoal && typeof mainGoal === 'string') {
    data.main_goal = mainGoal.trim();
  }

  const secondaryGoal = formData.get('secondary_goal');
  if (secondaryGoal && typeof secondaryGoal === 'string') {
    data.secondary_goal = secondaryGoal.trim();
  }

  const targetPace = formData.get('target_pace');
  if (targetPace && typeof targetPace === 'string') {
    data.target_pace = targetPace.trim();
  }

  const targetHr = formData.get('target_hr');
  if (targetHr && typeof targetHr === 'string') {
    data.target_hr = targetHr.trim();
  }

  const injuries = formData.get('injuries');
  if (injuries && typeof injuries === 'string') {
    data.injuries = injuries.trim();
  }

  const experienceLevel = formData.get('experience_level');
  if (experienceLevel && typeof experienceLevel === 'string') {
    data.experience_level = experienceLevel.trim();
  }

  // Giorni disponibili (array)
  const availableDays = formData.getAll('available_days');
  if (availableDays.length > 0) {
    data.available_days = availableDays.filter(day => typeof day === 'string') as string[];
  }

  // Boolean
  const avoidOverload = formData.get('avoid_overload');
  data.avoid_overload = avoidOverload === 'on';

  try {
    await updateAthleteSettings(data);
  } catch (error) {
    console.error('Errore aggiornamento impostazioni:', error);
    redirect('/settings?error=true');
  }

  redirect('/settings?success=true');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string; strava?: string }> | { success?: string; error?: string; strava?: string };
}) {
  const settings = await getAthleteSettings();
  const language = normalizeLanguage(settings?.language);
  const session = await verifySession();
  const isAdmin = isAdminUser(session);
  const stravaStatus = isAdmin && session
    ? await getPublicStravaConnectionStatus(session.email)
    : null;
  const params = searchParams ? await searchParams : {};
  const saveStatus = params.success === 'true'
    ? 'success'
    : params.error === 'true'
      ? 'error'
      : null;
  const stravaMessage = params.strava === 'connected'
    ? { type: 'success' as const, text: language === 'en' ? 'Strava connected successfully' : 'Strava collegato con successo' }
    : params.strava
      ? { type: 'error' as const, text: language === 'en' ? 'Strava connection failed' : 'Connessione Strava non riuscita' }
      : undefined;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow mb-1">{t(language, 'settings.eyebrow')}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">{t(language, 'settings.title')}</h1>
            <p className="mt-1 text-sm text-app-muted">
              {t(language, 'settings.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="pressable inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              {t(language, 'nav.dashboard')}
            </Link>
            <form action="/api/logout" method="post">
              <button className="pressable inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text">
                <LogOut size={16} strokeWidth={1.8} />
                {t(language, 'nav.logout')}
              </button>
            </form>
          </div>
        </div>

        {/* Form */}
        <form action={updateSettings} className="space-y-8">
          {isAdmin && stravaStatus ? (
            <StravaConnectionBox status={stravaStatus} initialMessage={stravaMessage} language={language} />
          ) : null}

          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-2">{t(language, 'settings.language')}</h2>
            <p className="mb-5 text-sm text-app-muted">{t(language, 'settings.languageHelp')}</p>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/20 p-1.5">
              {[
                { value: 'it', label: 'Italiano' },
                { value: 'en', label: 'English' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="relative flex cursor-pointer items-center justify-center rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-app-text has-[:checked]:border-[rgba(215,255,63,0.28)] has-[:checked]:bg-[rgba(215,255,63,0.12)]"
                >
                  <input
                    type="radio"
                    name="language"
                    value={option.value}
                    defaultChecked={language === option.value}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* Dati fisici */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">{t(language, 'settings.physical')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.weight')}
                </label>
                <input
                  type="number"
                  name="weight_kg"
                  defaultValue={settings?.weight_kg || ''}
                  step="0.1"
                  min="30"
                  max="200"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="70.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.height')}
                </label>
                <input
                  type="number"
                  name="height_cm"
                  defaultValue={settings?.height_cm || ''}
                  min="120"
                  max="220"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="175"
                />
              </div>
              <DateOfBirthField initialBirthDate={formatBirthDateInput(settings?.birth_date)} language={language} />
            </div>
          </div>

          {/* Obiettivi */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">{t(language, 'settings.goals')}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.mainGoal')}
                </label>
                <input
                  type="text"
                  name="main_goal"
                  defaultValue={settings?.main_goal || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={language === 'en' ? 'Lose weight, return to competition, etc.' : 'Dimagrire, tornare competitivo, ecc.'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.secondaryGoal')}
                </label>
                <input
                  type="text"
                  name="secondary_goal"
                  defaultValue={settings?.secondary_goal || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={language === 'en' ? 'Improve endurance, etc.' : 'Migliorare la resistenza, ecc.'}
                />
              </div>
            </div>
          </div>

          {/* Allenamento */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">{t(language, 'settings.training')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.targetRuns')}
                </label>
                <input
                  type="number"
                  name="target_runs_per_week"
                  defaultValue={settings?.target_runs_per_week || ''}
                  min="0"
                  max="10"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.weeklyVolume')}
                </label>
                <input
                  type="number"
                  name="target_weekly_volume_km"
                  defaultValue={settings?.target_weekly_volume_km || ''}
                  step="0.1"
                  min="0"
                  max="200"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="25.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.targetPace')}
                </label>
                <input
                  type="text"
                  name="target_pace"
                  defaultValue={settings?.target_pace || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5:30-6:00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.targetHr')}
                </label>
                <input
                  type="text"
                  name="target_hr"
                  defaultValue={settings?.target_hr || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="140-160"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-neutral-300 mb-3">
                {t(language, 'settings.availableDays')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DAYS_OPTIONS.map((day) => (
                  <label key={day.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="available_days"
                      value={day.value}
                      defaultChecked={settings?.available_days?.includes(day.value)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 border-neutral-700 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-white">{language === 'en' ? day.en : day.value}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Altro */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">{t(language, 'settings.other')}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.experience')}
                </label>
                <select
                  name="experience_level"
                  defaultValue={settings?.experience_level || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t(language, 'settings.selectLevel')}</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{language === 'en' ? level.en : level.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.injuries')}
                </label>
                <textarea
                  name="injuries"
                  defaultValue={settings?.injuries || ''}
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={language === 'en' ? 'Describe any injuries, physical issues, or limitations...' : 'Descrivi eventuali infortuni, problemi fisici o limitazioni...'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {t(language, 'settings.profileSummary')}
                </label>
                <textarea
                  name="profile_summary"
                  defaultValue={settings?.profile_summary || ''}
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={language === 'en' ? 'Briefly describe your running background...' : 'Descrivi brevemente il tuo background da runner...'}
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="avoid_overload"
                  defaultChecked={settings?.avoid_overload ?? true}
                  className="w-5 h-5 text-blue-600 bg-neutral-800 border-neutral-700 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label className="text-white font-medium">
                  {t(language, 'settings.avoidOverload')}
                </label>
              </div>
            </div>
          </div>

          {/* Submit */}
          <SettingsSubmit status={saveStatus} language={language} />
        </form>
      </div>
    </div>
  );
}
