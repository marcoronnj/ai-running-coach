import { query } from '@/lib/db';
import { type DBActivity } from '@/lib/coach';
import { getActivitiesWithoutReport, processReportForActivity } from '@/lib/run-report';
import { isTelegramNotificationsEnabled } from '@/lib/telegram';
import { formatDateTimeIT } from '@/lib/date-utils';
import {
  filterRunningActivities,
  formatActivityForDB,
  getRecentActivities,
  type StravaActivity,
} from '@/lib/strava';

export type StravaSyncMode = 'manual' | 'cron';

export interface StravaSyncPayload {
  ok: boolean;
  message: string;
  mode?: StravaSyncMode;
  error?: string;
  warning?: string;
  activitiesChecked?: number;
  runningActivities?: number;
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
}

const RETRY_MISSING_REPORT_LIMIT = 3;

export async function runStravaSync(
  mode: StravaSyncMode = 'cron',
  options: RunStravaSyncOptions = {}
): Promise<StravaSyncResult> {
  const startTime = Date.now();

  try {
    console.log(`[SYNC] Inizio sincronizzazione Strava mode=${mode}`);
    const telegramEnabled = isTelegramNotificationsEnabled();

    const accessToken = options.accessToken;

    if (!accessToken) {
      throw new Error('Access token OAuth Strava mancante');
    }

    console.log('[SYNC] Uso access token OAuth salvato');
    console.log('[SYNC] Fetching attività recenti...');
    const activities = await getRecentActivities(accessToken);

    const runningActivities = filterRunningActivities(activities);
    console.log(`[SYNC] Corse trovate=${runningActivities.length} mode=${mode}`);

    if (runningActivities.length === 0) {
      const duration = formatDuration(startTime);
      await logSyncSuccess('Nessuna corsa trovata nelle ultime 30 attività');

      return {
        payload: {
          ok: true,
          message: 'No new runs to sync',
          mode,
          activitiesChecked: activities.length,
          runningActivities: 0,
          newActivities: 0,
          reportsGenerated: 0,
          retryReportsProcessed: 0,
          telegramSent: false,
          notificationsSent: false,
          telegramEnabled,
          duration,
        },
        status: 200,
      };
    }

    console.log('[SYNC] Salvando nuove corse nel database...');
    const newActivities = sortActivitiesByStartDateDesc(await saveNewActivities(runningActivities));
    const latestNewActivity = newActivities[0];

    const activitiesWithoutReport = options.skipRetryMissingReports
      ? []
      : (await getActivitiesWithoutReport())
          .filter(activity => !newActivities.some(newActivity => newActivity.id === activity.id))
          .slice(0, RETRY_MISSING_REPORT_LIMIT);

    console.log(`[SYNC] Nuove attività=${newActivities.length} latest=${latestNewActivity?.id ?? 'none'} mode=${mode}`);
    console.log(`[SYNC] Retry report mancanti selezionati=${activitiesWithoutReport.length} limit=${RETRY_MISSING_REPORT_LIMIT}`);

    if (newActivities.length === 0 && activitiesWithoutReport.length === 0) {
      const duration = formatDuration(startTime);
      await logSyncSuccess(`Trovate ${runningActivities.length} corse, tutte già processate con report AI`);

      return {
        payload: {
          ok: true,
          message: 'No new runs to sync and no missing reports to regenerate',
          mode,
          activitiesChecked: activities.length,
          runningActivities: runningActivities.length,
          newActivities: newActivities.length,
          pendingReports: activitiesWithoutReport.length,
          processedActivities: [],
          reportsGenerated: 0,
          retryReportsProcessed: 0,
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

    for (const activity of newActivities) {
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

    const duration = formatDuration(startTime);
    const reportsGenerated = processedActivities.filter(activity => activity.reportGenerated).length;
    const warning = warnings.length > 0 ? warnings.join(' | ') : undefined;
    await logSyncSuccess(
      `mode=${mode} nuove=${newActivities.length} report=${reportsGenerated} retry=${retryReportsProcessed} telegram=${telegramSent ? 'yes' : 'no'} duration=${duration}`
    );

    console.log(
      `[SYNC] Completato mode=${mode} new=${newActivities.length} latest=${latestNewActivity?.id ?? 'none'} reports=${reportsGenerated} retry=${retryReportsProcessed} telegram=${telegramSent ? 'yes' : 'no'} warnings=${warnings.length}`
    );

    return {
      payload: {
        ok: true,
        message: newActivities.length > 0 ? 'Sync completed' : 'No new runs',
        mode,
        warning,
        activitiesChecked: activities.length,
        runningActivities: runningActivities.length,
        newActivities: newActivities.length,
        latestActivityId: latestNewActivity?.id,
        latestActivityName: latestNewActivity?.name,
        latestReportGenerated,
        telegramSent,
        notificationsSent: telegramSent,
        telegramEnabled,
        pendingReportsFound: activitiesWithoutReport.length,
        retryReportsProcessed,
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

      const result = await query(
        `INSERT INTO activities
         (id, strava_id, name, type, start_date, distance_m, moving_time_s,
          elapsed_time_s, average_speed, max_speed, average_heartrate,
          max_heartrate, total_elevation_gain, raw_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (strava_id) DO NOTHING
         RETURNING *`,
        [
          dbData.id,
          dbData.strava_id,
          dbData.name,
          dbData.type,
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

      if (result.rows.length > 0) {
        newActivities.push(result.rows[0] as DBActivity);
      }
    } catch (error) {
      console.error(`[SYNC] Errore salvando attività ${activity.name}:`, error);
    }
  }

  return newActivities;
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
