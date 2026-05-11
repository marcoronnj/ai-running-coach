import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Battery,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Info,
  LineChart,
  MapPin,
  Mountain,
  Settings,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { query, queryOne } from '@/lib/db';
import { buildRunJudgement } from '@/lib/run-analysis';
import { Card, IconBox, MetricTile, PageShell, SectionHeader, scoreTone } from '@/app/components/ui';

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

function getScoreColor(score?: number): string {
  return scoreTone(score);
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
    const next48h = run.next_48h || null;

    return (
      <PageShell>
        <div className="mx-auto max-w-6xl space-y-5">
          {/* Header con navigazione */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow mb-1">Analisi corsa</p>
              <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">{run.name}</h1>
              <p className="mt-1 text-sm text-app-muted">
                {formatDate(run.start_date)} • {formatTime(run.start_date)}
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/"
                className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
              >
                <ArrowLeft size={16} strokeWidth={1.8} />
                Dashboard
              </Link>
              
              {run.strava_id && (
                <a
                  href={`https://www.strava.com/activities/${run.strava_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
                  title="Apri questa corsa su Strava in una nuova scheda"
                >
                  <ExternalLink size={16} strokeWidth={1.8} />
                  <span className="hidden sm:inline">Strava</span>
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
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
                />
              )}
              {weeklyPlan.length > 0 && <WeeklyPlanSection weeklyPlan={weeklyPlan} />}
              {hasReport && run.full_report && <FullReportSection fullReport={run.full_report} />}
              {coachNotes.length > 0 && <CoachNotesSection notes={coachNotes} />}
              {!hasReport && <NoReportMessage />}
              {hasSplits && <RunSplitsSection splits={splits} />}
            </div>

            <div className="space-y-5">
              <HistoricalReportNotice runDate={run.start_date} />
              <StravaLinkCard stravaId={run.strava_id} />
            </div>
          </div>
        </div>
      </PageShell>
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
    <PageShell className="flex items-center justify-center">
      <Card className="max-w-xl text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,98,98,0.2)] bg-[rgba(255,98,98,0.1)] text-[var(--danger)]">
          <AlertTriangle size={24} strokeWidth={1.8} />
        </div>
        <h2 className="mb-3 text-xl font-semibold text-app-text">Corsa non trovata</h2>
        <p className="mb-4 text-sm text-app-muted">ID cercato: <span className="font-semibold text-app-text">{requestedId}</span></p>
        <p className="mb-6 text-sm text-app-muted">
          Questa corsa non esiste o non è stata ancora sincronizzata.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 py-2.5 text-sm font-bold text-black"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Dashboard
          </Link>
          <a
            href={stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-app-text"
          >
            <ExternalLink size={16} strokeWidth={1.8} />
            Apri Strava
          </a>
        </div>
      </Card>
    </PageShell>
  );
}

function NoReportMessage() {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(54,252,225,0.2)] bg-[rgba(54,252,225,0.1)] text-accent-secondary">
        <Info size={22} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-base font-semibold text-app-text">Analisi AI non ancora disponibile</h3>
      <p className="text-sm text-app-muted">
        Analisi AI non ancora disponibile. Verrà generata al prossimo sync.
      </p>
    </Card>
  );
}

function MetricsGrid({ run, elapsedTime, maxSpeed }: { run: RunDetailData; elapsedTime?: number; maxSpeed?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <MetricCard label="Distanza" value={formatKm(run.distance_m)} icon={MapPin} tone="lime" />
      <MetricCard label="Durata" value={formatDuration(run.moving_time_s)} icon={Timer} tone="cyan" />
      {elapsedTime && elapsedTime !== run.moving_time_s && (
        <MetricCard label="Elapsed time" value={formatDuration(elapsedTime)} icon={Clock} />
      )}
      <MetricCard label="Passo medio" value={formatPace(run.average_speed)} icon={Footprints} tone="lime" />
      <MetricCard label="Velocità media" value={formatSpeed(run.average_speed)} icon={Zap} tone="cyan" />
      {run.average_heartrate && (
        <MetricCard
          label="FC media"
          value={`${Math.round(run.average_heartrate)} bpm`}
          icon={HeartPulse}
          tone="danger"
        />
      )}
      {run.max_heartrate && (
        <MetricCard
          label="FC max"
          value={`${Math.round(run.max_heartrate)} bpm`}
          icon={HeartPulse}
          tone="danger"
        />
      )}
      {typeof run.total_elevation_gain === 'number' && (
        <MetricCard
          label="Dislivello"
          value={`${Math.round(run.total_elevation_gain)} m`}
          icon={Mountain}
        />
      )}
      {run.type && (
        <MetricCard label="Tipo" value={run.type} icon={Activity} />
      )}
      {maxSpeed && (
        <MetricCard label="Velocità max" value={formatSpeed(maxSpeed)} icon={Gauge} />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'lime' | 'cyan' | 'danger' | 'warning' | 'success';
}) {
  return (
    <MetricTile label={label} value={value} icon={icon} tone={tone} />
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
    <Card>
      <SectionHeader eyebrow="details" title="Metriche extra" icon={Settings} />

      <div className="grid gap-3 sm:grid-cols-2">
        {averageCadence !== undefined && (
          <MetricCard label="Cadenza media" value={`${Math.round(averageCadence)} spm`} icon={Footprints} />
        )}
        {calories !== undefined && (
          <MetricCard label="Calorie" value={`${Math.round(calories)} kcal`} icon={Flame} tone="warning" />
        )}
        {sufferScore !== undefined && (
          <MetricCard label="Suffer score" value={`${sufferScore}`} icon={Activity} tone="danger" />
        )}
        {averageWatts !== undefined && (
          <MetricCard label="Watt medio" value={`${Math.round(averageWatts)} W`} icon={Battery} tone="lime" />
        )}
        {maxSpeed !== undefined && (
          <MetricCard label="Velocità max" value={formatSpeed(maxSpeed)} icon={Gauge} />
        )}
        {elapsedTime !== undefined && (
          <MetricCard label="Elapsed time" value={formatDuration(elapsedTime)} icon={Clock} />
        )}
      </div>
    </Card>
  );
}

function SessionJudgementSection({ judgement }: { judgement: { label: string; summary: string; effort: string; recoveryHint: string; formImpact: string } }) {
  return (
    <Card>
      <SectionHeader eyebrow="session" title="Giudizio sulla seduta" icon={CheckCircle2} />
      <div className="space-y-3">
        <div className="metric-card p-3.5">
          <p className="eyebrow mb-2">Sintesi</p>
          <p className="text-sm leading-relaxed text-neutral-200">{judgement.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">Sforzo</p>
            <p className="font-semibold text-app-text">{judgement.effort}</p>
          </div>
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">Post-corsa</p>
            <p className="font-semibold text-app-text">{judgement.recoveryHint}</p>
          </div>
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">Impatto forma</p>
            <p className="font-semibold text-app-text">{judgement.formImpact}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HistoricalReportNotice({ runDate }: { runDate: string }) {
  return (
    <Card>
      <SectionHeader eyebrow="storico" title="Report della seduta" icon={Info} />
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-neutral-200">
          Questa pagina è una fotografia della corsa del {formatDate(runDate)}. Le indicazioni qui sotto sono quelle generate dopo quella seduta e non rappresentano necessariamente il coach live di oggi.
        </p>
        <Link
          href="/"
          className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
        >
          <Gauge size={16} strokeWidth={1.8} />
          Vedi coach live
        </Link>
      </div>
    </Card>
  );
}

function RunSplitsSection({ splits }: { splits: any[] }) {
  if (!splits || splits.length === 0) {
    return null;
  }

  return (
    <Card>
      <SectionHeader eyebrow="splits" title="Intertempi" icon={LineChart} />
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/10">
        <table className="min-w-full text-left text-sm text-neutral-300">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-app-muted">
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
                <tr key={index} className="border-t border-white/10">
                  <td className="px-4 py-3 text-app-text">{km}</td>
                  <td className="px-4 py-3">{pace}</td>
                  <td className="px-4 py-3">{hr}</td>
                  <td className="px-4 py-3">{typeof elev === 'number' ? `${Math.round(elev)} m` : elev}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StravaLinkCard({ stravaId }: { stravaId: string }) {
  return (
    <Card>
      <SectionHeader eyebrow="external" title="Strava" icon={ExternalLink} />
      <p className="mb-5 text-sm leading-relaxed text-app-muted">Vai alla pagina Strava della corsa per vedere mappe, segmenti e intertempi.</p>
      <a
        href={`https://www.strava.com/activities/${stravaId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
      >
        <ExternalLink size={16} strokeWidth={1.8} />
        Apri attività su Strava
      </a>
    </Card>
  );
}

function CoachAnalysisSection({ run }: { run: RunDetailData }) {
  return (
    <Card>
      <SectionHeader eyebrow="storico" title="Analisi generata dopo la seduta" icon={Brain} />

      <div className="space-y-3">
        {run.title && (
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">Titolo</p>
            <p className="font-semibold text-app-text">{run.title}</p>
          </div>
        )}

        {run.summary && (
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">Sommario</p>
            <p className="text-sm leading-relaxed text-neutral-200">{run.summary}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {run.risk_level && (
            <div className="metric-card p-3.5">
              <p className="eyebrow mb-2">Livello rischio</p>
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} strokeWidth={1.8} className={run.risk_level === 'alto' ? 'text-[var(--danger)]' : run.risk_level === 'medio' ? 'text-[var(--warning)]' : 'text-[var(--success)]'} />
                <p className="font-semibold capitalize text-app-text">{run.risk_level}</p>
              </div>
            </div>
          )}

          {run.suggested_focus && (
            <div className="metric-card p-3.5">
              <p className="eyebrow mb-2">Focus post-seduta</p>
              <p className="font-semibold text-app-text">{run.suggested_focus}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Next48hSection({ next48h, suggestedFocus }: { next48h: string; suggestedFocus?: string }) {
  return (
    <Card className="border-[rgba(54,252,225,0.22)] bg-[linear-gradient(135deg,rgba(54,252,225,0.09),rgba(17,17,17,0.94))]">
      <div className="flex items-start gap-4">
        <IconBox icon={Clock} tone="cyan" />
        <div className="flex-1">
          <p className="eyebrow mb-1">report storico</p>
          <h3 className="mb-2 text-lg font-semibold text-app-text">Indicazioni post-corsa</h3>
          <p className="mb-3 text-xs leading-relaxed text-app-muted">
            Consigli generati dopo questa seduta: usali come contesto storico, non come prescrizione live di oggi.
          </p>
          <p className="mb-4 text-sm leading-relaxed text-neutral-200">{next48h}</p>
          {suggestedFocus && (
            <div className="mt-4 border-t border-[rgba(54,252,225,0.18)] pt-4">
              <p className="eyebrow mb-1 text-accent-secondary">Focus generato allora</p>
              <p className="font-medium text-app-text">{suggestedFocus}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ScoresSection({
  readiness,
  fatigue,
  consistency,
}: {
  readiness?: number;
  fatigue?: number;
  consistency?: number;
}) {
  if (!readiness && !fatigue && !consistency) return null;

  return (
    <Card>
      <SectionHeader eyebrow="scores" title="Metriche della seduta" icon={LineChart} />

      <div className="grid gap-3 sm:grid-cols-3">
        {readiness !== undefined && (
          <ScoreCard label="Intensità seduta" value={readiness} icon={Zap} />
        )}
        {fatigue !== undefined && (
          <ScoreCard label="Fatica stimata" value={fatigue} icon={Activity} />
        )}
        {consistency !== undefined && (
          <ScoreCard label="Impatto sul recupero" value={consistency} icon={TrendingUp} />
        )}
      </div>
    </Card>
  );
}

function ScoreCard({ label, value, icon }: { label: string; value?: number; icon: LucideIcon }) {
  if (value === undefined || value === null) return null;
  const color = getScoreColor(value);

  return (
    <div className="metric-card p-3.5 text-center">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-accent-secondary">
        {(() => {
          const Icon = icon;
          return <Icon size={17} strokeWidth={1.8} />;
        })()}
      </div>
      <p className="eyebrow mb-2">{label}</p>
      <p className={`text-3xl font-semibold ${color}`}>{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}

function WeeklyPlanSection({
  weeklyPlan,
}: {
  weeklyPlan: Array<{ name: string; description: string; intensity: string; duration: string }>;
}) {
  return (
    <Card>
      <SectionHeader eyebrow="plan" title="Piano settimanale" icon={CalendarDays} />

      <div className="grid gap-3">
        {weeklyPlan.map((item, index) => (
          <div key={index} className="metric-card p-3.5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-app-text">{item.name}</h3>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                {item.intensity}
              </span>
            </div>
            {item.description && (
              <p className="text-neutral-300 text-sm mb-3 leading-relaxed">{item.description}</p>
            )}
            {item.duration && (
              <p className="flex items-center gap-1.5 text-xs text-app-muted"><Timer size={13} strokeWidth={1.8} /> {item.duration}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function FullReportSection({ fullReport }: { fullReport: string }) {
  return (
    <Card>
      <SectionHeader eyebrow="full text" title="Report completo" icon={Info} />

      <div className="prose prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
          {fullReport}
        </div>
      </div>
    </Card>
  );
}

function CoachNotesSection({ notes }: { notes: string[] }) {
  return (
    <Card>
      <SectionHeader eyebrow="notes" title="Note del coach" icon={Sparkles} />

      <div className="space-y-3">
        {notes.map((note, index) => (
          <div key={index} className="flex gap-3 rounded-xl bg-white/[0.035] p-3">
            <Sparkles size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent-secondary" />
            <p className="text-sm text-neutral-200">{note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
