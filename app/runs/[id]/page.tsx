import Link from 'next/link';
import type { ReactNode } from 'react';
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
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { query, queryOne } from '@/lib/db';
import { buildRunJudgement } from '@/lib/run-analysis';
import { formatDateIT, formatDateLocalized, formatTimeIT } from '@/lib/date-utils';
import { getCurrentLanguage } from '@/lib/athlete-settings';
import { t, type Language } from '@/lib/i18n';
import { Card, MetricTile, PageShell, SectionHeader, scoreTone } from '@/app/components/ui';
import { containsItalianText } from '@/lib/report-display';
import { getRecoveryTimelineState, type RecoveryTimelineItem } from '@/lib/recovery-timeline';
import { getSportLoadProfile, isRunningActivity } from '@/lib/sport-classification';

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
  sport_type?: string;
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

function localizedReportText(value: string | undefined, language: Language, fallback: string): string {
  if (!value) return fallback;
  if (language === 'en' && containsItalianText(value)) return fallback;
  return value;
}

function contextualReportText(value: string | undefined, language: Language, fallback: string, timeline: RecoveryTimelineItem[]): string {
  const text = localizedReportText(value, language, fallback);
  const today = timeline[0];
  const tomorrow = timeline[1];
  const dayAfterTomorrow = timeline[2];

  if (!today?.completed) return text;

  const todayReplacement = `${today.label}: ${today.title}. ${today.description}`;
  const tomorrowReplacement = tomorrow ? `${tomorrow.label}: ${tomorrow.title}. ${tomorrow.description}` : '';
  const dayAfterReplacement = dayAfterTomorrow ? `${dayAfterTomorrow.label}: ${dayAfterTomorrow.title}. ${dayAfterTomorrow.description}` : '';

  return text
    .replace(/\bOggi\s*:\s*niente corsa\.?/gi, todayReplacement)
    .replace(/\bOggi\s*:\s*riposo\.?/gi, todayReplacement)
    .replace(/\bToday\s*:\s*(no run|no running|rest)\.?/gi, todayReplacement)
    .replace(/\bDomani\s*:\s*(easy run|corsa facile|recovery run)[^.]*\.?/gi, tomorrowReplacement)
    .replace(/\bTomorrow\s*:\s*(easy run|recovery run)[^.]*\.?/gi, tomorrowReplacement)
    .replace(/\bDopodomani\s*:\s*riposo[^.]*\.?/gi, dayAfterReplacement)
    .replace(/\bDay after tomorrow\s*:\s*rest[^.]*\.?/gi, dayAfterReplacement);
}

function localizedRunName(value: string, language: Language): string {
  if (language === 'en' && containsItalianText(value)) return 'Run activity';
  return value;
}

function formatPreciseDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getScoreColor(score?: number): string {
  return scoreTone(score);
}

function parseWeeklyPlan(raw: unknown, language: Language): Array<{ name: string; description: string; intensity: string; duration: string }> {
  const localizeItem = (item: any) => {
    const parsed = {
      name: String(item?.name ?? (language === 'en' ? 'Workout' : 'Allenamento')),
      description: String(item?.description ?? ''),
      intensity: String(item?.intensity ?? 'easy'),
      duration: String(item?.duration ?? ''),
    };

    if (
      language === 'en' &&
      [parsed.name, parsed.description, parsed.duration].some((value) => value && containsItalianText(value))
    ) {
      return {
        name: 'Historical workout',
        description: 'This workout was generated before the current language setting. Use the live coach for current guidance.',
        intensity: parsed.intensity,
        duration: '',
      };
    }

    return parsed;
  };

  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map(localizeItem);
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(localizeItem);
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
               sport_type,
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

    const language = await getCurrentLanguage();
    if (!run) {
      return <ErrorState requestedId={id} language={language} />;
    }

    const rawJson = run.raw_json && typeof run.raw_json === 'string'
      ? JSON.parse(run.raw_json)
      : run.raw_json || {};

    if (!isRunningActivity(run)) {
      return <NonRunActivityState activity={run} language={language} />;
    }

    console.log('[RUN_DETAIL][TIMEZONE]', {
      activityId: run.id,
      dbStartDateUtc: run.start_date,
      stravaStartDateUtc: rawJson?.start_date ?? null,
      stravaStartDateLocal: rawJson?.start_date_local ?? null,
      displayDateRome: formatDateIT(run.start_date),
      displayTimeRome: formatTimeIT(run.start_date),
    });

    const averageCadence = rawJson?.average_cadence ?? rawJson?.cadence;
    const calories = rawJson?.calories;
    const sufferScore = rawJson?.suffer_score;
    const averageWatts = rawJson?.average_watts;
    const maxSpeed = run.max_speed ?? rawJson?.max_speed;
    const elapsedTime = run.elapsed_time_s ?? rawJson?.elapsed_time;
    const splits = Array.isArray(rawJson?.splits_metric) ? rawJson.splits_metric : [];
    const hasSplits = splits.length > 0;

    const recoveryTimeline = getRecoveryTimelineState({
      runDate: run.start_date,
      distanceMeters: run.distance_m,
      readinessScore: run.readiness_score,
      fatigueScore: run.fatigue_score,
      overloadRisk: run.risk_level,
      focus: run.suggested_focus,
      language,
    });

    const judgement = buildRunJudgement(run, {
      title: localizedReportText(run.title, language, language === 'en' ? 'Historical run analysis' : 'Analisi storica corsa'),
      summary: localizedReportText(run.summary, language, language === 'en' ? 'Historical report available for this run.' : 'Report storico disponibile per questa corsa.'),
      full_report: localizedReportText(run.full_report, language, language === 'en' ? 'This historical report was generated before the current language setting.' : 'Questo report storico è stato generato prima dell’impostazione lingua corrente.'),
      next_48h: recoveryTimeline.next48h,
      suggested_focus: localizedReportText(run.suggested_focus, language, language === 'en' ? 'Use live coach guidance' : 'Usa indicazioni coach live'),
      readiness_score: run.readiness_score,
      fatigue_score: run.fatigue_score,
      consistency_score: run.consistency_score,
      risk_level: run.risk_level,
    }, language);

    const weeklyPlan = parseWeeklyPlan(run.weekly_plan, language);
    const coachNotes = parseCoachNotes(run.coach_notes);
    const hasReport = !!run.title || !!run.full_report || !!run.summary;
    const next48h = recoveryTimeline.next48h || run.next_48h || null;
    const runName = localizedRunName(run.name, language);

    return (
      <PageShell>
        <div className="mx-auto max-w-6xl space-y-5">
          {/* Header con navigazione */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow mb-1">{t(language, 'run.analysisEyebrow')}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">{runName}</h1>
              <p className="mt-1 text-sm text-app-muted">
                {formatDateLocalized(run.start_date, language)} • {formatTimeIT(run.start_date)}
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/"
                className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
              >
                <ArrowLeft size={16} strokeWidth={1.8} />
                {t(language, 'nav.dashboard')}
              </Link>
              
              {run.strava_id && (
                <a
                  href={`https://www.strava.com/activities/${run.strava_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
                  title={language === 'en' ? 'Open this run on Strava in a new tab' : 'Apri questa corsa su Strava in una nuova scheda'}
                >
                  <ExternalLink size={16} strokeWidth={1.8} />
                  <span className="hidden sm:inline">Strava</span>
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <MetricsGrid
                run={run}
                language={language}
                elapsedTime={elapsedTime}
                maxSpeed={maxSpeed}
                averageCadence={averageCadence}
                calories={calories}
                sufferScore={sufferScore}
                averageWatts={averageWatts}
              />
              <SessionJudgementSection judgement={judgement} language={language} />
              {hasReport && <CoachAnalysisSection run={run} language={language} />}
              {hasReport && next48h && (
                <Next48hSection
                  next48h={localizedReportText(next48h, language, language === 'en' ? 'Use the live coach for current recovery guidance.' : 'Usa il coach live per le indicazioni di recupero correnti.')}
                  suggestedFocus={localizedReportText(run.suggested_focus, language, language === 'en' ? 'Use live coach guidance' : 'Usa indicazioni coach live')}
                  timeline={recoveryTimeline.timeline}
                  language={language}
                />
              )}
              {hasReport && (
                <ScoresSection
                  readiness={run.readiness_score}
                  fatigue={run.fatigue_score}
                  consistency={run.consistency_score}
                  language={language}
                />
              )}
              {weeklyPlan.length > 0 && <WeeklyPlanSection weeklyPlan={weeklyPlan} language={language} />}
              {hasReport && run.full_report && (
                <FullReportSection
                  fullReport={contextualReportText(run.full_report, language, language === 'en' ? 'This historical report was generated before the current language setting.' : run.full_report, recoveryTimeline.timeline)}
                  language={language}
                />
              )}
              {coachNotes.length > 0 && <CoachNotesSection notes={coachNotes} language={language} />}
              {!hasReport && <NoReportMessage language={language} />}
              {hasSplits && <RunSplitsSection splits={splits} language={language} />}
            </div>

            <div className="space-y-5">
              <HistoricalReportNotice runDate={run.start_date} language={language} />
              <StravaLinkCard stravaId={run.strava_id} language={language} />
            </div>
          </div>
        </div>
      </PageShell>
    );
  } catch (error) {
    console.error('[RUN_DETAIL] Errore:', error);
    const language = await getCurrentLanguage().catch(() => 'it' as Language);
    return <ErrorState requestedId={id} language={language} />;
  }
}

function ErrorState({ requestedId, language }: { requestedId: string; language: Language }) {
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
        <h2 className="mb-3 text-xl font-semibold text-app-text">{language === 'en' ? 'Run not found' : 'Corsa non trovata'}</h2>
        <p className="mb-4 text-sm text-app-muted">{language === 'en' ? 'Requested ID' : 'ID cercato'}: <span className="font-semibold text-app-text">{requestedId}</span></p>
        <p className="mb-6 text-sm text-app-muted">
          {language === 'en' ? 'This run does not exist or has not been synced yet.' : 'Questa corsa non esiste o non è stata ancora sincronizzata.'}
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
            {language === 'en' ? 'Open Strava' : 'Apri Strava'}
          </a>
        </div>
      </Card>
    </PageShell>
  );
}

function NoReportMessage({ language }: { language: Language }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(54,252,225,0.2)] bg-[rgba(54,252,225,0.1)] text-accent-secondary">
        <Info size={22} strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-base font-semibold text-app-text">{language === 'en' ? 'AI analysis not available yet' : 'Analisi AI non ancora disponibile'}</h3>
      <p className="text-sm text-app-muted">
        {language === 'en' ? 'AI analysis is not available yet. It will be generated on the next sync.' : 'Analisi AI non ancora disponibile. Verrà generata al prossimo sync.'}
      </p>
    </Card>
  );
}

function NonRunActivityState({ activity, language }: { activity: RunDetailData; language: Language }) {
  const profile = getSportLoadProfile(activity);
  const isEnglish = language === 'en';

  return (
    <PageShell className="flex items-center justify-center">
      <Card className="max-w-2xl">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[rgba(54,252,225,0.2)] bg-[rgba(54,252,225,0.1)] text-accent-secondary">
            <Activity size={24} strokeWidth={1.8} />
          </div>
          <div>
            <p className="eyebrow mb-1">{isEnglish ? 'Non-running activity' : 'Attività non-running'}</p>
            <h1 className="text-xl font-semibold text-app-text">{activity.name}</h1>
            <p className="mt-1 text-sm text-app-muted">
              {formatDateLocalized(activity.start_date, language)} • {formatTimeIT(activity.start_date)} • {activity.sport_type || activity.type}
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-neutral-200">
          {isEnglish
            ? 'This activity contributes to coach load, fatigue, readiness and recovery, but it does not generate a detailed run report.'
            : 'Questa attività contribuisce al carico del coach, fatigue, readiness e recupero, ma non genera un report corsa dettagliato.'}
        </p>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <MetricTile label={isEnglish ? 'Load category' : 'Categoria carico'} value={profile.sportCategory} icon={Activity} />
          <MetricTile label="Fatigue" value={profile.fatigueImpact.toFixed(2)} icon={Flame} tone="warning" />
          <MetricTile label={isEnglish ? 'Muscular stress' : 'Stress muscolare'} value={profile.muscularStress.toFixed(2)} icon={Zap} tone="danger" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 py-2.5 text-sm font-bold text-black"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Dashboard
          </Link>
          {activity.strava_id && (
            <a
              href={`https://www.strava.com/activities/${activity.strava_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-app-text"
            >
              <ExternalLink size={16} strokeWidth={1.8} />
              Strava
            </a>
          )}
        </div>
      </Card>
    </PageShell>
  );
}

function MetricsGrid({
  run,
  language,
  elapsedTime,
  maxSpeed,
  averageCadence,
  calories,
  sufferScore,
  averageWatts,
}: {
  run: RunDetailData;
  language: Language;
  elapsedTime?: number;
  maxSpeed?: number;
  averageCadence?: number;
  calories?: number;
  sufferScore?: number;
  averageWatts?: number;
}) {
  return (
    <Card>
      <SectionHeader eyebrow="run data" title={t(language, 'run.metrics')} icon={Gauge} className="mb-3" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard label={language === 'en' ? 'Distance' : 'Distanza'} value={formatKm(run.distance_m)} icon={MapPin} tone="lime" />
        <MetricCard label={t(language, 'run.duration')} value={formatPreciseDuration(run.moving_time_s)} icon={Timer} tone="cyan" />
        <MetricCard label={language === 'en' ? 'Average pace' : 'Passo medio'} value={formatPace(run.average_speed)} icon={Footprints} tone="lime" />
        <MetricCard label={language === 'en' ? 'Average speed' : 'Velocità media'} value={formatSpeed(run.average_speed)} icon={Zap} tone="cyan" />
        {run.average_heartrate && (
          <MetricCard
            label={language === 'en' ? 'Avg HR' : 'FC media'}
            value={`${Math.round(run.average_heartrate)} bpm`}
            icon={HeartPulse}
            tone="danger"
          />
        )}
        {run.max_heartrate && (
          <MetricCard
            label={language === 'en' ? 'Max HR' : 'FC max'}
            value={`${Math.round(run.max_heartrate)} bpm`}
            icon={HeartPulse}
            tone="danger"
          />
        )}
        {typeof run.total_elevation_gain === 'number' && (
          <MetricCard
            label={language === 'en' ? 'Elevation' : 'Dislivello'}
            value={`${Math.round(run.total_elevation_gain)} m`}
            icon={Mountain}
          />
        )}
        {run.type && (
          <MetricCard label={language === 'en' ? 'Type' : 'Tipo'} value={run.type} icon={Activity} />
        )}
        {maxSpeed && (
          <MetricCard label={t(language, 'run.maxSpeed')} value={formatSpeed(maxSpeed)} icon={Gauge} />
        )}
        {averageCadence !== undefined && (
          <MetricCard label={t(language, 'run.averageCadence')} value={`${Math.round(averageCadence)} spm`} icon={Footprints} />
        )}
        {calories !== undefined && (
          <MetricCard label="Calorie" value={`${Math.round(calories)} kcal`} icon={Flame} tone="warning" />
        )}
        {sufferScore !== undefined && (
          <MetricCard label="Suffer score" value={`${sufferScore}`} icon={Activity} tone="danger" />
        )}
        {averageWatts !== undefined && (
          <MetricCard label={t(language, 'run.averageWatts')} value={`${Math.round(averageWatts)} W`} icon={Battery} tone="lime" />
        )}
        {elapsedTime !== undefined && (
          <MetricCard label={t(language, 'run.elapsedTime')} value={formatPreciseDuration(elapsedTime)} icon={Clock} />
        )}
      </div>
    </Card>
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

function SessionJudgementSection({ judgement, language }: { judgement: { label: string; summary: string; effort: string; recoveryHint: string; formImpact: string }; language: Language }) {
  return (
    <Card>
      <SectionHeader eyebrow="session" title={t(language, 'run.sessionJudgement')} icon={CheckCircle2} />
      <div className="space-y-3">
        <div className="metric-card p-3.5">
          <p className="eyebrow mb-2">{t(language, 'run.summary')}</p>
          <p className="text-sm leading-relaxed text-neutral-200">{judgement.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">{t(language, 'run.effort')}</p>
            <p className="font-semibold text-app-text">{judgement.effort}</p>
          </div>
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">{t(language, 'run.postRun')}</p>
            <p className="font-semibold text-app-text">{judgement.recoveryHint}</p>
          </div>
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">{t(language, 'run.formImpact')}</p>
            <p className="font-semibold text-app-text">{judgement.formImpact}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HistoricalReportNotice({ runDate, language }: { runDate: string; language: Language }) {
  return (
    <Card>
      <SectionHeader eyebrow="historical" title={t(language, 'run.historicalReport')} icon={Info} />
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-neutral-200">
          {t(language, 'run.historicalNotice')} {formatDateLocalized(runDate, language)}.
        </p>
        <Link
          href="/"
          className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
        >
          <Gauge size={16} strokeWidth={1.8} />
          {t(language, 'run.viewLiveCoach')}
        </Link>
      </div>
    </Card>
  );
}

function RunSplitsSection({ splits, language }: { splits: any[]; language: Language }) {
  if (!splits || splits.length === 0) {
    return null;
  }

  return (
    <Card>
      <SectionHeader eyebrow="splits" title={language === 'en' ? 'Splits' : 'Intertempi'} icon={LineChart} />
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/10">
        <table className="min-w-full text-left text-sm text-neutral-300">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-app-muted">
            <tr>
              <th className="px-4 py-3">Km</th>
              <th className="px-4 py-3">{language === 'en' ? 'Pace' : 'Passo'}</th>
              <th className="px-4 py-3">{language === 'en' ? 'Avg HR' : 'FC media'}</th>
              <th className="px-4 py-3">{language === 'en' ? 'Elevation' : 'Dislivello'}</th>
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

function StravaLinkCard({ stravaId, language }: { stravaId: string; language: Language }) {
  return (
    <Card>
      <SectionHeader eyebrow="external" title="Strava" icon={ExternalLink} />
      <p className="mb-5 text-sm leading-relaxed text-app-muted">
        {language === 'en' ? 'Open the Strava activity page to view maps, segments, and splits.' : 'Vai alla pagina Strava della corsa per vedere mappe, segmenti e intertempi.'}
      </p>
      <a
        href={`https://www.strava.com/activities/${stravaId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
      >
        <ExternalLink size={16} strokeWidth={1.8} />
        {language === 'en' ? 'Open activity on Strava' : 'Apri attività su Strava'}
      </a>
    </Card>
  );
}

function CoachAnalysisSection({ run, language }: { run: RunDetailData; language: Language }) {
  const title = localizedReportText(run.title, language, language === 'en' ? 'Historical run analysis' : 'Analisi storica corsa');
  const summary = localizedReportText(run.summary, language, language === 'en' ? 'Historical report available for this run.' : 'Report storico disponibile per questa corsa.');
  const suggestedFocus = localizedReportText(run.suggested_focus, language, language === 'en' ? 'Use live coach guidance' : 'Usa indicazioni coach live');
  return (
    <Card>
      <SectionHeader eyebrow="historical" title={language === 'en' ? 'Analysis generated after the session' : 'Analisi generata dopo la seduta'} icon={Brain} />

      <div className="space-y-3">
        {title && (
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">{language === 'en' ? 'Title' : 'Titolo'}</p>
            <p className="font-semibold text-app-text">{title}</p>
          </div>
        )}

        {summary && (
          <div className="metric-card p-3.5">
            <p className="eyebrow mb-2">{language === 'en' ? 'Summary' : 'Sommario'}</p>
            <p className="text-sm leading-relaxed text-neutral-200">{summary}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {run.risk_level && (
            <div className="metric-card p-3.5">
              <p className="eyebrow mb-2">{language === 'en' ? 'Risk level' : 'Livello rischio'}</p>
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} strokeWidth={1.8} className={run.risk_level === 'alto' ? 'text-[var(--danger)]' : run.risk_level === 'medio' ? 'text-[var(--warning)]' : 'text-[var(--success)]'} />
                <p className="font-semibold capitalize text-app-text">{language === 'en' ? ({ basso: 'low', medio: 'medium', alto: 'high' } as Record<string, string>)[run.risk_level] ?? run.risk_level : run.risk_level}</p>
              </div>
            </div>
          )}

          {suggestedFocus && (
            <div className="metric-card p-3.5">
              <p className="eyebrow mb-2">{language === 'en' ? 'Post-session focus' : 'Focus post-seduta'}</p>
              <p className="font-semibold text-app-text">{suggestedFocus}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Next48hSection({
  next48h,
  suggestedFocus,
  timeline,
  language,
}: {
  next48h: string;
  suggestedFocus?: string;
  timeline?: RecoveryTimelineItem[];
  language: Language;
}) {
  return (
    <Card className="border-[rgba(54,252,225,0.22)] bg-[linear-gradient(135deg,rgba(54,252,225,0.09),rgba(17,17,17,0.94))] shadow-[0_0_28px_rgba(54,252,225,0.07)]">
      <SectionHeader
        eyebrow={t(language, 'run.historicalReportEyebrow')}
        title={t(language, 'run.postRunGuidance')}
        icon={Clock}
        className="mb-3"
      />
      <div className="space-y-3">
        <p className="text-xs leading-5 text-app-muted">
          {t(language, 'run.postRunGuidanceHelp')}
        </p>
        <p className="text-sm leading-6 text-neutral-200">{next48h}</p>
        {timeline && timeline.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {timeline.map((item, index) => (
              <div key={`${item.label}-${index}`} className="rounded-xl border border-[rgba(54,252,225,0.16)] bg-black/15 p-3">
                <p className="eyebrow mb-1 text-accent-secondary">{item.label}</p>
                <p className="text-sm font-semibold text-app-text">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-300">{item.description}</p>
              </div>
            ))}
          </div>
        )}
        {suggestedFocus && (
          <div className="border-t border-[rgba(54,252,225,0.18)] pt-3">
            <p className="eyebrow mb-1 text-accent-secondary">{t(language, 'run.generatedThen')}</p>
            <p className="text-sm font-semibold leading-5 text-app-text">{suggestedFocus}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function ScoresSection({
  readiness,
  fatigue,
  consistency,
  language,
}: {
  readiness?: number;
  fatigue?: number;
  consistency?: number;
  language: Language;
}) {
  if (!readiness && !fatigue && !consistency) return null;

  return (
    <Card>
      <SectionHeader eyebrow="scores" title={language === 'en' ? 'Session metrics' : 'Metriche della seduta'} icon={LineChart} />

      <div className="grid gap-3 sm:grid-cols-3">
        {readiness !== undefined && (
          <ScoreCard label={language === 'en' ? 'Session intensity' : 'Intensità seduta'} value={readiness} icon={Zap} />
        )}
        {fatigue !== undefined && (
          <ScoreCard label={language === 'en' ? 'Estimated fatigue' : 'Fatica stimata'} value={fatigue} icon={Activity} />
        )}
        {consistency !== undefined && (
          <ScoreCard label={language === 'en' ? 'Recovery impact' : 'Impatto sul recupero'} value={consistency} icon={TrendingUp} />
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
  language,
}: {
  weeklyPlan: Array<{ name: string; description: string; intensity: string; duration: string }>;
  language: Language;
}) {
  return (
    <Card>
      <SectionHeader eyebrow="plan" title={language === 'en' ? 'Weekly plan' : 'Piano settimanale'} icon={CalendarDays} />

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

type ReportBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

function parseFullReport(fullReport: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (list && list.items.length > 0) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  const flushParagraph = () => {
    const text = paragraph.join('\n').trim();
    if (text) {
      blocks.push({ type: 'paragraph', text });
    }
    paragraph = [];
  };

  for (const line of fullReport.split(/\r?\n/)) {
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', level: heading[1].length === 2 ? 2 : 3, text: heading[2].trim() });
      continue;
    }

    const unorderedItem = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const listItem = unorderedItem?.[1] ?? orderedItem?.[1];
    if (listItem) {
      flushParagraph();
      const ordered = Boolean(orderedItem);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(listItem.trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderMarkdownInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).replace(/\*\*/g, '');
    if (before) nodes.push(before);

    nodes.push(
      <strong key={`strong-${key}`} className="font-semibold text-neutral-100">
        {match[1]}
      </strong>
    );
    key += 1;
    lastIndex = match.index + match[0].length;
  }

  const after = text.slice(lastIndex).replace(/\*\*/g, '');
  if (after) nodes.push(after);

  return nodes;
}

function FullReportSection({ fullReport, language }: { fullReport: string; language: Language }) {
  const blocks = parseFullReport(fullReport);

  return (
    <Card>
      <SectionHeader eyebrow="full text" title={t(language, 'run.fullReport')} icon={Info} />

      <div className="space-y-4">
        {blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <h3
                key={`${block.type}-${index}`}
                className={block.level === 2
                  ? 'pt-2 text-base font-semibold tracking-tight text-app-text'
                  : 'pt-1 text-sm font-semibold tracking-tight text-neutral-100'}
              >
                {renderMarkdownInline(block.text)}
              </h3>
            );
          }

          if (block.type === 'list') {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag
                key={`${block.type}-${index}`}
                className={block.ordered
                  ? 'space-y-2 pl-5 text-sm leading-6 text-neutral-300 marker:text-accent-secondary'
                  : 'space-y-2 pl-5 text-sm leading-6 text-neutral-300 marker:text-accent-secondary'}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${index}-${itemIndex}`} className={block.ordered ? 'list-decimal pl-1' : 'list-disc pl-1'}>
                    {renderMarkdownInline(item)}
                  </li>
                ))}
              </ListTag>
            );
          }

          return (
            <p key={`${block.type}-${index}`} className="whitespace-pre-wrap text-sm leading-6 text-neutral-300">
              {renderMarkdownInline(block.text)}
            </p>
          );
        })}
      </div>
    </Card>
  );
}

function CoachNotesSection({ notes, language }: { notes: string[]; language: Language }) {
  const visibleNotes = language === 'en'
    ? notes.map((note) => localizedReportText(note, language, 'Historical coach note generated before the current language setting.'))
    : notes;
  return (
    <Card>
      <SectionHeader eyebrow="notes" title={language === 'en' ? 'Coach notes' : 'Note del coach'} icon={Sparkles} />

      <div className="space-y-3">
        {visibleNotes.map((note, index) => (
          <div key={index} className="flex gap-3 rounded-xl bg-white/[0.035] p-3">
            <Sparkles size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-accent-secondary" />
            <p className="text-sm text-neutral-200">{note}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
