import Link from 'next/link';
import { query } from '@/lib/db';

/**
 * Interfacce per i dati della dashboard
 */
interface DashboardRun {
  id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_heartrate?: number;
  type: string;
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
}

interface WeeklyTrendItem {
  week: number;
  runs: number;
  total_distance: number;
}

interface AthleteMetrics {
  readiness_score: number;
  fatigue_score: number;
  consistency_score: number;
  risk_level: string;
  suggested_focus: string;
}

/**
 * Helper: Formatta chilometri
 */
function formatKm(meters: number): string {
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

/**
 * Helper: Formatta data in italiano
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Helper: Ottieni emoji per livello rischio
 */
function getRiskEmoji(riskLevel: string): string {
  switch (riskLevel) {
    case 'basso': return '🟢';
    case 'medio': return '🟡';
    case 'alto': return '🔴';
    default: return '⚪';
  }
}

/**
 * Helper: Ottieni emoji per score
 */
function getScoreEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

/**
 * Helper: Ottieni colore per score
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Componente per l'ultima corsa
 */
function LastRunCard({ run, report }: { run: DashboardRun | null; report: DashboardRun | null }) {
  if (!run) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Ultima Corsa</h2>
        <div className="text-sm text-neutral-400">
          {formatDate(run.start_date)}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <h3 className="text-xl font-semibold text-white">{run.name}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-sm text-neutral-400 mb-1">Distanza</div>
            <div className="text-2xl font-bold text-white">{formatKm(run.distance_m)}</div>
          </div>

          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-sm text-neutral-400 mb-1">Durata</div>
            <div className="text-2xl font-bold text-white">{formatDuration(run.moving_time_s)}</div>
          </div>

          {run.average_heartrate && (
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-sm text-neutral-400 mb-1">FC Media</div>
              <div className="text-2xl font-bold text-red-400">{run.average_heartrate} bpm</div>
            </div>
          )}

          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-sm text-neutral-400 mb-1">Tipo</div>
            <div className="text-lg font-semibold text-white">{run.type}</div>
          </div>
        </div>
      </div>

      {report && (
        <div className="border-t border-neutral-800 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">{report.title}</h4>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getRiskEmoji(report.risk_level || 'medio')}</span>
              <span className="text-sm font-medium text-neutral-300 uppercase">
                {report.risk_level}
              </span>
            </div>
          </div>

          <p className="text-neutral-300 leading-relaxed">{report.summary}</p>

          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-sm text-neutral-400 mb-2">Prossime 48 ore</div>
            <p className="text-white">{report.next_48h}</p>
          </div>

          <Link
            href={`/runs/${run.id}`}
            className="inline-flex items-center justify-center w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200 active:scale-95"
          >
            <span>📊 Apri Analisi Completa</span>
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Componente per le metriche atleta
 */
function AthleteMetricsCard({ metrics }: { metrics: AthleteMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-6">Stato Atleta</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Readiness */}
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">{getScoreEmoji(metrics.readiness_score)}</div>
          <div className={`text-2xl font-bold ${getScoreColor(metrics.readiness_score)}`}>
            {metrics.readiness_score}
          </div>
          <div className="text-sm text-neutral-400">Readiness</div>
        </div>

        {/* Fatigue */}
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">😴</div>
          <div className={`text-2xl font-bold ${getScoreColor(100 - metrics.fatigue_score)}`}>
            {metrics.fatigue_score}
          </div>
          <div className="text-sm text-neutral-400">Fatigue</div>
        </div>

        {/* Consistency */}
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className={`text-2xl font-bold ${getScoreColor(metrics.consistency_score)}`}>
            {metrics.consistency_score}
          </div>
          <div className="text-sm text-neutral-400">Consistency</div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {/* Risk Level */}
        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">Rischio Overload</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getRiskEmoji(metrics.risk_level)}</span>
              <span className="text-sm font-medium text-neutral-300 uppercase">
                {metrics.risk_level}
              </span>
            </div>
          </div>
        </div>

        {/* Focus */}
        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="text-sm text-neutral-400 mb-2">Focus Consigliato</div>
          <div className="text-white font-medium">{metrics.suggested_focus}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente per il trend settimanale
 */
function WeeklyTrendCard({ trend }: { trend: WeeklyTrendItem[] | null }) {
  if (!trend || trend.length === 0) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-6">Trend Settimanale</h2>

      <div className="space-y-3">
        {trend.map((week, index) => (
          <div key={index} className="flex items-center justify-between py-3 px-4 bg-neutral-800 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center text-sm font-medium text-white">
                {week.week}
              </div>
              <div>
                <div className="text-white font-medium">Settimana {week.week}</div>
                <div className="text-sm text-neutral-400">
                  {week.runs} uscite • {formatKm(week.total_distance)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-white">{formatKm(week.total_distance)}</div>
              <div className="text-sm text-neutral-400">km</div>
            </div>
          </div>
        ))}
      </div>
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
 * Pagina principale della dashboard
 */
export default async function HomePage() {
  // Query per l'ultima corsa con il suo report
  const lastRunQuery = await query(`
    SELECT a.*, cr.title, cr.summary, cr.risk_level, cr.next_48h
    FROM activities a
    LEFT JOIN coach_reports cr ON a.id = cr.activity_id
    WHERE a.type IN ('Run', 'TrailRun')
    ORDER BY a.start_date DESC
    LIMIT 1
  `);

  const lastRun = lastRunQuery.rows[0];

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

  const metricsQuery = await query(`
    SELECT readiness_score, fatigue_score, consistency_score, risk_level, suggested_focus
    FROM coach_reports
    WHERE readiness_score IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const weeklyTrend = trendQuery.rows;
  const athleteMetrics = metricsQuery.rows[0] as AthleteMetrics | null;

  const hasData = lastRun || (weeklyTrend && weeklyTrend.length > 0);

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">AI Running Coach</h1>
            <p className="text-neutral-400">Il tuo allenatore personale basato sui dati</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/coach"
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              🧠 Coach
            </Link>
            <Link
              href="/settings"
              className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              ⚙️ Settings
            </Link>
          </div>
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Ultima corsa - 2 colonne su desktop */}
            <div className="lg:col-span-2">
              <LastRunCard run={lastRun} report={lastRun} />
            </div>

            {/* Metriche atleta - 1 colonna su desktop */}
            <div className="lg:col-span-1 space-y-8">
              <AthleteMetricsCard metrics={athleteMetrics} />
              <WeeklyTrendCard trend={weeklyTrend} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
