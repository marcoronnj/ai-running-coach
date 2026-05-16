import { Client, type QueryResultRow } from 'pg';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import type { AthleteSettings } from '@/lib/athlete-settings';
import { getCoachingRules } from '@/lib/coaching-rules';
import { buildDynamicAthleteState, type DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import type { PublicStravaConnectionStatus } from '@/lib/strava-connection';
import { fallbackDynamicAthleteState, logServerError } from '@/lib/resilient-data';
import { normalizeLanguage, type Language } from '@/lib/i18n';

export interface DashboardRun {
  id: string;
  strava_id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_speed: number;
  average_heartrate?: number;
  type: string;
  sport_type?: string;
  created_at?: string;
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
  suggested_focus?: string;
  coach_notes?: any;
  full_report?: string;
  weekly_plan?: any;
  readiness_score?: number;
  fatigue_score?: number;
  consistency_score?: number;
}

export interface WeeklyTrendItem {
  week: number;
  runs: number;
  total_distance: number;
}

export interface HomeDashboardIssue {
  section: string;
  reason: 'error' | 'timeout';
  durationMs: number;
  message?: string;
}

export interface HomeDashboardData {
  createdAt: string;
  updatedAt: string;
  latestRun: DashboardRun | null;
  latestReport: any | null;
  recentRuns: any[];
  activityCount: number | null;
  activityPresence: 'known' | 'unknown';
  isTrueEmpty: boolean;
  metrics: ReturnType<typeof calculateCoachingMetrics> | null;
  rules: ReturnType<typeof getCoachingRules> | null;
  athleteSettings: AthleteSettings | null;
  stravaConnection: PublicStravaConnectionStatus | undefined;
  trend: WeeklyTrendItem[];
  dynamicAthleteState: DynamicAthleteState;
  errors: HomeDashboardIssue[];
  timedOut: string[];
  source: 'cache' | 'db' | 'snapshot-db' | 'fallback';
}

const CRITICAL_TIMEOUT_MS = 2000;
const SECONDARY_TIMEOUT_MS = 1500;
const SNAPSHOT_TIMEOUT_MS = 500;
const HOME_CACHE_TTL_MS = 30_000;
const HOME_STALE_DASHBOARD_TTL_MS = 5 * 60_000;

const EMPTY_STRAVA_STATUS: PublicStravaConnectionStatus = { connected: false };

const homeDashboardCache = new Map<string, { data: HomeDashboardData; updatedAt: number }>();
const homeDashboardRefreshes = new Map<string, Promise<void>>();

async function homeQuery<T extends QueryResultRow>(
  text: string,
  values: any[] | undefined,
  timeoutMs: number
) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL non configurato');
  }

  const queryTimeoutMs = Math.max(timeoutMs - 100, 1);
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: Math.min(timeoutMs, 1000),
    query_timeout: queryTimeoutMs,
    statement_timeout: queryTimeoutMs,
  });

  try {
    await client.connect();
    return await client.query<T>({
      text,
      values,
      query_timeout: queryTimeoutMs,
    } as any);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function emptyHomeDashboardData(language: Language = 'it'): HomeDashboardData {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    latestRun: null,
    latestReport: null,
    recentRuns: [],
    activityCount: null,
    activityPresence: 'unknown',
    isTrueEmpty: false,
    metrics: null,
    rules: null,
    athleteSettings: null,
    stravaConnection: EMPTY_STRAVA_STATUS,
    trend: [],
    dynamicAthleteState: fallbackDynamicAthleteState(language),
    errors: [],
    timedOut: [],
    source: 'fallback',
  };
}

function withPromiseTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let settled = false;
  const guarded = promise
    .then((value) => {
      settled = true;
      return value;
    })
    .catch((error) => {
      settled = true;
      throw error;
    });

  const timeout = new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      if (!settled) resolve(fallback);
    }, timeoutMs);

    guarded.then(
      () => clearTimeout(timer),
      () => clearTimeout(timer)
    );
  });

  return Promise.race([guarded, timeout]);
}

export function isValidDashboardSnapshot(data: HomeDashboardData | null | undefined): data is HomeDashboardData {
  if (!data) return false;
  const hasActivitySignal = Boolean(data.latestRun) || (typeof data.activityCount === 'number' && data.activityCount > 0);
  return Boolean(hasActivitySignal && data.athleteSettings && data.createdAt && data.updatedAt);
}

function toIssue(section: string, reason: 'error' | 'timeout', durationMs: number, error?: unknown): HomeDashboardIssue {
  return {
    section,
    reason,
    durationMs,
    message: error instanceof Error ? error.message : error ? String(error) : undefined,
  };
}

async function withTimeout<T>({
  label,
  promise,
  timeoutMs,
  fallback,
  issues,
}: {
  label: string;
  promise: Promise<T>;
  timeoutMs: number;
  fallback: T;
  issues: HomeDashboardIssue[];
}): Promise<T> {
  const start = Date.now();
  let settled = false;

  const guarded = promise
    .then((value) => {
      settled = true;
      console.log(`[HOME PERF] ${label} ${Date.now() - start}ms`);
      return value;
    })
    .catch((error) => {
      settled = true;
      const durationMs = Date.now() - start;
      issues.push(toIssue(label, 'error', durationMs, error));
      logServerError(`home.${label}`, error);
      console.log(`[HOME PERF] ${label} error ${durationMs}ms`);
      return fallback;
    });

  const timeout = new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      if (settled) return;
      const durationMs = Date.now() - start;
      issues.push(toIssue(label, 'timeout', durationMs));
      console.log(`[HOME FALLBACK] ${label} timeout`);
      console.log(`[HOME PERF] ${label} timeout ${timeoutMs}ms`);
      resolve(fallback);
    }, timeoutMs);

    guarded.finally(() => clearTimeout(timer));
  });

  return Promise.race([guarded, timeout]);
}

async function getAthleteSettings(issues: HomeDashboardIssue[]): Promise<AthleteSettings | null> {
  return withTimeout({
    label: 'athleteSettings',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: null,
    issues,
    promise: homeQuery<{ data: AthleteSettings | null }>(
      `
        SELECT row_to_json(athlete_settings) AS data
        FROM athlete_settings
        WHERE id = 'default'
        LIMIT 1
      `,
      undefined,
      SECONDARY_TIMEOUT_MS
    ).then((result) => result.rows[0]?.data ?? null),
  });
}

async function getStravaConnection(userId: string | null, issues: HomeDashboardIssue[]): Promise<PublicStravaConnectionStatus> {
  return withTimeout({
    label: 'stravaConnection',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: EMPTY_STRAVA_STATUS,
    issues,
    promise: homeQuery<{ data: PublicStravaConnectionStatus | null }>(
      `
        SELECT json_build_object(
          'connected', true,
          'stravaAthleteId', strava_athlete_id,
          'expiresAt', expires_at,
          'updatedAt', updated_at,
          'athlete', json_build_object(
            'firstname', athlete_firstname,
            'lastname', athlete_lastname,
            'username', athlete_username,
            'profile', athlete_profile,
            'profileMedium', athlete_profile_medium
          )
        ) AS data
        FROM strava_connections
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId ?? ''],
      SECONDARY_TIMEOUT_MS
    ).then((result) => result.rows[0]?.data ?? EMPTY_STRAVA_STATUS),
  });
}

async function getLatestRun(issues: HomeDashboardIssue[]): Promise<DashboardRun | null> {
  return withTimeout({
    label: 'latestRun',
    timeoutMs: CRITICAL_TIMEOUT_MS,
    fallback: null,
    issues,
    promise: homeQuery<{ data: DashboardRun | null }>(
      `
        SELECT row_to_json(latest_activity) AS data
        FROM (
          SELECT a.id,
                 a.strava_id,
                 a.name,
                 a.start_date,
                 a.distance_m,
                 a.moving_time_s,
                 a.average_speed,
                 a.average_heartrate,
                 a.type,
                 a.sport_type,
                 a.created_at,
                 cr.created_at AS report_created_at,
                 cr.title,
                 cr.summary,
                 cr.risk_level,
                 cr.next_48h,
                 cr.suggested_focus,
                 cr.coach_notes,
                 cr.weekly_plan,
                 cr.full_report,
                 cr.readiness_score,
                 cr.fatigue_score,
                 cr.consistency_score
          FROM activities a
          LEFT JOIN LATERAL (
            SELECT *
            FROM coach_reports
            WHERE activity_id = a.id OR activity_id = a.strava_id
            ORDER BY created_at DESC
            LIMIT 1
          ) cr ON true
          WHERE COALESCE(a.sport_type, a.type) IN ('Run', 'TrailRun', 'VirtualRun')
          ORDER BY a.start_date DESC
          LIMIT 1
        ) latest_activity
      `,
      undefined,
      CRITICAL_TIMEOUT_MS
    ).then((result) => result.rows[0]?.data ?? null),
  });
}

async function getActivityCount(issues: HomeDashboardIssue[]): Promise<number | null> {
  return withTimeout({
    label: 'activityCount',
    timeoutMs: CRITICAL_TIMEOUT_MS,
    fallback: null,
    issues,
    promise: homeQuery<{ count: string }>(
      `
        SELECT COUNT(*)::TEXT AS count
        FROM activities
      `,
      undefined,
      CRITICAL_TIMEOUT_MS
    ).then((result) => Number(result.rows[0]?.count ?? 0)),
  });
}

async function getWeeklyTrend(issues: HomeDashboardIssue[]): Promise<WeeklyTrendItem[]> {
  return withTimeout({
    label: 'weeklyTrend',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: [],
    issues,
    promise: homeQuery<{ data: WeeklyTrendItem[] }>(
      `
        WITH weekly_stats AS (
          SELECT
            DATE_TRUNC('week', start_date) AS week_start,
            COUNT(*)::INTEGER AS runs,
            COALESCE(SUM(distance_m), 0)::FLOAT AS total_distance
          FROM activities
          WHERE COALESCE(sport_type, type) IN ('Run', 'TrailRun', 'VirtualRun')
            AND start_date >= NOW() - INTERVAL '6 weeks'
          GROUP BY DATE_TRUNC('week', start_date)
          ORDER BY week_start DESC
          LIMIT 6
        )
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'week', EXTRACT(WEEK FROM week_start)::INTEGER,
              'runs', runs,
              'total_distance', total_distance
            )
            ORDER BY week_start DESC
          ),
          '[]'::json
        ) AS data
        FROM weekly_stats
      `,
      undefined,
      SECONDARY_TIMEOUT_MS
    ).then((result) => result.rows[0]?.data ?? []),
  });
}

async function getActivityHistory(issues: HomeDashboardIssue[]): Promise<any[]> {
  return withTimeout({
    label: 'activityHistory',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: [],
    issues,
    promise: homeQuery<{ data: any[] }>(
      `
        SELECT COALESCE(json_agg(row_to_json(recent_activity) ORDER BY recent_activity.start_date DESC), '[]'::json) AS data
        FROM (
          SELECT *
          FROM activities
          WHERE start_date >= NOW() - INTERVAL '90 days'
          ORDER BY start_date DESC
        ) recent_activity
      `,
      undefined,
      SECONDARY_TIMEOUT_MS
    ).then((result) => result.rows[0]?.data ?? []),
  });
}

function getLatestReport(latestRun: DashboardRun | null) {
  if (!latestRun?.full_report && !latestRun?.summary && !latestRun?.title) return null;

  return {
    title: latestRun.title || 'Report Coach',
    summary: latestRun.summary || '',
    risk_level: (latestRun.risk_level || 'medio') as 'basso' | 'medio' | 'alto',
    next_48h: latestRun.next_48h || '',
    suggested_focus: latestRun.suggested_focus || '',
    coach_notes: Array.isArray(latestRun.coach_notes) ? latestRun.coach_notes : [],
    readiness_score: latestRun.readiness_score || 0,
    fatigue_score: latestRun.fatigue_score || 0,
    consistency_score: latestRun.consistency_score || 0,
    weekly_plan: Array.isArray(latestRun.weekly_plan) ? latestRun.weekly_plan : [],
    full_report: latestRun.full_report || '',
  };
}

async function buildMetricsSafe(
  recentRuns: any[],
  athleteSettings: AthleteSettings | null,
  issues: HomeDashboardIssue[]
): Promise<Pick<HomeDashboardData, 'metrics' | 'rules'>> {
  if (recentRuns.length === 0) return { metrics: null, rules: null };

  return withTimeout({
    label: 'metrics',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: { metrics: null, rules: null },
    issues,
    promise: Promise.resolve().then(() => {
      const metrics = calculateCoachingMetrics(recentRuns, athleteSettings);
      return {
        metrics,
        rules: getCoachingRules(metrics, athleteSettings),
      };
    }),
  });
}

async function buildDynamicAthleteStateSafe({
  latestRun,
  latestReport,
  recentRuns,
  metrics,
  rules,
  language,
  issues,
}: {
  latestRun: DashboardRun | null;
  latestReport: any | null;
  recentRuns: any[];
  metrics: ReturnType<typeof calculateCoachingMetrics> | null;
  rules: ReturnType<typeof getCoachingRules> | null;
  language: 'it' | 'en';
  issues: HomeDashboardIssue[];
}): Promise<DynamicAthleteState> {
  return withTimeout({
    label: 'dynamicAthleteState',
    timeoutMs: SECONDARY_TIMEOUT_MS,
    fallback: fallbackDynamicAthleteState(language),
    issues,
    promise: Promise.resolve().then(() => buildDynamicAthleteState({
      latestRun,
      latestReport,
      recentRuns,
      metrics,
      rules,
      language,
    })),
  });
}

async function loadDashboardFromDb(userId: string | null): Promise<HomeDashboardData> {
  const start = Date.now();
  const now = new Date().toISOString();
  const issues: HomeDashboardIssue[] = [];

  const [
    athleteSettingsResult,
    stravaConnectionResult,
    latestRunResult,
    activityCountResult,
    weeklyTrendResult,
    activityHistoryResult,
  ] = await Promise.allSettled([
    getAthleteSettings(issues),
    getStravaConnection(userId, issues),
    getLatestRun(issues),
    getActivityCount(issues),
    getWeeklyTrend(issues),
    getActivityHistory(issues),
  ]);

  const athleteSettings = athleteSettingsResult.status === 'fulfilled' ? athleteSettingsResult.value : null;
  const stravaConnection = stravaConnectionResult.status === 'fulfilled' ? stravaConnectionResult.value : EMPTY_STRAVA_STATUS;
  const latestRun = latestRunResult.status === 'fulfilled' ? latestRunResult.value : null;
  const activityCount = activityCountResult.status === 'fulfilled' ? activityCountResult.value : null;
  const activityPresence = activityCount === null ? 'unknown' : 'known';
  const trend = weeklyTrendResult.status === 'fulfilled' ? weeklyTrendResult.value : [];
  const recentRuns = activityHistoryResult.status === 'fulfilled' ? activityHistoryResult.value : [];
  const isTrueEmpty = activityPresence === 'known' && activityCount === 0;
  const latestReport = getLatestReport(latestRun);
  const language = normalizeLanguage(athleteSettings?.language);
  const { metrics, rules } = await buildMetricsSafe(recentRuns, athleteSettings, issues);
  const dynamicAthleteState = await buildDynamicAthleteStateSafe({
    latestRun,
    latestReport,
    recentRuns,
    metrics,
    rules,
    language,
    issues,
  });
  const timedOut = issues.filter((issue) => issue.reason === 'timeout').map((issue) => issue.section);

  console.log(`[HOME PERF] total ${Date.now() - start}ms`, {
    source: 'db',
    latestRun: Boolean(latestRun),
    activityCount,
    activityPresence,
    isTrueEmpty,
    trendRows: trend.length,
    recentRows: recentRuns.length,
    issues: issues.length,
  });

  if (isTrueEmpty) {
    console.log('[HOME EMPTY] true no activities');
  }

  return {
    createdAt: now,
    updatedAt: now,
    latestRun,
    latestReport,
    recentRuns,
    activityCount,
    activityPresence,
    isTrueEmpty,
    metrics,
    rules,
    athleteSettings,
    stravaConnection,
    trend,
    dynamicAthleteState,
    errors: issues,
    timedOut,
    source: 'db',
  };
}

function isReusableDashboardSnapshot(data: HomeDashboardData, ageMs: number): boolean {
  if (ageMs > HOME_STALE_DASHBOARD_TTL_MS) return false;
  return isValidDashboardSnapshot(data) && !data.isTrueEmpty;
}

function shouldStoreDashboardSnapshot(data: HomeDashboardData): boolean {
  if (!isValidDashboardSnapshot(data) || data.isTrueEmpty) return false;

  const criticalTimeouts = new Set(['activityCount', 'latestRun', 'activityHistory']);
  return !data.timedOut.some((section) => criticalTimeouts.has(section));
}

async function loadPersistedDashboardSnapshot(): Promise<HomeDashboardData | null> {
  try {
    const result = await homeQuery<{ payload: HomeDashboardData | null }>(
      `
        SELECT payload
        FROM dashboard_snapshots
        WHERE id = 'home'
        LIMIT 1
      `,
      undefined,
      SNAPSHOT_TIMEOUT_MS
    );
    const snapshot = result.rows[0]?.payload ?? null;

    if (isValidDashboardSnapshot(snapshot)) {
      console.log('[HOME SNAPSHOT] loaded from db');
      return { ...snapshot, source: 'snapshot-db' };
    }
  } catch (error) {
    logServerError('home.dashboardSnapshot.load', error);
  }

  return null;
}

async function savePersistedDashboardSnapshot(data: HomeDashboardData): Promise<void> {
  if (!shouldStoreDashboardSnapshot(data)) return;

  const now = new Date().toISOString();
  const payload: HomeDashboardData = {
    ...data,
    createdAt: data.createdAt || now,
    updatedAt: now,
    source: 'snapshot-db',
  };

  try {
    await homeQuery(
      `
        INSERT INTO dashboard_snapshots (id, payload, created_at, updated_at)
        VALUES ('home', $1::jsonb, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
        SET payload = EXCLUDED.payload,
            updated_at = NOW()
      `,
      [JSON.stringify(payload)],
      SECONDARY_TIMEOUT_MS
    );
    console.log('[HOME SNAPSHOT] saved');
  } catch (error) {
    logServerError('home.dashboardSnapshot.save', error);
  }
}

function refreshHomeDashboardCache(userId: string): Promise<void> {
  const inFlight = homeDashboardRefreshes.get(userId);
  if (inFlight) return inFlight;

  const refresh = loadDashboardFromDb(userId)
    .then((data) => {
      if (shouldStoreDashboardSnapshot(data)) {
        homeDashboardCache.set(userId, { data, updatedAt: Date.now() });
        void savePersistedDashboardSnapshot(data);
      }
    })
    .catch((error) => {
      logServerError('home.backgroundDashboardDb', error);
    })
    .finally(() => {
      homeDashboardRefreshes.delete(userId);
    });

  homeDashboardRefreshes.set(userId, refresh);
  return refresh;
}

export async function getDashboardDataSafe(userId: string | null): Promise<HomeDashboardData> {
  const cacheKey = userId || 'anonymous';
  const cached = homeDashboardCache.get(cacheKey);
  const cacheAgeMs = cached ? Date.now() - cached.updatedAt : null;

  if (cached && cacheAgeMs !== null && cacheAgeMs < HOME_CACHE_TTL_MS) {
    console.log('[HOME CACHE] using cached dashboard', { cacheAgeMs, fresh: true });
    console.log('[HOME PERF] cache 0ms', { cacheAgeMs });
    return { ...cached.data, source: 'cache' };
  }

  if (cached && cacheAgeMs !== null && isReusableDashboardSnapshot(cached.data, cacheAgeMs)) {
    console.log('[HOME CACHE] using cached dashboard', { cacheAgeMs, fresh: false });
    console.log('[HOME PERF] stale-cache 0ms', { cacheAgeMs });
    void refreshHomeDashboardCache(cacheKey);
    return { ...cached.data, source: 'cache' };
  }

  const persistedSnapshotPromise = loadPersistedDashboardSnapshot();
  const freshDashboardPromise = loadDashboardFromDb(userId);
  const quickPersistedSnapshot = await withPromiseTimeout(persistedSnapshotPromise, SNAPSHOT_TIMEOUT_MS, null).catch(() => null);

  if (quickPersistedSnapshot) {
    console.log('[HOME SNAPSHOT] using persisted snapshot');
    void freshDashboardPromise
      .then((data) => {
        if (shouldStoreDashboardSnapshot(data)) {
          homeDashboardCache.set(cacheKey, { data, updatedAt: Date.now() });
          void savePersistedDashboardSnapshot(data);
          console.log('[HOME FRESH] loaded');
        }
      })
      .catch((error) => {
        logServerError('home.backgroundDashboardDb', error);
      });
    return quickPersistedSnapshot;
  }

  try {
    const data = await freshDashboardPromise;
    if (shouldStoreDashboardSnapshot(data)) {
      homeDashboardCache.set(cacheKey, { data, updatedAt: Date.now() });
      void savePersistedDashboardSnapshot(data);
      console.log('[HOME FRESH] loaded');
      return data;
    }

    const persistedSnapshot = quickPersistedSnapshot ?? await persistedSnapshotPromise.catch(() => null);
    if (persistedSnapshot) {
      console.log('[HOME SNAPSHOT] using persisted snapshot');
      return persistedSnapshot;
    }

    if (!isValidDashboardSnapshot(data)) {
      console.log('[HOME SNAPSHOT] no snapshot available');
    } else {
      console.log('[HOME FRESH] loaded');
    }

    return data;
  } catch (error) {
    logServerError('home.dashboardData', error);
    if (cached && cacheAgeMs !== null && isReusableDashboardSnapshot(cached.data, cacheAgeMs)) {
      console.log('[HOME CACHE] using cached dashboard', { cacheAgeMs, reason: 'db-error' });
      return { ...cached.data, source: 'cache' };
    }

    const persistedSnapshot = quickPersistedSnapshot ?? await persistedSnapshotPromise.catch(() => null);
    if (persistedSnapshot) {
      console.log('[HOME SNAPSHOT] using persisted snapshot');
      return persistedSnapshot;
    }

    console.log('[HOME SNAPSHOT] no snapshot available');
    return emptyHomeDashboardData();
  }
}
