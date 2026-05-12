import { CoachingMetrics } from './coaching-metrics';
import { AthleteSettings } from './athlete-settings';
import { normalizeLanguage } from './i18n';

/**
 * Regole di coaching calcolate
 */
export interface CoachingRules {
  allowedIntensity: 'recovery' | 'easy' | 'moderate' | 'quality';
  maxRunsNextWeek: number;
  maxWeeklyKmNextWeek: number | null;
  rules: string[];
  blockedWorkouts: string[];
}

/**
 * Calcola le regole di coaching basate su metriche e impostazioni atleta
 * @param metrics - Metriche calcolate
 * @param athleteSettings - Impostazioni atleta
 * @returns Regole di coaching
 */
export function getCoachingRules(
  metrics: CoachingMetrics,
  athleteSettings: AthleteSettings | null
): CoachingRules {
  const language = normalizeLanguage(athleteSettings?.language);
  const isEnglish = language === 'en';
  let allowedIntensity: CoachingRules['allowedIntensity'] = 'moderate';
  let maxRunsNextWeek = athleteSettings?.target_runs_per_week || 3;
  let maxWeeklyKmNextWeek: number | null = null;

  const rules: string[] = [];
  const blockedWorkouts: string[] = [];

  // Regola 0: Controllo qualità se tutti i segnali sono forti
  if (
    metrics.overloadRisk === 'basso' &&
    metrics.readinessScore >= 80 &&
    metrics.fatigueScore <= 35 &&
    metrics.consistencyLabel === 'solida'
  ) {
    allowedIntensity = 'quality';
    rules.push(isEnglish ? 'Strong balance: quality is possible with recovery discipline' : 'Perfetto equilibrio: qualità possibile con attenzione al recupero');
  }

  // Regola 1: Overload risk (priorità massima)
  if (metrics.overloadRisk === 'alto') {
    allowedIntensity = 'easy';
    rules.push(isEnglish ? 'High overload risk: maximum intensity is easy' : 'Rischio sovrallenamento alto: massima intensità easy');
    blockedWorkouts.push(...(isEnglish ? ['quality workouts', 'intense intervals', 'aggressive long runs'] : ['allenamenti quality', 'ripetute intense', 'lunghi aggressivi']));
  } else if (metrics.overloadRisk === 'medio') {
    allowedIntensity = 'moderate';
    rules.push(isEnglish ? 'Medium overload risk: avoid consecutive quality sessions' : 'Rischio sovrallenamento medio: evitare quality consecutive');
    blockedWorkouts.push(isEnglish ? 'double quality session in the same week' : 'doppia quality in settimana');
  }

  // Regola 2: Fatigue score (priorità alta)
  if (metrics.fatigueScore >= 60) {
    allowedIntensity = 'recovery';
    rules.push(isEnglish ? 'High fatigue: focus on active recovery' : 'Fatica elevata: focus su recupero attivo');
    blockedWorkouts.push(...(isEnglish ? ['intense workouts', 'high volume'] : ['allenamenti intensi', 'volume elevato']));
  }

  // Regola 3: Consistency (priorità media)
  if (metrics.consistencyLabel === 'in costruzione' || metrics.consistencyScore < 40) {
    if (allowedIntensity === 'quality') {
      allowedIntensity = 'moderate';
    }
    rules.push(isEnglish ? 'Irregular consistency: no quality work until stable' : 'Consistenza irregolare: niente qualità fino a stabilizzazione');
    blockedWorkouts.push(isEnglish ? 'quality workouts' : 'allenamenti quality');
  }

  // Regola 4: Giorni dall'ultima corsa
  if (metrics.daysSinceLastRun > 5) {
    if (allowedIntensity === 'quality') {
      allowedIntensity = 'easy';
    }
    rules.push(isEnglish ? 'Long break: return gradually' : 'Pausa prolungata: riprendere gradualmente');
  }

  // Regola 5: Readiness score
  if (metrics.readinessScore < 40) {
    allowedIntensity = 'recovery';
    rules.push(isEnglish ? 'Low readiness: focus on recovery and rebuilding the base' : 'Readiness basso: focus su recupero e costruzione base');
  }

  // Regola 6: Volume massimo prossima settimana (se richiesto)
  if (athleteSettings?.avoid_overload && metrics.averageWeeklyKm28Days > 0) {
    const maxIncrease = metrics.averageWeeklyKm28Days * 0.1; // +10%
    maxWeeklyKmNextWeek = metrics.averageWeeklyKm28Days + maxIncrease;
    rules.push(isEnglish
      ? `Max weekly volume: ${maxWeeklyKmNextWeek.toFixed(1)}km (+10% from average)`
      : `Volume max settimana: ${maxWeeklyKmNextWeek.toFixed(1)}km (+10% dalla media)`);
  }

  // Regola 7: Mai più del target settimanale
  if (athleteSettings?.target_runs_per_week) {
    maxRunsNextWeek = Math.min(maxRunsNextWeek, athleteSettings.target_runs_per_week);
    rules.push(isEnglish ? `Maximum ${maxRunsNextWeek} weekly runs` : `Massimo ${maxRunsNextWeek} uscite settimanali`);
  }

  // Regola 8: Infortuni
  if (athleteSettings?.injuries) {
    rules.push(isEnglish ? 'Injuries/medical notes: consult a professional before intense training' : 'Infortuni/note mediche: consultare professionista per allenamenti intensi');
    blockedWorkouts.push(isEnglish ? 'high-impact workouts unless cleared' : 'allenamenti ad alto impatto se non autorizzati');
  }

  // Assicurati che le regole siano uniche
  const uniqueRules = Array.from(new Set(rules));
  const uniqueBlocked = Array.from(new Set(blockedWorkouts));

  return {
    allowedIntensity,
    maxRunsNextWeek,
    maxWeeklyKmNextWeek: maxWeeklyKmNextWeek ? Math.round(maxWeeklyKmNextWeek * 10) / 10 : null,
    rules: uniqueRules,
    blockedWorkouts: uniqueBlocked,
  };
}
