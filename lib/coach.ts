import OpenAI from 'openai';
import { AthleteSettings } from './athlete-settings';
import { CoachingMetrics } from './coaching-metrics';
import { CoachingRules } from './coaching-rules';

/**
 * Modulo AI Coach per generare report di running con OpenAI
 */

/**
 * Tipi TypeScript per il coach
 */
export interface DBActivity {
  id: string;
  strava_id: string;
  name: string;
  type: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  elapsed_time_s: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number;
  raw_json: any;
  created_at: string;
}

export interface CoachReport {
  title: string;
  summary: string;
  risk_level: 'basso' | 'medio' | 'alto';
  readiness_score: number;
  fatigue_score: number;
  consistency_score: number;
  suggested_focus: string;
  next_48h: string;
  weekly_plan: WeeklyPlanItem[];
  coach_notes: string[];
  full_report: string;
  readiness_label?: string;
  readiness_explanation?: string;
  fatigue_label?: string;
  fatigue_explanation?: string;
  consistency_label?: string;
  consistency_explanation?: string;
  overload_explanation?: string;
}

export interface WeeklyPlanItem {
  name: string;
  description: string;
  intensity: 'recovery' | 'easy' | 'medium' | 'quality';
  duration: string;
  reason: string;
}

/**
 * Inizializza il client OpenAI
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY non è configurato in .env.local. ' +
      'Aggiungi la variabile di ambiente e riavvia il server.'
    );
  }

  return new OpenAI({
    apiKey: apiKey,
  });
}

/**
 * Costruisce il prompt per il coach AI
 * @param newRun - La nuova corsa appena completata
 * @param history - Storico delle corse recenti (ultime 10-15)
 * @param athleteSettings - Impostazioni atleta
 * @param metrics - Metriche coaching calcolate
 * @param rules - Regole coaching calcolate
 * @returns Prompt completo per OpenAI
 */
export function buildCoachPrompt(
  newRun: DBActivity,
  history: DBActivity[],
  athleteSettings?: AthleteSettings | null,
  metrics?: CoachingMetrics | null,
  rules?: CoachingRules | null
): string {
  const formatActivity = (activity: DBActivity, isNewRun = false) => {
    const prefix = isNewRun ? 'NUOVA CORSA (da analizzare):' : 'STORICO:';
    const date = new Date(activity.start_date).toLocaleDateString('it-IT');
    const distance = formatKm(activity.distance_m);
    const pace = formatPace(activity.average_speed);
    const time = formatDuration(activity.moving_time_s);
    const hr = activity.average_heartrate ? `FC media: ${activity.average_heartrate} bpm` : 'FC non disponibile';
    const elevation = activity.total_elevation_gain > 0 ? `D+ ${activity.total_elevation_gain}m` : '';

    return `${prefix}
- Data: ${date}
- Nome: ${activity.name}
- Distanza: ${distance}
- Tempo: ${time}
- Pace medio: ${pace}/km
- ${hr}
- ${elevation}
- Tipo: ${activity.type}`;
  };

  const newRunFormatted = formatActivity(newRun, true);
  const historyFormatted = history.slice(0, 10).map(activity => formatActivity(activity)).join('\n\n');

  // Costruisci il profilo atleta dinamico
  const buildAthleteProfile = (settings?: AthleteSettings): string => {
    if (!settings) {
      return `- Profilo non configurato - usa valori di default`;
    }

    const profileParts = [];

    if (settings.profile_summary) {
      profileParts.push(`- ${settings.profile_summary}`);
    }

    if (settings.age) {
      profileParts.push(`- Età: ${settings.age} anni`);
    }

    if (settings.weight_kg && settings.height_cm) {
      const bmi = (settings.weight_kg / ((settings.height_cm / 100) ** 2)).toFixed(1);
      profileParts.push(`- Peso: ${settings.weight_kg}kg, Altezza: ${settings.height_cm}cm (BMI: ${bmi})`);
    } else if (settings.weight_kg) {
      profileParts.push(`- Peso: ${settings.weight_kg}kg`);
    } else if (settings.height_cm) {
      profileParts.push(`- Altezza: ${settings.height_cm}cm`);
    }

    if (settings.main_goal) {
      profileParts.push(`- Obiettivo principale: ${settings.main_goal}`);
    }

    if (settings.secondary_goal) {
      profileParts.push(`- Obiettivo secondario: ${settings.secondary_goal}`);
    }

    if (settings.target_runs_per_week) {
      profileParts.push(`- Uscite target/settimana: ${settings.target_runs_per_week}`);
    }

    if (settings.target_weekly_volume_km) {
      profileParts.push(`- Volume target settimanale: ${settings.target_weekly_volume_km}km`);
    }

    if (settings.target_pace) {
      profileParts.push(`- Pace target: ${settings.target_pace}/km`);
    }

    if (settings.target_hr) {
      profileParts.push(`- FC target: ${settings.target_hr} bpm`);
    }

    if (settings.available_days && settings.available_days.length > 0) {
      profileParts.push(`- Giorni disponibili: ${settings.available_days.join(', ')}`);
    }

    if (settings.experience_level) {
      profileParts.push(`- Livello esperienza: ${settings.experience_level}`);
    }

    if (settings.injuries) {
      profileParts.push(`- Note fisiche/infortuni: ${settings.injuries}`);
    }

    if (settings.avoid_overload !== undefined) {
      profileParts.push(`- Evitare sovrallenamento: ${settings.avoid_overload ? 'Sì' : 'No'}`);
    }

    return profileParts.length > 0 ? profileParts.join('\n') : '- Profilo base - adattati alla corsa';
  };

  const athleteProfile = buildAthleteProfile(athleteSettings || undefined);

  // Sezione metriche
  const metricsSection = metrics ? `

## METRICHE ATTUALI
- Readiness: ${metrics.readinessLabel} (${metrics.readinessScore}/100) - ${metrics.readinessExplanation}
- Fatigue: ${metrics.fatigueLabel} (${metrics.fatigueScore}/100) - ${metrics.fatigueExplanation}
- Consistency: ${metrics.consistencyLabel} (${metrics.consistencyScore}/100) - ${metrics.consistencyExplanation}
- Overload Risk: ${metrics.overloadRisk} - ${metrics.overloadExplanation}
- Focus Consigliato: ${metrics.suggestedFocus}
${metrics.warnings && metrics.warnings.length > 0 ? `- Avvertenze: ${metrics.warnings.join(', ')}` : ''}` : '';

  // Sezione regole
  const rulesSection = rules ? `

## REGOLE COACHING ATTIVE
- Intensità massima consentita: ${rules.allowedIntensity}
- Max corse prossima settimana: ${rules.maxRunsNextWeek}
${rules.blockedWorkouts && rules.blockedWorkouts.length > 0 ? `- Allenamenti bloccati: ${rules.blockedWorkouts.join(', ')}` : ''}` : '';

  const prompt = `# AI RUNNING COACH - ANALISI CORSA

## PROFILO ATLETA
${athleteProfile}${metricsSection}${rulesSection}

## REGOLE IMPORTANTI
- Sei un running coach prudente e concreto
- Usa i dati del profilo atleta per personalizzare consigli
- RISPETTA SEMPRE le regole del coaching engine (non proporre allenamenti bloccati)
- Non proporre più sedute del massimo consentito
- Non superare il volume massimo consigliato
- Se mancano dati cardio, ragiona su volume, frequenza e passo
- Spiega con trasparenza perché la readiness è alta/bassa e perché la fatigue è rilevante
- Obiettivo: dimagrimento + ritorno progressivo alla competitività
- Priorità: continuità, salute, progressione graduale
- Niente due allenamenti intensi consecutivi
- Progressione massima del 10-20% a settimana
- Bilanciare cardio con recupero attivo
- Adotta linguaggio sportivo credibile, non frasi generiche o slogan

## NUOVA CORSA DA ANALIZZARE
${newRunFormatted}

## STORICO RECENTE (ultime corse)
${historyFormatted || 'Nessuna corsa precedente registrata'}

## ISTRUZIONI PER IL REPORT
Genera un report JSON con questa struttura ESATTA:

{
  "title": "string",
  "summary": "string breve",
  "risk_level": "basso | medio | alto",
  "readiness_score": 0,
  "fatigue_score": 0,
  "consistency_score": 0,
  "suggested_focus": "string",
  "next_48h": "string - raccomandazione pratica per oggi e domani, specifica cosa fare",
  "weekly_plan": [
    {
      "name": "string",
      "description": "string",
      "intensity": "recovery | easy | medium | quality",
      "duration": "string",
      "reason": "string"
    }
  ],
  "coach_notes": [
    "string"
  ],
  "full_report": "testo markdown breve"
}

## NOTE IMPORTANTI
- Rispondi SOLO con JSON valido, niente testo aggiuntivo
- Adatta il piano settimanale al livello attuale dell'atleta
- Rispetta le metriche e regole fornite
- Usa italiano professionale
- Per next_48h: specifica chiaramente cosa fare OGGI e DOMANI, non essere vago`;

  return prompt;
}

/**
 * Genera un report del coach usando OpenAI
 * @param prompt - Prompt completo per OpenAI
 * @returns Promise<CoachReport> - Report parsato
 */
export async function generateCoachReport(prompt: string): Promise<CoachReport> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL_DAILY || 'gpt-4o-mini';

  try {
    console.log('[COACH] Generating report with OpenAI...');

    const completion = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI non ha restituito contenuto');
    }

    console.log('[COACH] ✓ Report generated, parsing JSON...');

    // Prova a parsare il JSON
    try {
      const report: CoachReport = JSON.parse(content.trim());

      // Validazione basilare della struttura
      if (!report.title || !report.summary || !report.risk_level ||
          !report.next_48h || !Array.isArray(report.weekly_plan) || !report.full_report ||
          typeof report.readiness_score !== 'number' || typeof report.fatigue_score !== 'number' ||
          typeof report.consistency_score !== 'number' || !report.suggested_focus ||
          !Array.isArray(report.coach_notes)) {
        throw new Error('Struttura JSON incompleta');
      }

      // Validazione risk_level
      if (!['basso', 'medio', 'alto'].includes(report.risk_level)) {
        console.warn('[COACH] Risk level non valido, impostando "medio"');
        report.risk_level = 'medio';
      }

      // Validazione scores
      report.readiness_score = Math.max(0, Math.min(100, report.readiness_score));
      report.fatigue_score = Math.max(0, Math.min(100, report.fatigue_score));
      report.consistency_score = Math.max(0, Math.min(100, report.consistency_score));

      // Validazione weekly_plan
      report.weekly_plan = report.weekly_plan.filter(item =>
        item.name && item.description && item.intensity && item.duration && item.reason &&
        ['recovery', 'easy', 'medium', 'quality'].includes(item.intensity)
      );

      console.log('[COACH] ✓ Report parsed successfully');
      return report;

    } catch (parseError) {
      console.warn('[COACH] JSON parsing failed, using fallback:', parseError);
      return createFallbackReport(content);
    }

  } catch (error) {
    console.error('[COACH] OpenAI API error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Chiave API OpenAI non valida o mancante');
      }
      if (error.message.includes('quota') || error.message.includes('billing')) {
        throw new Error('Quota OpenAI esaurita. Controlla il billing su OpenAI.');
      }
      if (error.message.includes('model')) {
        throw new Error(`Modello OpenAI "${model}" non disponibile`);
      }
    }

    throw new Error('Errore nella generazione del report AI');
  }
}

/**
 * Crea un report fallback quando il parsing JSON fallisce
 * @param rawContent - Contenuto grezzo da OpenAI
 * @returns CoachReport - Report di fallback
 */
function createFallbackReport(rawContent: string): CoachReport {
  console.log('[COACH] Creating fallback report');

  return {
    title: 'Report Corsa Completata',
    summary: 'Allenamento completato. Analisi dettagliata nel report completo.',
    risk_level: 'medio',
    readiness_score: 50,
    fatigue_score: 30,
    consistency_score: 60,
    suggested_focus: 'mantenimento e recupero',
    next_48h: 'Riposo attivo domani, facile corsa tra 2-3 giorni se ti senti bene.',
    weekly_plan: [
      {
        name: 'Riposo Attivo',
        description: 'Camminata leggera o mobilità',
        intensity: 'recovery',
        duration: '30-45 min',
        reason: 'Recupero dalla corsa recente',
      },
      {
        name: 'Easy Run',
        description: 'Corsa leggera a ritmo comodo',
        intensity: 'easy',
        duration: '45-60 min',
        reason: 'Mantenimento continuità',
      },
      {
        name: 'Riposo',
        description: 'Recupero completo',
        intensity: 'recovery',
        duration: '0 min',
        reason: 'Bilanciare carico e recupero',
      },
    ],
    coach_notes: ['Report generato automaticamente - consulta professionista per consigli personalizzati'],
    full_report: rawContent, // Usa il contenuto grezzo come full_report
  };
}

/**
 * Genera un report completo per una corsa
 * Combina buildCoachPrompt + generateCoachReport
 * @param newRun - La nuova corsa
 * @param history - Storico corse
 * @param athleteSettings - Impostazioni atleta
 * @param metrics - Metriche coaching
 * @param rules - Regole coaching
 * @returns Promise<CoachReport>
 */
export async function generateCompleteCoachReport(
  newRun: DBActivity,
  history: DBActivity[],
  athleteSettings?: AthleteSettings | null,
  metrics?: CoachingMetrics | null,
  rules?: CoachingRules | null
): Promise<CoachReport> {
  const prompt = buildCoachPrompt(newRun, history, athleteSettings || undefined, metrics || undefined, rules || undefined);
  return await generateCoachReport(prompt);
}

/**
 * Helper: Formatta metri in chilometri
 * @param meters - Distanza in metri
 * @returns string - "5.2 km"
 */
export function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Helper: Formatta velocità media in pace al km
 * @param speedMs - Velocità in m/s
 * @returns string - "5:30/km"
 */
export function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';

  // Converti m/s in secondi per km
  const secondsPerKm = 1000 / speedMs;

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Helper: Formatta durata in secondi in formato leggibile
 * @param seconds - Durata in secondi
 * @returns string - "45:30" o "1h 23m"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Helper: Calcola il pace target per un'intensità
 * @param basePace - Pace della corsa recente (secondi/km)
 * @param intensity - Tipo di intensità
 * @returns string - Pace formattato
 */
export function getTargetPace(basePace: number, intensity: string): string {
  if (!basePace || basePace <= 0) return 'N/A';

  let multiplier = 1;

  switch (intensity) {
    case 'easy':
      multiplier = 1.1; // 10% più lento
      break;
    case 'medium':
      multiplier = 1.0; // Pace normale
      break;
    case 'quality':
      multiplier = 0.9; // 10% più veloce
      break;
    case 'recovery':
      multiplier = 1.2; // 20% più lento
      break;
    default:
      multiplier = 1.0;
  }

  const targetPace = basePace * multiplier;
  return formatPace(1000 / targetPace); // Converti secondi/km in m/s poi formatta
}

/**
 * Helper: Valida un report generato
 * @param report - Report da validare
 * @returns boolean
 */
export function validateCoachReport(report: any): report is CoachReport {
  return (
    typeof report === 'object' &&
    typeof report.title === 'string' &&
    typeof report.summary === 'string' &&
    ['basso', 'medio', 'alto'].includes(report.risk_level) &&
    typeof report.next_48h === 'string' &&
    Array.isArray(report.weekly_plan) &&
    typeof report.full_report === 'string' &&
    report.weekly_plan.every((item: any) =>
      typeof item.name === 'string' &&
      typeof item.description === 'string' &&
      ['easy', 'medium', 'quality', 'recovery'].includes(item.intensity) &&
      typeof item.duration === 'string'
    )
  );
}
