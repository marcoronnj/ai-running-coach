import { AthleteSettings } from './athlete-settings';
import { calculateAge } from './age';
import { CoachingMetrics } from './coaching-metrics';
import { CoachingRules } from './coaching-rules';
import { formatDateIT } from './date-utils';
import { normalizeLanguage, outputLanguageName, type Language } from './i18n';
import {
  getDailyOpenAIModel,
  getOpenAIClient,
  logOpenAIError,
  OPENAI_RESPONSES_ENDPOINT,
} from './openai-client';

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
  rules?: CoachingRules | null,
  language: Language = normalizeLanguage(athleteSettings?.language)
): string {
  const outputLanguage = outputLanguageName(language);
  const isEnglish = normalizeLanguage(language) === 'en';
  const formatActivity = (activity: DBActivity, isNewRun = false) => {
    const prefix = isNewRun
      ? (isEnglish ? 'NEW RUN (to analyze):' : 'NUOVA CORSA (da analizzare):')
      : (isEnglish ? 'HISTORY:' : 'STORICO:');
    const date = formatDateIT(activity.start_date);
    const distance = formatKm(activity.distance_m);
    const pace = formatPace(activity.average_speed);
    const time = formatDuration(activity.moving_time_s);
    const hr = activity.average_heartrate
      ? (isEnglish ? `Average HR: ${activity.average_heartrate} bpm` : `FC media: ${activity.average_heartrate} bpm`)
      : (isEnglish ? 'HR unavailable' : 'FC non disponibile');
    const elevation = activity.total_elevation_gain > 0 ? `D+ ${activity.total_elevation_gain}m` : '';

    return `${prefix}
- ${isEnglish ? 'Date' : 'Data'}: ${date}
- ${isEnglish ? 'Name' : 'Nome'}: ${activity.name}
- ${isEnglish ? 'Distance' : 'Distanza'}: ${distance}
- ${isEnglish ? 'Time' : 'Tempo'}: ${time}
- ${isEnglish ? 'Average pace' : 'Pace medio'}: ${pace}/km
- ${hr}
- ${elevation}
- ${isEnglish ? 'Type' : 'Tipo'}: ${activity.type}`;
  };

  const newRunFormatted = formatActivity(newRun, true);
  const historyFormatted = history.slice(0, 10).map(activity => formatActivity(activity)).join('\n\n');

  // Costruisci il profilo atleta dinamico
  const buildAthleteProfile = (settings?: AthleteSettings): string => {
    if (!settings) {
      return isEnglish ? '- Profile not configured - use default values' : '- Profilo non configurato - usa valori di default';
    }

    const profileParts = [];

    if (settings.profile_summary) {
      profileParts.push(`- ${settings.profile_summary}`);
    }

    const calculatedAge = calculateAge(settings.birth_date);
    if (calculatedAge !== null) {
      profileParts.push(isEnglish ? `- Age: ${calculatedAge} years` : `- Età: ${calculatedAge} anni`);
    }

    if (settings.weight_kg && settings.height_cm) {
      const bmi = (settings.weight_kg / ((settings.height_cm / 100) ** 2)).toFixed(1);
      profileParts.push(isEnglish ? `- Weight: ${settings.weight_kg}kg, Height: ${settings.height_cm}cm (BMI: ${bmi})` : `- Peso: ${settings.weight_kg}kg, Altezza: ${settings.height_cm}cm (BMI: ${bmi})`);
    } else if (settings.weight_kg) {
      profileParts.push(isEnglish ? `- Weight: ${settings.weight_kg}kg` : `- Peso: ${settings.weight_kg}kg`);
    } else if (settings.height_cm) {
      profileParts.push(isEnglish ? `- Height: ${settings.height_cm}cm` : `- Altezza: ${settings.height_cm}cm`);
    }

    if (settings.main_goal) {
      profileParts.push(isEnglish ? `- Main goal: ${settings.main_goal}` : `- Obiettivo principale: ${settings.main_goal}`);
    }

    if (settings.secondary_goal) {
      profileParts.push(isEnglish ? `- Secondary goal: ${settings.secondary_goal}` : `- Obiettivo secondario: ${settings.secondary_goal}`);
    }

    if (settings.target_runs_per_week) {
      profileParts.push(isEnglish ? `- Target runs/week: ${settings.target_runs_per_week}` : `- Uscite target/settimana: ${settings.target_runs_per_week}`);
    }

    if (settings.target_weekly_volume_km) {
      profileParts.push(isEnglish ? `- Target weekly volume: ${settings.target_weekly_volume_km}km` : `- Volume target settimanale: ${settings.target_weekly_volume_km}km`);
    }

    if (settings.target_pace) {
      profileParts.push(isEnglish ? `- Target pace: ${settings.target_pace}/km` : `- Pace target: ${settings.target_pace}/km`);
    }

    if (settings.target_hr) {
      profileParts.push(isEnglish ? `- Target HR: ${settings.target_hr} bpm` : `- FC target: ${settings.target_hr} bpm`);
    }

    if (settings.available_days && settings.available_days.length > 0) {
      profileParts.push(isEnglish ? `- Available days: ${settings.available_days.join(', ')}` : `- Giorni disponibili: ${settings.available_days.join(', ')}`);
    }

    if (settings.experience_level) {
      profileParts.push(isEnglish ? `- Experience level: ${settings.experience_level}` : `- Livello esperienza: ${settings.experience_level}`);
    }

    if (settings.injuries) {
      profileParts.push(isEnglish ? `- Physical notes/injuries: ${settings.injuries}` : `- Note fisiche/infortuni: ${settings.injuries}`);
    }

    if (settings.avoid_overload !== undefined) {
      profileParts.push(isEnglish ? `- Avoid overload: ${settings.avoid_overload ? 'Yes' : 'No'}` : `- Evitare sovrallenamento: ${settings.avoid_overload ? 'Sì' : 'No'}`);
    }

    return profileParts.length > 0 ? profileParts.join('\n') : (isEnglish ? '- Basic profile - adapt to the run' : '- Profilo base - adattati alla corsa');
  };

  const athleteProfile = buildAthleteProfile(athleteSettings || undefined);

  // Sezione metriche
  const metricsSection = metrics ? `

## METRICHE ATTUALI
- Readiness: ${metrics.readinessLabel} (${metrics.readinessScore}/100) - ${metrics.readinessExplanation}
- Fatigue: ${metrics.fatigueLabel} (${metrics.fatigueScore}/100) - ${metrics.fatigueExplanation}
- Consistency: ${metrics.consistencyLabel} (${metrics.consistencyScore}/100) - ${metrics.consistencyExplanation}
- Overload Risk: ${metrics.overloadRisk} - ${metrics.overloadExplanation}
- ${isEnglish ? 'Suggested Focus' : 'Focus Consigliato'}: ${metrics.suggestedFocus}
${metrics.warnings && metrics.warnings.length > 0 ? `- ${isEnglish ? 'Warnings' : 'Avvertenze'}: ${metrics.warnings.join(', ')}` : ''}` : '';

  // Sezione regole
  const rulesSection = rules ? `

## REGOLE COACHING ATTIVE
- ${isEnglish ? 'Maximum allowed intensity' : 'Intensità massima consentita'}: ${rules.allowedIntensity}
- ${isEnglish ? 'Max runs next week' : 'Max corse prossima settimana'}: ${rules.maxRunsNextWeek}
${rules.blockedWorkouts && rules.blockedWorkouts.length > 0 ? `- ${isEnglish ? 'Blocked workouts' : 'Allenamenti bloccati'}: ${rules.blockedWorkouts.join(', ')}` : ''}` : '';

  const promptLabels = isEnglish
    ? {
        title: 'AI RUNNING COACH - RUN ANALYSIS',
        profile: 'ATHLETE PROFILE',
        rules: 'IMPORTANT RULES',
        newRun: 'NEW RUN TO ANALYZE',
        history: 'RECENT HISTORY (latest runs)',
        noHistory: 'No previous runs recorded',
        reportInstructions: 'REPORT INSTRUCTIONS',
        generateReport: 'Generate a JSON report with this EXACT structure:',
        shortSummary: 'short string',
        next48h: 'string - practical post-run recommendation for the next two calendar days after this run',
        fullReport: 'short markdown text',
        importantNotes: 'IMPORTANT NOTES',
        coachingRules: [
          'You are a cautious, practical running coach',
          'Use the athlete profile data to personalize advice',
          'ALWAYS respect the coaching engine rules (do not suggest blocked workouts)',
          'Do not suggest more sessions than the maximum allowed',
          'Do not exceed the recommended maximum volume',
          'If cardio data is missing, reason from volume, frequency, and pace',
          'Explain clearly why readiness is high/low and why fatigue matters',
          'Goal: weight loss plus gradual return to competitiveness',
          'Priority: consistency, health, gradual progression',
          'No two intense workouts in a row',
          'Maximum progression of 10-20% per week',
          'Balance cardio with active recovery',
          'Use credible sports language, not generic phrases or slogans',
        ],
        notes: [
          'Reply ONLY with valid JSON, no extra text',
          'Adapt the weekly plan to the athlete current level',
          'Respect the provided metrics and rules',
          'Use professional English',
          'For next_48h: if the run happened today, say TODAY = run completed/light recovery only, TOMORROW = recovery/rest, DAY AFTER TOMORROW = optional easy/recovery run. Never say "Today: no running" after a completed run.',
        ],
      }
    : {
        title: 'AI RUNNING COACH - ANALISI CORSA',
        profile: 'PROFILO ATLETA',
        rules: 'REGOLE IMPORTANTI',
        newRun: 'NUOVA CORSA DA ANALIZZARE',
        history: 'STORICO RECENTE (ultime corse)',
        noHistory: 'Nessuna corsa precedente registrata',
        reportInstructions: 'ISTRUZIONI PER IL REPORT',
        generateReport: 'Genera un report JSON con questa struttura ESATTA:',
        shortSummary: 'string breve',
        next48h: 'string - raccomandazione pratica post-corsa per i prossimi due giorni di calendario dopo questa corsa',
        fullReport: 'testo markdown breve',
        importantNotes: 'NOTE IMPORTANTI',
        coachingRules: [
          'Sei un running coach prudente e concreto',
          'Usa i dati del profilo atleta per personalizzare consigli',
          'RISPETTA SEMPRE le regole del coaching engine (non proporre allenamenti bloccati)',
          'Non proporre più sedute del massimo consentito',
          'Non superare il volume massimo consigliato',
          'Se mancano dati cardio, ragiona su volume, frequenza e passo',
          'Spiega con trasparenza perché la readiness è alta/bassa e perché la fatigue è rilevante',
          'Obiettivo: dimagrimento + ritorno progressivo alla competitività',
          'Priorità: continuità, salute, progressione graduale',
          'Niente due allenamenti intensi consecutivi',
          'Progressione massima del 10-20% a settimana',
          'Bilanciare cardio con recupero attivo',
          'Adotta linguaggio sportivo credibile, non frasi generiche o slogan',
        ],
        notes: [
          'Rispondi SOLO con JSON valido, niente testo aggiuntivo',
          "Adatta il piano settimanale al livello attuale dell'atleta",
          'Rispetta le metriche e regole fornite',
          'Usa italiano professionale',
          'Per next_48h: se la corsa è avvenuta oggi, scrivi OGGI = corsa completata/solo recupero leggero, DOMANI = recupero/riposo, DOPODOMANI = easy/recovery opzionale. Non scrivere mai "Oggi: niente corsa" dopo una corsa completata.',
        ],
      };

  const prompt = `# ${promptLabels.title}

Output language: ${outputLanguage}
If language is "en", write every user-facing text field in English only.
Do not use Italian words.
All JSON fields that contain natural language must be in English.
Some context labels or historical user data may contain Italian; do not copy their language into the output.
If language is "it", write every user-facing text field in Italian only.
This applies to: title, summary, next_48h, suggested_focus, coach_notes, full_report, weekly_plan descriptions, run judgement and recovery hints.
All user-facing JSON text fields MUST be written in ${outputLanguage}: title, summary, suggested_focus, next_48h, weekly_plan names/descriptions/reasons, coach_notes and full_report.
Keep enum/code values unchanged: risk_level must remain "basso | medio | alto"; intensity must remain "recovery | easy | medium | quality".

## ${promptLabels.profile}
${athleteProfile}${metricsSection}${rulesSection}

## ${promptLabels.rules}
${promptLabels.coachingRules.map((rule) => `- ${rule}`).join('\n')}

## ${promptLabels.newRun}
${newRunFormatted}

## ${promptLabels.history}
${historyFormatted || promptLabels.noHistory}

## ${promptLabels.reportInstructions}
${promptLabels.generateReport}

{
  "title": "string",
  "summary": "${promptLabels.shortSummary}",
  "risk_level": "basso | medio | alto",
  "readiness_score": 0,
  "fatigue_score": 0,
  "consistency_score": 0,
  "suggested_focus": "string",
  "next_48h": "${promptLabels.next48h}",
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
  "full_report": "${promptLabels.fullReport}"
}

## ${promptLabels.importantNotes}
${promptLabels.notes.map((note) => `- ${note}`).join('\n')}`;

  return prompt;
}

/**
 * Genera un report del coach usando OpenAI
 * @param prompt - Prompt completo per OpenAI
 * @returns Promise<CoachReport> - Report parsato
 */
export async function generateCoachReport(prompt: string, language: Language = 'it'): Promise<CoachReport> {
  const client = getOpenAIClient();
  const model = getDailyOpenAIModel();
  const endpoint = OPENAI_RESPONSES_ENDPOINT;

  try {
    console.log('[COACH] Generating report with OpenAI...', { model, endpoint });

    const response = await client.responses.create({
      model,
      input: prompt,
      max_output_tokens: 3000,
      text: {
        format: { type: 'json_object' },
      },
    });

    const content = response.output_text;

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
      return createFallbackReport(content, language);
    }

  } catch (error) {
    const details = logOpenAIError(error, model, endpoint);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('Chiave API OpenAI non valida o mancante');
      }
      if (error.message.includes('quota') || error.message.includes('billing')) {
        throw new Error('Quota OpenAI esaurita. Controlla il billing su OpenAI.');
      }
      if (details.status === 404 || error.message.includes('model')) {
        throw new Error(
          `OpenAI ha rifiutato il modello "${model}" su ${endpoint}. ` +
          `Status: ${details.status ?? 'n/d'} - ${details.message}`
        );
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
function createFallbackReport(rawContent: string, language: Language = 'it'): CoachReport {
  console.log('[COACH] Creating fallback report');
  const isEnglish = normalizeLanguage(language) === 'en';

  return {
    title: isEnglish ? 'Run Completed Report' : 'Report Corsa Completata',
    summary: isEnglish ? 'Workout completed. Detailed analysis is available in the full report.' : 'Allenamento completato. Analisi dettagliata nel report completo.',
    risk_level: 'medio',
    readiness_score: 50,
    fatigue_score: 30,
    consistency_score: 60,
    suggested_focus: isEnglish ? 'maintenance and recovery' : 'mantenimento e recupero',
    next_48h: isEnglish ? 'Active recovery tomorrow, easy run in 2-3 days if you feel good.' : 'Riposo attivo domani, facile corsa tra 2-3 giorni se ti senti bene.',
    weekly_plan: [
      {
        name: isEnglish ? 'Active Recovery' : 'Riposo Attivo',
        description: isEnglish ? 'Light walking or mobility' : 'Camminata leggera o mobilità',
        intensity: 'recovery',
        duration: '30-45 min',
        reason: isEnglish ? 'Recovery from recent run' : 'Recupero dalla corsa recente',
      },
      {
        name: 'Easy Run',
        description: isEnglish ? 'Light run at a comfortable pace' : 'Corsa leggera a ritmo comodo',
        intensity: 'easy',
        duration: '45-60 min',
        reason: isEnglish ? 'Maintain consistency' : 'Mantenimento continuità',
      },
      {
        name: isEnglish ? 'Rest' : 'Riposo',
        description: isEnglish ? 'Full recovery' : 'Recupero completo',
        intensity: 'recovery',
        duration: '0 min',
        reason: isEnglish ? 'Balance load and recovery' : 'Bilanciare carico e recupero',
      },
    ],
    coach_notes: [isEnglish ? 'Automatically generated report - consult a professional for personalized advice' : 'Report generato automaticamente - consulta professionista per consigli personalizzati'],
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
  rules?: CoachingRules | null,
  language: Language = normalizeLanguage(athleteSettings?.language)
): Promise<CoachReport> {
  const prompt = buildCoachPrompt(newRun, history, athleteSettings || undefined, metrics || undefined, rules || undefined, language);
  return await generateCoachReport(prompt, language);
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
