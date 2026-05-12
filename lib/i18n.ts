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
  | 'dashboard.todayStatus'
  | 'dashboard.lastRun'
  | 'dashboard.noRunsSynced'
  | 'dashboard.dataPending'
  | 'dashboard.athleteStatus'
  | 'dashboard.overloadRisk'
  | 'dashboard.updatedWithDynamicFatigue'
  | 'dashboard.latestActivity'
  | 'dashboard.latestRun'
  | 'dashboard.aiAnalysisPending'
  | 'dashboard.distance'
  | 'dashboard.duration'
  | 'dashboard.avgPace'
  | 'dashboard.avgHr'
  | 'dashboard.openAnalysis'
  | 'dashboard.openFullAnalysis'
  | 'dashboard.weeklyTrend'
  | 'dashboard.thisWeek'
  | 'dashboard.outings'
  | 'dashboard.recentAverage'
  | 'dashboard.lastWeeks'
  | 'dashboard.openStravaProfile'
  | 'dashboard.emptyTitle'
  | 'dashboard.emptyBody'
  | 'dashboard.emptyFootnote'
  | 'report.ready'
  | 'report.pending'
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
  | 'settings.birthDate'
  | 'settings.calculatedAge'
  | 'settings.years'
  | 'settings.birthDateNotSet'
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
  | 'run.metrics'
  | 'run.duration'
  | 'run.elapsedTime'
  | 'run.averageCadence'
  | 'run.averageWatts'
  | 'run.maxSpeed'
  | 'run.fullReport'
  | 'run.historicalReportEyebrow'
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
    'dashboard.eyebrow': 'Performance running intelligence',
    'dashboard.subtitle': 'Performance running intelligence',
    'dashboard.coachLive': 'COACH LIVE',
    'dashboard.currentState': "Stato attuale dell'atleta",
    'dashboard.today': 'Oggi',
    'dashboard.tomorrow': 'Domani',
    'dashboard.nextRun': 'Dopodomani / Prossima corsa',
    'dashboard.todayStatus': 'STATO DI OGGI',
    'dashboard.lastRun': 'Ultima corsa',
    'dashboard.noRunsSynced': 'Nessuna corsa ancora sincronizzata',
    'dashboard.dataPending': 'In attesa dati',
    'dashboard.athleteStatus': 'Stato atleta',
    'dashboard.overloadRisk': 'Rischio Overload',
    'dashboard.updatedWithDynamicFatigue': "Aggiornato con fatica dinamica e giorni dall'ultima corsa.",
    'dashboard.latestActivity': 'latest activity',
    'dashboard.latestRun': 'Ultima corsa',
    'dashboard.aiAnalysisPending': 'Analisi AI in attesa di generazione.',
    'dashboard.distance': 'Distanza',
    'dashboard.duration': 'Durata',
    'dashboard.avgPace': 'Passo medio',
    'dashboard.avgHr': 'FC media',
    'dashboard.openAnalysis': 'Apri analisi',
    'dashboard.openFullAnalysis': 'Apri analisi completa',
    'dashboard.weeklyTrend': 'Trend settimanale',
    'dashboard.thisWeek': 'Questa settimana',
    'dashboard.outings': 'uscite',
    'dashboard.recentAverage': 'Media recente',
    'dashboard.lastWeeks': 'Ultime settimane',
    'dashboard.openStravaProfile': 'Apri profilo Strava',
    'dashboard.emptyTitle': 'Nessuna corsa ancora sincronizzata',
    'dashboard.emptyBody': 'Le tue corse appariranno qui automaticamente dopo la prima sincronizzazione con Strava. Controlla che il cron job sia attivo o avvia una sync manuale.',
    'dashboard.emptyFootnote': 'La sincronizzazione avviene automaticamente ogni 6 ore',
    'report.ready': 'Report pronto',
    'report.pending': 'Report in attesa',
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
    'settings.birthDate': 'Data di nascita',
    'settings.calculatedAge': 'Età calcolata',
    'settings.years': 'anni',
    'settings.birthDateNotSet': 'Data di nascita non impostata',
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
    'run.metrics': 'Metriche',
    'run.duration': 'Durata',
    'run.elapsedTime': 'Tempo trascorso',
    'run.averageCadence': 'Cadenza media',
    'run.averageWatts': 'Watt medio',
    'run.maxSpeed': 'Velocità max',
    'run.fullReport': 'Report completo',
    'run.historicalReportEyebrow': 'HISTORICAL REPORT',
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
    'dashboard.eyebrow': 'Performance running intelligence',
    'dashboard.subtitle': 'Performance running intelligence',
    'dashboard.coachLive': 'LIVE COACH',
    'dashboard.currentState': 'Current athlete status',
    'dashboard.today': 'Today',
    'dashboard.tomorrow': 'Tomorrow',
    'dashboard.nextRun': 'Day after tomorrow / Next run',
    'dashboard.todayStatus': 'TODAY STATUS',
    'dashboard.lastRun': 'Last run',
    'dashboard.noRunsSynced': 'No runs synced yet',
    'dashboard.dataPending': 'Waiting for data',
    'dashboard.athleteStatus': 'Athlete status',
    'dashboard.overloadRisk': 'Overload risk',
    'dashboard.updatedWithDynamicFatigue': 'Updated with dynamic fatigue and days since last run.',
    'dashboard.latestActivity': 'latest activity',
    'dashboard.latestRun': 'Last run',
    'dashboard.aiAnalysisPending': 'AI analysis pending.',
    'dashboard.distance': 'Distance',
    'dashboard.duration': 'Duration',
    'dashboard.avgPace': 'Average pace',
    'dashboard.avgHr': 'Average HR',
    'dashboard.openAnalysis': 'Open analysis',
    'dashboard.openFullAnalysis': 'Open full analysis',
    'dashboard.weeklyTrend': 'Weekly trend',
    'dashboard.thisWeek': 'This week',
    'dashboard.outings': 'runs',
    'dashboard.recentAverage': 'Recent average',
    'dashboard.lastWeeks': 'Last weeks',
    'dashboard.openStravaProfile': 'Open Strava profile',
    'dashboard.emptyTitle': 'No runs synced yet',
    'dashboard.emptyBody': 'Your runs will appear here automatically after the first Strava sync. Check that the cron job is active or start a manual sync.',
    'dashboard.emptyFootnote': 'Sync runs automatically every 6 hours',
    'report.ready': 'Report ready',
    'report.pending': 'Report pending',
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
    'settings.birthDate': 'Date of birth',
    'settings.calculatedAge': 'Calculated age',
    'settings.years': 'years old',
    'settings.birthDateNotSet': 'Date of birth not set',
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
    'run.metrics': 'Metrics',
    'run.duration': 'Duration',
    'run.elapsedTime': 'Elapsed time',
    'run.averageCadence': 'Average cadence',
    'run.averageWatts': 'Average watts',
    'run.maxSpeed': 'Max speed',
    'run.fullReport': 'Full report',
    'run.historicalReportEyebrow': 'HISTORICAL REPORT',
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
