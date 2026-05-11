export type Language = 'it' | 'en';

type TranslationKey =
  | 'nav.dashboard'
  | 'nav.coach'
  | 'nav.settings'
  | 'nav.logout'
  | 'common.loading'
  | 'common.error'
  | 'common.save'
  | 'common.saved'
  | 'common.login'
  | 'common.email'
  | 'common.password'
  | 'dashboard.eyebrow'
  | 'dashboard.subtitle'
  | 'dashboard.coachLive'
  | 'dashboard.currentState'
  | 'dashboard.today'
  | 'dashboard.tomorrow'
  | 'dashboard.nextRun'
  | 'coach.eyebrow'
  | 'coach.subtitle'
  | 'settings.eyebrow'
  | 'settings.title'
  | 'settings.subtitle'
  | 'settings.language'
  | 'settings.languageHelp'
  | 'settings.physical'
  | 'settings.weight'
  | 'settings.height'
  | 'settings.age'
  | 'settings.goals'
  | 'settings.mainGoal'
  | 'settings.secondaryGoal'
  | 'settings.training'
  | 'settings.targetRuns'
  | 'settings.weeklyVolume'
  | 'settings.targetPace'
  | 'settings.targetHr'
  | 'settings.availableDays'
  | 'settings.other'
  | 'settings.experience'
  | 'settings.selectLevel'
  | 'settings.injuries'
  | 'settings.profileSummary'
  | 'settings.avoidOverload'
  | 'account.eyebrow'
  | 'account.title'
  | 'account.subtitle'
  | 'account.currentAccount'
  | 'account.lastSync'
  | 'account.importedRuns'
  | 'login.subtitle'
  | 'login.invalidCredentials'
  | 'login.signingIn'
  | 'run.analysisEyebrow'
  | 'run.sessionJudgement'
  | 'run.summary'
  | 'run.effort'
  | 'run.postRun'
  | 'run.formImpact'
  | 'run.historicalReport'
  | 'run.historicalNotice'
  | 'run.viewLiveCoach'
  | 'run.postRunGuidance'
  | 'run.postRunGuidanceHelp'
  | 'run.generatedThen'
  | 'metric.readiness'
  | 'metric.fatigue'
  | 'metric.consistency'
  | 'metric.overload'
  | 'state.recovery'
  | 'state.easy'
  | 'state.insufficientData';

const translations: Record<Language, Record<TranslationKey, string>> = {
  it: {
    'nav.dashboard': 'Dashboard',
    'nav.coach': 'Coach',
    'nav.settings': 'Impostazioni',
    'nav.logout': 'Logout',
    'common.loading': 'Caricamento...',
    'common.error': 'Errore',
    'common.save': 'Salva',
    'common.saved': 'Salvato',
    'common.login': 'Login',
    'common.email': 'Email',
    'common.password': 'Password',
    'dashboard.eyebrow': 'AI Running',
    'dashboard.subtitle': 'Il tuo allenatore personale basato sui dati',
    'dashboard.coachLive': 'Coach live',
    'dashboard.currentState': "Stato attuale dell'atleta",
    'dashboard.today': 'Oggi',
    'dashboard.tomorrow': 'Domani',
    'dashboard.nextRun': 'Dopodomani / Prossima corsa',
    'coach.eyebrow': 'coach hub',
    'coach.subtitle': 'Analisi compatta del tuo stato di forma',
    'settings.eyebrow': 'IMPOSTAZIONI',
    'settings.title': 'Profilo atleta',
    'settings.subtitle': 'Configura i dati usati dal coach per personalizzare analisi e consigli.',
    'settings.language': 'Lingua app',
    'settings.languageHelp': 'La lingua scelta viene usata anche dai nuovi report AI.',
    'settings.physical': 'Dati Fisici',
    'settings.weight': 'Peso (kg)',
    'settings.height': 'Altezza (cm)',
    'settings.age': 'Età',
    'settings.goals': 'Obiettivi',
    'settings.mainGoal': 'Obiettivo Principale',
    'settings.secondaryGoal': 'Obiettivo Secondario',
    'settings.training': 'Allenamento',
    'settings.targetRuns': 'Uscite target/settimana',
    'settings.weeklyVolume': 'Volume target settimanale (km)',
    'settings.targetPace': 'Pace target (min/km)',
    'settings.targetHr': 'FC target (bpm)',
    'settings.availableDays': 'Giorni disponibili',
    'settings.other': 'Altro',
    'settings.experience': 'Esperienza',
    'settings.selectLevel': 'Seleziona livello',
    'settings.injuries': 'Infortuni / Note fisiche',
    'settings.profileSummary': 'Sommario profilo',
    'settings.avoidOverload': 'Evita sovrallenamento e burnout',
    'account.eyebrow': 'ACCOUNT',
    'account.title': 'Profilo app',
    'account.subtitle': 'Sessione privata e stato della tua app atleta.',
    'account.currentAccount': 'Account corrente',
    'account.lastSync': 'Ultima sync',
    'account.importedRuns': 'Corse importate',
    'login.subtitle': 'Accedi alla tua dashboard atleta',
    'login.invalidCredentials': 'Credenziali non valide',
    'login.signingIn': 'Accesso...',
    'run.analysisEyebrow': 'Analisi corsa',
    'run.sessionJudgement': 'Giudizio sulla seduta',
    'run.summary': 'Sintesi',
    'run.effort': 'Sforzo',
    'run.postRun': 'Post-corsa',
    'run.formImpact': 'Impatto forma',
    'run.historicalReport': 'Report della seduta',
    'run.historicalNotice': 'Questa pagina è una fotografia della corsa. Le indicazioni qui sotto sono quelle generate dopo quella seduta e non rappresentano necessariamente il coach live di oggi.',
    'run.viewLiveCoach': 'Vedi coach live',
    'run.postRunGuidance': 'Indicazioni post-corsa',
    'run.postRunGuidanceHelp': 'Consigli generati dopo questa seduta: usali come contesto storico, non come prescrizione live di oggi.',
    'run.generatedThen': 'Focus generato allora',
    'metric.readiness': 'Readiness',
    'metric.fatigue': 'Fatigue',
    'metric.consistency': 'Consistency',
    'metric.overload': 'Rischio',
    'state.recovery': 'recupero',
    'state.easy': 'facile',
    'state.insufficientData': 'dati insufficienti',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.coach': 'Coach',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.save': 'Save',
    'common.saved': 'Saved',
    'common.login': 'Login',
    'common.email': 'Email',
    'common.password': 'Password',
    'dashboard.eyebrow': 'AI Running',
    'dashboard.subtitle': 'Your data-driven personal running coach',
    'dashboard.coachLive': 'Live coach',
    'dashboard.currentState': 'Current athlete state',
    'dashboard.today': 'Today',
    'dashboard.tomorrow': 'Tomorrow',
    'dashboard.nextRun': 'Day after tomorrow / Next run',
    'coach.eyebrow': 'coach hub',
    'coach.subtitle': 'Compact analysis of your current fitness state',
    'settings.eyebrow': 'SETTINGS',
    'settings.title': 'Athlete profile',
    'settings.subtitle': 'Configure the data the coach uses to personalize analysis and recommendations.',
    'settings.language': 'App language',
    'settings.languageHelp': 'The selected language is also used for new AI reports.',
    'settings.physical': 'Physical data',
    'settings.weight': 'Weight (kg)',
    'settings.height': 'Height (cm)',
    'settings.age': 'Age',
    'settings.goals': 'Goals',
    'settings.mainGoal': 'Main goal',
    'settings.secondaryGoal': 'Secondary goal',
    'settings.training': 'Training',
    'settings.targetRuns': 'Target runs/week',
    'settings.weeklyVolume': 'Target weekly volume (km)',
    'settings.targetPace': 'Target pace (min/km)',
    'settings.targetHr': 'Target HR (bpm)',
    'settings.availableDays': 'Available days',
    'settings.other': 'Other',
    'settings.experience': 'Experience',
    'settings.selectLevel': 'Select level',
    'settings.injuries': 'Injuries / physical notes',
    'settings.profileSummary': 'Profile summary',
    'settings.avoidOverload': 'Avoid overload and burnout',
    'account.eyebrow': 'ACCOUNT',
    'account.title': 'App profile',
    'account.subtitle': 'Private session and athlete app status.',
    'account.currentAccount': 'Current account',
    'account.lastSync': 'Last sync',
    'account.importedRuns': 'Imported runs',
    'login.subtitle': 'Sign in to your athlete dashboard',
    'login.invalidCredentials': 'Invalid credentials',
    'login.signingIn': 'Signing in...',
    'run.analysisEyebrow': 'Run analysis',
    'run.sessionJudgement': 'Session judgement',
    'run.summary': 'Summary',
    'run.effort': 'Effort',
    'run.postRun': 'Post-run',
    'run.formImpact': 'Fitness impact',
    'run.historicalReport': 'Session report',
    'run.historicalNotice': 'This page is a snapshot of that run. The guidance below was generated after that session and does not necessarily represent today’s live coach.',
    'run.viewLiveCoach': 'View live coach',
    'run.postRunGuidance': 'Post-run guidance',
    'run.postRunGuidanceHelp': 'Guidance generated after this session: use it as historical context, not as today’s live prescription.',
    'run.generatedThen': 'Focus generated then',
    'metric.readiness': 'Readiness',
    'metric.fatigue': 'Fatigue',
    'metric.consistency': 'Consistency',
    'metric.overload': 'Risk',
    'state.recovery': 'recovery',
    'state.easy': 'easy',
    'state.insufficientData': 'insufficient data',
  },
};

export function normalizeLanguage(value: unknown): Language {
  return value === 'en' ? 'en' : 'it';
}

export function t(language: unknown, key: TranslationKey): string {
  const normalized = normalizeLanguage(language);
  return translations[normalized][key] ?? translations.it[key] ?? key;
}

export function outputLanguageName(language: unknown): 'Italian' | 'English' {
  return normalizeLanguage(language) === 'en' ? 'English' : 'Italian';
}
