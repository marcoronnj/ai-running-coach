import { query } from '@/lib/db';
import { type DBActivity } from '@/lib/coach';
import { getActivitiesWithoutReport, processReportForActivity } from '@/lib/run-report';
import {
  filterRunningActivities,
  formatActivityForDB,
  getRecentActivities,
  refreshStravaToken,
  type StravaActivity,
} from '@/lib/strava';

export interface StravaSyncPayload {
  ok: boolean;
  message: string;
  error?: string;
  activitiesChecked?: number;
  runningActivities?: number;
  newActivities: number;
  pendingReports?: number;
  pendingReportsFound?: number;
  processedWithReports?: number;
  reportsGenerated?: number;
  processedActivities?: Array<{
    id: string;
    name: string;
    reportGenerated: boolean;
    telegramSent: boolean;
    error?: string;
  }>;
  duration?: string;
}

export interface StravaSyncResult {
  payload: StravaSyncPayload;
  status: number;
}

export async function runStravaSync(): Promise<StravaSyncResult> {
  const startTime = Date.now();

  try {
    console.log('[SYNC] 🔄 Inizio sincronizzazione Strava...');

    console.log('[SYNC] 🔑 Refreshing Strava token...');
    const tokenData = await refreshStravaToken();

    console.log('[SYNC] 📊 Fetching attività recenti...');
    const activities = await getRecentActivities(tokenData.access_token);

    const runningActivities = filterRunningActivities(activities);
    console.log(`[SYNC] 🏃‍♂️ Trovate ${runningActivities.length} corse`);

    if (runningActivities.length === 0) {
      const duration = formatDuration(startTime);
      await logSyncSuccess('Nessuna corsa trovata nelle ultime 30 attività');

      return {
        payload: {
          ok: true,
          message: 'Nessuna nuova corsa da sincronizzare',
          activitiesChecked: activities.length,
          runningActivities: 0,
          newActivities: 0,
          reportsGenerated: 0,
          duration,
        },
        status: 200,
      };
    }

    console.log('[SYNC] 💾 Salvando nuove corse nel database...');
    const newActivities = await saveNewActivities(runningActivities);
    const activitiesWithoutReport = await getActivitiesWithoutReport();
    const activitiesToProcess: DBActivity[] = [...newActivities];

    for (const activity of activitiesWithoutReport) {
      if (!activitiesToProcess.some(existing => existing.id === activity.id)) {
        activitiesToProcess.push(activity);
      }
    }

    console.log(`[SYNC] 📌 Attività senza report trovate: ${activitiesWithoutReport.length}`);
    console.log(`[SYNC] ✨ Totale corse da processare: ${activitiesToProcess.length} (nuove + report mancanti)`);

    if (activitiesToProcess.length === 0) {
      const duration = formatDuration(startTime);
      await logSyncSuccess(`Trovate ${runningActivities.length} corse, tutte già processate con report AI`);

      return {
        payload: {
          ok: true,
          message: 'Nessuna nuova corsa da sincronizzare e nessun report mancante da rigenerare',
          activitiesChecked: activities.length,
          runningActivities: runningActivities.length,
          newActivities: newActivities.length,
          pendingReports: activitiesWithoutReport.length,
          processedActivities: [],
          reportsGenerated: 0,
          duration,
        },
        status: 200,
      };
    }

    const processedActivities: NonNullable<StravaSyncPayload['processedActivities']> = [];

    for (const activity of activitiesToProcess) {
      try {
        console.log(`[SYNC] 🤖 Processando activity id=${activity.id} strava_id=${activity.strava_id} name="${activity.name}"`);

        const { telegramSent } = await processReportForActivity(activity);

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: true,
          telegramSent,
        });

        console.log(`[SYNC] ✅ Completato: ${activity.name} (id=${activity.id})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SYNC] ❌ Errore processando ${activity.name} (id=${activity.id}):`, errorMessage);
        console.error(`[SYNC] ❌ Eventuale errore OpenAI/report per activity id=${activity.id}:`, error);

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          error: errorMessage,
        });
      }
    }

    const duration = formatDuration(startTime);
    const reportsGenerated = processedActivities.filter(activity => activity.reportGenerated).length;
    await logSyncSuccess(`Sincronizzate ${newActivities.length} nuove corse in ${duration}`);

    return {
      payload: {
        ok: true,
        message: 'Sincronizzazione completata con successo',
        activitiesChecked: activities.length,
        runningActivities: runningActivities.length,
        newActivities: newActivities.length,
        pendingReportsFound: activitiesWithoutReport.length,
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
        error: 'Errore durante la sincronizzazione',
        message: errorMessage,
        newActivities: 0,
        duration,
      },
      status: 500,
    };
  }
}

function formatDuration(startTime: number): string {
  return `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
}

async function saveNewActivities(activities: StravaActivity[]): Promise<DBActivity[]> {
  const newActivities: DBActivity[] = [];

  for (const activity of activities) {
    try {
      const dbData = formatActivityForDB(activity);

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
