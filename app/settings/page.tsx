import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAthleteSettings, updateAthleteSettings, type AthleteSettings } from '@/lib/athlete-settings';

export const dynamic = 'force-dynamic';

const DAYS_OPTIONS = [
  'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'
];

const EXPERIENCE_LEVELS = [
  'Principiante',
  'Intermedio',
  'Avanzato',
  'Ex runner forte, ora in ripresa',
  'Competitivo'
];

async function updateSettings(formData: FormData) {
  'use server';

  const data: Partial<AthleteSettings> = {};

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

  const age = formData.get('age');
  if (age && typeof age === 'string') {
    const ageNum = parseInt(age);
    if (!isNaN(ageNum) && ageNum > 0) {
      data.age = ageNum;
    }
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
    throw new Error('Errore durante il salvataggio delle impostazioni');
  }

  redirect('/settings?success=true');
}

export default async function SettingsPage() {
  const settings = await getAthleteSettings();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Impostazioni Atleta</h1>
            <p className="text-neutral-400">
              Configura il tuo profilo per report personalizzati dal coach AI
            </p>
          </div>
          <Link
            href="/"
            className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
          >
            ← Torna alla Dashboard
          </Link>
        </div>

        {/* Success message */}
        {process.env.NODE_ENV === 'development' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('success') && (
          <div className="bg-green-900 border border-green-700 rounded-xl p-4 mb-8">
            <p className="text-green-300">✓ Impostazioni salvate con successo!</p>
          </div>
        )}

        {/* Form */}
        <form action={updateSettings} className="space-y-8">
          {/* Dati fisici */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">Dati Fisici</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Peso (kg)
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
                  Altezza (cm)
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
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Età
                </label>
                <input
                  type="number"
                  name="age"
                  defaultValue={settings?.age || ''}
                  min="16"
                  max="100"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="35"
                />
              </div>
            </div>
          </div>

          {/* Obiettivi */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">Obiettivi</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Obiettivo Principale
                </label>
                <input
                  type="text"
                  name="main_goal"
                  defaultValue={settings?.main_goal || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dimagrire, tornare competitivo, ecc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Obiettivo Secondario
                </label>
                <input
                  type="text"
                  name="secondary_goal"
                  defaultValue={settings?.secondary_goal || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Migliorare la resistenza, ecc."
                />
              </div>
            </div>
          </div>

          {/* Allenamento */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">Allenamento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Uscite target/settimana
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
                  Volume target settimanale (km)
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
                  Pace target (min/km)
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
                  FC target (bpm)
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
                Giorni disponibili
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DAYS_OPTIONS.map((day) => (
                  <label key={day} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="available_days"
                      value={day}
                      defaultChecked={settings?.available_days?.includes(day)}
                      className="w-4 h-4 text-blue-600 bg-neutral-800 border-neutral-700 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-white">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Altro */}
          <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6">Altro</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Esperienza
                </label>
                <select
                  name="experience_level"
                  defaultValue={settings?.experience_level || ''}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona livello</option>
                  {EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Infortuni / Note fisiche
                </label>
                <textarea
                  name="injuries"
                  defaultValue={settings?.injuries || ''}
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrivi eventuali infortuni, problemi fisici o limitazioni..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Sommario profilo
                </label>
                <textarea
                  name="profile_summary"
                  defaultValue={settings?.profile_summary || ''}
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrivi brevemente il tuo background da runner..."
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
                  Evita sovrallenamento e burnout
                </label>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-8 rounded-xl transition-colors duration-200"
            >
              Salva Impostazioni
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
