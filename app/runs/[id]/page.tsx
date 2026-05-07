import Link from 'next/link';
import { query, queryOne } from '@/lib/db';
import { buildRunJudgement } from '@/lib/run-analysis';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { calculateCoachingMetrics, CoachingMetrics } from '@/lib/coaching-metrics';
import { getDaysSince } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

interface RunDetailData {
  // Attività
  id: string;
  strava_id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s?: number;
  average_speed: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  type: string;
  total_elevation_gain?: number;
  raw_json?: any;
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

function formatSpeed(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
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

function getReadinessLabel(score?: number): string {
  if (score === undefined || score === null) return 'N/A';
  if (score >= 80) return 'Alta';
  if (score >= 60) return 'Moderata';
  return 'Bassa';
}

function getFatigueLabel(score?: number): string {
  if (score === undefined || score === null) return 'N/A';
  if (score <= 30) return 'Bassa';
  if (score <= 60) return 'Media';
  return 'Alta';
}

function getConsistencyLabel(score?: number): string {
  if (score === undefined || score === null) return 'N/A';
  if (score >= 80) return 'Solida';
  if (score >= 60) return 'Buona';
  return 'In costruzione';
}

function getRunAwareNext48h(run: RunDetailData, next48h: string): string {
  const hasRunToday = getDaysSince(run.start_date) === 0;

  if (!hasRunToday) {
    return next48h;
  }

  return [
    `Oggi: corsa completata (${formatKm(run.distance_m)}). Ora solo recupero leggero, camminata facile o mobilità.`,
    'Domani: niente corsa se senti gambe pesanti. Recupero o riposo completo.',
    'Dopodomani: se le gambe sono fresche, 30-40 minuti recovery molto facile, FC bassa.',
  ].join(' ');
}

function getRiskLevelLabel(riskLevel?: string): string {
  switch (riskLevel?.toLowerCase()) {
    case 'basso': return 'Basso';
    case 'medio': return 'Medio';
    case 'alto': return 'Alto';
    default: return 'N/A';
  }
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

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { id } = await params;

  console.log('[RUN_DETAIL] ID ricevuto:', id);

  try {
    const activity = await queryOne<RunDetailData>(
      `
        SELECT id,
               strava_id,
               name,
               start_date,
               distance_m,
               moving_time_s,
               elapsed_time_s,
               average_speed,
               max_speed,
               average_heartrate,
               max_heartrate,
               total_elevation_gain,
               type,
               raw_json
        FROM activities
        WHERE id = $1 OR strava_id = $1
        LIMIT 1
      `,
      [id]
    );

    const report = activity
      ? await queryOne(
          `
            SELECT *
            FROM coach_reports
            WHERE activity_id = $1 OR activity_id = $2
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [activity.id, activity.strava_id]
        )
      : null;

    const run = activity ? { ...activity, ...report } as RunDetailData : undefined;

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
      return <ErrorState requestedId={id} />;
    }

    const rawJson = run.raw_json && typeof run.raw_json === 'string'
      ? JSON.parse(run.raw_json)
      : run.raw_json || {};

    const averageCadence = rawJson?.average_cadence ?? rawJson?.cadence;
    const calories = rawJson?.calories;
    const sufferScore = rawJson?.suffer_score;
    const averageWatts = rawJson?.average_watts;
    const maxSpeed = run.max_speed ?? rawJson?.max_speed;
    const elapsedTime = run.elapsed_time_s ?? rawJson?.elapsed_time;
    const splits = Array.isArray(rawJson?.splits_metric) ? rawJson.splits_metric : [];
    const hasSplits = splits.length > 0;

    const judgement = buildRunJudgement(run, {
      title: run.title,
      summary: run.summary,
      full_report: run.full_report,
      next_48h: run.next_48h,
      suggested_focus: run.suggested_focus,
      readiness_score: run.readiness_score,
      fatigue_score: run.fatigue_score,
      consistency_score: run.consistency_score,
      risk_level: run.risk_level,
    });

    const weeklyPlan = parseWeeklyPlan(run.weekly_plan);
    const coachNotes = parseCoachNotes(run.coach_notes);
    const hasReport = !!run.title || !!run.full_report || !!run.summary;
    const athleteSettings = await getAthleteSettings();
    const history90d = await query(`
      SELECT *
      FROM activities
      WHERE type IN ('Run', 'TrailRun')
        AND start_date >= NOW() - INTERVAL '90 days'
      ORDER BY start_date DESC
    `);
    const currentMetrics = calculateCoachingMetrics(history90d.rows, athleteSettings);
    const next48h = run.next_48h ? getRunAwareNext48h(run, run.next_48h) : null;

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

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <MetricsGrid run={run} elapsedTime={elapsedTime} maxSpeed={maxSpeed} />
              <RunExtraMetricsSection
                averageCadence={averageCadence}
                calories={calories}
                sufferScore={sufferScore}
                averageWatts={averageWatts}
                maxSpeed={maxSpeed}
                elapsedTime={elapsedTime}
              />
              <SessionJudgementSection judgement={judgement} />
              {hasReport && <CoachAnalysisSection run={run} />}
              {hasReport && next48h && (
                <Next48hSection next48h={next48h} suggestedFocus={run.suggested_focus} />
              )}
              {hasReport && (
                <ScoresSection
                  readiness={run.readiness_score}
                  fatigue={run.fatigue_score}
                  consistency={run.consistency_score}
                  riskLevel={run.risk_level}
                />
              )}
              {weeklyPlan.length > 0 && <WeeklyPlanSection weeklyPlan={weeklyPlan} />}
              {hasReport && run.full_report && <FullReportSection fullReport={run.full_report} />}
              {coachNotes.length > 0 && <CoachNotesSection notes={coachNotes} />}
              {!hasReport && <NoReportMessage />}
              {hasSplits && <RunSplitsSection splits={splits} />}
            </div>

            <div className="space-y-6">
              <CurrentStatusSection
                metrics={currentMetrics}
              />
              <StravaLinkCard stravaId={run.strava_id} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[RUN_DETAIL] Errore:', error);
    return <ErrorState requestedId={id} />;
  }
}

function ErrorState({ requestedId }: { requestedId: string }) {
  const isNumeric = /^[0-9]+$/.test(requestedId);
  const stravaUrl = isNumeric
    ? `https://www.strava.com/activities/${requestedId}`
    : 'https://www.strava.com';

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4 py-16">
      <div className="max-w-xl text-center">
        <div className="inline-block bg-red-500/20 rounded-full p-6 mb-6">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Corsa non trovata</h2>
        <p className="text-neutral-400 mb-4">ID cercato: <span className="text-white font-semibold">{requestedId}</span></p>
        <p className="text-neutral-400 mb-8">
          Questa corsa non esiste o non è stata ancora sincronizzata.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-white font-semibold transition-colors active:scale-95"
          >
            ← Torna alla Dashboard
          </Link>
          <a
            href={stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 hover:bg-orange-700 px-6 py-3 text-white font-semibold transition-colors active:scale-95"
          >
            Apri Strava
          </a>
        </div>
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
      <h3 className="text-lg font-semibold mb-2">Analisi AI non ancora disponibile</h3>
      <p className="text-neutral-400">
        Analisi AI non ancora disponibile. Verrà generata al prossimo sync.
      </p>
    </div>
  );
}

function MetricsGrid({ run, elapsedTime, maxSpeed }: { run: RunDetailData; elapsedTime?: number; maxSpeed?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <MetricCard label="Distanza" value={formatKm(run.distance_m)} icon="📍" />
      <MetricCard label="Durata" value={formatDuration(run.moving_time_s)} icon="⏱️" />
      {elapsedTime && elapsedTime !== run.moving_time_s && (
        <MetricCard label="Elapsed time" value={formatDuration(elapsedTime)} icon="⏳" />
      )}
      <MetricCard label="Passo medio" value={formatPace(run.average_speed)} icon="🏃" />
      <MetricCard label="Velocità media" value={formatSpeed(run.average_speed)} icon="⚡" />
      {run.average_heartrate && (
        <MetricCard
          label="FC media"
          value={`${Math.round(run.average_heartrate)} bpm`}
          icon="❤️"
          color="red"
        />
      )}
      {run.max_heartrate && (
        <MetricCard
          label="FC max"
          value={`${Math.round(run.max_heartrate)} bpm`}
          icon="🚀"
          color="red"
        />
      )}
      {typeof run.total_elevation_gain === 'number' && (
        <MetricCard
          label="Dislivello"
          value={`${Math.round(run.total_elevation_gain)} m`}
          icon="⛰️"
        />
      )}
      {run.type && (
        <MetricCard label="Tipo" value={run.type} icon="🎯" />
      )}
      {maxSpeed && (
        <MetricCard label="Velocità max" value={formatSpeed(maxSpeed)} icon="💨" />
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

function RunExtraMetricsSection({
  averageCadence,
  calories,
  sufferScore,
  averageWatts,
  maxSpeed,
  elapsedTime,
}: {
  averageCadence?: number;
  calories?: number;
  sufferScore?: number;
  averageWatts?: number;
  maxSpeed?: number;
  elapsedTime?: number;
}) {
  const hasExtra = averageCadence || calories || sufferScore || averageWatts || maxSpeed || elapsedTime;
  if (!hasExtra) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-3xl">⚙️</span>
        <h2 className="text-xl sm:text-2xl font-bold">Metriche extra</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {averageCadence !== undefined && (
          <MetricCard label="Cadenza media" value={`${Math.round(averageCadence)} spm`} icon="🦶" />
        )}
        {calories !== undefined && (
          <MetricCard label="Calorie" value={`${Math.round(calories)} kcal`} icon="🔥" />
        )}
        {sufferScore !== undefined && (
          <MetricCard label="Suffer score" value={`${sufferScore}`} icon="😅" />
        )}
        {averageWatts !== undefined && (
          <MetricCard label="Watt medio" value={`${Math.round(averageWatts)} W`} icon="🔋" />
        )}
        {maxSpeed !== undefined && (
          <MetricCard label="Velocità max" value={formatSpeed(maxSpeed)} icon="💨" />
        )}
        {elapsedTime !== undefined && (
          <MetricCard label="Elapsed time" value={formatDuration(elapsedTime)} icon="⏳" />
        )}
      </div>
    </div>
  );
}

function SessionJudgementSection({ judgement }: { judgement: { label: string; summary: string; effort: string; recoveryHint: string; formImpact: string } }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-3xl">🧾</span>
        <h2 className="text-xl sm:text-2xl font-bold">Giudizio sulla seduta</h2>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl bg-neutral-800 p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Sintesi</p>
          <p className="text-neutral-200 leading-relaxed text-sm sm:text-base">{judgement.summary}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-neutral-800 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Sforzo</p>
            <p className="text-white font-semibold">{judgement.effort}</p>
          </div>
          <div className="rounded-2xl bg-neutral-800 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Recupero</p>
            <p className="text-white font-semibold">{judgement.recoveryHint}</p>
          </div>
          <div className="rounded-2xl bg-neutral-800 p-4">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Impatto Forma</p>
            <p className="text-white font-semibold">{judgement.formImpact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentStatusSection({ metrics }: { metrics: CoachingMetrics | null }) {
  if (!metrics) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Stato attuale</h2>
        <p className="text-neutral-400">Dati non ancora sufficienti per valutare lo stato forma.</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-5">Stato attuale</h2>
      <div className="space-y-4">
        <StatusRow label="Readiness" value={getReadinessLabel(metrics.readinessScore)} detail={`${metrics.readinessScore}`} icon="⚡" />
        <StatusRow label="Fatigue" value={getFatigueLabel(metrics.fatigueScore)} detail={`${metrics.fatigueScore}`} icon="😴" />
        <StatusRow label="Consistency" value={getConsistencyLabel(metrics.consistencyScore)} detail={`${metrics.consistencyScore}`} icon="📈" />
        <StatusRow label="Rischio" value={getRiskLevelLabel(metrics.overloadRisk)} detail={metrics.overloadRisk} icon="⚠️" />
        <div className="rounded-2xl bg-neutral-800 p-4">
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-2">Focus consigliato</p>
          <p className="text-white leading-relaxed text-sm sm:text-base">{metrics.suggestedFocus}</p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-neutral-800 p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <div className="text-xs text-neutral-400 uppercase tracking-wide">{label}</div>
        <div className="text-white font-semibold">{value}</div>
      </div>
      <div className="text-sm text-neutral-400">{detail}</div>
    </div>
  );
}

function RunSplitsSection({ splits }: { splits: any[] }) {
  if (!splits || splits.length === 0) {
    return null;
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-3xl">📉</span>
        <h2 className="text-xl sm:text-2xl font-bold">Intertempi</h2>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-neutral-800 bg-neutral-950/10">
        <table className="min-w-full text-left text-sm text-neutral-300">
          <thead className="bg-neutral-900 text-xs uppercase tracking-[0.24em] text-neutral-500">
            <tr>
              <th className="px-4 py-3">Km</th>
              <th className="px-4 py-3">Passo</th>
              <th className="px-4 py-3">FC media</th>
              <th className="px-4 py-3">Dislivello</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split, index) => {
              const km = typeof split.distance === 'number'
                ? (split.distance / 1000).toFixed(1)
                : `${index + 1}`;
              const pace = split.average_speed ? formatPace(split.average_speed) : 'N/A';
              const hr = split.average_heartrate ? `${Math.round(split.average_heartrate)} bpm` : '—';
              const elev = split.elevation_difference ?? split.elevation_gain ?? '—';

              return (
                <tr key={index} className="border-t border-neutral-800">
                  <td className="px-4 py-3 text-white">{km}</td>
                  <td className="px-4 py-3">{pace}</td>
                  <td className="px-4 py-3">{hr}</td>
                  <td className="px-4 py-3">{typeof elev === 'number' ? `${Math.round(elev)} m` : elev}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StravaLinkCard({ stravaId }: { stravaId: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Apri attività su Strava</h2>
      <p className="text-neutral-400 mb-6">Vai alla pagina Strava della corsa per vedere il dettaglio completo delle mappe, segmenti e intertempi.</p>
      <a
        href={`https://www.strava.com/activities/${stravaId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 transition duration-200"
      >
        Apri attività su Strava
      </a>
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
        <span>📊</span> Metriche della seduta
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        {readiness !== undefined && (
          <ScoreCard label="Intensità seduta" value={readiness} icon="⚡" />
        )}
        {fatigue !== undefined && (
          <ScoreCard label="Fatica stimata" value={fatigue} icon="😴" />
        )}
        {consistency !== undefined && (
          <ScoreCard label="Impatto sul recupero" value={consistency} icon="📈" />
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
