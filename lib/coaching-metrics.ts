import { DBActivity } from './coach';
import { AthleteSettings } from './athlete-settings';
import { daysSinceInRome } from './date-utils';
import { normalizeLanguage, type Language } from './i18n';
import { estimateActivityLoad, getSportLoadProfile, isRunningActivity } from './sport-classification';

/**
 * Metriche di coaching calcolate dalle attività recenti
 */
export interface CoachingMetrics {
  // Dati grezzi per debug
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
  daysSinceLastRun: number;
  totalTrainingLoad7d: number;
  runningLoad7d: number;
  crossTrainingLoad7d: number;
  muscularStress7d: number;
  recoveryActivities7d: number;

  // Metriche principali con label e spiegazioni
  readinessScore: number; // 0-100
  readinessLabel: 'bassa' | 'moderata' | 'buona' | 'alta';
  readinessExplanation: string;

  fatigueScore: number; // 0-100
  fatigueLabel: 'bassa' | 'media' | 'alta';
  fatigueExplanation: string;

  consistencyScore: number; // 0-100
  consistencyLabel: 'in costruzione' | 'buona' | 'solida';
  consistencyExplanation: string;

  overloadRisk: 'basso' | 'medio' | 'alto';
  overloadExplanation: string;

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
  const language = normalizeLanguage(athleteSettings?.language);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const fortyTwoDaysAgo = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);

  const sortedActivities = [...activities].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  const runningActivities = sortedActivities.filter(isRunningActivity);

  // Filtra attività per periodi. Le metriche run-specific usano solo running;
  // fatigue/readiness usano tutto il carico Strava importato.
  const last7Days = sortedActivities.filter(a => new Date(a.start_date) >= sevenDaysAgo);
  const last14Days = sortedActivities.filter(a => new Date(a.start_date) >= fourteenDaysAgo);
  const last28Days = sortedActivities.filter(a => new Date(a.start_date) >= twentyEightDaysAgo);
  const last42Days = sortedActivities.filter(a => new Date(a.start_date) >= fortyTwoDaysAgo);
  const runningLast7Days = runningActivities.filter(a => new Date(a.start_date) >= sevenDaysAgo);
  const runningLast14Days = runningActivities.filter(a => new Date(a.start_date) >= fourteenDaysAgo);
  const runningLast28Days = runningActivities.filter(a => new Date(a.start_date) >= twentyEightDaysAgo);
  const runningLast42Days = runningActivities.filter(a => new Date(a.start_date) >= fortyTwoDaysAgo);

  // Calcola chilometri totali per periodo
  const last7DaysKm = runningLast7Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last14DaysKm = runningLast14Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last28DaysKm = runningLast28Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);
  const last42DaysKm = runningLast42Days.reduce((sum, a) => sum + (a.distance_m / 1000), 0);

  // Conta corse per periodo
  const runsLast7Days = runningLast7Days.length;
  const runsLast14Days = runningLast14Days.length;
  const runsLast28Days = runningLast28Days.length;

  // Media settimanale negli ultimi 28 giorni
  const averageWeeklyKm28Days = last28DaysKm / 4; // 28 giorni = 4 settimane

  const runningLoad7d = last7Days.reduce((sum, activity) => isRunningActivity(activity) ? sum + estimateActivityLoad(activity) : sum, 0);
  const totalTrainingLoad7d = last7Days.reduce((sum, activity) => sum + estimateActivityLoad(activity), 0);
  const totalTrainingLoad42d = last42Days.reduce((sum, activity) => sum + estimateActivityLoad(activity), 0);
  const crossTrainingLoad7d = Math.max(0, totalTrainingLoad7d - runningLoad7d);
  const muscularStress7d = last7Days.reduce((sum, activity) => {
    const profile = getSportLoadProfile(activity);
    return sum + estimateActivityLoad(activity) * profile.muscularStress;
  }, 0);
  const recoveryActivities7d = last7Days.filter((activity) => getSportLoadProfile(activity).recoveryBonus > 0.08).length;
  const recentNonRunStress = last14Days
    .filter((activity) => !isRunningActivity(activity))
    .reduce((sum, activity) => {
      const daysAgo = Math.max(0, daysSinceInRome(activity.start_date, now));
      const recency = daysAgo <= 1 ? 1 : daysAgo <= 3 ? 0.55 : 0.25;
      const profile = getSportLoadProfile(activity);
      return sum + estimateActivityLoad(activity) * recency * (profile.muscularStress + profile.runningSpecificImpact) / 2;
    }, 0);

  // Acute/chronic load include multisport; running volume resta separato.
  const acuteLoad7d = totalTrainingLoad7d;
  const chronicLoad42d = totalTrainingLoad42d / 6;

  // Acute/Chronic ratio
  const acuteChronicRatio = chronicLoad42d > 0 ? acuteLoad7d / chronicLoad42d : null;

  // Giorni dall'ultima corsa
  const daysSinceLastRun = runningActivities.length > 0
    ? daysSinceInRome(runningActivities[0].start_date, now)
    : 999;

  // === CALCOLO READINESS SCORE ===
  const readinessData = calculateReadinessScore(daysSinceLastRun, acuteLoad7d, chronicLoad42d, runsLast14Days, averageWeeklyKm28Days, language, recentNonRunStress, recoveryActivities7d);
  const readinessScore = readinessData.score;
  const readinessLabel = readinessData.label;
  const readinessExplanation = readinessData.explanation;

  // === CALCOLO FATIGUE SCORE ===
  const fatigueData = calculateFatigueScore(acuteLoad7d, chronicLoad42d, runsLast7Days, daysSinceLastRun, language, crossTrainingLoad7d, muscularStress7d, recoveryActivities7d);
  const fatigueScore = fatigueData.score;
  const fatigueLabel = fatigueData.label;
  const fatigueExplanation = fatigueData.explanation;

  // === CALCOLO CONSISTENCY SCORE ===
  const consistencyData = calculateConsistencyScore(runningActivities, athleteSettings, language);
  const consistencyScore = consistencyData.score;
  const consistencyLabel = consistencyData.label;
  const consistencyExplanation = consistencyData.explanation;

  // === CALCOLO OVERLOAD RISK ===
  const overloadData = calculateOverloadRisk(acuteChronicRatio, acuteLoad7d, chronicLoad42d, runsLast7Days, averageWeeklyKm28Days, language, crossTrainingLoad7d, muscularStress7d, recoveryActivities7d);
  const overloadRisk = overloadData.risk;
  const overloadExplanation = overloadData.explanation;

  // === SUGGESTED FOCUS ===
  const suggestedFocus = getSuggestedFocus(consistencyScore, consistencyLabel, fatigueScore, overloadRisk, averageWeeklyKm28Days, daysSinceLastRun, language);

  // === WARNINGS ===
  const warnings = generateWarnings(overloadRisk, fatigueScore, consistencyScore, daysSinceLastRun, athleteSettings, language);

  return {
    // Dati grezzi
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
    daysSinceLastRun,
    totalTrainingLoad7d: Math.round(totalTrainingLoad7d * 10) / 10,
    runningLoad7d: Math.round(runningLoad7d * 10) / 10,
    crossTrainingLoad7d: Math.round(crossTrainingLoad7d * 10) / 10,
    muscularStress7d: Math.round(muscularStress7d * 10) / 10,
    recoveryActivities7d,

    // Metriche con spiegazioni
    readinessScore: Math.round(readinessScore),
    readinessLabel,
    readinessExplanation,
    fatigueScore: Math.round(fatigueScore),
    fatigueLabel,
    fatigueExplanation,
    consistencyScore: Math.round(consistencyScore),
    consistencyLabel,
    consistencyExplanation,
    overloadRisk,
    overloadExplanation,
    suggestedFocus,
    warnings,
  };
}

/**
 * Calcola Readiness Score - "quanto ha senso allenarsi oggi"
 */
function calculateReadinessScore(
  daysSinceLastRun: number,
  acuteLoad7d: number,
  chronicLoad42d: number,
  runsLast14Days: number,
  averageWeeklyKm: number,
  language: Language,
  recentNonRunStress = 0,
  recoveryActivities7d = 0
): { score: number; label: 'bassa' | 'moderata' | 'buona' | 'alta'; explanation: string } {
  const isEnglish = language === 'en';

  // Caso limite: nessuna attività recente
  if (daysSinceLastRun > 30) {
    return {
      score: 25,
      label: 'bassa',
      explanation: isEnglish
        ? 'No recent activity recorded - low readiness due to lack of consistency'
        : 'Nessuna attività recente registrata - readiness bassa per mancanza di continuità'
    };
  }

  let score = 60; // Base moderata
  const explanationParts: string[] = [];

  // 1. Giorni dall'ultima corsa
  if (daysSinceLastRun === 0) {
    score -= 15; // Corso oggi - possibile affaticamento
    explanationParts.push(isEnglish ? 'run completed today' : 'corsa effettuata oggi');
  } else if (daysSinceLastRun === 1) {
    score -= 10; // Corso ieri
    explanationParts.push(isEnglish ? 'run completed yesterday' : 'corsa effettuata ieri');
  } else if (daysSinceLastRun === 2) {
    score += 5; // Corso 2 giorni fa - buono
    explanationParts.push(isEnglish ? 'last run 2 days ago' : 'ultima corsa 2 giorni fa');
  } else if (daysSinceLastRun === 3) {
    score += 10; // Corso 3 giorni fa - ottimo
    explanationParts.push(isEnglish ? 'last run 3 days ago' : 'ultima corsa 3 giorni fa');
  } else if (daysSinceLastRun > 5) {
    score -= 20; // Pausa lunga - rischio scarico
    explanationParts.push(isEnglish ? `${daysSinceLastRun} days since last run` : `${daysSinceLastRun} giorni dall'ultima corsa`);
  } else {
    explanationParts.push(isEnglish ? `${daysSinceLastRun} days since last run` : `${daysSinceLastRun} giorni dall'ultima corsa`);
  }

  // 2. Carico recente vs media
  if (chronicLoad42d > 0) {
    const loadRatio = acuteLoad7d / chronicLoad42d;
    if (loadRatio > 1.3) {
      score -= 15; // Carico alto recente
      explanationParts.push(isEnglish ? 'elevated weekly load' : 'carico settimanale elevato');
    } else if (loadRatio < 0.7) {
      score += 5; // Carico basso - recupero
      explanationParts.push(isEnglish ? 'light week' : 'settimana leggera');
    }
  }

  if (recentNonRunStress >= 10) {
    score -= 15;
    explanationParts.push(isEnglish ? 'recent intense cross-training load' : 'carico cross-training intenso recente');
  } else if (recentNonRunStress >= 5) {
    score -= 8;
    explanationParts.push(isEnglish ? 'recent non-running muscular stress' : 'stress muscolare non-running recente');
  }

  if (recoveryActivities7d > 0 && recentNonRunStress < 5) {
    score += Math.min(6, recoveryActivities7d * 3);
    explanationParts.push(isEnglish ? 'active recovery logged' : 'recupero attivo registrato');
  }

  // 3. Continuità recente
  if (runsLast14Days < 2) {
    score -= 10; // Poca continuità
    explanationParts.push(isEnglish ? 'low consistency over the last 2 weeks' : 'continuità bassa nelle ultime 2 settimane');
  } else if (runsLast14Days >= 4) {
    score += 5; // Buona continuità
    explanationParts.push(isEnglish ? 'good recent consistency' : 'buona continuità recente');
  }

  // Clamp tra 25-95
  score = Math.max(25, Math.min(95, score));

  // Determina label
  let label: 'bassa' | 'moderata' | 'buona' | 'alta';
  if (score >= 75) label = 'alta';
  else if (score >= 60) label = 'buona';
  else if (score >= 40) label = 'moderata';
  else label = 'bassa';

  const labelText = isEnglish
    ? ({ bassa: 'low', moderata: 'moderate', buona: 'good', alta: 'high' } as const)[label]
    : label.toLowerCase();
  const explanation = `Readiness ${labelText} (${score}/100): ${explanationParts.join(', ')}`;

  return { score, label, explanation };
}

/**
 * Calcola Fatigue Score - "quanto il carico recente pesa rispetto alla tua abitudine"
 */
function calculateFatigueScore(
  acuteLoad7d: number,
  chronicLoad42d: number,
  runsLast7Days: number,
  daysSinceLastRun: number,
  language: Language,
  crossTrainingLoad7d = 0,
  muscularStress7d = 0,
  recoveryActivities7d = 0
): { score: number; label: 'bassa' | 'media' | 'alta'; explanation: string } {
  const isEnglish = language === 'en';

  // Caso limite: nessuna attività recente
  if (acuteLoad7d === 0 && chronicLoad42d === 0) {
    return {
      score: 5,
      label: 'bassa',
      explanation: isEnglish ? 'No recent activity - minimal fatigue' : 'Nessuna attività recente - fatica minima'
    };
  }

  let score = 20; // Base bassa
  const explanationParts: string[] = [];

  // 1. Acute/Chronic ratio (principale indicatore)
  if (chronicLoad42d > 0) {
    const ratio = acuteLoad7d / chronicLoad42d;
    if (ratio > 1.4) {
      score += 40; // Carico molto sopra media
      explanationParts.push(isEnglish ? `weekly load ${ratio.toFixed(1)}x average` : `carico settimanale ${ratio.toFixed(1)}x la media`);
    } else if (ratio > 1.2) {
      score += 25; // Carico sopra media
      explanationParts.push(isEnglish ? `weekly load ${ratio.toFixed(1)}x average` : `carico settimanale ${ratio.toFixed(1)}x la media`);
    } else if (ratio > 0.9) {
      score += 10; // Carico normale
      explanationParts.push(isEnglish ? 'weekly load within normal range' : 'carico settimanale nella norma');
    } else {
      score -= 5; // Carico sotto media
      explanationParts.push(isEnglish ? 'lighter week than average' : 'settimana leggera rispetto alla media');
    }
  } else {
    // Senza storico, basa su volume assoluto
    if (acuteLoad7d > 30) {
      score += 30;
      explanationParts.push(isEnglish ? `${acuteLoad7d.toFixed(1)}km this week` : `${acuteLoad7d.toFixed(1)}km questa settimana`);
    } else if (acuteLoad7d > 15) {
      score += 15;
      explanationParts.push(isEnglish ? `${acuteLoad7d.toFixed(1)}km this week` : `${acuteLoad7d.toFixed(1)}km questa settimana`);
    } else {
      explanationParts.push(isEnglish ? `${acuteLoad7d.toFixed(1)}km this week` : `${acuteLoad7d.toFixed(1)}km questa settimana`);
    }
  }

  // 2. Numero corse ravvicinate
  if (runsLast7Days >= 5) {
    score += 20; // Molte corse
    explanationParts.push(isEnglish ? `${runsLast7Days} runs this week` : `${runsLast7Days} corse questa settimana`);
  } else if (runsLast7Days >= 3) {
    score += 10; // Buone corse
    explanationParts.push(isEnglish ? `${runsLast7Days} runs this week` : `${runsLast7Days} corse questa settimana`);
  } else if (runsLast7Days === 0) {
    score -= 10; // Riposo
    explanationParts.push(isEnglish ? 'rest week' : 'settimana di riposo');
  }

  // 3. Corso nelle ultime 24h
  if (daysSinceLastRun === 0) {
    score += 15; // Affaticamento post-corsa
    explanationParts.push(isEnglish ? 'run in the last 24h' : 'corsa nelle ultime 24h');
  }

  if (crossTrainingLoad7d >= 15) {
    score += 18;
    explanationParts.push(isEnglish ? 'high cross-training load' : 'carico cross-training alto');
  } else if (crossTrainingLoad7d >= 7) {
    score += 10;
    explanationParts.push(isEnglish ? 'cross-training contributes to fatigue' : 'il cross-training contribuisce alla fatica');
  }

  if (muscularStress7d >= 14) {
    score += 12;
    explanationParts.push(isEnglish ? 'elevated muscular stress' : 'stress muscolare elevato');
  } else if (muscularStress7d >= 7) {
    score += 6;
    explanationParts.push(isEnglish ? 'moderate muscular stress' : 'stress muscolare moderato');
  }

  if (recoveryActivities7d > 0 && crossTrainingLoad7d < 7) {
    score -= Math.min(8, recoveryActivities7d * 4);
    explanationParts.push(isEnglish ? 'active recovery activity' : 'attività di recupero attivo');
  }

  // Clamp tra 5-90
  score = Math.max(5, Math.min(90, score));

  // Determina label
  let label: 'bassa' | 'media' | 'alta';
  if (score >= 60) label = 'alta';
  else if (score >= 35) label = 'media';
  else label = 'bassa';

  const labelText = isEnglish
    ? ({ bassa: 'low', media: 'medium', alta: 'high' } as const)[label]
    : label.toLowerCase();
  const explanation = `${isEnglish ? 'Fatigue' : 'Fatica'} ${labelText} (${score}/100): ${explanationParts.join(', ')}`;

  return { score, label, explanation };
}

/**
 * Calcola Consistency Score - "quanto sei regolare"
 */
function calculateConsistencyScore(
  activities: DBActivity[],
  athleteSettings: AthleteSettings | null,
  language: Language
): { score: number; label: 'in costruzione' | 'buona' | 'solida'; explanation: string } {
  const isEnglish = language === 'en';

  // Caso limite: nessuna attività
  if (activities.length === 0) {
    return {
      score: 10,
      label: 'in costruzione',
      explanation: isEnglish ? 'Consistency building: no runs recorded' : 'Consistency in costruzione: nessuna corsa registrata'
    };
  }

  const now = new Date();
  const targetRunsPerWeek = athleteSettings?.target_runs_per_week || 3;

  // Conta settimane attive nelle ultime 4 settimane
  let activeWeeks = 0;
  let totalRuns = 0;
  const weeklyRuns: number[] = [];

  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekActivities = activities.filter(a =>
      new Date(a.start_date) >= weekEnd && new Date(a.start_date) < weekStart
    );

    const runsThisWeek = weekActivities.length;
    weeklyRuns.push(runsThisWeek);
    totalRuns += runsThisWeek;

    if (runsThisWeek > 0) activeWeeks++;
  }

  // Calcola score basato su settimane attive e regolarità
  let score = 0;
  const explanationParts: string[] = [];

  // Base score da settimane attive
  if (activeWeeks >= 3) {
    score += 60; // Almeno 3 settimane su 4
    explanationParts.push(isEnglish ? `${activeWeeks}/4 active weeks` : `${activeWeeks}/4 settimane attive`);
  } else if (activeWeeks >= 2) {
    score += 40; // 2 settimane su 4
    explanationParts.push(isEnglish ? `${activeWeeks}/4 active weeks` : `${activeWeeks}/4 settimane attive`);
  } else if (activeWeeks >= 1) {
    score += 20; // 1 settimana su 4
    explanationParts.push(isEnglish ? `${activeWeeks}/4 active week` : `${activeWeeks}/4 settimane attiva`);
  } else {
    score += 10; // Nessuna settimana attiva nelle ultime 4
    explanationParts.push(isEnglish ? 'no active weeks in the last 4' : 'nessuna settimana attiva nelle ultime 4');
  }

  // Bonus per regolarità (tutte le settimane attive hanno corse simili)
  const avgRunsPerActiveWeek = activeWeeks > 0 ? totalRuns / activeWeeks : 0;
  const hasRegularActiveWeeks = activeWeeks > 0 && weeklyRuns.filter(r => r > 0).every(r =>
    Math.abs(r - avgRunsPerActiveWeek) <= 1
  );

  if (hasRegularActiveWeeks) {
    score += 20;
    explanationParts.push(isEnglish ? 'regular across active weeks' : 'regolare nelle settimane attive');
  }

  // Penalità se molto sotto target
  if (targetRunsPerWeek > 0 && avgRunsPerActiveWeek < targetRunsPerWeek * 0.5) {
    score -= 15;
    explanationParts.push(isEnglish
      ? `below target (${avgRunsPerActiveWeek.toFixed(1)} vs ${targetRunsPerWeek} runs/week)`
      : `sotto target (${avgRunsPerActiveWeek.toFixed(1)} vs ${targetRunsPerWeek} corse/settimana)`);
  }

  // Clamp tra 10-95
  score = Math.max(10, Math.min(95, score));

  // Determina label
  let label: 'in costruzione' | 'buona' | 'solida';
  if (score >= 70) label = 'solida';
  else if (score >= 40) label = 'buona';
  else label = 'in costruzione';

  const labelText = isEnglish
    ? ({ 'in costruzione': 'building', buona: 'good', solida: 'solid' } as const)[label]
    : label.toLowerCase();
  const explanation = `Consistency ${labelText} (${score}/100): ${explanationParts.join(', ')}`;

  return { score, label, explanation };
}

/**
 * Calcola Overload Risk - "rischio sovrallenamento"
 */
function calculateOverloadRisk(
  acuteChronicRatio: number | null,
  acuteLoad7d: number,
  chronicLoad42d: number,
  runsLast7Days: number,
  averageWeeklyKm: number,
  language: Language,
  crossTrainingLoad7d = 0,
  muscularStress7d = 0,
  recoveryActivities7d = 0
): { risk: 'basso' | 'medio' | 'alto'; explanation: string } {
  const isEnglish = language === 'en';

  let risk: 'basso' | 'medio' | 'alto' = 'basso';
  const explanationParts: string[] = [];

  // 1. Acute/Chronic ratio (principale)
  if (acuteChronicRatio !== null) {
    if (acuteChronicRatio > 1.4) {
      risk = 'alto';
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (${isEnglish ? 'very high' : 'molto alto'})`);
    } else if (acuteChronicRatio > 1.2) {
      risk = 'medio';
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (${isEnglish ? 'elevated' : 'elevato'})`);
    } else {
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (${isEnglish ? 'within range' : 'nella norma'})`);
    }
  } else {
    // Senza storico sufficiente, usa cautela
    if (acuteLoad7d > 40) {
      risk = 'medio';
      explanationParts.push(isEnglish
        ? `${acuteLoad7d.toFixed(1)}km this week without enough history`
        : `${acuteLoad7d.toFixed(1)}km questa settimana senza storico sufficiente`);
    } else {
      explanationParts.push(isEnglish ? 'limited history for precise evaluation' : 'storico limitato per valutazione precisa');
    }
  }

  // 2. Incremento volume vs media 28 giorni
  if (averageWeeklyKm > 0) {
    const weeklyIncrease = (acuteLoad7d - averageWeeklyKm) / averageWeeklyKm;
    if (weeklyIncrease > 0.3) {
      if (risk === 'basso') risk = 'medio';
      explanationParts.push(isEnglish
        ? `+${(weeklyIncrease * 100).toFixed(0)}% vs 4-week average`
        : `+${(weeklyIncrease * 100).toFixed(0)}% vs media 4 settimane`);
    }
  }

  // 3. Frequenza recente
  if (runsLast7Days >= 6) {
    if (risk === 'basso') risk = 'medio';
    explanationParts.push(isEnglish ? `${runsLast7Days} runs this week` : `${runsLast7Days} corse questa settimana`);
  }

  if (crossTrainingLoad7d >= 14 || muscularStress7d >= 14) {
    if (risk === 'basso') risk = 'medio';
    explanationParts.push(isEnglish ? 'multisport load adds overload risk' : 'il carico multisport aumenta il rischio overload');
  }

  if (risk === 'medio' && recoveryActivities7d > 0 && crossTrainingLoad7d < 6 && muscularStress7d < 6) {
    explanationParts.push(isEnglish ? 'active recovery offsets part of the load' : 'recupero attivo compensa parte del carico');
  }

  // 4. Prudenza per dati limitati
  if (chronicLoad42d === 0 && acuteLoad7d > 20) {
    if (risk === 'basso') risk = 'medio';
    explanationParts.push(isEnglish ? 'limited historical data - conservative evaluation' : 'dati storici limitati - valutazione prudente');
  }

  const riskText = isEnglish ? ({ basso: 'low', medio: 'medium', alto: 'high' } as const)[risk] : risk;
  const explanation = `${isEnglish ? 'Overload risk' : 'Rischio overload'} ${riskText}: ${explanationParts.join(', ')}`;

  return { risk, explanation };
}

/**
 * Determina il focus suggerito basato sulle nuove metriche
 */
function getSuggestedFocus(
  consistencyScore: number,
  consistencyLabel: string,
  fatigueScore: number,
  overloadRisk: string,
  averageWeeklyKm: number,
  daysSinceLastRun: number,
  language: Language
): string {
  const isEnglish = language === 'en';

  // Priorità: overload alto
  if (overloadRisk === 'alto') {
    return isEnglish ? 'reduce overload risk' : 'ridurre rischio sovraccarico';
  }

  // Priorità: fatigue alta
  if (fatigueScore >= 60) {
    return isEnglish ? 'recovery and consolidation' : 'recupero e consolidamento';
  }

  // Priorità: consistency bassa
  if (consistencyLabel === 'in costruzione' || consistencyScore < 40) {
    return isEnglish ? 'build consistency' : 'costruire continuità';
  }

  // Volume basso
  if (averageWeeklyKm < 15) {
    return isEnglish ? 'easy aerobic base' : 'base aerobica facile';
  }

  // Pausa lunga
  if (daysSinceLastRun > 5) {
    return isEnglish ? 'restore consistency' : 'ripristinare continuità';
  }

  // Tutto buono
  if (consistencyLabel === 'solida' && overloadRisk === 'basso' && fatigueScore < 35) {
    return isEnglish ? 'controlled progression' : 'progressione controllata';
  }

  // Default
  return isEnglish ? 'maintenance and recovery' : 'mantenimento e recupero';
}

/**
 * Genera warnings basati sui dati
 */
function generateWarnings(
  overloadRisk: string,
  fatigueScore: number,
  consistencyScore: number,
  daysSinceLastRun: number,
  athleteSettings: AthleteSettings | null,
  language: Language
): string[] {
  const isEnglish = language === 'en';
  const warnings: string[] = [];

  if (overloadRisk === 'alto') {
    warnings.push(isEnglish ? 'High overload risk - prioritize recovery and monitor fatigue signals' : 'Rischio sovrallenamento elevato - privilegia recupero e monitora segnali di fatica');
  } else if (overloadRisk === 'medio') {
    warnings.push(isEnglish ? 'Elevated load - monitor fatigue signals and consider extra recovery' : 'Carico elevato - monitora segnali di fatica e considera recupero aggiuntivo');
  }

  if (fatigueScore >= 60) {
    warnings.push(isEnglish ? 'High fatigue level - consider light training or rest' : 'Livello di fatica alto - considera allenamenti leggeri o pausa');
  }

  if (consistencyScore < 40) {
    warnings.push(isEnglish ? 'Irregular consistency - establish a weekly routine for better results' : 'Continuità irregolare - stabilisci routine settimanale per risultati migliori');
  }

  if (daysSinceLastRun > 7) {
    warnings.push(isEnglish ? 'Long break - return gradually to avoid injury' : 'Pausa prolungata - riprendi gradualmente per evitare infortuni');
  }

  if (athleteSettings?.injuries) {
    warnings.push(isEnglish ? 'Medical notes present - consult a professional before intense training' : 'Note mediche presenti - consulta professionista per allenamenti intensi');
  }

  return warnings;
}
