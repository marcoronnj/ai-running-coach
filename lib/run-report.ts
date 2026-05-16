import { query } from '@/lib/db';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';
import { isRunningActivity } from '@/lib/sport-classification';
import {
  DBActivity,
  CoachReport,
  generateCompleteCoachReport,
} from '@/lib/coach';

export async function getActivitiesWithoutReport(limit = 10): Promise<DBActivity[]> {
  const safeLimit = Math.max(0, Math.floor(limit));

  if (safeLimit === 0) {
    return [];
  }

  const result = await query<DBActivity>(
    `SELECT a.*
     FROM activities a
     WHERE COALESCE(a.sport_type, a.type) IN ('Run', 'TrailRun', 'VirtualRun')
       AND NOT EXISTS (
         SELECT 1 FROM coach_reports cr WHERE cr.activity_id = a.id
       )
     ORDER BY a.start_date DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}

export async function getActivityByIdOrStravaId(id: string): Promise<DBActivity | undefined> {
  const result = await query<DBActivity>(
    `SELECT * FROM activities WHERE id = $1 OR strava_id = $1 LIMIT 1`,
    [id]
  );

  return result.rows[0];
}

export interface ProcessReportOptions {
  reason?: 'new-activity' | 'retry-missing' | 'manual-regenerate' | 'cron-regenerate';
  syncMode?: 'manual' | 'cron' | 'webhook';
}

export async function processReportForActivity(
  activity: DBActivity,
  options: ProcessReportOptions = {}
): Promise<{ report: CoachReport }> {
  if (!isRunningActivity(activity)) {
    throw new Error('Run report generation is only available for running activities');
  }

  console.log(
    `[RUN-REPORT] Generazione report activity id=${activity.id} mode=${options.syncMode ?? 'n/a'} reason=${options.reason ?? 'n/a'}`
  );

  const history90d = await getActivityHistory90d(activity.start_date);
  const history = history90d.filter(isRunningActivity).slice(0, 15);
  const athleteSettings = await getAthleteSettings();
  const metrics = calculateCoachingMetrics(history90d, athleteSettings);
  const rules = getCoachingRules(metrics, athleteSettings);
  let report: CoachReport;
  try {
    report = await generateCompleteCoachReport(activity, history, athleteSettings, metrics, rules);
  } catch (error) {
    console.error(`[RUN-REPORT] OpenAI error for activity id=${activity.id}:`, error);
    throw error;
  }

  report.readiness_label = metrics.readinessLabel;
  report.readiness_explanation = metrics.readinessExplanation;
  report.fatigue_label = metrics.fatigueLabel;
  report.fatigue_explanation = metrics.fatigueExplanation;
  report.consistency_label = metrics.consistencyLabel;
  report.consistency_explanation = metrics.consistencyExplanation;
  report.overload_explanation = metrics.overloadExplanation;

  await saveCoachReport(activity.id, report);

  return { report };
}

async function saveCoachReport(activityId: string, report: CoachReport): Promise<void> {
  await query(
    `INSERT INTO coach_reports
     (activity_id, report_type, title, summary, risk_level, next_48h,
      weekly_plan, full_report, readiness_score, readiness_label, readiness_explanation,
      fatigue_score, fatigue_label, fatigue_explanation,
      consistency_score, consistency_label, consistency_explanation,
      overload_explanation, suggested_focus, coach_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      activityId,
      'post_run',
      report.title,
      report.summary,
      report.risk_level,
      report.next_48h,
      JSON.stringify(report.weekly_plan),
      report.full_report,
      report.readiness_score,
      report.readiness_label || null,
      report.readiness_explanation || null,
      report.fatigue_score,
      report.fatigue_label || null,
      report.fatigue_explanation || null,
      report.consistency_score,
      report.consistency_label || null,
      report.consistency_explanation || null,
      report.overload_explanation || null,
      report.suggested_focus,
      JSON.stringify(report.coach_notes),
    ]
  );
}

async function getActivityHistory90d(beforeDate: string): Promise<DBActivity[]> {
  const ninetyDaysAgo = new Date(new Date(beforeDate).getTime() - 90 * 24 * 60 * 60 * 1000);

  const result = await query<DBActivity>(
    `SELECT * FROM activities
     WHERE start_date >= $1
       AND start_date < $2
     ORDER BY start_date DESC`,
    [ninetyDaysAgo.toISOString(), beforeDate]
  );

  return result.rows;
}
