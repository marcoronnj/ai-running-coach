import { DBActivity } from './coach';
import { AthleteSettings } from './athlete-settings';

/**
 * Metriche di coaching calcolate dalle attività recenti
 */
export interface CoachingMetrics {
  last7DaysKm: number;
  last14DaysKm: number;
  last28DaysKm: number;
  last42DaysKm: number;
  runsLast7Days: number;
  runsLast14Days: number;
  runsLast28Days: number;
  averageWeeklyKm28Days: number;
  acuteLoad7d: number;
  chronicLoad42d: number;
  acuteChronicRatio: number | null;
  consistencyScore: number; // 0-100
  fatigueScore: number; // 0-100
  readinessScore: number; // 0-100
  overloadRisk: 'basso' | 'medio' | 'alto';
  suggestedFocus: string;
  warnings: string[];
}

/**
 * Calcola le metriche di coaching dalle attività recenti
 * @param activities - Attività degli ultimi 90 giorni
 * @param athleteSettings - Impostazioni dell'atleta
 * @returns Metriche calcolate
 */
export function calculateCoachingMetrics(
  activities: DBActivity[],
  athleteSettings: AthleteSettings | null
): CoachingMetrics {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const fortyTwoDaysAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

  // Filtra attività per periodi
  const last7Days = activities.filter(a => new Date(a.start_date) >= sevenDaysAgo);
  const last14Days = activities.filter(a => new Date(a.start_date) >= fourteenDaysAgo);
  const last28Days = activities.filter(a => new Date(a.start_date) >= twentyEightDaysAgo);
  const last42Days = activities.filter(a => new Date(a.start_date) >= fortyTwoDaysAgo);

  // Calcola chilometri totali per periodo
  const last7DaysKm = last7Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last14DaysKm = last14Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last28DaysKm = last28Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last42DaysKm = last42Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);

  // Conta corse per periodo
  const runsLast7Days = last7Days.length;
  const runsLast14Days = last14Days.length;
  const runsLast28Days = last28Days.length;

  // Media settimanale negli ultimi 28 giorni
  const averageWeeklyKm28Days = last28DaysKm / 4; // 28 giorni = 4 settimane

  // Acute load = km ultimi 7 giorni
  const acuteLoad7d = last7DaysKm;

  // Chronic load = media settimanale km ultimi 42 giorni
  const chronicLoad42d = last42DaysKm / 6; // 42 giorni = 6 settimane

  // Acute/Chronic ratio
  const acuteChronicRatio = chronicLoad42d > 0 ? acuteLoad7d / chronicLoad42d : null;

  // Overload risk basato sul ratio
  let overloadRisk: 'basso' | 'medio' | 'alto' = 'basso';
  if (acuteChronicRatio !== null) {
    if (acuteChronicRatio > 1.35) {
      overloadRisk = 'alto';
    } else if (acuteChronicRatio > 1.15) {
      overloadRisk = 'medio';
    }
  }

  // Consistency score: regolarità delle uscite nelle ultime 4 settimane
  const consistencyScore = calculateConsistencyScore(last28Days, 28);

  // Fatigue score: carico recente vs media
  const fatigueScore = calculateFatigueScore(acuteLoad7d, chronicLoad42d, overloadRisk);

  // Readiness score: 100 - fatigue, corretto da consistenza
  const readinessScore = Math.max(0, Math.min(100,
    100 - fatigueScore + (consistencyScore / 10) - (overloadRisk === 'alto' ? 20 : overloadRisk === 'medio' ? 10 : 0)
  ));

  // Suggested focus basato sui dati
  const suggestedFocus = getSuggestedFocus(activities.length, consistencyScore, overloadRisk, averageWeeklyKm28Days, athleteSettings);

  // Warnings
  const warnings = generateWarnings(overloadRisk, fatigueScore, consistencyScore, athleteSettings);

  return {
    last7DaysKm: Math.round(last7DaysKm * 10) / 10,
    last14DaysKm: Math.round(last14DaysKm * 10) / 10,
    last28DaysKm: Math.round(last28DaysKm * 10) / 10,
    last42DaysKm: Math.round(last42DaysKm * 10) / 10,
    runsLast7Days,
    runsLast14Days,
    runsLast28Days,
    averageWeeklyKm28Days: Math.round(averageWeeklyKm28Days * 10) / 10,
    acuteLoad7d: Math.round(acuteLoad7d * 10) / 10,
    chronicLoad42d: Math.round(chronicLoad42d * 10) / 10,
    acuteChronicRatio: acuteChronicRatio ? Math.round(acuteChronicRatio * 100) / 100 : null,
    consistencyScore: Math.round(consistencyScore),
    fatigueScore: Math.round(fatigueScore),
    readinessScore: Math.round(readinessScore),
    overloadRisk,
    suggestedFocus,
    warnings,
  };
}

/**
 * Calcola il punteggio di consistenza (0-100)
 */
function calculateConsistencyScore(activities: DBActivity[], days: number): number {
  if (activities.length === 0) return 0;

  const weeks = days / 7;
  const expectedRunsPerWeek = activities.length / weeks;

  // Penalizza variazioni grandi tra settimane
  const weeklyRuns = [];
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(Date.now() - (days - i * 7) * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.now() - (days - (i + 1) * 7) * 24 * 60 * 60 * 1000);
    const weekActivities = activities.filter(a =>
      new Date(a.start_date) >= weekEnd && new Date(a.start_date) < weekStart
    );
    weeklyRuns.push(weekActivities.length);
  }

  const avgRuns = weeklyRuns.reduce((sum, runs) => sum + runs, 0) / weeklyRuns.length;
  const variance = weeklyRuns.reduce((sum, runs) => sum + Math.pow(runs - avgRuns, 2), 0) / weeklyRuns.length;
  const stdDev = Math.sqrt(variance);

  // Più bassa la deviazione standard, più alto il punteggio
  const consistencyScore = Math.max(0, 100 - (stdDev * 20));

  return consistencyScore;
}

/**
 * Calcola il punteggio di fatica (0-100)
 */
function calculateFatigueScore(acuteLoad: number, chronicLoad: number, overloadRisk: string): number {
  if (chronicLoad === 0) return acuteLoad > 20 ? 80 : 20; // Se no storico, basa su carico assoluto

  const ratio = acuteLoad / chronicLoad;
  let fatigueScore = 0;

  if (ratio > 1.5) fatigueScore = 90;
  else if (ratio > 1.3) fatigueScore = 70;
  else if (ratio > 1.1) fatigueScore = 50;
  else if (ratio > 0.9) fatigueScore = 30;
  else fatigueScore = 10;

  // Aggiusta per rischio overload
  if (overloadRisk === 'alto') fatigueScore += 20;
  else if (overloadRisk === 'medio') fatigueScore += 10;

  return Math.min(100, Math.max(0, fatigueScore));
}

/**
 * Determina il focus suggerito
 */
function getSuggestedFocus(
  totalActivities: number,
  consistencyScore: number,
  overloadRisk: string,
  averageWeeklyKm: number,
  athleteSettings: AthleteSettings | null
): string {
  // Se discontinuo (poche attività o bassa consistenza)
  if (totalActivities < 10 || consistencyScore < 40) {
    return 'costruire continuità';
  }

  // Se overload alto
  if (overloadRisk === 'alto') {
    return 'recupero e consolidamento';
  }

  // Se volume basso (< 15km/settimana)
  if (averageWeeklyKm < 15) {
    return 'base aerobica facile';
  }

  // Se carico stabile e consistente
  if (consistencyScore > 70 && overloadRisk === 'basso') {
    return 'progressione controllata';
  }

  // Default prudente
  return 'mantenimento e recupero';
}

/**
 * Genera warnings basati sui dati
 */
function generateWarnings(
  overloadRisk: string,
  fatigueScore: number,
  consistencyScore: number,
  athleteSettings: AthleteSettings | null
): string[] {
  const warnings: string[] = [];

  if (overloadRisk === 'alto') {
    warnings.push('Rischio sovrallenamento elevato - privilegia recupero');
  } else if (overloadRisk === 'medio') {
    warnings.push('Carico elevato - monitora segnali di fatica');
  }

  if (fatigueScore > 70) {
    warnings.push('Livello di fatica alto - considera pausa o allenamenti leggeri');
  }

  if (consistencyScore < 30) {
    warnings.push('Continuità irregolare - stabilisci routine settimanale');
  }

  if (athleteSettings?.injuries) {
    warnings.push('Note mediche presenti - consulta professionista per allenamenti intensi');
  }

  return warnings;
}