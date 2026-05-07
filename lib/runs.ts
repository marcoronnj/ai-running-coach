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
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
  suggested_focus?: string;
  coach_notes?: any;
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
             cr.title,
             cr.summary,
             cr.risk_level,
             cr.next_48h,
             cr.suggested_focus,
             cr.coach_notes
      FROM activities a
      LEFT JOIN coach_reports cr
        ON cr.activity_id = a.id
       AND cr.created_at = (
         SELECT MAX(created_at)
         FROM coach_reports
         WHERE activity_id = a.id
       )
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
  });

  return latestRun;
}
