import Link from 'next/link';
import { query } from '@/lib/db';

function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes} min`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function parseWeeklyPlan(raw: unknown): Array<{ name: string; description: string; intensity: string; duration: string }> {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => ({
      name: String((item as any).name ?? 'Allenamento'),
      description: String((item as any).description ?? ''),
      intensity: String((item as any).intensity ?? 'easy'),
      duration: String((item as any).duration ?? ''),
    }));
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          name: String((item as any).name ?? 'Allenamento'),
          description: String((item as any).description ?? ''),
          intensity: String((item as any).intensity ?? 'easy'),
          duration: String((item as any).duration ?? ''),
        }));
      }
    } catch {
      return [];
    }
  }

  return [];
}

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const result = await query(
    `
      SELECT a.id,
             a.name,
             a.start_date,
             a.distance_m,
             a.moving_time_s,
             a.average_speed,
             a.average_heartrate,
             a.type,
             cr.title,
             cr.summary,
             cr.risk_level,
             cr.next_48h,
             cr.weekly_plan,
             cr.full_report
      FROM activities a
      LEFT JOIN coach_reports cr
        ON cr.activity_id = a.id
       AND cr.created_at = (
         SELECT MAX(created_at)
         FROM coach_reports
         WHERE activity_id = a.id
       )
      WHERE a.id = $1
      LIMIT 1
    `,
    [id]
  );

  const run = result.rows[0];

  if (!run) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 py-16">
        <div className="max-w-xl text-center bg-neutral-900 border border-neutral-800 rounded-3xl p-12 shadow-xl">
          <p className="text-xl font-semibold">Corsa non trovata</p>
          <p className="mt-4 text-neutral-400">Controlla l&apos;ID della corsa o torna alla dashboard.</p>
          <Link
            href="/"
            className="inline-flex mt-8 rounded-2xl bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const weeklyPlan = parseWeeklyPlan(run.weekly_plan);

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-neutral-400">Dettaglio corsa</p>
            <h1 className="text-4xl font-bold tracking-tight">{run.name}</h1>
            <p className="mt-2 text-neutral-400">{formatDate(run.start_date)}</p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr,0.9fr]">
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-white mb-6">Dettagli corsa</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-neutral-800 p-5">
                  <p className="text-sm text-neutral-400">Distanza</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{formatKm(run.distance_m)}</p>
                </div>
                <div className="rounded-3xl bg-neutral-800 p-5">
                  <p className="text-sm text-neutral-400">Durata</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{formatDuration(run.moving_time_s)}</p>
                </div>
                <div className="rounded-3xl bg-neutral-800 p-5">
                  <p className="text-sm text-neutral-400">Passo medio</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{formatPace(run.average_speed)}</p>
                </div>
                {run.average_heartrate ? (
                  <div className="rounded-3xl bg-neutral-800 p-5">
                    <p className="text-sm text-neutral-400">FC media</p>
                    <p className="mt-2 text-3xl font-semibold text-red-400">{run.average_heartrate} bpm</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-sm">
              <h2 className="text-2xl font-semibold text-white mb-5">Report coach</h2>
              <div className="space-y-4">
                <div className="rounded-3xl bg-neutral-800 p-5">
                  <p className="text-sm text-neutral-400">Titolo report</p>
                  <p className="mt-2 text-xl font-semibold text-white">{run.title ?? 'Nessun report disponibile'}</p>
                </div>

                <div className="rounded-3xl bg-neutral-800 p-5">
                  <p className="text-sm text-neutral-400">Summary</p>
                  <p className="mt-2 text-neutral-200 leading-relaxed">{run.summary ?? 'Nessun summary disponibile'}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-neutral-800 p-5">
                    <p className="text-sm text-neutral-400">Livello rischio</p>
                    <p className="mt-2 text-lg font-semibold text-white">{run.risk_level ?? 'N/A'}</p>
                  </div>
                  <div className="rounded-3xl bg-neutral-800 p-5">
                    <p className="text-sm text-neutral-400">Prossime 48 ore</p>
                    <p className="mt-2 text-lg font-semibold text-white">{run.next_48h ?? 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">Weekly plan</h2>
                <span className="text-sm text-neutral-400">{weeklyPlan.length} elementi</span>
              </div>
              {weeklyPlan.length > 0 ? (
                <div className="grid gap-4">
                  {weeklyPlan.map((item, index) => (
                    <div key={index} className="rounded-3xl bg-neutral-800 p-5 border border-neutral-800">
                      <p className="text-sm text-neutral-400 uppercase tracking-[0.18em] mb-2">{item.intensity}</p>
                      <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                      <p className="mt-2 text-neutral-300 leading-relaxed">{item.description}</p>
                      <p className="mt-4 text-sm text-neutral-400">Durata: {item.duration}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl bg-neutral-800 p-6 text-neutral-400">
                  Nessun piano settimanale disponibile.
                </div>
              )}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-white mb-6">Report completo</h2>
            <div className="whitespace-pre-wrap text-neutral-200 leading-relaxed">{run.full_report ?? 'Nessun report completo disponibile'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
