import { daysSinceInRome, isSameDayInRome } from './date-utils';

type OverloadRisk = 'basso' | 'medio' | 'alto' | 'dati insufficienti';

export interface DynamicAthleteTimelineItem {
  label: string;
  title: string;
  description: string;
  completed?: boolean;
}

export interface DynamicAthleteState {
  hasRunToday: boolean;
  daysSinceLatestRun: number | null;
  readinessScore: number | null;
  readinessLabel: string;
  fatigueScore: number | null;
  fatigueLabel: string;
  consistencyScore: number | null;
  consistencyLabel: string;
  overloadRisk: OverloadRisk;
  recoveryStatus: string;
  suggestedFocus: string;
  todayAction: string;
  tomorrowAction: string;
  nextAction: string;
  timeline: DynamicAthleteTimelineItem[];
  explanation: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatKm(meters: unknown): string {
  const value = asNumber(meters);
  if (!value || value <= 0) return 'corsa';
  return `${(value / 1000).toFixed(1)} km`;
}

function readinessLabel(score: number | null): string {
  if (score === null) return 'dati insufficienti';
  if (score >= 75) return 'buona';
  if (score >= 50) return 'moderata';
  return 'bassa';
}

function fatigueLabel(score: number | null): string {
  if (score === null) return 'dati insufficienti';
  if (score >= 60) return 'alta';
  if (score >= 35) return 'media';
  return 'bassa';
}

function consistencyLabel(score: number | null): string {
  if (score === null) return 'dati insufficienti';
  if (score >= 70) return 'solida';
  if (score >= 40) return 'buona';
  return 'in costruzione';
}

function normalizeRisk(value: unknown): OverloadRisk {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'basso' || normalized === 'medio' || normalized === 'alto') return normalized;
  return 'dati insufficienti';
}

function extractTechnicalFocus(report: any | null, metrics: any): string {
  const candidates = [
    report?.suggested_focus,
    report?.next_48h,
    Array.isArray(report?.weekly_plan) ? report.weekly_plan[0]?.description : null,
    Array.isArray(report?.weekly_plan) ? report.weekly_plan[0]?.name : null,
    metrics?.suggestedFocus,
  ];

  const focus = candidates.find((item) => typeof item === 'string' && item.trim().length > 0);
  if (focus) return focus.trim();

  return '30-40 minuti easy/recovery molto facile';
}

function calculateRecentVolume(recentRuns: any[]) {
  const last7DaysKm = asNumber(recentRuns?.[0]?.last7DaysKm) ?? null;
  if (last7DaysKm !== null) return last7DaysKm;

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return recentRuns
    .filter((run) => run?.start_date && now.getTime() - new Date(run.start_date).getTime() <= sevenDaysMs)
    .reduce((sum, run) => sum + ((asNumber(run.distance_m) ?? 0) / 1000), 0);
}

function calculateFatigue({
  latestReport,
  metrics,
  recentRuns,
  daysSinceLatestRun,
}: {
  latestReport: any | null;
  metrics: any;
  recentRuns: any[];
  daysSinceLatestRun: number | null;
}): number | null {
  const base = asNumber(latestReport?.fatigue_score) ?? asNumber(metrics?.fatigueScore);
  if (base === null) return null;

  const days = daysSinceLatestRun ?? 7;
  const recentVolumeKm = calculateRecentVolume(recentRuns);
  const chronicKm = asNumber(metrics?.chronicLoad42d) ?? asNumber(metrics?.averageWeeklyKm28Days) ?? 0;
  const highRecentVolume = chronicKm > 0 ? recentVolumeKm > chronicKm * 1.2 : recentVolumeKm >= 25;
  const decayMap = highRecentVolume ? [0, 10, 20, 30, 40] : [0, 15, 30, 40, 50];
  const decay = decayMap[Math.min(days, 4)] ?? decayMap[4];

  return Math.round(clamp(base - decay, 5, 90));
}

function calculateReadiness({
  fatigueScore,
  metrics,
  daysSinceLatestRun,
  overloadRisk,
}: {
  fatigueScore: number | null;
  metrics: any;
  daysSinceLatestRun: number | null;
  overloadRisk: OverloadRisk;
}): number | null {
  const metricBase = asNumber(metrics?.readinessScore);
  const days = daysSinceLatestRun;
  if (days === null && metricBase === null && fatigueScore === null) return null;

  let score = metricBase ?? 55;

  if (fatigueScore !== null) {
    score = 35 + (90 - fatigueScore) * 0.55;
  }

  if (days === 0) score -= 20;
  else if (days === 1) score = Math.min(score + 2, 65);
  else if (days === 2 || days === 3) score += 10;
  else if (days !== null && days > 5) score = Math.min(score, 62);

  if (overloadRisk === 'alto') score -= 15;
  if (overloadRisk === 'medio') score -= 6;

  return Math.round(clamp(score, 20, 90));
}

function calculateConsistency(metrics: any, recentRuns: any[], daysSinceLatestRun: number | null): number | null {
  const base = asNumber(metrics?.consistencyScore);
  if (base === null && (!recentRuns || recentRuns.length === 0)) return null;

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const activeWeeks = [0, 1, 2, 3].filter((index) => {
    const start = now.getTime() - (index + 1) * weekMs;
    const end = now.getTime() - index * weekMs;
    return recentRuns.some((run) => {
      const time = run?.start_date ? new Date(run.start_date).getTime() : 0;
      return time >= start && time < end;
    });
  }).length;

  let score = base ?? (activeWeeks * 18 + 10);
  if (activeWeeks < 3) score = Math.min(score, 82);
  if (activeWeeks < 2) score = Math.min(score, 64);
  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 7) score -= Math.min(18, daysSinceLatestRun - 6);

  return Math.round(clamp(score, 10, 95));
}

function calculateOverloadRisk({
  metrics,
  fatigueScore,
  daysSinceLatestRun,
  hasRunToday,
}: {
  metrics: any;
  fatigueScore: number | null;
  daysSinceLatestRun: number | null;
  hasRunToday: boolean;
}): OverloadRisk {
  const ratio = asNumber(metrics?.acuteChronicRatio);
  let risk = normalizeRisk(metrics?.overloadRisk);

  if (ratio !== null) {
    if (ratio > 1.4) risk = 'alto';
    else if (ratio > 1.2) risk = risk === 'alto' ? 'alto' : 'medio';
    else if (risk === 'dati insufficienti') risk = 'basso';
  }

  if (fatigueScore !== null && fatigueScore <= 35 && risk === 'alto') risk = 'medio';
  if (fatigueScore !== null && fatigueScore <= 30 && risk === 'medio') risk = 'basso';
  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 3 && risk === 'alto') risk = 'medio';
  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 4 && risk === 'medio' && (fatigueScore ?? 99) < 50) risk = 'basso';
  if (hasRunToday && (fatigueScore ?? 0) >= 60) risk = risk === 'alto' ? 'alto' : 'medio';

  return risk;
}

function buildActions(daysSinceLatestRun: number | null, hasRunToday: boolean, latestRun: any, focus: string) {
  const distance = formatKm(latestRun?.distance_m);
  const persistedFocus = focus.endsWith('.') ? focus : `${focus}.`;

  if (hasRunToday) {
    return {
      todayAction: `Corsa completata: ${distance}. Ora solo recupero leggero, mobilità o camminata facile.`,
      tomorrowAction: 'Recupero o riposo completo. Evita qualità.',
      nextAction: `Dopodomani: ${persistedFocus}`,
      timeline: [
        {
          label: 'Oggi',
          title: `Corsa completata: ${distance}`,
          description: 'Ora solo recupero leggero, mobilità o camminata facile.',
          completed: true,
        },
        {
          label: 'Domani',
          title: 'Recupero o riposo completo',
          description: 'Evita qualità e lascia scendere la fatica residua.',
        },
        {
          label: 'Dopodomani',
          title: 'Prossima seduta facile',
          description: persistedFocus,
        },
      ],
    };
  }

  if (daysSinceLatestRun === 1) {
    return {
      todayAction: 'Recupero o riposo consigliato.',
      tomorrowAction: `Easy run se le gambe sono fresche: ${persistedFocus}`,
      nextAction: 'Dopodomani valuta una progressione leggera solo se recupero e gambe sono buoni.',
      timeline: [
        { label: 'Oggi', title: 'Recupero consigliato', description: 'Riposo, mobilità o camminata facile.' },
        { label: 'Domani', title: 'Easy run se fresco', description: persistedFocus },
        { label: 'Dopodomani', title: 'Valuta progressione leggera', description: 'Solo se non senti fatica residua.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 2 && daysSinceLatestRun <= 3) {
    return {
      todayAction: `Puoi correre easy/recovery se ti senti fresco: ${persistedFocus}`,
      tomorrowAction: 'Recupero leggero.',
      nextAction: 'Dopodomani seconda easy run opzionale, senza qualità.',
      timeline: [
        { label: 'Oggi', title: 'Easy/recovery possibile', description: persistedFocus },
        { label: 'Domani', title: 'Recupero leggero', description: 'Mobilità, camminata o riposo.' },
        { label: 'Dopodomani', title: 'Seconda easy run opzionale', description: 'Mantieni intensità facile.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 4 && daysSinceLatestRun <= 6) {
    return {
      todayAction: `È consigliato tornare a correre con una easy run controllata: ${persistedFocus}`,
      tomorrowAction: 'Recupero.',
      nextAction: 'Dopodomani possibile seconda easy run se la prima è stata leggera.',
      timeline: [
        { label: 'Oggi', title: 'Torna a correre facile', description: persistedFocus },
        { label: 'Domani', title: 'Recupero', description: 'Lascia assorbire il rientro.' },
        { label: 'Dopodomani', title: 'Seconda easy run possibile', description: 'Solo facile e controllata.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 7) {
    return {
      todayAction: `Riparti facile: ${persistedFocus || "25-35 minuti easy senza qualità."}`,
      tomorrowAction: 'Recupero o camminata facile.',
      nextAction: 'Dopodomani valuta una seconda easy breve, senza qualità.',
      timeline: [
        { label: 'Oggi', title: 'Ripartenza facile', description: persistedFocus || "25-35 minuti easy senza qualità." },
        { label: 'Domani', title: 'Recupero', description: 'Niente qualità dopo una pausa lunga.' },
        { label: 'Dopodomani', title: 'Seconda easy breve opzionale', description: 'Decidi in base alle gambe.' },
      ],
    };
  }

  return {
    todayAction: 'Dati corsa insufficienti: resta su riposo attivo o camminata facile.',
    tomorrowAction: 'Sincronizza una corsa o mantieni attività leggera.',
    nextAction: 'Prossima corsa facile quando hai dati aggiornati.',
    timeline: [
      { label: 'Oggi', title: 'Recupero attivo', description: 'Camminata facile o mobilità.' },
      { label: 'Domani', title: 'Valuta dati', description: 'Sincronizza una nuova corsa se disponibile.' },
      { label: 'Prossima corsa', title: 'Easy run', description: 'Riparti senza qualità.' },
    ],
  };
}

export function buildDynamicAthleteState({
  latestRun,
  latestReport,
  recentRuns,
  metrics,
  rules,
  today = new Date(),
}: {
  latestRun: any;
  latestReport: any | null;
  recentRuns: any[];
  metrics: any;
  rules: any;
  today?: Date;
}): DynamicAthleteState {
  const daysSinceLatestRun = latestRun?.start_date ? daysSinceInRome(latestRun.start_date, today) : null;
  const hasRunToday = latestRun?.start_date ? isSameDayInRome(latestRun.start_date, today) : false;
  const suggestedFocus = extractTechnicalFocus(latestReport, metrics);
  const fatigueScore = calculateFatigue({ latestReport, metrics, recentRuns, daysSinceLatestRun });
  const overloadRisk = calculateOverloadRisk({ metrics, fatigueScore, daysSinceLatestRun, hasRunToday });
  const readinessScore = calculateReadiness({ fatigueScore, metrics, daysSinceLatestRun, overloadRisk });
  const consistencyScore = calculateConsistency(metrics, recentRuns, daysSinceLatestRun);
  const actions = buildActions(daysSinceLatestRun, hasRunToday, latestRun, suggestedFocus);

  const recoveryStatus = hasRunToday
    ? 'post-corsa'
    : daysSinceLatestRun === null
      ? 'dati insufficienti'
      : daysSinceLatestRun <= 1
        ? 'recupero'
        : daysSinceLatestRun <= 3
          ? 'pronto per facile'
          : 'rientro controllato';

  const explanationParts = [
    daysSinceLatestRun === null
      ? 'Non ci sono corse recenti sincronizzate.'
      : hasRunToday
        ? 'Hai già corso oggi, quindi il timing passa al recupero.'
        : `Ultima corsa ${daysSinceLatestRun} giorni fa: il timing del coach evolve senza aspettare una nuova sync.`,
    fatigueScore !== null
      ? `La fatica dinamica è ${fatigueScore}/100 dopo decadimento dal valore del report o dalle metriche.`
      : 'Fatica non disponibile: uso fallback prudente nelle azioni.',
    `Il focus tecnico resta: ${suggestedFocus}`,
  ];

  if (rules?.allowedIntensity) {
    explanationParts.push(`Intensità massima corrente: ${rules.allowedIntensity}.`);
  }

  return {
    hasRunToday,
    daysSinceLatestRun,
    readinessScore,
    readinessLabel: readinessLabel(readinessScore),
    fatigueScore,
    fatigueLabel: fatigueLabel(fatigueScore),
    consistencyScore,
    consistencyLabel: consistencyLabel(consistencyScore),
    overloadRisk,
    recoveryStatus,
    suggestedFocus,
    todayAction: actions.todayAction,
    tomorrowAction: actions.tomorrowAction,
    nextAction: actions.nextAction,
    timeline: actions.timeline,
    explanation: explanationParts.join(' '),
  };
}
