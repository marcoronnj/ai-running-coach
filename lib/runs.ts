import { query } from '@/lib/db';
import { getDaysSince } from '@/lib/date-utils';

export interface LatestRunWithReport {
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
  readiness_score?: number;
  fatigue_score?: number;
  consistency_score?: number;
}

export async function getLatestRunWithReport(): Promise<LatestRunWithReport | null> {
  const result = await query(
    `
      SELECT a.id,
             a.strava_id,
             a.name,
             a.start_date,
             a.distance_m,
             a.moving_time_s,
             a.average_speed,
             a.average_heartrate,
             a.type,
             a.created_at,
             cr.title,
             cr.summary,
             cr.risk_level,
             cr.next_48h,
             cr.suggested_focus,
             cr.coach_notes,
             cr.readiness_score,
             cr.fatigue_score,
             cr.consistency_score
      FROM activities a
      LEFT JOIN LATERAL (
        SELECT *
        FROM coach_reports
        WHERE activity_id = a.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cr ON true
      WHERE a.type IN ('Run', 'TrailRun')
      ORDER BY a.start_date DESC
      LIMIT 1
    `
  );

  const latestRun = result.rows[0] as LatestRunWithReport | undefined;
  if (!latestRun) {
    return null;
  }

  console.log('[RUNS] latestRun', {
    id: latestRun.id,
    start_date: latestRun.start_date,
    daysSince: getDaysSince(latestRun.start_date),
    hasReport: Boolean(latestRun.title),
  });

  return latestRun;
}
