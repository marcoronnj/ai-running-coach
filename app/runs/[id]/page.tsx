import Link from 'next/link';
import { query } from '@/lib/db';

interface RunDetailData {
  // Attività
  id: string;
  strava_id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  type: string;
  total_elevation_gain?: number;
  // Report coach
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
  weekly_plan?: any;
  full_report?: string;
  readiness_score?: number;
  fatigue_score?: number;
  consistency_score?: number;
  suggested_focus?: string;
  coach_notes?: any;
}

function formatKm(meters: number): string {
  if (!meters) return '0 km';
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

function formatTime(value: string): string {
  const date = new Date(value);
  return date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRiskEmoji(riskLevel?: string): string {
  switch (riskLevel?.toLowerCase()) {
    case 'basso': return '🟢';
    case 'medio': return '🟡';
    case 'alto': return '🔴';
    default: return '⚪';
  }
}

function getScoreColor(score?: number): string {
  if (!score) return 'text-neutral-400';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
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

function parseCoachNotes(raw: unknown): string[] {
  if (!raw) return [];
  
  if (Array.isArray(raw)) {
    return raw.filter(n => typeof n === 'string');
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(n => typeof n === 'string') : [];
    } catch {
      return [];
    }
  }

  return [];
}

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  console.log('[RUN_DETAIL] ID ricevuto:', id);

  try {
    const result = await query(
      `
        SELECT a.id,
               a.strava_id,
               a.name,
               a.start_date,
               a.distance_m,
               a.moving_time_s,
               a.average_speed,
               a.average_heartrate,
               a.max_heartrate,
               a.total_elevation_gain,
               a.type,
               cr.title,
               cr.summary,
               cr.risk_level,
               cr.next_48h,
               cr.weekly_plan,
               cr.full_report,
               cr.readiness_score,
               cr.fatigue_score,
               cr.consistency_score,
               cr.suggested_focus,
               cr.coach_notes
        FROM activities a
        LEFT JOIN coach_reports cr
          ON cr.activity_id = a.id
         AND cr.created_at = (
           SELECT MAX(created_at)
           FROM coach_reports
           WHERE activity_id = a.id
         )
        WHERE a.id = $1 OR a.strava_id = $1
        LIMIT 1
      `,
      [id]
    );

    const run = result.rows[0] as RunDetailData | undefined;

    console.log('[RUN_DETAIL] ID ricevuto:', id);
    console.log('[RUN_DETAIL] Attività trovata:', !!run);
    if (run) {
      console.log('[RUN_DETAIL] Activity ID:', run.id);
      console.log('[RUN_DETAIL] Strava ID:', run.strava_id);
      console.log('[RUN_DETAIL] Report trovato:', !!run.title);
    } else {
      console.log('[RUN_DETAIL] ❌ Nessuna attività trovata per ID:', id);
    }

    if (!run) {
      return <ErrorState />;
    }

    const weeklyPlan = parseWeeklyPlan(run.weekly_plan);
    const coachNotes = parseCoachNotes(run.coach_notes);
    const hasReport = !!run.title;

    return (
      <div className="min-h-screen bg-neutral-950 text-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header con navigazione */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-neutral-400 mb-2">Analisi Corsa</p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{run.name}</h1>
              <p className="mt-2 text-neutral-400">
                {formatDate(run.start_date)} • {formatTime(run.start_date)}
              </p>
            </div>

            <div className="flex gap-2 sm:flex-col sm:gap-2">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 sm:px-5 py-2 sm:py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 active:scale-95"
              >
                ← Dashboard
              </Link>
              
              {run.strava_id && (
                <a
                  href={`https://www.strava.com/activities/${run.strava_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 hover:bg-orange-700 px-4 sm:px-5 py-2 sm:py-3 text-sm font-semibold text-white transition-colors active:scale-95"
                  title="Apri questa corsa su Strava in una nuova scheda"
                >
                  <span>🔗</span>
                  <span className="hidden sm:inline">Strava</span>
                </a>
              )}
            </div>
          </div>

          {/* Metriche principali */}
          <MetricsGrid run={run} />

          {/* Coach Analysis */}
          {hasReport && <CoachAnalysisSection run={run} />}

          {/* Prossime 48h evidenziato */}
          {hasReport && run.next_48h && (
            <Next48hSection next48h={run.next_48h} suggestedFocus={run.suggested_focus} />
          )}

          {/* Trend e analisi */}
          {hasReport && (
            <ScoresSection
              readiness={run.readiness_score}
              fatigue={run.fatigue_score}
              consistency={run.consistency_score}
              riskLevel={run.risk_level}
            />
          )}

          {/* Weekly plan */}
          {weeklyPlan.length > 0 && <WeeklyPlanSection weeklyPlan={weeklyPlan} />}

          {/* Report completo */}
          {hasReport && run.full_report && <FullReportSection fullReport={run.full_report} />}

          {/* Note del coach */}
          {coachNotes.length > 0 && <CoachNotesSection notes={coachNotes} />}

          {/* Messaggio se nessun report */}
          {!hasReport && <NoReportMessage />}
        </div>
      </div>
    );
  } catch (error) {
    console.error('[RUN_DETAIL] Errore:', error);
    return <ErrorState />;
  }
}

function ErrorState() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 py-16">
      <div className="max-w-xl text-center">
        <div className="inline-block bg-red-500/20 rounded-full p-6 mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Corsa non trovata</h2>
        <p className="text-neutral-400 mb-8">
          Questa corsa non esiste o è stata eliminata. Torna alla dashboard per visualizzare le tue corse.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-white font-semibold transition-colors active:scale-95"
        >
          ← Torna alla Dashboard
        </Link>
      </div>
    </div>
  );
}

function NoReportMessage() {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center">
      <div className="inline-block bg-blue-500/20 rounded-full p-4 mb-4">
        <span className="text-2xl">ℹ️</span>
      </div>
      <h3 className="text-lg font-semibold mb-2">Report non ancora disponibile</h3>
      <p className="text-neutral-400">
        L'analisi del coach per questa corsa è ancora in elaborazione. Riprova tra pochi minuti.
      </p>
    </div>
  );
}

function MetricsGrid({ run }: { run: RunDetailData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Distanza" value={formatKm(run.distance_m)} icon="📍" />
      <MetricCard label="Durata" value={formatDuration(run.moving_time_s)} icon="⏱️" />
      <MetricCard label="Passo medio" value={formatPace(run.average_speed)} icon="🏃" />
      {run.average_heartrate && (
        <MetricCard
          label="FC media"
          value={`${Math.round(run.average_heartrate)} bpm`}
          icon="❤️"
          color="red"
        />
      )}
      {!run.average_heartrate && run.total_elevation_gain && (
        <MetricCard
          label="Dislivello"
          value={`${Math.round(run.total_elevation_gain)} m`}
          icon="⛰️"
        />
      )}
      {run.type && (
        <MetricCard label="Tipo" value={run.type} icon="🎯" />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color = 'blue',
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  const colorClass = color === 'red' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-6">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function CoachAnalysisSection({ run }: { run: RunDetailData }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🧠</span>
        <h2 className="text-xl sm:text-2xl font-bold">Analisi del Coach</h2>
      </div>

      <div className="space-y-4">
        {run.title && (
          <div className="rounded-2xl bg-neutral-800 p-4 sm:p-5">
            <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">Titolo</p>
            <p className="text-lg sm:text-xl font-semibold text-white">{run.title}</p>
          </div>
        )}

        {run.summary && (
          <div className="rounded-2xl bg-neutral-800 p-4 sm:p-5">
            <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">Sommario</p>
            <p className="text-neutral-200 leading-relaxed text-sm sm:text-base">{run.summary}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {run.risk_level && (
            <div className="rounded-2xl bg-neutral-800 p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">Livello Rischio</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getRiskEmoji(run.risk_level)}</span>
                <p className="text-lg font-semibold capitalize text-white">{run.risk_level}</p>
              </div>
            </div>
          )}

          {run.suggested_focus && (
            <div className="rounded-2xl bg-neutral-800 p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">Focus Consigliato</p>
              <p className="text-lg font-semibold text-white">{run.suggested_focus}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Next48hSection({ next48h, suggestedFocus }: { next48h: string; suggestedFocus?: string }) {
  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-600/40 rounded-3xl p-6 sm:p-8 shadow-lg shadow-blue-500/10">
      <div className="flex items-start gap-4">
        <div className="text-4xl flex-shrink-0">⏰</div>
        <div className="flex-1">
          <h3 className="text-xl sm:text-2xl font-bold mb-3">Prossime 48 ore</h3>
          <p className="text-neutral-200 leading-relaxed text-sm sm:text-base mb-4">{next48h}</p>
          {suggestedFocus && (
            <div className="mt-4 pt-4 border-t border-blue-500/30">
              <p className="text-xs text-blue-300 uppercase tracking-wide mb-1">Indicazione</p>
              <p className="text-blue-100 font-medium">{suggestedFocus}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoresSection({
  readiness,
  fatigue,
  consistency,
  riskLevel,
}: {
  readiness?: number;
  fatigue?: number;
  consistency?: number;
  riskLevel?: string;
}) {
  if (!readiness && !fatigue && !consistency) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
        <span>📊</span> Metriche
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {readiness !== undefined && (
          <ScoreCard label="Readiness" value={readiness} icon="⚡" />
        )}
        {fatigue !== undefined && (
          <ScoreCard label="Fatigue" value={fatigue} icon="😴" />
        )}
        {consistency !== undefined && (
          <ScoreCard label="Consistency" value={consistency} icon="📈" />
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, icon }: { label: string; value?: number; icon: string }) {
  if (value === undefined || value === null) return null;
  const color = getScoreColor(value);

  return (
    <div className="bg-neutral-800 rounded-2xl p-4 sm:p-6 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl sm:text-4xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function WeeklyPlanSection({
  weeklyPlan,
}: {
  weeklyPlan: Array<{ name: string; description: string; intensity: string; duration: string }>;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
        <span>📅</span> Piano Settimanale
      </h2>

      <div className="grid gap-4">
        {weeklyPlan.map((item, index) => (
          <div key={index} className="bg-neutral-800 rounded-2xl p-4 sm:p-5 border border-neutral-700">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">{item.name}</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-neutral-700 text-neutral-200 uppercase tracking-wide">
                {item.intensity}
              </span>
            </div>
            {item.description && (
              <p className="text-neutral-300 text-sm mb-3 leading-relaxed">{item.description}</p>
            )}
            {item.duration && (
              <p className="text-xs text-neutral-400">⏱️ {item.duration}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FullReportSection({ fullReport }: { fullReport: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
        <span>📝</span> Report Completo
      </h2>

      <div className="prose prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-neutral-300 leading-relaxed text-sm sm:text-base font-mono">
          {fullReport}
        </div>
      </div>
    </div>
  );
}

function CoachNotesSection({ notes }: { notes: string[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
        <span>💡</span> Note del Coach
      </h2>

      <div className="space-y-3">
        {notes.map((note, index) => (
          <div key={index} className="flex gap-3 p-3 sm:p-4 bg-neutral-800 rounded-xl">
            <span className="text-xl flex-shrink-0">•</span>
            <p className="text-neutral-200 text-sm sm:text-base">{note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
