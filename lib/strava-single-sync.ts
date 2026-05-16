import { query } from '@/lib/db';
import { getActivityById } from '@/lib/strava';
import { getValidStravaAccessToken } from '@/lib/strava-connection';
import { getActivitySportType, isRunningActivity } from '@/lib/sport-classification';
import { getActivityByIdOrStravaId, processReportForActivity } from '@/lib/run-report';
import { saveStravaActivity, type StravaSyncMode } from '@/lib/strava-sync';

export interface SyncSingleStravaActivityOptions {
  userId: string;
  source: StravaSyncMode;
  generateReport?: boolean;
  allowNonRun?: boolean;
}

export interface SyncSingleStravaActivityResult {
  ok: boolean;
  source: StravaSyncMode;
  stravaId: string;
  activityId?: string;
  activityName?: string;
  sportType?: string;
  runningActivity?: boolean;
  inserted?: boolean;
  updated?: boolean;
  reportGenerated: boolean;
  reportSkippedReason?: string;
  error?: string;
}

export async function syncSingleStravaActivity(
  activityId: string | number,
  options: SyncSingleStravaActivityOptions
): Promise<SyncSingleStravaActivityResult> {
  const source = options.source;
  const stravaId = String(activityId);
  const shouldGenerateReport = options.generateReport !== false;
  const allowNonRun = options.allowNonRun !== false;

  console.log(`[SINGLE SYNC] start source=${source} stravaId=${stravaId}`);

  try {
    const { accessToken } = await getValidStravaAccessToken(options.userId);
    const stravaActivity = await getActivityById(accessToken, stravaId);
    const saved = await saveStravaActivity(stravaActivity, { updateExisting: true });
    const dbActivity = saved.activity;
    const sportType = getActivitySportType(dbActivity);
    const runningActivity = isRunningActivity(dbActivity);

    if (!runningActivity && !allowNonRun) {
      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: false,
        reportSkippedReason: 'non-running-not-allowed',
      };
    }

    if (!runningActivity) {
      console.log(`[SINGLE SYNC] non-running activity imported source=${source} id=${dbActivity.id} sportType=${sportType}`);
      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: false,
        reportSkippedReason: 'non-running-load-only',
      };
    }

    if (!shouldGenerateReport) {
      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: false,
        reportSkippedReason: 'generate-report-disabled',
      };
    }

    const existingReport = await hasCoachReport(dbActivity.id, dbActivity.strava_id);

    if (existingReport) {
      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: false,
        reportSkippedReason: 'report-already-exists',
      };
    }

    try {
      await processReportForActivity(dbActivity, {
        reason: 'new-activity',
        syncMode: source,
      });

      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[SINGLE SYNC] Report generation failed id=${dbActivity.id}:`, message);

      return {
        ok: true,
        source,
        stravaId,
        activityId: dbActivity.id,
        activityName: dbActivity.name,
        sportType,
        runningActivity,
        inserted: saved.inserted,
        updated: saved.updated,
        reportGenerated: false,
        reportSkippedReason: 'report-generation-failed',
        error: message,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SINGLE SYNC] failed source=${source} stravaId=${stravaId}:`, message);

    return {
      ok: false,
      source,
      stravaId,
      reportGenerated: false,
      error: message,
    };
  }
}

export async function deleteSyncedStravaActivity(stravaId: string | number): Promise<{ deleted: boolean; id?: string }> {
  const existing = await getActivityByIdOrStravaId(String(stravaId));

  if (!existing) {
    return { deleted: false };
  }

  await query('DELETE FROM activities WHERE strava_id = $1 OR id = $1', [String(stravaId)]);
  return { deleted: true, id: existing.id };
}

async function hasCoachReport(activityId: string, stravaId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM coach_reports
       WHERE activity_id = $1 OR activity_id = $2
     ) AS exists`,
    [activityId, stravaId]
  );

  return result.rows[0]?.exists === true;
}
