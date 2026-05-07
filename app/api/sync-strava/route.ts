import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { refreshStravaToken, getRecentActivities, filterRunningActivities, formatActivityForDB, type StravaActivity } from '@/lib/strava';
import { generateCompleteCoachReport, type DBActivity, type CoachReport } from '@/lib/coach';
import { sendTelegramMessage } from '@/lib/telegram';
import { getAppUrl } from '@/lib/app-url';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';

/**
 * Helper: Formatta chilometri
 */
function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Helper: Formatta pace al km
 */
function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';

  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * API Route: GET /api/sync-strava
 * Sincronizza le attività Strava, genera report AI e invia notifiche Telegram
 */
export const maxDuration = 60; // 60 secondi per Vercel

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verifica il secret
    const cronSecret = process.env.CRON_SECRET;
    const secretParam = request.nextUrl.searchParams.get('secret');

    if (!cronSecret) {
      await logSyncError('CRON_SECRET non configurato');
      return NextResponse.json(
        {
          ok: false,
          error: 'Configurazione mancante',
          message: 'CRON_SECRET non è configurato in .env.local',
        },
        { status: 500 }
      );
    }

    if (!secretParam || secretParam !== cronSecret) {
      await logSyncError('Secret non valido fornito nella richiesta');
      return NextResponse.json(
        {
          ok: false,
          error: 'Accesso negato',
          message: 'Secret non valido o mancante',
        },
        { status: 403 }
      );
    }

    console.log('[SYNC] 🔄 Inizio sincronizzazione Strava...');

    // 1. Refresh token Strava
    console.log('[SYNC] 🔑 Refreshing Strava token...');
    const tokenData = await refreshStravaToken();

    // 2. Ottieni ultime 30 attività
    console.log('[SYNC] 📊 Fetching attività recenti...');
    const activities = await getRecentActivities(tokenData.access_token);

    // 3. Filtra solo corse
    const runningActivities = filterRunningActivities(activities);
    console.log(`[SYNC] 🏃‍♂️ Trovate ${runningActivities.length} corse`);

    if (runningActivities.length === 0) {
      await logSyncSuccess('Nessuna corsa trovata nelle ultime 30 attività');
      return NextResponse.json(
        {
          ok: true,
          message: 'Nessuna nuova corsa da sincronizzare',
          activitiesChecked: activities.length,
          runningActivities: 0,
        },
        { status: 200 }
      );
    }

    // 4. Salva nuove attività nel DB
    console.log('[SYNC] 💾 Salvando nuove corse nel database...');
    const newActivities = await saveNewActivities(runningActivities);

    if (newActivities.length === 0) {
      await logSyncSuccess(`Trovate ${runningActivities.length} corse ma tutte già esistenti`);
      return NextResponse.json(
        {
          ok: true,
          message: 'Nessuna nuova corsa da sincronizzare',
          activitiesChecked: activities.length,
          runningActivities: runningActivities.length,
          newActivities: 0,
        },
        { status: 200 }
      );
    }

    console.log(`[SYNC] ✨ ${newActivities.length} nuove corse da processare`);

    // 5. Per ogni nuova corsa, genera report AI e invia Telegram
    const processedActivities = [];

    for (const activity of newActivities) {
      try {
        console.log(`[SYNC] 🤖 Generando report per: ${activity.name}`);

        // Ottieni storico per il report AI (ultime 90 giorni per metrics)
        const history90d = await getActivityHistory90d(activity.start_date);
        const history = history90d.slice(0, 15); // Solo ultime 15 per il prompt

        // Recupera impostazioni atleta per personalizzare il prompt
        const athleteSettings = await getAthleteSettings();

        // Calcola metriche coaching
        const metrics = calculateCoachingMetrics(history90d, athleteSettings);

        // Calcola regole coaching
        const rules = getCoachingRules(metrics, athleteSettings);

        // Genera report AI con metrics e rules
        const report = await generateCompleteCoachReport(activity, history, athleteSettings, metrics, rules);

        // Associa metadata metriche al report per la dashboard
        report.readiness_label = metrics.readinessLabel;
        report.readiness_explanation = metrics.readinessExplanation;
        report.fatigue_label = metrics.fatigueLabel;
        report.fatigue_explanation = metrics.fatigueExplanation;
        report.consistency_label = metrics.consistencyLabel;
        report.consistency_explanation = metrics.consistencyExplanation;
        report.overload_explanation = metrics.overloadExplanation;

        // Salva report nel DB
        await saveCoachReport(activity.id, report);

        // Invia notifica Telegram
        await sendTelegramNotification(activity, report);

        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: true,
          telegramSent: true,
        });

        console.log(`[SYNC] ✅ Completato: ${activity.name}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SYNC] ❌ Errore processando ${activity.name}:`, errorMessage);

        // Salva comunque l'attività senza report
        processedActivities.push({
          id: activity.id,
          name: activity.name,
          reportGenerated: false,
          telegramSent: false,
          error: errorMessage,
        });
      }
    }

    // 6. Log del successo
    const duration = (Date.now() - startTime) / 1000;
    await logSyncSuccess(
      `Sincronizzate ${newActivities.length} nuove corse in ${duration.toFixed(1)}s`
    );

    return NextResponse.json(
      {
        ok: true,
        message: `Sincronizzazione completata con successo`,
        activitiesChecked: activities.length,
        runningActivities: runningActivities.length,
        newActivities: newActivities.length,
        processedActivities: processedActivities,
        duration: `${duration.toFixed(1)}s`,
      },
      { status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = (Date.now() - startTime) / 1000;

    console.error('[SYNC] 💥 Errore generale:', errorMessage);
    await logSyncError(`Errore sincronizzazione: ${errorMessage} (${duration.toFixed(1)}s)`);

    return NextResponse.json(
      {
        ok: false,
        error: 'Errore durante la sincronizzazione',
        message: errorMessage,
        duration: `${duration.toFixed(1)}s`,
      },
      { status: 500 }
    );
  }
}

/**
 * Salva nuove attività nel database
 */
async function saveNewActivities(activities: StravaActivity[]): Promise<DBActivity[]> {
  const newActivities: DBActivity[] = [];

  for (const activity of activities) {
    try {
      const dbData = formatActivityForDB(activity);

      // Usa ON CONFLICT per evitare duplicati
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

      // Se è stata inserita (result.rows.length > 0), aggiungila alle nuove
      if (result.rows.length > 0) {
        newActivities.push(result.rows[0] as DBActivity);
      }

    } catch (error) {
      console.error(`[SYNC] Errore salvando attività ${activity.name}:`, error);
      // Continua con le altre attività
    }
  }

  return newActivities;
}

/**
 * Ottieni storico attività per il report AI
 */
async function getActivityHistory(beforeDate: string): Promise<DBActivity[]> {
  try {
    const result = await query(
      `SELECT * FROM activities
       WHERE type IN ('Run', 'TrailRun')
       AND start_date < $1
       ORDER BY start_date DESC
       LIMIT 50`,
      [beforeDate]
    );

    return result.rows;
  } catch (error) {
    console.error('[SYNC] Errore ottenendo storico:', error);
    return []; // Ritorna array vuoto in caso di errore
  }
}

/**
 * Ottieni storico attività degli ultimi 90 giorni per le metriche coaching
 */
async function getActivityHistory90d(beforeDate: string): Promise<DBActivity[]> {
  try {
    const ninetyDaysAgo = new Date(new Date(beforeDate).getTime() - 90 * 24 * 60 * 60 * 1000);

    const result = await query(
      `SELECT * FROM activities
       WHERE type IN ('Run', 'TrailRun')
       AND start_date >= $1
       AND start_date < $2
       ORDER BY start_date DESC`,
      [ninetyDaysAgo.toISOString(), beforeDate]
    );

    return result.rows;
  } catch (error) {
    console.error('[SYNC] Errore ottenendo storico 90d:', error);
    return []; // Ritorna array vuoto in caso di errore
  }
}

/**
 * Salva un report del coach nel database
 */
async function saveCoachReport(activityId: string, report: CoachReport): Promise<void> {
  try {
    await query(
      `INSERT INTO coach_reports
       (activity_id, report_type, title, summary, risk_level, next_48h,
        weekly_plan, full_report, readiness_score, readiness_label, readiness_explanation,
        fatigue_score, fatigue_label, fatigue_explanation,
        consistency_score, consistency_label, consistency_explanation,
        overload_explanation, suggested_focus, coach_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
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

    console.log(`[SYNC] 💾 Report salvato per attività ${activityId}`);
  } catch (error) {
    console.error(`[SYNC] Errore salvando report per ${activityId}:`, error);
    throw error;
  }
}

/**
 * Invia notifica Telegram per una nuova corsa
 */
async function sendTelegramNotification(activity: DBActivity, report: CoachReport): Promise<void> {
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
      console.log(`[SYNC] 📱 Telegram inviato per: ${activity.name}`);
    } else {
      console.warn(`[SYNC] ⚠️ Telegram fallito per: ${activity.name}`);
    }

  } catch (error) {
    console.error(`[SYNC] Errore Telegram per ${activity.name}:`, error);
    // Non throw perché non è un errore bloccante
  }
}

/**
 * Log di un sync riuscito
 */
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

/**
 * Log di un errore di sync
 */
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

/**
 * Rifiuta altri metodi HTTP
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Metodo POST non consentito. Usa GET.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Metodo PUT non consentito. Usa GET.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Metodo DELETE non consentito. Usa GET.' },
    { status: 405 }
  );
}
