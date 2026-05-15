type ActivityLike = {
  type?: string | null;
  sport_type?: string | null;
  name?: string | null;
  title?: string | null;
  moving_time_s?: number | null;
  elapsed_time_s?: number | null;
  distance_m?: number | null;
  average_heartrate?: number | null;
  total_elevation_gain?: number | null;
  raw_json?: any;
};

export type SportCategory =
  | 'running'
  | 'cycling'
  | 'strength'
  | 'recovery'
  | 'racket'
  | 'team'
  | 'outdoor'
  | 'water'
  | 'winter'
  | 'other';

export interface SportLoadProfile {
  sportType: string;
  sportCategory: SportCategory;
  fatigueImpact: number;
  muscularStress: number;
  aerobicImpact: number;
  recoveryBonus: number;
  runningSpecificImpact: number;
  shouldGenerateRunReport: boolean;
  shouldAppearAsLatestRun: boolean;
  shortDescription: string;
}

export const RUNNING_SPORT_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export const SPORT_FATIGUE_MULTIPLIERS: Record<string, number> = {
  Run: 1.0,
  TrailRun: 1.15,
  VirtualRun: 1.0,
  Ride: 0.65,
  GravelRide: 0.75,
  MountainBikeRide: 0.85,
  EBikeRide: 0.45,
  EMountainBikeRide: 0.55,
  VirtualRide: 0.6,
  Swim: 0.5,
  Walk: 0.2,
  Hike: 0.75,
  Workout: 0.65,
  WeightTraining: 0.8,
  HIIT: 1.0,
  Crossfit: 1.05,
  Yoga: 0.1,
  Pilates: 0.2,
  Physiotherapy: 0.05,
  Padel: 0.55,
  Tennis: 0.55,
  Squash: 0.7,
  Badminton: 0.45,
  Pickleball: 0.4,
  Soccer: 0.8,
  Basketball: 0.75,
  Volleyball: 0.45,
  Elliptical: 0.45,
  Stepper: 0.5,
  AlpineSki: 0.65,
  NordicSki: 0.75,
  BackcountrySki: 0.9,
  Snowboard: 0.55,
  Snowshoe: 0.7,
  RockClimbing: 0.55,
  Kayak: 0.45,
  Canoe: 0.4,
  Rowing: 0.65,
  VirtualRow: 0.6,
  StandUpPaddling: 0.35,
  Surfing: 0.45,
  Windsurf: 0.45,
  Kitesurf: 0.5,
  Sail: 0.15,
  Skateboard: 0.35,
  InlineSkate: 0.55,
  IceSkate: 0.45,
  Golf: 0.2,
  Dance: 0.4,
  Handcycle: 0.55,
  Wheelchair: 0.45,
  Velomobile: 0.45,
  Racquetball: 0.55,
};

const SPORT_ALIASES: Record<string, string> = {
  Trail: 'TrailRun',
  VirtualRun: 'VirtualRun',
  WeightTraining: 'WeightTraining',
  Weight_Training: 'WeightTraining',
  CrossFit: 'Crossfit',
  Crossfit: 'Crossfit',
  StandUpPaddle: 'StandUpPaddling',
  SUP: 'StandUpPaddling',
  AlpineSki: 'AlpineSki',
  BackcountrySki: 'BackcountrySki',
  NordicSki: 'NordicSki',
  MountainBike: 'MountainBikeRide',
  MountainBikeRide: 'MountainBikeRide',
  GravelRide: 'GravelRide',
  E_BikeRide: 'EBikeRide',
  EBikeRide: 'EBikeRide',
  E_MountainBikeRide: 'EMountainBikeRide',
  EMountainBikeRide: 'EMountainBikeRide',
  VirtualRide: 'VirtualRide',
  VirtualRow: 'VirtualRow',
  InlineSkate: 'InlineSkate',
  IceSkate: 'IceSkate',
};

const HIGH_IMPACT_KEYWORDS = [
  'hyrox',
  'circuit',
  'circuito',
  'hiit',
  'crossfit',
  'wod',
  'intervals',
  'intervalli',
  'ripetute',
  'tempo',
  'threshold',
  'soglia',
  'leg day',
  'gambe',
  'full body',
  'forza',
  'strength',
  'intense',
  'hard',
  'gara',
  'race',
  'match',
];

const RECOVERY_KEYWORDS = [
  'recovery',
  'recupero',
  'easy',
  'facile',
  'mobility',
  'mobilita',
  'mobilità',
  'stretching',
  'yoga',
  'pilates',
  'walk',
  'camminata',
  'scarico',
  'easy spin',
];

const LOWER_BODY_KEYWORDS = [
  'legs',
  'gambe',
  'squat',
  'lunges',
  'affondi',
  'plyo',
  'salti',
  'hill',
  'salita',
];

function normalizeSportName(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const cleaned = value.trim().replace(/\s+/g, '');
  return SPORT_ALIASES[cleaned] || cleaned;
}

export function getActivitySportType(activity: ActivityLike): string {
  const rawJson = typeof activity.raw_json === 'string'
    ? safeParseJson(activity.raw_json)
    : activity.raw_json;
  return (
    normalizeSportName(activity.sport_type) ||
    normalizeSportName(rawJson?.sport_type) ||
    normalizeSportName(activity.type) ||
    normalizeSportName(rawJson?.type) ||
    'Unknown'
  );
}

export function isRunningActivity(activity: ActivityLike): boolean {
  return RUNNING_SPORT_TYPES.has(getActivitySportType(activity));
}

export function isLoadActivity(activity: ActivityLike): boolean {
  const sportType = getActivitySportType(activity);
  return sportType !== 'Unknown' || Boolean(activity.name || activity.title);
}

export function getSportLoadProfile(activity: ActivityLike): SportLoadProfile {
  const sportType = getActivitySportType(activity);
  const baseFatigue = SPORT_FATIGUE_MULTIPLIERS[sportType] ?? 0.35;
  const isRunning = RUNNING_SPORT_TYPES.has(sportType);
  const category = getSportCategory(sportType);
  const profile: SportLoadProfile = {
    sportType,
    sportCategory: category,
    fatigueImpact: baseFatigue,
    muscularStress: getBaseMuscularStress(sportType, category),
    aerobicImpact: getBaseAerobicImpact(sportType, category),
    recoveryBonus: getBaseRecoveryBonus(sportType),
    runningSpecificImpact: isRunning ? 1 : getBaseRunningSpecificImpact(sportType, category),
    shouldGenerateRunReport: isRunning,
    shouldAppearAsLatestRun: isRunning,
    shortDescription: describeSport(sportType, category),
  };

  return adjustLoadByActivityTitle(activity.name || activity.title || '', profile);
}

export function adjustLoadByActivityTitle(activityName: string, baseProfile: SportLoadProfile): SportLoadProfile {
  const normalized = activityName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hasHighImpact = HIGH_IMPACT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasRecovery = RECOVERY_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasLowerBody = LOWER_BODY_KEYWORDS.some((keyword) => normalized.includes(keyword));

  const profile = { ...baseProfile };

  if (hasHighImpact) {
    profile.fatigueImpact = Math.min(1.25, profile.fatigueImpact + 0.22);
    profile.muscularStress = Math.min(1.25, profile.muscularStress + 0.25);
    profile.runningSpecificImpact = Math.min(1, profile.runningSpecificImpact + 0.12);
    profile.recoveryBonus = Math.max(0, profile.recoveryBonus - 0.05);
    profile.shortDescription = `${profile.shortDescription}, high-intensity title`;
  }

  if (hasRecovery) {
    profile.fatigueImpact = Math.max(0.03, profile.fatigueImpact * 0.65);
    profile.muscularStress = Math.max(0.02, profile.muscularStress * 0.7);
    profile.recoveryBonus = Math.min(0.35, profile.recoveryBonus + 0.12);
    profile.shortDescription = `${profile.shortDescription}, recovery title`;
  }

  if (hasLowerBody) {
    profile.muscularStress = Math.min(1.25, profile.muscularStress + 0.22);
    profile.runningSpecificImpact = Math.min(1, profile.runningSpecificImpact + 0.1);
    profile.shortDescription = `${profile.shortDescription}, lower-body stress`;
  }

  return profile;
}

export function estimateActivityLoad(activity: ActivityLike): number {
  const profile = getSportLoadProfile(activity);
  const durationMinutes = Math.max(0, Number(activity.moving_time_s ?? activity.elapsed_time_s ?? 0) / 60);
  const distanceKm = Math.max(0, Number(activity.distance_m ?? 0) / 1000);
  const hrFactor = activity.average_heartrate ? Math.min(1.35, Math.max(0.85, Number(activity.average_heartrate) / 145)) : 1;
  const elevationFactor = Math.min(1.25, 1 + Math.max(0, Number(activity.total_elevation_gain ?? 0)) / 1200);
  const durationLoad = durationMinutes / 10;
  const distanceLoad = distanceKm * (profile.sportCategory === 'running' ? 1 : 0.35);
  const load = (durationLoad + distanceLoad) * profile.fatigueImpact * hrFactor * elevationFactor;
  return Math.max(0, load - profile.recoveryBonus * 4);
}

function getSportCategory(sportType: string): SportCategory {
  if (RUNNING_SPORT_TYPES.has(sportType)) return 'running';
  if (['Ride', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'EMountainBikeRide', 'VirtualRide', 'Handcycle', 'Velomobile'].includes(sportType)) return 'cycling';
  if (['Workout', 'WeightTraining', 'HIIT', 'Crossfit', 'Elliptical', 'Stepper'].includes(sportType)) return 'strength';
  if (['Yoga', 'Pilates', 'Physiotherapy', 'Walk', 'Golf'].includes(sportType)) return 'recovery';
  if (['Padel', 'Tennis', 'Squash', 'Badminton', 'Pickleball', 'Racquetball'].includes(sportType)) return 'racket';
  if (['Soccer', 'Basketball', 'Volleyball'].includes(sportType)) return 'team';
  if (['Hike', 'RockClimbing', 'Skateboard', 'InlineSkate', 'IceSkate', 'Dance'].includes(sportType)) return 'outdoor';
  if (['Swim', 'Kayak', 'Canoe', 'Rowing', 'VirtualRow', 'StandUpPaddling', 'Surfing', 'Windsurf', 'Kitesurf', 'Sail'].includes(sportType)) return 'water';
  if (['AlpineSki', 'NordicSki', 'BackcountrySki', 'Snowboard', 'Snowshoe'].includes(sportType)) return 'winter';
  if (sportType === 'Wheelchair') return 'other';
  return 'other';
}

function getBaseMuscularStress(sportType: string, category: SportCategory): number {
  if (sportType === 'TrailRun' || sportType === 'BackcountrySki') return 0.9;
  if (['Run', 'Hike', 'WeightTraining', 'HIIT', 'Crossfit', 'Squash', 'Soccer', 'Basketball'].includes(sportType)) return 0.75;
  if (['Padel', 'Tennis', 'MountainBikeRide', 'Stepper', 'Snowshoe'].includes(sportType)) return 0.6;
  if (category === 'recovery') return 0.12;
  if (category === 'cycling' || category === 'water') return 0.35;
  return 0.4;
}

function getBaseAerobicImpact(sportType: string, category: SportCategory): number {
  if (RUNNING_SPORT_TYPES.has(sportType)) return 1;
  if (['Ride', 'GravelRide', 'MountainBikeRide', 'VirtualRide', 'NordicSki', 'Rowing', 'VirtualRow'].includes(sportType)) return 0.75;
  if (['Swim', 'Hike', 'Soccer', 'Basketball', 'HIIT', 'Crossfit'].includes(sportType)) return 0.65;
  if (category === 'recovery') return 0.18;
  return 0.4;
}

function getBaseRecoveryBonus(sportType: string): number {
  if (['Yoga', 'Pilates', 'Physiotherapy'].includes(sportType)) return 0.25;
  if (sportType === 'Walk' || sportType === 'Golf' || sportType === 'Sail') return 0.12;
  return 0;
}

function getBaseRunningSpecificImpact(sportType: string, category: SportCategory): number {
  if (['Hike', 'Soccer', 'Basketball', 'Squash', 'Padel', 'Tennis', 'WeightTraining', 'HIIT', 'Crossfit'].includes(sportType)) return 0.45;
  if (category === 'cycling' || category === 'winter') return 0.25;
  if (category === 'recovery') return 0.05;
  return 0.2;
}

function describeSport(sportType: string, category: SportCategory): string {
  if (RUNNING_SPORT_TYPES.has(sportType)) return 'running primary activity';
  if (category === 'recovery') return 'active recovery or low-impact activity';
  if (category === 'racket') return 'lateral movement with medium muscular stress';
  if (category === 'strength') return 'cross-training load';
  return `${category} training load`;
}

function safeParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
