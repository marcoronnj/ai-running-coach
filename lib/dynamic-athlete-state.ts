import { daysSinceInRome, isSameDayInRome } from './date-utils';
import { normalizeLanguage, type Language } from './i18n';
import { type RecoveryTimelineItem } from './recovery-timeline';
import { estimateActivityLoad, getSportLoadProfile, isRunningActivity } from './sport-classification';

type OverloadRisk = 'basso' | 'medio' | 'alto' | 'dati insufficienti';

export type DynamicAthleteTimelineItem = RecoveryTimelineItem;

export interface DynamicAthleteState {
  hasRunToday: boolean;
  hasAnyActivityToday: boolean;
  latestTodayActivity: any | null;
  todayNonRunActivities: any[];
  todayLoadSummary: string | null;
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
  if (!value || value <= 0) return '';
  return `${(value / 1000).toFixed(1)} km`;
}

function readinessLabel(score: number | null, language: Language): string {
  if (score === null) return language === 'en' ? 'insufficient data' : 'dati insufficienti';
  if (language === 'en') {
    if (score >= 75) return 'good';
    if (score >= 50) return 'moderate';
    return 'low';
  }
  if (score >= 75) return 'buona';
  if (score >= 50) return 'moderata';
  return 'bassa';
}

function fatigueLabel(score: number | null, language: Language): string {
  if (score === null) return language === 'en' ? 'insufficient data' : 'dati insufficienti';
  if (language === 'en') {
    if (score >= 60) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }
  if (score >= 60) return 'alta';
  if (score >= 35) return 'media';
  return 'bassa';
}

function consistencyLabel(score: number | null, language: Language): string {
  if (score === null) return language === 'en' ? 'insufficient data' : 'dati insufficienti';
  if (language === 'en') {
    if (score >= 70) return 'solid';
    if (score >= 40) return 'good';
    return 'building';
  }
  if (score >= 70) return 'solida';
  if (score >= 40) return 'buona';
  return 'in costruzione';
}

function normalizeRisk(value: unknown): OverloadRisk {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'basso' || normalized === 'medio' || normalized === 'alto') return normalized;
  return 'dati insufficienti';
}

function extractTechnicalFocus(report: any | null, metrics: any, language: Language): string {
  if (language === 'en') {
    return '30-40 minutes easy/recovery, low HR / Z2, conversational pace, finish with light mobility.';
  }

  const candidates = [
    report?.suggested_focus,
    Array.isArray(report?.weekly_plan) ? report.weekly_plan[0]?.description : null,
    Array.isArray(report?.weekly_plan) ? report.weekly_plan[0]?.name : null,
    metrics?.suggestedFocus,
  ];

  const focus = candidates.find((item) => typeof item === 'string' && item.trim().length > 0);
  if (focus) return normalizeTechnicalFocus(focus.trim());

  return '30-40 minuti easy in Z2 bassa, respirazione facile, chiusura con mobilità leggera.';
}

function normalizeTechnicalFocus(focus: string): string {
  const normalized = focus.toLowerCase();

  if (
    normalized.includes('mantenimento') ||
    normalized.includes('recupero attivo') ||
    normalized.includes('recupero e mobilità')
  ) {
    return '30-40 minuti recovery molto facile, FC bassa/Z2, oppure camminata facile e mobilità leggera.';
  }

  if (normalized.includes('easy') || normalized.includes('facile')) {
    return focus.includes('Z2') || focus.includes('FC')
      ? focus
      : `${focus.replace(/\.$/, '')}, tenendo FC bassa/Z2 e passo conversazionale.`;
  }

  return focus;
}

function calculateRecentVolume(recentRuns: any[]) {
  const last7DaysKm = asNumber(recentRuns?.[0]?.last7DaysKm) ?? null;
  if (last7DaysKm !== null) return last7DaysKm;

  const now = new Date();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return recentRuns
    .filter(isRunningActivity)
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
  const runsOnly = (recentRuns || []).filter(isRunningActivity);
  const base = asNumber(metrics?.consistencyScore);
  if (base === null && runsOnly.length === 0) return null;

  const now = new Date();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const activeWeeks = [0, 1, 2, 3].filter((index) => {
    const start = now.getTime() - (index + 1) * weekMs;
    const end = now.getTime() - index * weekMs;
    return runsOnly.some((run) => {
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

function getActivityName(activity: any): string {
  const profile = getSportLoadProfile(activity);
  return activity?.name || activity?.title || activity?.sport_type || activity?.type || profile.sportType;
}

function sortActivitiesByLoadDesc(activities: any[]): any[] {
  return [...activities].sort((a, b) => estimateActivityLoad(b) - estimateActivityLoad(a));
}

function buildTodayLoadSummary(todayActivities: any[], language: Language): string | null {
  if (todayActivities.length === 0) return null;

  const sorted = sortActivitiesByLoadDesc(todayActivities);
  const main = sorted[0];
  const mainName = getActivityName(main);
  const otherCount = sorted.length - 1;

  if (otherCount <= 0) {
    return language === 'en'
      ? `Today's main activity: ${mainName}.`
      : `Attività principale di oggi: ${mainName}.`;
  }

  return language === 'en'
    ? `Activities completed today: ${mainName} + ${otherCount} more.`
    : `Attività completate oggi: ${mainName} + altre ${otherCount}.`;
}

function buildCompletedTodayActions({
  latestTodayActivity,
  todayActivities,
  fatigueScore,
  language,
}: {
  latestTodayActivity: any;
  todayActivities: any[];
  fatigueScore: number | null;
  language: Language;
}) {
  const main = latestTodayActivity;
  const profile = getSportLoadProfile(main);
  const isRun = isRunningActivity(main);
  const name = getActivityName(main);
  const otherCount = Math.max(0, todayActivities.length - 1);
  const highLoad = profile.fatigueImpact >= 0.75 || profile.muscularStress >= 0.75 || (fatigueScore ?? 0) >= 60;
  const isWorkout = profile.sportCategory === 'strength';
  const title = language === 'en'
    ? otherCount > 0
      ? `Activities completed today: ${name} + ${otherCount} more`
      : isRun
        ? `Run completed: ${formatKm(main.distance_m) || name}`
        : isWorkout
          ? `Workout completed: ${name}`
          : `Activity completed: ${name}`
    : otherCount > 0
      ? `Attività completate oggi: ${name} + altre ${otherCount}`
      : isRun
        ? `Corsa completata: ${formatKm(main.distance_m) || name}`
        : isWorkout
          ? `Workout completato: ${name}`
          : `Attività completata: ${name}`;

  if (language === 'en') {
    const todayAction = isRun
      ? `${title}. Now only light recovery, mobility or an easy walk.`
      : `${title}. Load included in recovery; keep the rest of the day light.`;

    return {
      todayAction,
      tomorrowAction: highLoad
        ? 'Recovery or full rest. If fatigue drops, only very easy Z1/Z2.'
        : 'Recovery or an easy run only if legs feel fresh.',
      nextAction: 'Day after tomorrow: cautious easy run if legs and sleep are good.',
      timeline: [
        {
          label: 'Today',
          title,
          description: isRun
            ? 'Only light recovery, mobility or an easy walk now.'
            : 'Load included in recovery. Avoid adding running quality today.',
          completed: true,
        },
        {
          label: 'Tomorrow',
          title: highLoad ? 'Recovery or full rest' : 'Recovery bias',
          description: highLoad
            ? 'Rest, mobility, walking or very easy Z1/Z2 if fatigue drops.'
            : 'Easy/recovery only if legs are fresh.',
        },
        {
          label: 'Day after tomorrow',
          title: 'Cautious easy run',
          description: '30-40 minutes in low Z2 only if recovered.',
        },
      ],
    };
  }

  const todayAction = isRun
    ? `${title}. Ora solo recupero leggero, mobilità o camminata facile.`
    : `${title}. Carico considerato nel recupero; mantieni leggero il resto della giornata.`;

  return {
    todayAction,
    tomorrowAction: highLoad
      ? 'Recupero o riposo completo. Se la fatica scende, solo Z1/Z2 molto facile.'
      : 'Recupero o easy run solo se le gambe sono fresche.',
    nextAction: 'Dopodomani: easy run prudente se gambe e sonno sono buoni.',
    timeline: [
      {
        label: 'Oggi',
        title,
        description: isRun
          ? 'Ora solo recupero leggero, mobilità o camminata facile.'
          : 'Carico considerato nel recupero. Evita qualità nella corsa oggi.',
        completed: true,
      },
      {
        label: 'Domani',
        title: highLoad ? 'Recupero o riposo completo' : 'Priorità recupero',
        description: highLoad
          ? 'Riposo, mobilità, camminata o Z1/Z2 molto facile se la fatica scende.'
          : 'Solo facile/recovery se le gambe sono fresche.',
      },
      {
        label: 'Dopodomani',
        title: 'Easy run prudente',
        description: '30-40 minuti in Z2 bassa solo se recuperato.',
      },
    ],
  };
}

function buildActions({
  daysSinceLatestRun,
  hasRunToday,
  hasAnyActivityToday,
  latestTodayActivity,
  todayActivities,
  latestRun,
  focus,
  readinessScore,
  fatigueScore,
  overloadRisk,
  rules,
  language,
}: {
  daysSinceLatestRun: number | null;
  hasRunToday: boolean;
  hasAnyActivityToday: boolean;
  latestTodayActivity?: any | null;
  todayActivities: any[];
  latestRun: any;
  focus: string;
  readinessScore: number | null;
  fatigueScore: number | null;
  overloadRisk: OverloadRisk;
  rules: any;
  language: Language;
}) {
  if (hasAnyActivityToday && latestTodayActivity) {
    return buildCompletedTodayActions({
      latestTodayActivity,
      todayActivities,
      fatigueScore,
      language,
    });
  }

  const distance = formatKm(latestRun?.distance_m) || (language === 'en' ? 'run' : 'corsa');
  const persistedFocus = focus.endsWith('.') ? focus : `${focus}.`;
  const forcedRecovery =
    overloadRisk === 'alto' ||
    (fatigueScore !== null && fatigueScore >= 60) ||
    (readinessScore !== null && readinessScore < 40) ||
    rules?.allowedIntensity === 'recovery';

  if (hasRunToday) {
    if (language === 'en') {
      return {
        todayAction: `Run completed: ${distance}. Now only light recovery, mobility or an easy walk.`,
        tomorrowAction: 'Recovery or full rest. Avoid quality work.',
        nextAction: 'Day after tomorrow: 30-40 minutes very easy recovery, low HR/Z2, only if your legs feel fresh.',
        timeline: [
          { label: 'Today', title: `Run completed: ${distance}`, description: 'Only light recovery, mobility or an easy walk now.', completed: true },
          { label: 'Tomorrow', title: 'Recovery or full rest', description: 'Avoid quality and let residual fatigue come down.' },
          { label: 'Day after tomorrow', title: 'Optional recovery run', description: '30-40 minutes very easy, low HR/Z2, no progressions.' },
        ],
      };
    }
    return {
      todayAction: `Corsa completata: ${distance}. Ora solo recupero leggero, mobilità o camminata facile.`,
      tomorrowAction: 'Recupero o riposo completo. Evita qualità.',
      nextAction: `Dopodomani: 30-40 minuti recovery molto facile, FC bassa/Z2, solo se le gambe sono fresche.`,
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
          title: 'Recovery run opzionale',
          description: '30-40 minuti molto facili, FC bassa/Z2, senza progressioni.',
        },
      ],
    };
  }

  if (forcedRecovery) {
    const reason = overloadRisk === 'alto'
      ? 'rischio overload alto'
      : fatigueScore !== null && fatigueScore >= 60
        ? `fatigue alta (${fatigueScore}/100)`
        : readinessScore !== null && readinessScore < 40
          ? `readiness bassa (${readinessScore}/100)`
          : 'intensità limitata a recovery';

    if (language === 'en') {
      const enReason = overloadRisk === 'alto'
        ? 'high overload risk'
        : fatigueScore !== null && fatigueScore >= 60
          ? `high fatigue (${fatigueScore}/100)`
          : readinessScore !== null && readinessScore < 40
            ? `low readiness (${readinessScore}/100)`
            : 'intensity limited to recovery';

      return {
        todayAction: `Recovery today: rest, 20-30 minutes easy walking, or mobility. Reason: ${enReason}.`,
        tomorrowAction: 'If fatigue drops: 25-35 minutes very easy recovery in low Z1/Z2. Otherwise rest.',
        nextAction: 'Day after tomorrow, restart with a 30-40 minute easy run only if legs and sleep are good.',
        timeline: [
          { label: 'Today', title: 'Recovery needed', description: `Rest or easy walking. ${enReason}.` },
          { label: 'Tomorrow', title: 'Optional recovery', description: '25-35 minutes very easy, low HR, no quality.' },
          { label: 'Day after tomorrow', title: 'Cautious easy run', description: '30-40 minutes in low Z2 only if recovered.' },
        ],
      };
    }

    return {
      todayAction: `Recupero oggi: riposo, camminata facile 20-30 minuti o mobilità. Motivo: ${reason}.`,
      tomorrowAction: 'Se la fatica scende: 25-35 minuti recovery molto facile in Z1/Z2 bassa. Altrimenti riposo.',
      nextAction: 'Dopodomani riparti con easy run 30-40 minuti solo se gambe e sonno sono buoni.',
      timeline: [
        { label: 'Oggi', title: 'Recupero necessario', description: `Riposo o camminata facile. ${reason}.` },
        { label: 'Domani', title: 'Recovery opzionale', description: '25-35 minuti molto facili, FC bassa, niente qualità.' },
        { label: 'Dopodomani', title: 'Easy run prudente', description: '30-40 minuti in Z2 bassa solo se recuperato.' },
      ],
    };
  }

  if (daysSinceLatestRun === 1) {
    if (language === 'en') {
      return {
        todayAction: 'Recovery today: rest, light mobility, or 20-30 minutes easy walking.',
        tomorrowAction: `Easy run if legs feel fresh: ${persistedFocus}`,
        nextAction: 'Day after tomorrow, consider a light progression only if recovery and legs are good.',
        timeline: [
          { label: 'Today', title: 'Recovery recommended', description: 'Rest, light mobility, or 20-30 minutes easy walking.' },
          { label: 'Tomorrow', title: 'Easy run if fresh', description: persistedFocus },
          { label: 'Day after tomorrow', title: 'Consider light progression', description: 'Only if you feel no residual fatigue.' },
        ],
      };
    }
    return {
      todayAction: 'Recupero oggi: riposo, mobilità leggera o camminata facile 20-30 minuti.',
      tomorrowAction: `Easy run se le gambe sono fresche: ${persistedFocus}`,
      nextAction: 'Dopodomani valuta una progressione leggera solo se recupero e gambe sono buoni.',
      timeline: [
        { label: 'Oggi', title: 'Recupero consigliato', description: 'Riposo, mobilità leggera o camminata facile 20-30 minuti.' },
        { label: 'Domani', title: 'Easy run se fresco', description: persistedFocus },
        { label: 'Dopodomani', title: 'Valuta progressione leggera', description: 'Solo se non senti fatica residua.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 2 && daysSinceLatestRun <= 3) {
    if (language === 'en') {
      return {
        todayAction: `You can run easy/recovery if you feel fresh: ${persistedFocus}`,
        tomorrowAction: 'Light recovery: mobility, easy walking, or rest.',
        nextAction: 'Day after tomorrow, optional second easy run, no quality.',
        timeline: [
          { label: 'Today', title: 'Easy/recovery possible', description: persistedFocus },
          { label: 'Tomorrow', title: 'Light recovery', description: 'Mobility, walking, or rest.' },
          { label: 'Day after tomorrow', title: 'Optional second easy run', description: 'Keep intensity easy.' },
        ],
      };
    }
    return {
      todayAction: `Puoi correre easy/recovery se ti senti fresco: ${persistedFocus}`,
      tomorrowAction: 'Recupero leggero: mobilità, camminata facile o riposo.',
      nextAction: 'Dopodomani seconda easy run opzionale, senza qualità.',
      timeline: [
        { label: 'Oggi', title: 'Easy/recovery possibile', description: persistedFocus },
        { label: 'Domani', title: 'Recupero leggero', description: 'Mobilità, camminata o riposo.' },
        { label: 'Dopodomani', title: 'Seconda easy run opzionale', description: 'Mantieni intensità facile.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 4 && daysSinceLatestRun <= 6) {
    if (language === 'en') {
      return {
        todayAction: `It is a good time to return with a controlled easy run: ${persistedFocus}`,
        tomorrowAction: 'Recovery: easy walking, mobility, or rest.',
        nextAction: 'Day after tomorrow, possible second easy run if the first one was light.',
        timeline: [
          { label: 'Today', title: 'Return with easy running', description: persistedFocus },
          { label: 'Tomorrow', title: 'Recovery', description: 'Easy walking or mobility: absorb the return.' },
          { label: 'Day after tomorrow', title: 'Second easy run possible', description: 'Easy and controlled only, low HR/Z2.' },
        ],
      };
    }
    return {
      todayAction: `È consigliato tornare a correre con una easy run controllata: ${persistedFocus}`,
      tomorrowAction: 'Recupero: camminata facile, mobilità o riposo.',
      nextAction: 'Dopodomani possibile seconda easy run se la prima è stata leggera.',
      timeline: [
        { label: 'Oggi', title: 'Torna a correre facile', description: persistedFocus },
        { label: 'Domani', title: 'Recupero', description: 'Camminata facile o mobilità: lascia assorbire il rientro.' },
        { label: 'Dopodomani', title: 'Seconda easy run possibile', description: 'Solo facile e controllata, FC bassa/Z2.' },
      ],
    };
  }

  if (daysSinceLatestRun !== null && daysSinceLatestRun >= 7) {
    if (language === 'en') {
      return {
        todayAction: `Restart easy: ${persistedFocus || '25-35 minutes easy, no quality, low HR/Z2.'}`,
        tomorrowAction: 'Recovery or easy walking.',
        nextAction: 'Day after tomorrow, consider a second short easy run, no quality.',
        timeline: [
          { label: 'Today', title: 'Easy restart', description: persistedFocus || '25-35 minutes easy, no quality, low HR/Z2.' },
          { label: 'Tomorrow', title: 'Recovery', description: 'No quality after a long break.' },
          { label: 'Day after tomorrow', title: 'Optional short easy run', description: 'Decide based on your legs.' },
        ],
      };
    }
    return {
      todayAction: `Riparti facile: ${persistedFocus || '25-35 minuti easy senza qualità, FC bassa/Z2.'}`,
      tomorrowAction: 'Recupero o camminata facile.',
      nextAction: 'Dopodomani valuta una seconda easy breve, senza qualità.',
      timeline: [
        { label: 'Oggi', title: 'Ripartenza facile', description: persistedFocus || '25-35 minuti easy senza qualità, FC bassa/Z2.' },
        { label: 'Domani', title: 'Recupero', description: 'Niente qualità dopo una pausa lunga.' },
        { label: 'Dopodomani', title: 'Seconda easy breve opzionale', description: 'Decidi in base alle gambe.' },
      ],
    };
  }

  if (language === 'en') {
    return {
      todayAction: 'Insufficient run data: stay with active recovery or easy walking.',
      tomorrowAction: 'Sync a run or keep activity light.',
      nextAction: 'Next run should be easy when updated data is available.',
      timeline: [
        { label: 'Today', title: 'Active recovery', description: '20-30 minutes easy walking or light mobility.' },
        { label: 'Tomorrow', title: 'Check data', description: 'Sync a new run if available.' },
        { label: 'Day after tomorrow', title: 'Easy run', description: 'Restart without quality, low HR/Z2.' },
      ],
    };
  }

  return {
    todayAction: 'Dati corsa insufficienti: resta su riposo attivo o camminata facile.',
    tomorrowAction: 'Sincronizza una corsa o mantieni attività leggera.',
    nextAction: 'Prossima corsa facile quando hai dati aggiornati.',
    timeline: [
      { label: 'Oggi', title: 'Recupero attivo', description: 'Camminata facile 20-30 minuti o mobilità leggera.' },
      { label: 'Domani', title: 'Valuta dati', description: 'Sincronizza una nuova corsa se disponibile.' },
      { label: 'Dopodomani', title: 'Easy run', description: 'Riparti senza qualità, FC bassa/Z2.' },
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
  language = 'it',
}: {
  latestRun: any;
  latestReport: any | null;
  recentRuns: any[];
  metrics: any;
  rules: any;
  today?: Date;
  language?: Language;
}): DynamicAthleteState {
  const currentLanguage = normalizeLanguage(language);
  const daysSinceLatestRun = latestRun?.start_date ? daysSinceInRome(latestRun.start_date, today) : null;
  const todayActivities = sortActivitiesByLoadDesc(
    (recentRuns || []).filter((activity) => activity?.start_date && isSameDayInRome(activity.start_date, today))
  );
  const latestTodayActivity = todayActivities[0] || null;
  const todayNonRunActivities = todayActivities.filter((activity) => !isRunningActivity(activity));
  const hasRunToday = Boolean(todayActivities.some(isRunningActivity) || (latestRun?.start_date && isSameDayInRome(latestRun.start_date, today)));
  const hasAnyActivityToday = todayActivities.length > 0 || hasRunToday;
  const todayLoadSummary = buildTodayLoadSummary(todayActivities, currentLanguage);
  const suggestedFocus = extractTechnicalFocus(latestReport, metrics, currentLanguage);
  const fatigueScore = calculateFatigue({ latestReport, metrics, recentRuns, daysSinceLatestRun });
  const overloadRisk = calculateOverloadRisk({ metrics, fatigueScore, daysSinceLatestRun, hasRunToday });
  const readinessScore = calculateReadiness({ fatigueScore, metrics, daysSinceLatestRun, overloadRisk });
  const consistencyScore = calculateConsistency(metrics, recentRuns, daysSinceLatestRun);
  const recoveryTimeline = buildActions({
    daysSinceLatestRun,
    hasRunToday,
    hasAnyActivityToday,
    latestTodayActivity,
    todayActivities,
    latestRun,
    focus: suggestedFocus,
    readinessScore,
    fatigueScore,
    overloadRisk,
    rules,
    language: currentLanguage,
  });

  const recoveryStatus = hasRunToday
    ? (currentLanguage === 'en' ? 'post-run' : 'post-corsa')
    : hasAnyActivityToday
      ? (currentLanguage === 'en' ? 'post-activity' : 'post-attività')
    : daysSinceLatestRun === null
      ? (currentLanguage === 'en' ? 'insufficient data' : 'dati insufficienti')
      : daysSinceLatestRun <= 1
        ? (currentLanguage === 'en' ? 'recovery' : 'recupero')
        : daysSinceLatestRun <= 3
          ? (currentLanguage === 'en' ? 'ready for easy' : 'pronto per facile')
          : (currentLanguage === 'en' ? 'controlled return' : 'rientro controllato');

  const explanationParts = currentLanguage === 'en'
    ? [
        daysSinceLatestRun === null
          ? (hasAnyActivityToday ? 'No recent synced runs, but today has a non-running activity.' : 'No recent synced runs.')
          : hasRunToday
            ? 'You already ran today, so timing shifts to recovery.'
            : hasAnyActivityToday
              ? 'You already completed a non-running activity today, so timing shifts to recovery.'
            : `Last run ${daysSinceLatestRun} days ago: coach timing evolves without waiting for a new sync.`,
        fatigueScore !== null
          ? `Dynamic fatigue is ${fatigueScore}/100 after decay from report value or metrics.`
          : 'Fatigue unavailable: using conservative action fallback.',
        todayLoadSummary
          ? `${todayLoadSummary} Load included in recovery.`
          : '',
        `Current practical guidance: ${suggestedFocus}`,
      ]
    : [
        daysSinceLatestRun === null
          ? (hasAnyActivityToday ? 'Non ci sono corse recenti sincronizzate, ma oggi hai svolto un’attività non-running.' : 'Non ci sono corse recenti sincronizzate.')
          : hasRunToday
            ? 'Hai già corso oggi, quindi il timing passa al recupero.'
            : hasAnyActivityToday
              ? 'Oggi hai già svolto un’attività non-running, quindi il timing passa al recupero.'
            : `Ultima corsa ${daysSinceLatestRun} giorni fa: il timing del coach evolve senza aspettare una nuova sync.`,
        fatigueScore !== null
          ? `La fatica dinamica è ${fatigueScore}/100 dopo decadimento dal valore del report o dalle metriche.`
          : 'Fatica non disponibile: uso fallback prudente nelle azioni.',
        todayLoadSummary
          ? `${todayLoadSummary} Carico considerato nel recupero.`
          : '',
        `Indicazione pratica corrente: ${suggestedFocus}`,
      ];

  if (rules?.allowedIntensity) {
    explanationParts.push(currentLanguage === 'en'
      ? `Current max intensity: ${rules.allowedIntensity}.`
      : `Intensità massima corrente: ${rules.allowedIntensity}.`);
  }

  return {
    hasRunToday,
    hasAnyActivityToday,
    latestTodayActivity,
    todayNonRunActivities,
    todayLoadSummary,
    daysSinceLatestRun,
    readinessScore,
    readinessLabel: readinessLabel(readinessScore, currentLanguage),
    fatigueScore,
    fatigueLabel: fatigueLabel(fatigueScore, currentLanguage),
    consistencyScore,
    consistencyLabel: consistencyLabel(consistencyScore, currentLanguage),
    overloadRisk,
    recoveryStatus,
    suggestedFocus,
    todayAction: recoveryTimeline.todayAction,
    tomorrowAction: recoveryTimeline.tomorrowAction,
    nextAction: recoveryTimeline.nextAction,
    timeline: recoveryTimeline.timeline,
    explanation: explanationParts.join(' '),
  };
}
