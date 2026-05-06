import { CoachingMetrics } from './coaching-metrics';
import { AthleteSettings } from './athlete-settings';

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
  let allowedIntensity: 'recovery' | 'easy' | 'moderate' | 'quality' = 'moderate';
  let maxRunsNextWeek = athleteSettings?.target_runs_per_week || 3;
  let maxWeeklyKmNextWeek: number | null = null;

  const rules: string[] = [];
  const blockedWorkouts: string[] = [];

  // Determina intensità massima basata su overload
  if (metrics.overloadRisk === 'alto') {
    allowedIntensity = 'easy';
    rules.push('Overload alto: massima intensità easy');
    blockedWorkouts.push('allenamenti quality', 'ripetute intense', 'lunghi aggressivi');
  } else if (metrics.overloadRisk === 'medio') {
    allowedIntensity = 'moderate';
    rules.push('Overload medio: evitare quality consecutive');
    blockedWorkouts.push('doppia quality in settimana');
  } else {
    // Overload basso - possiamo permettere quality
    allowedIntensity = 'quality';
  }

  // Regola 2: Fatigue score
  if (metrics.fatigueScore > 70) {
    allowedIntensity = 'recovery';
    rules.push('Fatica elevata: focus su recupero attivo');
    blockedWorkouts.push('allenamenti intensi', 'volume elevato');
  }

  // Regola 3: Continuità recente
  if (metrics.runsLast14Days < 3) {
    if (allowedIntensity === 'quality') {
      allowedIntensity = 'moderate';
    }
    rules.push('Continuità bassa: costruire base gradualmente');
  }

  // Regola 4: Consistency score
  if (metrics.consistencyScore < 40) {
    if (allowedIntensity === 'quality' || allowedIntensity === 'moderate') {
      allowedIntensity = 'easy';
    }
    rules.push('Consistenza irregolare: niente qualità fino a stabilizzazione');
    blockedWorkouts.push('allenamenti quality');
  }

  // Regola 5: Volume massimo prossima settimana
  if (athleteSettings?.avoid_overload && metrics.averageWeeklyKm28Days > 0) {
    const maxIncrease = metrics.averageWeeklyKm28Days * 0.1; // +10%
    maxWeeklyKmNextWeek = metrics.averageWeeklyKm28Days + maxIncrease;
    rules.push(`Volume max settimana: ${maxWeeklyKmNextWeek.toFixed(1)}km (+10% dalla media)`);
  }

  // Regola 6: Mai più del target settimanale
  if (athleteSettings?.target_runs_per_week) {
    maxRunsNextWeek = Math.min(maxRunsNextWeek, athleteSettings.target_runs_per_week);
    rules.push(`Massimo ${maxRunsNextWeek} uscite settimanali`);
  }

  // Regola 7: Infortuni
  if (athleteSettings?.injuries) {
    rules.push('Infortuni/note mediche: consultare professionista per allenamenti intensi');
    blockedWorkouts.push('allenamenti ad alto impatto se non autorizzati');
  }

  // Regola 8: Readiness score basso
  if (metrics.readinessScore < 40) {
    allowedIntensity = 'recovery';
    rules.push('Readiness basso: focus su recupero e costruzione base');
  }

  // Assicurati che le regole siano uniche
  const uniqueRules = [...new Set(rules)];
  const uniqueBlocked = [...new Set(blockedWorkouts)];

  return {
    allowedIntensity,
    maxRunsNextWeek,
    maxWeeklyKmNextWeek: maxWeeklyKmNextWeek ? Math.round(maxWeeklyKmNextWeek * 10) / 10 : null,
    rules: uniqueRules,
    blockedWorkouts: uniqueBlocked,
  };
}