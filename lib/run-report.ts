import { query } from '@/lib/db';
import { getAppUrl } from '@/lib/app-url';
import { sendTelegramMessage } from '@/lib/telegram';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';
import {
  DBActivity,
  CoachReport,
  generateCompleteCoachReport,
  formatKm,
  formatPace,
} from '@/lib/coach';

export async function getActivitiesWithoutReport(): Promise<DBActivity[]> {
  const result = await query<DBActivity>(
    `SELECT a.*
     FROM activities a
     WHERE a.type IN ('Run', 'TrailRun')
       AND NOT EXISTS (
         SELECT 1 FROM coach_reports cr WHERE cr.activity_id = a.id
       )
     ORDER BY a.start_date DESC`
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
  sendTelegram?: boolean;
  reason?: 'new-activity' | 'retry-missing' | 'manual-regenerate' | 'cron-regenerate';
  syncMode?: 'manual' | 'cron';
}

export async function processReportForActivity(
  activity: DBActivity,
  options: ProcessReportOptions = {}
): Promise<{ report: CoachReport; telegramSent: boolean }> {
  const sendTelegram = options.sendTelegram === true;
  console.log(
    `[RUN-REPORT] Generazione report activity id=${activity.id} mode=${options.syncMode ?? 'n/a'} reason=${options.reason ?? 'n/a'} telegram=${sendTelegram ? 'yes' : 'no'}`
  );

  const history90d = await getActivityHistory90d(activity.start_date);
  const history = history90d.slice(0, 15);
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

  const telegramSent = sendTelegram
    ? await sendTelegramNotification(activity, report)
    : false;

  if (!sendTelegram) {
    console.log(`[RUN-REPORT] Telegram skipped for activity id=${activity.id}`);
  }

  return { report, telegramSent };
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
     WHERE type IN ('Run', 'TrailRun')
       AND start_date >= $1
       AND start_date < $2
     ORDER BY start_date DESC`,
    [ninetyDaysAgo.toISOString(), beforeDate]
  );

  return result.rows;
}

async function sendTelegramNotification(activity: DBActivity, report: CoachReport): Promise<boolean> {
  try {
    const appUrl = getAppUrl();
    const dashboardLink = `${appUrl}/runs/${activity.id}`;

    const distance = formatKm(activity.distance_m);
    const pace = formatPace(activity.average_speed);
    const heartrate = activity.average_heartrate
      ? ` • FC ${activity.average_heartrate} bpm`
      : '';

    const riskLevel = String(report.risk_level).toLowerCase();
    const riskEmoji = {
      basso: '🟢',
      medio: '🟡',
      alto: '🔴',
    }[riskLevel as 'basso' | 'medio' | 'alto'] || '🟡';

    const message = `
🏃‍♂️ <b>${report.title}</b>

📊 <b>${activity.name}</b>
📏 ${distance} • ⏱️ ${pace}${heartrate}

� <b>Stato Atleta:</b>
🎯 Readiness: ${report.readiness_score}/100
😴 Fatigue: ${report.fatigue_score}/100
📊 Consistency: ${report.consistency_score}/100

🎯 <b>Focus:</b> ${report.suggested_focus}

⚠️ <b>Rischio:</b> ${riskEmoji} ${String(report.risk_level).toUpperCase()}

📝 <b>Riepilogo:</b>
${report.summary}

⏰ <b>Prossime 48h:</b>
${report.next_48h}

🔗 <a href="${dashboardLink}">Vedi Report Completo</a>
    `.trim();

    const success = await sendTelegramMessage(message);

    if (success) {
      console.log(`[RUN-REPORT] 📱 Telegram inviato per: ${activity.name}`);
    } else {
      console.warn(`[RUN-REPORT] ⚠️ Telegram fallito per: ${activity.name}`);
    }

    return success;
  } catch (error) {
    console.error(`[RUN-REPORT] Errore Telegram per ${activity.name}:`, error);
    return false;
  }
}
