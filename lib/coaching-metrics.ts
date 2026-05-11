import { DBActivity } from './coach';
import { AthleteSettings } from './athlete-settings';
import { daysSinceInRome } from './date-utils';

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

  // Giorni dall'ultima corsa
  const daysSinceLastRun = activities.length > 0
    ? daysSinceInRome(activities[0].start_date, now)
    : 999;

  // === CALCOLO READINESS SCORE ===
  const readinessData = calculateReadinessScore(daysSinceLastRun, acuteLoad7d, chronicLoad42d, runsLast14Days, averageWeeklyKm28Days);
  const readinessScore = readinessData.score;
  const readinessLabel = readinessData.label;
  const readinessExplanation = readinessData.explanation;

  // === CALCOLO FATIGUE SCORE ===
  const fatigueData = calculateFatigueScore(acuteLoad7d, chronicLoad42d, runsLast7Days, daysSinceLastRun);
  const fatigueScore = fatigueData.score;
  const fatigueLabel = fatigueData.label;
  const fatigueExplanation = fatigueData.explanation;

  // === CALCOLO CONSISTENCY SCORE ===
  const consistencyData = calculateConsistencyScore(activities, athleteSettings);
  const consistencyScore = consistencyData.score;
  const consistencyLabel = consistencyData.label;
  const consistencyExplanation = consistencyData.explanation;

  // === CALCOLO OVERLOAD RISK ===
  const overloadData = calculateOverloadRisk(acuteChronicRatio, acuteLoad7d, chronicLoad42d, runsLast7Days, averageWeeklyKm28Days);
  const overloadRisk = overloadData.risk;
  const overloadExplanation = overloadData.explanation;

  // === SUGGESTED FOCUS ===
  const suggestedFocus = getSuggestedFocus(consistencyScore, consistencyLabel, fatigueScore, overloadRisk, averageWeeklyKm28Days, daysSinceLastRun);

  // === WARNINGS ===
  const warnings = generateWarnings(overloadRisk, fatigueScore, consistencyScore, daysSinceLastRun, athleteSettings);

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
  averageWeeklyKm: number
): { score: number; label: 'bassa' | 'moderata' | 'buona' | 'alta'; explanation: string } {

  // Caso limite: nessuna attività recente
  if (daysSinceLastRun > 30) {
    return {
      score: 25,
      label: 'bassa',
      explanation: 'Nessuna attività recente registrata - readiness bassa per mancanza di continuità'
    };
  }

  let score = 60; // Base moderata
  let explanationParts: string[] = [];

  // 1. Giorni dall'ultima corsa
  if (daysSinceLastRun === 0) {
    score -= 15; // Corso oggi - possibile affaticamento
    explanationParts.push('corsa effettuata oggi');
  } else if (daysSinceLastRun === 1) {
    score -= 10; // Corso ieri
    explanationParts.push('corsa effettuata ieri');
  } else if (daysSinceLastRun === 2) {
    score += 5; // Corso 2 giorni fa - buono
    explanationParts.push('ultima corsa 2 giorni fa');
  } else if (daysSinceLastRun === 3) {
    score += 10; // Corso 3 giorni fa - ottimo
    explanationParts.push('ultima corsa 3 giorni fa');
  } else if (daysSinceLastRun > 5) {
    score -= 20; // Pausa lunga - rischio scarico
    explanationParts.push(`${daysSinceLastRun} giorni dall'ultima corsa`);
  } else {
    explanationParts.push(`${daysSinceLastRun} giorni dall'ultima corsa`);
  }

  // 2. Carico recente vs media
  if (chronicLoad42d > 0) {
    const loadRatio = acuteLoad7d / chronicLoad42d;
    if (loadRatio > 1.3) {
      score -= 15; // Carico alto recente
      explanationParts.push('carico settimanale elevato');
    } else if (loadRatio < 0.7) {
      score += 5; // Carico basso - recupero
      explanationParts.push('settimana leggera');
    }
  }

  // 3. Continuità recente
  if (runsLast14Days < 2) {
    score -= 10; // Poca continuità
    explanationParts.push('continuità bassa nelle ultime 2 settimane');
  } else if (runsLast14Days >= 4) {
    score += 5; // Buona continuità
    explanationParts.push('buona continuità recente');
  }

  // Clamp tra 25-95
  score = Math.max(25, Math.min(95, score));

  // Determina label
  let label: 'bassa' | 'moderata' | 'buona' | 'alta';
  if (score >= 75) label = 'alta';
  else if (score >= 60) label = 'buona';
  else if (score >= 40) label = 'moderata';
  else label = 'bassa';

  const explanation = `Readiness ${label.toLowerCase()} (${score}/100): ${explanationParts.join(', ')}`;

  return { score, label, explanation };
}

/**
 * Calcola Fatigue Score - "quanto il carico recente pesa rispetto alla tua abitudine"
 */
function calculateFatigueScore(
  acuteLoad7d: number,
  chronicLoad42d: number,
  runsLast7Days: number,
  daysSinceLastRun: number
): { score: number; label: 'bassa' | 'media' | 'alta'; explanation: string } {

  // Caso limite: nessuna attività recente
  if (acuteLoad7d === 0 && chronicLoad42d === 0) {
    return {
      score: 5,
      label: 'bassa',
      explanation: 'Nessuna attività recente - fatica minima'
    };
  }

  let score = 20; // Base bassa
  let explanationParts: string[] = [];

  // 1. Acute/Chronic ratio (principale indicatore)
  if (chronicLoad42d > 0) {
    const ratio = acuteLoad7d / chronicLoad42d;
    if (ratio > 1.4) {
      score += 40; // Carico molto sopra media
      explanationParts.push(`carico settimanale ${ratio.toFixed(1)}x la media`);
    } else if (ratio > 1.2) {
      score += 25; // Carico sopra media
      explanationParts.push(`carico settimanale ${ratio.toFixed(1)}x la media`);
    } else if (ratio > 0.9) {
      score += 10; // Carico normale
      explanationParts.push('carico settimanale nella norma');
    } else {
      score -= 5; // Carico sotto media
      explanationParts.push('settimana leggera rispetto alla media');
    }
  } else {
    // Senza storico, basa su volume assoluto
    if (acuteLoad7d > 30) {
      score += 30;
      explanationParts.push(`${acuteLoad7d.toFixed(1)}km questa settimana`);
    } else if (acuteLoad7d > 15) {
      score += 15;
      explanationParts.push(`${acuteLoad7d.toFixed(1)}km questa settimana`);
    } else {
      explanationParts.push(`${acuteLoad7d.toFixed(1)}km questa settimana`);
    }
  }

  // 2. Numero corse ravvicinate
  if (runsLast7Days >= 5) {
    score += 20; // Molte corse
    explanationParts.push(`${runsLast7Days} corse questa settimana`);
  } else if (runsLast7Days >= 3) {
    score += 10; // Buone corse
    explanationParts.push(`${runsLast7Days} corse questa settimana`);
  } else if (runsLast7Days === 0) {
    score -= 10; // Riposo
    explanationParts.push('settimana di riposo');
  }

  // 3. Corso nelle ultime 24h
  if (daysSinceLastRun === 0) {
    score += 15; // Affaticamento post-corsa
    explanationParts.push('corsa nelle ultime 24h');
  }

  // Clamp tra 5-90
  score = Math.max(5, Math.min(90, score));

  // Determina label
  let label: 'bassa' | 'media' | 'alta';
  if (score >= 60) label = 'alta';
  else if (score >= 35) label = 'media';
  else label = 'bassa';

  const explanation = `Fatica ${label.toLowerCase()} (${score}/100): ${explanationParts.join(', ')}`;

  return { score, label, explanation };
}

/**
 * Calcola Consistency Score - "quanto sei regolare"
 */
function calculateConsistencyScore(
  activities: DBActivity[],
  athleteSettings: AthleteSettings | null
): { score: number; label: 'in costruzione' | 'buona' | 'solida'; explanation: string } {

  // Caso limite: nessuna attività
  if (activities.length === 0) {
    return {
      score: 10,
      label: 'in costruzione',
      explanation: 'Consistency in costruzione: nessuna corsa registrata'
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
  let explanationParts: string[] = [];

  // Base score da settimane attive
  if (activeWeeks >= 3) {
    score += 60; // Almeno 3 settimane su 4
    explanationParts.push(`${activeWeeks}/4 settimane attive`);
  } else if (activeWeeks >= 2) {
    score += 40; // 2 settimane su 4
    explanationParts.push(`${activeWeeks}/4 settimane attive`);
  } else if (activeWeeks >= 1) {
    score += 20; // 1 settimana su 4
    explanationParts.push(`${activeWeeks}/4 settimane attiva`);
  } else {
    score += 10; // Nessuna settimana attiva nelle ultime 4
    explanationParts.push('nessuna settimana attiva nelle ultime 4');
  }

  // Bonus per regolarità (tutte le settimane attive hanno corse simili)
  const avgRunsPerActiveWeek = activeWeeks > 0 ? totalRuns / activeWeeks : 0;
  const hasRegularActiveWeeks = activeWeeks > 0 && weeklyRuns.filter(r => r > 0).every(r =>
    Math.abs(r - avgRunsPerActiveWeek) <= 1
  );

  if (hasRegularActiveWeeks) {
    score += 20;
    explanationParts.push('regolare nelle settimane attive');
  }

  // Penalità se molto sotto target
  if (targetRunsPerWeek > 0 && avgRunsPerActiveWeek < targetRunsPerWeek * 0.5) {
    score -= 15;
    explanationParts.push(`sotto target (${avgRunsPerActiveWeek.toFixed(1)} vs ${targetRunsPerWeek} corse/settimana)`);
  }

  // Clamp tra 10-95
  score = Math.max(10, Math.min(95, score));

  // Determina label
  let label: 'in costruzione' | 'buona' | 'solida';
  if (score >= 70) label = 'solida';
  else if (score >= 40) label = 'buona';
  else label = 'in costruzione';

  const explanation = `Consistency ${label.toLowerCase()} (${score}/100): ${explanationParts.join(', ')}`;

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
  averageWeeklyKm: number
): { risk: 'basso' | 'medio' | 'alto'; explanation: string } {

  let risk: 'basso' | 'medio' | 'alto' = 'basso';
  let explanationParts: string[] = [];

  // 1. Acute/Chronic ratio (principale)
  if (acuteChronicRatio !== null) {
    if (acuteChronicRatio > 1.4) {
      risk = 'alto';
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (molto alto)`);
    } else if (acuteChronicRatio > 1.2) {
      risk = 'medio';
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (elevato)`);
    } else {
      explanationParts.push(`acute/chronic ratio ${acuteChronicRatio.toFixed(1)} (nella norma)`);
    }
  } else {
    // Senza storico sufficiente, usa cautela
    if (acuteLoad7d > 40) {
      risk = 'medio';
      explanationParts.push(`${acuteLoad7d.toFixed(1)}km questa settimana senza storico sufficiente`);
    } else {
      explanationParts.push('storico limitato per valutazione precisa');
    }
  }

  // 2. Incremento volume vs media 28 giorni
  if (averageWeeklyKm > 0) {
    const weeklyIncrease = (acuteLoad7d - averageWeeklyKm) / averageWeeklyKm;
    if (weeklyIncrease > 0.3) {
      if (risk === 'basso') risk = 'medio';
      explanationParts.push(`+${(weeklyIncrease * 100).toFixed(0)}% vs media 4 settimane`);
    }
  }

  // 3. Frequenza recente
  if (runsLast7Days >= 6) {
    if (risk === 'basso') risk = 'medio';
    explanationParts.push(`${runsLast7Days} corse questa settimana`);
  }

  // 4. Prudenza per dati limitati
  if (chronicLoad42d === 0 && acuteLoad7d > 20) {
    if (risk === 'basso') risk = 'medio';
    explanationParts.push('dati storici limitati - valutazione prudente');
  }

  const explanation = `Rischio overload ${risk}: ${explanationParts.join(', ')}`;

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
  daysSinceLastRun: number
): string {

  // Priorità: overload alto
  if (overloadRisk === 'alto') {
    return 'ridurre rischio sovraccarico';
  }

  // Priorità: fatigue alta
  if (fatigueScore >= 60) {
    return 'recupero e consolidamento';
  }

  // Priorità: consistency bassa
  if (consistencyLabel === 'in costruzione' || consistencyScore < 40) {
    return 'costruire continuità';
  }

  // Volume basso
  if (averageWeeklyKm < 15) {
    return 'base aerobica facile';
  }

  // Pausa lunga
  if (daysSinceLastRun > 5) {
    return 'ripristinare continuità';
  }

  // Tutto buono
  if (consistencyLabel === 'solida' && overloadRisk === 'basso' && fatigueScore < 35) {
    return 'progressione controllata';
  }

  // Default
  return 'mantenimento e recupero';
}

/**
 * Genera warnings basati sui dati
 */
function generateWarnings(
  overloadRisk: string,
  fatigueScore: number,
  consistencyScore: number,
  daysSinceLastRun: number,
  athleteSettings: AthleteSettings | null
): string[] {
  const warnings: string[] = [];

  if (overloadRisk === 'alto') {
    warnings.push('Rischio sovrallenamento elevato - privilegia recupero e monitora segnali di fatica');
  } else if (overloadRisk === 'medio') {
    warnings.push('Carico elevato - monitora segnali di fatica e considera recupero aggiuntivo');
  }

  if (fatigueScore >= 60) {
    warnings.push('Livello di fatica alto - considera allenamenti leggeri o pausa');
  }

  if (consistencyScore < 40) {
    warnings.push('Continuità irregolare - stabilisci routine settimanale per risultati migliori');
  }

  if (daysSinceLastRun > 7) {
    warnings.push('Pausa prolungata - riprendi gradualmente per evitare infortuni');
  }

  if (athleteSettings?.injuries) {
    warnings.push('Note mediche presenti - consulta professionista per allenamenti intensi');
  }

  return warnings;
}
