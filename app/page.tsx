import Link from 'next/link';
import { query } from '@/lib/db';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { buildCoachDecision } from '@/lib/coach-decision';
import { getLatestRunWithReport } from '@/lib/runs';
import { formatDateIT, formatDaysSince, getTodayInAppTimezone } from '@/lib/date-utils';
import { getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';

/**
 * Interfacce per i dati della dashboard
 */
interface DashboardRun {
  id: string;
  strava_id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_speed: number;
  average_heartrate?: number;
  type: string;
  created_at?: string;
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
  suggested_focus?: string;
  coach_notes?: any;
  full_report?: string;
  weekly_plan?: any;
}

interface WeeklyTrendItem {
  week: number;
  runs: number;
  total_distance: number;
}

interface AthleteMetrics {
  readinessScore?: number;
  readinessLabel?: string;
  readinessExplanation?: string;
  fatigueScore?: number;
  fatigueLabel?: string;
  fatigueExplanation?: string;
  consistencyScore?: number;
  consistencyLabel?: string;
  consistencyExplanation?: string;
  overloadRisk?: string;
  overloadExplanation?: string;
  suggestedFocus?: string;
}

/**
 * Helper: Formatta chilometri
 */
function formatKm(meters: number): string {
  if (!meters) return '0 km';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Helper: Formatta durata in minuti
 */
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

// Date utility moved to src/lib/date-utils.ts

/**
 * Helper: Ottieni label interpretativa per readiness
 */
function getReadinessLabel(score?: number): string {
  if (!score) return 'N/A';
  if (score >= 80) return 'Buona';
  if (score >= 60) return 'Moderata';
  return 'Bassa';
}

/**
 * Helper: Ottieni label interpretativa per fatigue
 */
function getFatigueLabel(score?: number): string {
  if (!score) return 'N/A';
  if (score <= 30) return 'Bassa';
  if (score <= 60) return 'Media';
  return 'Alta';
}

/**
 * Helper: Ottieni label interpretativa per consistency
 */
function getConsistencyLabel(score?: number): string {
  if (!score) return 'N/A';
  if (score >= 80) return 'Solida';
  if (score >= 60) return 'Buona';
  return 'In costruzione';
}

/**
 * Helper: Ottieni label interpretativa per risk level
 */
function getRiskLabel(riskLevel?: string): string {
  switch (riskLevel?.toLowerCase()) {
    case 'basso': return 'Basso';
    case 'medio': return 'Medio';
    case 'alto': return 'Alto';
    default: return 'N/A';
  }
}

/**
 * Helper: Ottieni emoji per livello rischio
 */
function getRiskEmoji(riskLevel?: string): string {
  switch (riskLevel?.toLowerCase()) {
    case 'basso': return '🟢';
    case 'medio': return '🟡';
    case 'alto': return '🔴';
    default: return '⚪';
  }
}

/**
 * Helper: Ottieni colore per score
 */
function getScoreColor(score?: number): string {
  if (!score) return 'text-neutral-400';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function getReportStatus(run?: DashboardRun | null): 'ready' | 'waiting' {
  return hasCoachReport(run) ? 'ready' : 'waiting';
}

function ReportStatusBadge({ status }: { status: 'ready' | 'waiting' }) {
  const styles = {
    ready: 'bg-emerald-500/10 text-emerald-300',
    waiting: 'bg-yellow-500/10 text-yellow-300',
  };
  const labels = {
    ready: 'Report pronto',
    waiting: 'Report in attesa',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/**
 * Helper: Ottieni label per settimana
 */
function getWeekLabel(runs: number, distanceKm: number): string {
  if (runs === 0) return 'Riposo';
  if (distanceKm < 10) return 'Leggera';
  if (distanceKm < 25) return 'Moderata';
  return 'Carica';
}

/**
 * Helper: Calcola media settimanale recente
 */
function calculateWeeklyAverage(trend: WeeklyTrendItem[]): number {
  if (!trend || trend.length < 2) return 0;

  // Prendi le ultime 4 settimane (escludendo la corrente)
  const recentWeeks = trend.slice(1, 5);
  if (recentWeeks.length === 0) return 0;

  const totalKm = recentWeeks.reduce((sum, week) => sum + (week.total_distance / 1000), 0);
  return totalKm / recentWeeks.length;
}

/**
 * Componente Hero - Today / Coach Status
 */
function HeroSection({ lastRun }: { lastRun: DashboardRun | null | undefined }) {
  const today = formatDateIT(getTodayInAppTimezone());
  const lastRunLabel = lastRun ? formatDaysSince(lastRun.start_date) : null;
  const reportStatus = getReportStatus(lastRun);

  return (
    <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-3xl p-6 sm:p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {today}
          </h1>
          <div className="text-neutral-300 text-sm sm:text-base">
            {lastRunLabel ? (
              <span>Ultima corsa: {lastRunLabel}</span>
            ) : (
              <span>Nessuna corsa ancora sincronizzata</span>
            )}
          </div>
        </div>

        {/* Placeholder per futura card meteo */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-neutral-400 uppercase tracking-wide">Stato Coach</div>
            <div className="text-white font-medium">
              {lastRun ? (
                <ReportStatusBadge status={reportStatus} />
              ) : (
                'In attesa dati'
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente Coach Decision Card - Nuova card principale del coach
 */
function CoachDecisionCard({ decision }: { decision: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'recovery': return 'text-blue-400';
      case 'easy': return 'text-green-400';
      case 'progression': return 'text-yellow-400';
      case 'caution': return 'text-orange-400';
      case 'insufficient_data': return 'text-gray-400';
      default: return 'text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'recovery': return '🛋️';
      case 'easy': return '🏃‍♂️';
      case 'progression': return '📈';
      case 'caution': return '⚠️';
      case 'insufficient_data': return '📊';
      default: return '🧠';
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="text-4xl flex-shrink-0">
          {getStatusIcon(decision.status)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {decision.title}
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 ${getStatusColor(decision.status)}`}>
              {decision.label}
            </span>
          </div>
          <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
            {decision.message}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-neutral-800 rounded-2xl p-4">
          <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">
            Oggi
          </div>
          <p className="text-white text-sm sm:text-base">
            {decision.actionToday}
          </p>
        </div>

        <div className="bg-neutral-800 rounded-2xl p-4">
          <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">
            Domani
          </div>
          <p className="text-white text-sm sm:text-base">
            {decision.actionTomorrow}
          </p>
        </div>
      </div>

      <div className="bg-neutral-800 rounded-2xl p-4 mb-4">
        <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-2">
          {decision.nextWorkoutLabel || 'Dopodomani / Prossima corsa'}
        </div>
        <p className="text-white text-sm sm:text-base">
          {decision.nextWorkout}
        </p>
      </div>

      <div className="text-xs text-neutral-400">
        <strong>Motivo:</strong> {decision.reason}
      </div>
    </div>
  );
}

/**
 * Componente Metriche Atleta - Più leggibili con label interpretative
 */
function AthleteMetricsCard({ metrics }: { metrics: AthleteMetrics | null | undefined }) {
  if (!metrics) return null;

  const hasValidMetrics = metrics.readinessScore || metrics.fatigueScore || metrics.consistencyScore;

  if (!hasValidMetrics) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Stato Atleta</h2>

      <div className="space-y-4">
        {metrics.readinessScore && metrics.readinessLabel && (
          <MetricItem
            label="Readiness"
            value={metrics.readinessScore}
            description={metrics.readinessLabel}
            explanation={metrics.readinessExplanation}
            icon="⚡"
          />
        )}

        {metrics.fatigueScore && metrics.fatigueLabel && (
          <MetricItem
            label="Fatigue"
            value={metrics.fatigueScore}
            description={metrics.fatigueLabel}
            explanation={metrics.fatigueExplanation}
            icon="😴"
          />
        )}

        {metrics.consistencyScore && metrics.consistencyLabel && (
          <MetricItem
            label="Consistency"
            value={metrics.consistencyScore}
            description={metrics.consistencyLabel}
            explanation={metrics.consistencyExplanation}
            icon="📊"
          />
        )}

        {metrics.overloadRisk && (
          <div className="bg-neutral-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">
                  Rischio Overload
                </div>
                <div className="text-white font-medium">
                  {getRiskLabel(metrics.overloadRisk)}
                </div>
                {metrics.overloadExplanation && (
                  <div className="text-xs text-neutral-400 mt-1">
                    {metrics.overloadExplanation}
                  </div>
                )}
              </div>
              <span className="text-3xl">{getRiskEmoji(metrics.overloadRisk)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente per singola metrica
 */
function MetricItem({
  label,
  value,
  description,
  explanation,
  icon
}: {
  label: string;
  value: number;
  description: string;
  explanation?: string;
  icon: string;
}) {
  return (
    <div className="bg-neutral-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide">
              {label}
            </div>
            <div className="text-white font-medium text-sm sm:text-base">
              {description}
            </div>
          </div>
        </div>
        <div className={`text-xl sm:text-2xl font-bold ${getScoreColor(value)}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente Ultima Corsa - Migliorata con bottone Strava
 */
function LastRunCard({ run }: { run: DashboardRun | null | undefined }) {
  if (!run) return null;

  const reportStatus = getReportStatus(run);
  const reportExcerpt = getCoachReportExcerpt(run);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Ultima Corsa</h2>
          <div className="text-xs sm:text-sm text-neutral-400 mt-1">
            {formatDateIT(run.start_date)}
          </div>
        </div>
        <ReportStatusBadge status={reportStatus} />
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-white">{run.name}</h3>
        {reportExcerpt ? (
          <p className="text-sm text-neutral-300 leading-relaxed">
            {reportExcerpt}
          </p>
        ) : (
          <p className="text-sm text-neutral-300">
            Analisi AI in attesa di generazione.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-neutral-800 rounded-2xl p-4">
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">Distanza</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{formatKm(run.distance_m)}</div>
          </div>

          <div className="bg-neutral-800 rounded-2xl p-4">
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">Durata</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{formatDuration(run.moving_time_s)}</div>
          </div>

          <div className="bg-neutral-800 rounded-2xl p-4">
            <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">Passo medio</div>
            <div className="text-lg sm:text-xl font-bold text-white">
              {run.average_speed ? formatPace(run.average_speed) : 'N/A'}
            </div>
          </div>

          {run.average_heartrate && (
            <div className="bg-neutral-800 rounded-2xl p-4">
              <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-1">FC Media</div>
              <div className="text-lg sm:text-xl font-bold text-red-400">{run.average_heartrate} bpm</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/runs/${run.id}`}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 sm:px-6 rounded-2xl transition-colors duration-200 active:scale-95 text-sm sm:text-base"
        >
          <span>Apri Analisi Completa</span>
          <span>→</span>
        </Link>

        {run.strava_id && (
          <a
            href={`https://www.strava.com/activities/${run.strava_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-4 sm:px-6 rounded-2xl transition-colors duration-200 active:scale-95 text-sm sm:text-base"
          >
            <span>🔗 Strava</span>
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Helper: Formatta passo medio
 */
function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

/**
 * Componente Trend Settimanale - Più interpretativo
 */
function WeeklyTrendCard({ trend }: { trend: WeeklyTrendItem[] | null }) {
  if (!trend || trend.length === 0) return null;

  const weeklyAverage = calculateWeeklyAverage(trend);
  const currentWeek = trend[0]; // La settimana più recente
  const currentKm = currentWeek.total_distance / 1000;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Trend Settimanale</h2>

      {/* Settimana corrente evidenziata */}
      <div className="bg-neutral-800 rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">
              {currentWeek.week}
            </div>
            <div>
              <div className="text-white font-medium">Questa settimana</div>
              <div className="text-xs sm:text-sm text-neutral-400">
                {currentWeek.runs} uscite
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-bold text-white">{formatKm(currentWeek.total_distance)}</div>
            <div className="text-xs sm:text-sm text-neutral-400">
              {getWeekLabel(currentWeek.runs, currentKm)}
            </div>
          </div>
        </div>

        {weeklyAverage > 0 && (
          <div className="text-xs sm:text-sm text-neutral-400">
            Media recente: {weeklyAverage.toFixed(1)} km/settimana
            {currentKm > weeklyAverage * 1.2 && (
              <span className="text-green-400 ml-2">↑ Più del 20%</span>
            )}
            {currentKm < weeklyAverage * 0.8 && (
              <span className="text-yellow-400 ml-2">↓ Meno del 20%</span>
            )}
          </div>
        )}
      </div>

      {/* Altre settimane */}
      <div className="space-y-2">
        <div className="text-xs sm:text-sm text-neutral-400 uppercase tracking-wide mb-3">
          Ultime settimane
        </div>
        {trend.slice(1, 5).map((week, index) => {
          const weekKm = week.total_distance / 1000;
          return (
            <div key={index} className="flex items-center justify-between py-2 px-3 bg-neutral-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center text-xs font-medium text-white">
                  {week.week}
                </div>
                <div className="text-xs sm:text-sm text-neutral-400">
                  {week.runs} uscite
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm sm:text-base font-medium text-white">{formatKm(week.total_distance)}</div>
                <div className="text-xs text-neutral-500">
                  {getWeekLabel(week.runs, weekKm)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Componente Link Profilo Strava
 */
function StravaProfileLink() {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
      <a
        href="https://www.strava.com/athletes/533234"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-full gap-3 bg-orange-600 hover:bg-orange-700 text-white font-medium py-4 px-6 rounded-2xl transition-colors duration-200 active:scale-95"
      >
        <span className="text-2xl">🏃</span>
        <span className="text-sm sm:text-base">Apri Profilo Strava</span>
        <span className="text-lg">→</span>
      </a>
    </div>
  );
}

/**
 * Componente per empty state
 */
function EmptyState() {
  return (
    <div className="bg-neutral-900 rounded-3xl p-12 border border-neutral-800 text-center">
      <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-2xl">🏃‍♂️</span>
      </div>

      <h2 className="text-2xl font-bold text-white mb-4">Nessuna corsa ancora sincronizzata</h2>

      <p className="text-neutral-400 mb-8 max-w-md mx-auto">
        Le tue corse appariranno qui automaticamente dopo la prima sincronizzazione con Strava.
        Controlla che il cron job sia attivo o avvia una sync manuale.
      </p>

      <div className="text-sm text-neutral-500">
        La sincronizzazione avviene automaticamente ogni 6 ore
      </div>
    </div>
  );
}

/**
 * Pagina principale della dashboard - Coach at a Glance
 */
export default async function HomePage() {
  // Query per l'ultima corsa con il suo report (ultimo disponibile)
  const lastRun = await getLatestRunWithReport();

  // Query per il trend delle ultime 6 settimane
  const trendQuery = await query(`
    WITH weekly_stats AS (
      SELECT
        DATE_TRUNC('week', start_date) as week_start,
        COUNT(*) as runs,
        SUM(distance_m) as total_distance
      FROM activities
      WHERE type IN ('Run', 'TrailRun')
        AND start_date >= NOW() - INTERVAL '6 weeks'
      GROUP BY DATE_TRUNC('week', start_date)
      ORDER BY week_start DESC
    )
    SELECT
      EXTRACT(WEEK FROM week_start)::INTEGER as week,
      runs,
      total_distance
    FROM weekly_stats
    ORDER BY week_start DESC
    LIMIT 6
  `);

  const athleteSettings = await getAthleteSettings();
  const activityHistoryQuery = await query(`
    SELECT * FROM activities
    WHERE type IN ('Run', 'TrailRun')
      AND start_date >= NOW() - INTERVAL '90 days'
    ORDER BY start_date DESC
  `);

  const athleteMetrics = calculateCoachingMetrics(activityHistoryQuery.rows, athleteSettings);
  const weeklyTrend = trendQuery.rows as WeeklyTrendItem[];

  // Query per il report più recente
  const latestReport = lastRun && hasCoachReport(lastRun)
    ? {
        title: lastRun?.title || 'Report Coach',
        summary: lastRun.summary || '',
        risk_level: (lastRun.risk_level || 'medio') as 'basso' | 'medio' | 'alto',
        next_48h: lastRun.next_48h || '',
        suggested_focus: lastRun.suggested_focus || '',
        coach_notes: Array.isArray(lastRun.coach_notes) ? lastRun.coach_notes : [],
        readiness_score: lastRun.readiness_score || 0,
        fatigue_score: lastRun.fatigue_score || 0,
        consistency_score: lastRun.consistency_score || 0,
        weekly_plan: Array.isArray(lastRun.weekly_plan) ? lastRun.weekly_plan : [],
        full_report: lastRun.full_report || '',
      }
    : null;

  const coachDecision = buildCoachDecision(latestReport, athleteMetrics, lastRun);

  const hasData = lastRun || (weeklyTrend && weeklyTrend.length > 0);

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header con navigazione */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">AI Running Coach</h1>
            <p className="text-neutral-400 text-sm sm:text-base">Il tuo allenatore personale basato sui dati</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/coach"
              className="inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-colors duration-200 text-sm"
            >
              <span>🧠</span>
              <span className="hidden sm:inline">Coach</span>
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-colors duration-200 text-sm"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Hero Section */}
            <HeroSection lastRun={lastRun} />

            {/* Layout principale */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Colonna sinistra - Coach Decision (principale) */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                <CoachDecisionCard decision={coachDecision} />
                <LastRunCard run={lastRun} />
              </div>

              {/* Colonna destra - Metriche e trend */}
              <div className="lg:col-span-1 space-y-6 sm:space-y-8">
                <AthleteMetricsCard metrics={athleteMetrics} />
                <WeeklyTrendCard trend={weeklyTrend} />
                <StravaProfileLink />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
