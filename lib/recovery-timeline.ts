import { daysSinceInRome, isSameDayInRome } from './date-utils';
import { normalizeLanguage, type Language } from './i18n';

export interface RecoveryTimelineItem {
  label: string;
  title: string;
  description: string;
  completed?: boolean;
}

export interface RecoveryTimelineState {
  hasRunToday: boolean;
  isRecoveryDay: boolean;
  daysSinceRun: number | null;
  todayAction: string;
  tomorrowAction: string;
  nextAction: string;
  nextSuggestedSession: string;
  nextSuggestedSessionLabel: string;
  next48h: string;
  excerpt: string;
  timeline: RecoveryTimelineItem[];
}

export interface RecoveryTimelineInput {
  runDate?: string | Date | null;
  distanceMeters?: number | null;
  fatigueScore?: number | null;
  readinessScore?: number | null;
  overloadRisk?: string | null;
  focus?: string | null;
  today?: Date;
  language?: Language;
}

function formatKm(meters?: number | null, language: Language = 'it'): string {
  if (!meters || meters <= 0) return language === 'en' ? 'run' : 'corsa';
  return `${(meters / 1000).toFixed(1)} km`;
}

function sentence(value?: string | null): string {
  const text = value?.trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function isLowFatigue(fatigueScore?: number | null, readinessScore?: number | null): boolean {
  return (fatigueScore === null || fatigueScore === undefined || fatigueScore < 45) &&
    (readinessScore === null || readinessScore === undefined || readinessScore >= 55);
}

function hasHighRecoveryNeed(input: RecoveryTimelineInput): boolean {
  const risk = String(input.overloadRisk || '').toLowerCase();
  return risk === 'alto' ||
    risk === 'high' ||
    (input.fatigueScore !== null && input.fatigueScore !== undefined && input.fatigueScore >= 60) ||
    (input.readinessScore !== null && input.readinessScore !== undefined && input.readinessScore < 40);
}

export function getRecoveryTimelineState(input: RecoveryTimelineInput): RecoveryTimelineState {
  const language = normalizeLanguage(input.language);
  const isEnglish = language === 'en';
  const runDate = input.runDate ?? null;
  const daysSinceRun = runDate ? daysSinceInRome(runDate, input.today) : null;
  const hasRunToday = runDate ? isSameDayInRome(runDate, input.today) : false;
  const distance = formatKm(input.distanceMeters, language);
  const focus = sentence(input.focus) || (isEnglish
    ? '30-40 minutes very easy, low HR/Z2, conversational pace.'
    : '30-40 minuti molto facili, FC bassa/Z2, passo conversazionale.');
  const highRecoveryNeed = hasHighRecoveryNeed(input);
  const lowFatigue = isLowFatigue(input.fatigueScore, input.readinessScore);

  if (hasRunToday) {
    const todayAction = isEnglish
      ? `Run completed: ${distance}. Now only light recovery, easy walking, or mobility.`
      : `Corsa completata: ${distance}. Ora solo recupero leggero, camminata facile o mobilità.`;
    const tomorrowAction = highRecoveryNeed
      ? (isEnglish ? 'Recovery or full rest. Avoid running if your legs feel heavy.' : 'Recupero o riposo completo. Evita corsa se senti gambe pesanti.')
      : (isEnglish ? 'Recovery or full rest; a very light recovery jog only if fatigue is low.' : 'Recupero o riposo; recovery molto leggera solo se la fatica è bassa.');
    const nextAction = highRecoveryNeed
      ? (isEnglish ? 'Day after tomorrow: reassess legs; stay with rest or mobility if fatigue remains high.' : 'Dopodomani: rivaluta le gambe; resta su riposo o mobilità se la fatica resta alta.')
      : (isEnglish ? 'Day after tomorrow: optional recovery run, 30-40 minutes very easy, low HR/Z2.' : 'Dopodomani: recovery run opzionale, 30-40 minuti molto facili, FC bassa/Z2.');

    return {
      hasRunToday: true,
      isRecoveryDay: true,
      daysSinceRun,
      todayAction,
      tomorrowAction,
      nextAction,
      nextSuggestedSession: nextAction,
      nextSuggestedSessionLabel: isEnglish ? 'Day after tomorrow / Next run' : 'Dopodomani / Prossima corsa',
      next48h: isEnglish
        ? `${todayAction} Tomorrow: ${tomorrowAction}`
        : `${todayAction} Domani: ${tomorrowAction}`,
      excerpt: isEnglish
        ? `${todayAction} Tomorrow is recovery or full rest; the next easy/recovery run shifts to the day after tomorrow.`
        : `${todayAction} Domani recupero o riposo; la prossima easy/recovery slitta a dopodomani.`,
      timeline: [
        {
          label: isEnglish ? 'Today' : 'Oggi',
          title: isEnglish ? `Run completed: ${distance}` : `Corsa completata: ${distance}`,
          description: isEnglish ? 'Only light recovery, walking, or mobility now.' : 'Ora solo recupero leggero, camminata o mobilità.',
          completed: true,
        },
        {
          label: isEnglish ? 'Tomorrow' : 'Domani',
          title: isEnglish ? 'Recovery or full rest' : 'Recupero o riposo',
          description: tomorrowAction,
        },
        {
          label: isEnglish ? 'Day after tomorrow' : 'Dopodomani',
          title: isEnglish ? 'Optional recovery run' : 'Recovery run opzionale',
          description: nextAction.replace(/^Day after tomorrow:\s*/i, '').replace(/^Dopodomani:\s*/i, ''),
        },
      ],
    };
  }

  if (daysSinceRun === 1) {
    const todayAction = isEnglish
      ? 'Recovery today: full rest, light mobility, or 20-30 minutes easy walking.'
      : 'Recupero oggi: riposo, mobilità leggera o camminata facile 20-30 minuti.';
    const tomorrowAction = lowFatigue
      ? (isEnglish ? `Optional recovery/easy run if legs feel fresh: ${focus}` : `Recovery/easy run opzionale se le gambe sono fresche: ${focus}`)
      : (isEnglish ? 'Keep recovery or full rest if fatigue is still present.' : 'Mantieni recupero o riposo completo se la fatica è ancora presente.');
    const nextAction = isEnglish
      ? 'Day after tomorrow: gradual return with easy running only if recovery is good.'
      : 'Dopodomani: ritorno graduale con easy run solo se il recupero è buono.';

    return {
      hasRunToday: false,
      isRecoveryDay: true,
      daysSinceRun,
      todayAction,
      tomorrowAction,
      nextAction,
      nextSuggestedSession: tomorrowAction,
      nextSuggestedSessionLabel: isEnglish ? 'Tomorrow / Optional run' : 'Domani / Corsa opzionale',
      next48h: isEnglish ? `${todayAction} Tomorrow: ${tomorrowAction}` : `${todayAction} Domani: ${tomorrowAction}`,
      excerpt: isEnglish
        ? 'Yesterday’s run makes today a recovery day. The next easy/recovery run is optional tomorrow if fatigue is low.'
        : 'La corsa di ieri rende oggi un giorno di recupero. La prossima easy/recovery è opzionale domani se la fatica è bassa.',
      timeline: [
        { label: isEnglish ? 'Today' : 'Oggi', title: isEnglish ? 'Recovery day' : 'Giorno di recupero', description: todayAction },
        { label: isEnglish ? 'Tomorrow' : 'Domani', title: lowFatigue ? (isEnglish ? 'Optional recovery run' : 'Recovery run opzionale') : (isEnglish ? 'Recovery if needed' : 'Recupero se serve'), description: tomorrowAction },
        { label: isEnglish ? 'Day after tomorrow' : 'Dopodomani', title: isEnglish ? 'Gradual return' : 'Ritorno graduale', description: nextAction },
      ],
    };
  }

  if (daysSinceRun !== null && daysSinceRun >= 2 && daysSinceRun <= 3) {
    const todayAction = highRecoveryNeed
      ? (isEnglish ? 'Recovery remains the priority today: mobility, walking, or rest.' : 'Il recupero resta la priorità oggi: mobilità, camminata o riposo.')
      : (isEnglish ? `Easy/recovery run is possible today if you feel fresh: ${focus}` : `Easy/recovery possibile oggi se ti senti fresco: ${focus}`);
    const tomorrowAction = isEnglish ? 'Light recovery after the return: walking, mobility, or rest.' : 'Recupero leggero dopo il rientro: camminata, mobilità o riposo.';
    const nextAction = isEnglish ? 'Day after tomorrow: optional second easy run, no quality work.' : 'Dopodomani: seconda easy run opzionale, niente qualità.';

    return {
      hasRunToday: false,
      isRecoveryDay: highRecoveryNeed,
      daysSinceRun,
      todayAction,
      tomorrowAction,
      nextAction,
      nextSuggestedSession: todayAction,
      nextSuggestedSessionLabel: isEnglish ? 'Today / Next run' : 'Oggi / Prossima corsa',
      next48h: isEnglish ? `${todayAction} Tomorrow: ${tomorrowAction}` : `${todayAction} Domani: ${tomorrowAction}`,
      excerpt: isEnglish
        ? 'The post-run recovery window has moved forward; use the live coach timing for today.'
        : 'La finestra post-corsa è avanzata; usa il timing live del coach per oggi.',
      timeline: [
        { label: isEnglish ? 'Today' : 'Oggi', title: highRecoveryNeed ? (isEnglish ? 'Recovery still useful' : 'Recupero ancora utile') : (isEnglish ? 'Easy/recovery possible' : 'Easy/recovery possibile'), description: todayAction },
        { label: isEnglish ? 'Tomorrow' : 'Domani', title: isEnglish ? 'Light recovery' : 'Recupero leggero', description: tomorrowAction },
        { label: isEnglish ? 'Day after tomorrow' : 'Dopodomani', title: isEnglish ? 'Optional easy run' : 'Easy run opzionale', description: nextAction },
      ],
    };
  }

  if (daysSinceRun !== null && daysSinceRun >= 4) {
    const todayAction = isEnglish
      ? 'This guidance is historical. Use the live coach for today’s current prescription.'
      : 'Questa indicazione è storica. Usa il coach live per la prescrizione corrente di oggi.';
    const tomorrowAction = isEnglish ? 'Live coach timing depends on your latest synced activity.' : 'Il timing live dipende dall’ultima attività sincronizzata.';
    const nextAction = isEnglish ? 'Next run should follow the current Coach Live state.' : 'La prossima corsa deve seguire lo stato corrente di Coach Live.';

    return {
      hasRunToday: false,
      isRecoveryDay: false,
      daysSinceRun,
      todayAction,
      tomorrowAction,
      nextAction,
      nextSuggestedSession: nextAction,
      nextSuggestedSessionLabel: isEnglish ? 'Current live coach' : 'Coach live corrente',
      next48h: isEnglish
        ? 'Historical post-run guidance has expired. Use Coach Live for the current recovery window and next run timing.'
        : 'Le indicazioni post-corsa storiche sono scadute. Usa Coach Live per finestra di recupero e timing della prossima corsa.',
      excerpt: isEnglish
        ? 'Historical report: timing references from this run are no longer live guidance.'
        : 'Report storico: i riferimenti temporali di questa corsa non sono più indicazioni live.',
      timeline: [
        { label: isEnglish ? 'Historical' : 'Storico', title: isEnglish ? 'Post-run window expired' : 'Finestra post-corsa scaduta', description: todayAction },
        { label: isEnglish ? 'Now' : 'Ora', title: isEnglish ? 'Follow Coach Live' : 'Segui Coach Live', description: tomorrowAction },
        { label: isEnglish ? 'Next run' : 'Prossima corsa', title: isEnglish ? 'Current state decides' : 'Decide lo stato corrente', description: nextAction },
      ],
    };
  }

  const todayAction = isEnglish
    ? 'Insufficient run data: keep activity light until the next sync.'
    : 'Dati corsa insufficienti: mantieni attività leggera fino alla prossima sync.';
  const tomorrowAction = isEnglish ? 'Sync a run or continue with light recovery.' : 'Sincronizza una corsa o continua con recupero leggero.';
  const nextAction = isEnglish ? 'Next run should be easy when updated data is available.' : 'La prossima corsa deve essere facile quando i dati sono aggiornati.';

  return {
    hasRunToday: false,
    isRecoveryDay: true,
    daysSinceRun,
    todayAction,
    tomorrowAction,
    nextAction,
    nextSuggestedSession: nextAction,
    nextSuggestedSessionLabel: isEnglish ? 'Next run' : 'Prossima corsa',
    next48h: isEnglish ? `${todayAction} Tomorrow: ${tomorrowAction}` : `${todayAction} Domani: ${tomorrowAction}`,
    excerpt: todayAction,
    timeline: [
      { label: isEnglish ? 'Today' : 'Oggi', title: isEnglish ? 'Active recovery' : 'Recupero attivo', description: todayAction },
      { label: isEnglish ? 'Tomorrow' : 'Domani', title: isEnglish ? 'Check data' : 'Valuta dati', description: tomorrowAction },
      { label: isEnglish ? 'Day after tomorrow' : 'Dopodomani', title: isEnglish ? 'Easy run' : 'Easy run', description: nextAction },
    ],
  };
}

export function getDynamicRecoveryText(input: RecoveryTimelineInput): string {
  return getRecoveryTimelineState(input).next48h;
}

export function getDynamicRecoveryExcerpt(input: RecoveryTimelineInput): string {
  return getRecoveryTimelineState(input).excerpt;
}
