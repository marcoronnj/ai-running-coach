import { query } from '@/lib/db';
import { type DBActivity } from '@/lib/coach';
import { getActivitiesWithoutReport, processReportForActivity } from '@/lib/run-report';
import { isRunningActivity } from '@/lib/sport-classification';
import { isTelegramNotificationsEnabled } from '@/lib/telegram';
import { formatDateTimeIT } from '@/lib/date-utils';
import {
  filterRunningActivities,
  formatActivityForDB,
  getRecentActivities,
  type StravaActivity,
} from '@/lib/strava';

export type StravaSyncMode = 'manual' | 'cron' | 'webhook';

export interface StravaSyncPayload {
  ok: boolean;
  message: string;
  mode?: StravaSyncMode;
  error?: string;
  warning?: string;
  activitiesChecked?: number;
  runningActivities?: number;
  loadActivities?: number;
  newActivities: number;
  latestActivityId?: string;
  latestActivityName?: string;
  latestReportGenerated?: boolean;
  telegramSent?: boolean;
  notificationsSent?: boolean;
  telegramEnabled?: boolean;
  pendingReports?: number;
  pendingReportsFound?: number;
  retryReportsProcessed?: number;
  stravaCalls?: number;
  processedWithReports?: number;
  reportsGenerated?: number;
  processedActivities?: Array<{
    id: string;
    name: string;
    reportGenerated: boolean;
    telegramSent: boolean;
    notificationsSent?: boolean;
    telegramEnabled?: boolean;
    error?: string;
  }>;
  duration?: string;
}

export interface StravaSyncResult {
  payload: StravaSyncPayload;
  status: number;
}

export interface RunStravaSyncOptions {
  accessToken?: string;
  skipRetryMissingReports?: boolean;
  perPage?: number;
  retryMissingReportsLimit?: number;
}

const MANUAL_ACTIVITIES_PER_PAGE = 10;
const CRON_ACTIVITIES_PER_PAGE = 30;
const MANUAL_RETRY_MISSING_REPORT_LIMIT = 1;
const CRON_RETRY_MISSING_REPORT_LIMIT = 3;

export async function runStravaSync(
  mode: StravaSyncMode = 'cron',
  options: RunStravaSyncOptions = {}
): Promise<StravaSyncResult> {
  const startTime = Date.now();

  try {
    console.log(`[SYNC] Inizio sincronizzazione Strava mode=${mode}`);
    const telegramEnabled = isTelegramNotificationsEnabled();
    const perPage = options.perPage ?? (mode === 'manual' ? MANUAL_ACTIVITIES_PER_PAGE : CRON_ACTIVITIES_PER_PAGE);
    const retryLimit = options.skipRetryMissingReports
      ? 0
      : options.retryMissingReportsLimit ?? (mode === 'manual' ? MANUAL_RETRY_MISSING_REPORT_LIMIT : CRON_RETRY_MISSING_REPORT_LIMIT);
    let stravaCalls = 0;

    const accessToken = options.accessToken;

    if (!accessToken) {
      throw new Error('Access token OAuth Strava mancante');
    }

    console.log('[SYNC] Uso access token OAuth salvato');
    console.log(`[SYNC] Fetching attività recenti per_page=${perPage}...`);
    const fetchStart = Date.now();
    const activities = await getRecentActivities(accessToken, { perPage });
    stravaCalls += 1;
    console.log(`[SYNC][PERF] fetch activities duration=${Date.now() - fetchStart}ms count=${activities.length} stravaCalls=${stravaCalls}`);

    const runningActivities = filterRunningActivities(activities);
    console.log(`[SYNC] Attività trovate=${activities.length} corse=${runningActivities.length} mode=${mode}`);

    console.log('[SYNC] Salvando nuove attività nel database...');
    const saveStart = Date.now();
    const newActivities = sortActivitiesByStartDateDesc(await saveNewActivities(activities));
    console.log(`[SYNC][PERF] save activities duration=${Date.now() - saveStart}ms new=${newActivities.length}`);
    const newRunningActivities = newActivities.filter(isRunningActivity);
    const latestNewActivity = newRunningActivities[0];

    const activitiesWithoutReport = options.skipRetryMissingReports
      ? []
      : (await getActivitiesWithoutReport(retryLimit + newActivities.length))
          .filter(activity => !newActivities.some(newActivity => newActivity.id === activity.id))
          .slice(0, retryLimit);

    console.log(`[SYNC] Nuove attività=${newActivities.length} nuove corse=${newRunningActivities.length} latestRun=${latestNewActivity?.id ?? 'none'} mode=${mode}`);
    console.log(`[SYNC] Retry report mancanti selezionati=${activitiesWithoutReport.length} limit=${retryLimit}`);

    if (newActivities.length === 0 && activitiesWithoutReport.length === 0) {
      const duration = formatDuration(startTime);
      await logSyncSuccess(`Trovate ${runningActivities.length} corse, tutte già processate con report AI`);

      return {
        payload: {
          ok: true,
          message: 'No new activities to sync and no missing run reports to regenerate',
          mode,
          activitiesChecked: activities.length,
          runningActivities: runningActivities.length,
          newActivities: newActivities.length,
          pendingReports: activitiesWithoutReport.length,
          processedActivities: [],
          reportsGenerated: 0,
          retryReportsProcessed: 0,
          stravaCalls,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
          duration,
        },
        status: 200,
      };
    }

    const processedActivities: NonNullable<StravaSyncPayload['processedActivities']> = [];
    const warnings: string[] = [];
    let latestReportGenerated = false;
    let telegramSent = false;
    let retryReportsProcessed = 0;
    const reportStart = Date.now();
    let skippedNewRunReports = 0;

    for (const activity of newActivities) {
      if (!isRunningActivity(activity)) {
        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
        });
        console.log(`[SYNC] Attività non-running importata senza report id=${activity.id} type=${activity.sport_type || activity.type}`);
        continue;
      }

      if (mode === 'manual' && latestNewActivity?.id !== activity.id) {
        skippedNewRunReports += 1;
        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
        });
        console.log(`[SYNC] Report nuova run rinviato nel manual sync id=${activity.id}`);
        continue;
      }

      try {
        const shouldSendTelegram = telegramEnabled && latestNewActivity?.id === activity.id;
        console.log(
          `[SYNC] Report nuova activity id=${activity.id} latest=${latestNewActivity?.id === activity.id ? 'yes' : 'no'} telegramEnabled=${telegramEnabled ? 'yes' : 'no'} telegram=${shouldSendTelegram ? 'yes' : 'no'}`
        );

        const result = await processReportForActivity(activity, {
          sendTelegram: shouldSendTelegram,
          reason: 'new-activity',
          syncMode: mode,
        });
        const activityTelegramSent = result.telegramSent;

        if (latestNewActivity?.id === activity.id) {
          latestReportGenerated = true;
          telegramSent = activityTelegramSent;
        }

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: true,
          telegramSent: activityTelegramSent,
          notificationsSent: activityTelegramSent,
          telegramEnabled,
        });

        console.log(`[SYNC] Report completato activity id=${activity.id} telegram=${activityTelegramSent ? 'yes' : 'no'}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SYNC] Errore report nuova activity id=${activity.id}:`, errorMessage);
        warnings.push(`Report not generated for ${activity.name}: ${errorMessage}`);

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
          error: errorMessage,
        });
      }
    }

    console.log(`[SYNC][PERF] generate report duration=${Date.now() - reportStart}ms generatedSoFar=${processedActivities.filter(activity => activity.reportGenerated).length}`);

    const retryStart = Date.now();
    for (const activity of activitiesWithoutReport) {
      try {
        console.log(`[SYNC] Retry report mancante activity id=${activity.id} telegram=no`);

        await processReportForActivity(activity, {
          sendTelegram: false,
          reason: 'retry-missing',
          syncMode: mode,
        });
        retryReportsProcessed += 1;

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: true,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SYNC] Errore retry report activity id=${activity.id}:`, errorMessage);
        warnings.push(`Report retry failed for ${activity.name}: ${errorMessage}`);

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
          error: errorMessage,
        });
      }
    }
    console.log(`[SYNC][PERF] retry reports duration=${Date.now() - retryStart}ms processed=${retryReportsProcessed} limit=${retryLimit}`);

    const duration = formatDuration(startTime);
    const reportsGenerated = processedActivities.filter(activity => activity.reportGenerated).length;
    if (skippedNewRunReports > 0) {
      warnings.push(`${skippedNewRunReports} older new run report${skippedNewRunReports === 1 ? '' : 's'} left pending`);
    }
    const warning = warnings.length > 0 ? warnings.join(' | ') : undefined;
    await logSyncSuccess(
      `mode=${mode} nuove=${newActivities.length} report=${reportsGenerated} retry=${retryReportsProcessed} telegram=${telegramSent ? 'yes' : 'no'} duration=${duration}`
    );

    console.log(
      `[SYNC] Completato mode=${mode} new=${newActivities.length} latest=${latestNewActivity?.id ?? 'none'} reports=${reportsGenerated} retry=${retryReportsProcessed} telegram=${telegramSent ? 'yes' : 'no'} warnings=${warnings.length}`
    );
    console.log(`[SYNC][PERF] total duration=${Date.now() - startTime}ms mode=${mode} stravaCalls=${stravaCalls}`);

    return {
      payload: {
        ok: true,
        message: newActivities.length > 0 ? 'Sync completed' : 'No new activities',
        mode,
        warning,
        activitiesChecked: activities.length,
        runningActivities: runningActivities.length,
        loadActivities: activities.length,
        newActivities: newActivities.length,
        latestActivityId: latestNewActivity?.id,
        latestActivityName: latestNewActivity?.name,
        latestReportGenerated,
        telegramSent,
        notificationsSent: telegramSent,
        telegramEnabled,
        pendingReportsFound: activitiesWithoutReport.length,
        retryReportsProcessed,
        stravaCalls,
        processedWithReports: reportsGenerated,
        reportsGenerated,
        processedActivities,
        duration,
      },
      status: 200,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = formatDuration(startTime);

    console.error('[SYNC] 💥 Errore generale:', errorMessage);
    await logSyncError(`Errore sincronizzazione: ${errorMessage} (${duration})`);

    return {
      payload: {
        ok: false,
        error: 'Sync failed',
        message: errorMessage,
        mode,
        newActivities: 0,
        telegramSent: false,
        notificationsSent: false,
        telegramEnabled: isTelegramNotificationsEnabled(),
        retryReportsProcessed: 0,
        stravaCalls: 0,
        duration,
      },
      status: 500,
    };
  }
}

function formatDuration(startTime: number): string {
  return `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
}

function sortActivitiesByStartDateDesc(activities: DBActivity[]): DBActivity[] {
  return [...activities].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
}

async function saveNewActivities(activities: StravaActivity[]): Promise<DBActivity[]> {
  const newActivities: DBActivity[] = [];

  for (const activity of activities) {
    try {
      const saved = await saveStravaActivity(activity, { updateExisting: false });

      if (saved.inserted) {
        newActivities.push(saved.activity);
      }
    } catch (error) {
      console.error(`[SYNC] Errore salvando attività ${activity.name}:`, error);
    }
  }

  return newActivities;
}

export async function saveStravaActivity(
  activity: StravaActivity,
  options: { updateExisting?: boolean } = {}
): Promise<{ activity: DBActivity; inserted: boolean; updated: boolean }> {
  const dbData = formatActivityForDB(activity);

  console.log('[SYNC][TIMEZONE]', {
    stravaId: activity.id,
    name: activity.name,
    stravaStartDateUtc: activity.start_date,
    stravaStartDateLocal: activity.start_date_local,
    stravaTimezone: activity.timezone ?? null,
    stravaUtcOffsetSeconds: activity.utc_offset ?? null,
    dbStartDateUtc: dbData.start_date,
    displayRome: formatDateTimeIT(dbData.start_date),
  });

  if (!options.updateExisting) {
    const result = await query<DBActivity>(
      `INSERT INTO activities
       (id, strava_id, name, type, sport_type, start_date, distance_m, moving_time_s,
        elapsed_time_s, average_speed, max_speed, average_heartrate,
        max_heartrate, total_elevation_gain, raw_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (strava_id) DO NOTHING
       RETURNING *`,
      [
        dbData.id,
        dbData.strava_id,
        dbData.name,
        dbData.type,
        dbData.sport_type,
        dbData.start_date,
        dbData.distance_m,
        dbData.moving_time_s,
        dbData.elapsed_time_s,
        dbData.average_speed,
        dbData.max_speed,
        dbData.average_heartrate,
        dbData.max_heartrate,
        dbData.total_elevation_gain,
        JSON.stringify(dbData.raw_json),
      ]
    );

    if (result.rows[0]) {
      return { activity: result.rows[0], inserted: true, updated: false };
    }

    const existing = await query<DBActivity>(
      'SELECT * FROM activities WHERE strava_id = $1 LIMIT 1',
      [dbData.strava_id]
    );

    if (!existing.rows[0]) {
      throw new Error(`Activity ${dbData.strava_id} was not inserted and could not be found`);
    }

    return { activity: existing.rows[0], inserted: false, updated: false };
  }

  const result = await query<DBActivity>(
    `INSERT INTO activities
     (id, strava_id, name, type, sport_type, start_date, distance_m, moving_time_s,
      elapsed_time_s, average_speed, max_speed, average_heartrate,
      max_heartrate, total_elevation_gain, raw_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (strava_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       sport_type = EXCLUDED.sport_type,
       start_date = EXCLUDED.start_date,
       distance_m = EXCLUDED.distance_m,
       moving_time_s = EXCLUDED.moving_time_s,
       elapsed_time_s = EXCLUDED.elapsed_time_s,
       average_speed = EXCLUDED.average_speed,
       max_speed = EXCLUDED.max_speed,
       average_heartrate = EXCLUDED.average_heartrate,
       max_heartrate = EXCLUDED.max_heartrate,
       total_elevation_gain = EXCLUDED.total_elevation_gain,
       raw_json = EXCLUDED.raw_json
     RETURNING *, (xmax = 0) AS inserted`,
    [
      dbData.id,
      dbData.strava_id,
      dbData.name,
      dbData.type,
      dbData.sport_type,
      dbData.start_date,
      dbData.distance_m,
      dbData.moving_time_s,
      dbData.elapsed_time_s,
      dbData.average_speed,
      dbData.max_speed,
      dbData.average_heartrate,
      dbData.max_heartrate,
      dbData.total_elevation_gain,
      JSON.stringify(dbData.raw_json),
    ]
  );

  const row = result.rows[0] as DBActivity & { inserted?: boolean };

  return {
    activity: row,
    inserted: row.inserted === true,
    updated: row.inserted !== true,
  };
}

async function logSyncSuccess(message: string): Promise<void> {
  try {
    await query(
      'INSERT INTO sync_logs (status, message) VALUES ($1, $2)',
      ['success', message]
    );
  } catch (error) {
    console.error('[SYNC] Errore logging success:', error);
  }
}

async function logSyncError(message: string): Promise<void> {
  try {
    await query(
      'INSERT INTO sync_logs (status, message) VALUES ($1, $2)',
      ['error', message]
    );
  } catch (error) {
    console.error('[SYNC] Errore logging error:', error);
  }
}
