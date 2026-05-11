/**
 * Utility per l'integrazione con Strava API
 * Gestisce autenticazione e recupero attività
 */

/**
 * Tipi TypeScript per Strava API
 */
export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  scope?: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    username?: string;
    profile_medium: string;
    profile: string;
    city: string;
    state: string;
    country: string;
    sex: string;
    summit: boolean;
    created_at: string;
    updated_at: string;
  };
}

export interface StravaAthleteProfile {
  id: number;
  username?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  profile?: string | null;
  profile_medium?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  start_date_local: string;
  distance: number; // metri
  moving_time: number; // secondi
  elapsed_time: number; // secondi
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number; // metri
  workout_type?: number;
  description?: string;
  photos?: any;
  calories?: number;
  segment_efforts?: any[];
  device_name?: string;
  embed_token?: string;
  splits_metric?: any[];
  splits_standard?: any[];
  laps?: any[];
  gear_id?: string;
  average_cadence?: number;
  has_heartrate: boolean;
  average_temp?: number;
  suffer_score?: number;
  has_kudoed: boolean;
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  gear?: any;
  average_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  max_watts?: number;
  weighted_average_watts?: number;
  pr_count?: number;
  total_photo_count?: number;
  has_video?: boolean;
  video?: any;
  achievement_count?: number;
  kudos_count?: number;
  comment_count?: number;
  athlete_count?: number;
  photo_count?: number;
  elev_high?: number;
  elev_low?: number;
  timezone?: string;
  utc_offset?: number;
  heartrate_opt_out?: boolean;
  display_hide_heartrate_option?: boolean;
  upload_id?: number;
  external_id?: string;
  from_accepted_tag?: boolean;
  visibility?: string;
}

export interface StravaTokenRefreshResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
}

/**
 * Refresh del token di accesso Strava
 * @returns Promise<StravaTokenResponse>
 * @throws Error se il refresh fallisce
 */
export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId) {
    throw new Error('STRAVA_CLIENT_ID non configurato');
  }

  if (!clientSecret) {
    throw new Error('STRAVA_CLIENT_SECRET non configurato');
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('[STRAVA] OAuth code exchange failed:', {
      status: response.status,
      body: errorData,
    });
    throw new Error(`Errore OAuth Strava (${response.status})`);
  }

  const data: StravaTokenResponse = await response.json();

  if (!data.access_token || !data.refresh_token || !data.expires_at || !data.athlete) {
    throw new Error('Risposta OAuth Strava incompleta');
  }

  console.log('[STRAVA] OAuth code exchanged successfully');
  return data;
}

/**
 * Refresh del token di accesso Strava
 * @returns Promise<StravaTokenRefreshResponse>
 * @throws Error se il refresh fallisce
 */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenRefreshResponse> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  // Verifica che le credenziali siano configurate
  if (!clientId) {
    throw new Error(
      'STRAVA_CLIENT_ID non è configurato in .env.local. ' +
      'Aggiungi la variabile di ambiente e riavvia il server.'
    );
  }

  if (!clientSecret) {
    throw new Error(
      'STRAVA_CLIENT_SECRET non è configurato in .env.local. ' +
      'Aggiungi la variabile di ambiente e riavvia il server.'
    );
  }

  if (!refreshToken) {
    throw new Error('Refresh token Strava mancante. Collega Strava via OAuth.');
  }

  try {
    console.log('[STRAVA] Refreshing access token...');

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[STRAVA] Token refresh failed:', {
        status: response.status,
        body: errorData,
      });

      if (response.status === 400) {
        throw new Error(
          'Refresh token non valido o scaduto. ' +
          'Ricomincia il flusso OAuth di Strava per ottenere un nuovo refresh token.'
        );
      }

      if (response.status === 401) {
        throw new Error(
          'Credenziali Strava non valide. ' +
          'Verifica STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET in .env.local.'
        );
      }

      throw new Error(
        `Errore dal server Strava (${response.status}): ${errorData}`
      );
    }

    const data: StravaTokenRefreshResponse = await response.json();

    // Verifica che la risposta contenga i campi necessari
    if (!data.access_token || !data.refresh_token || !data.expires_at) {
      throw new Error(
        'Risposta Strava incompleta. Mancano access_token, refresh_token o expires_at.'
      );
    }

    console.log('[STRAVA] ✓ Token refreshed successfully');
    console.log('[STRAVA] Expires at:', new Date(data.expires_at * 1000).toISOString());

    return data;
  } catch (error) {
    if (error instanceof Error) {
      console.error('[STRAVA] Token refresh error:', error.message);
      throw error;
    }

    console.error('[STRAVA] Unexpected token refresh error:', error);
    throw new Error('Errore imprevisto durante il refresh del token Strava');
  }
}

/**
 * Recupera le attività recenti dell'atleta
 * @param accessToken - Token di accesso valido
 * @returns Promise<StravaActivity[]>
 * @throws Error se il recupero fallisce
 */
export async function getRecentActivities(accessToken: string): Promise<StravaActivity[]> {
  if (!accessToken) {
    throw new Error('Access token è obbligatorio');
  }

  try {
    console.log('[STRAVA] Fetching recent activities...');

    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[STRAVA] Activities fetch failed:', {
        status: response.status,
        body: errorData,
      });

      if (response.status === 401) {
        throw new Error(
          'Access token non valido o scaduto. ' +
          'Rifai il refresh del token prima di chiamare questa funzione.'
        );
      }

      if (response.status === 403) {
        throw new Error(
          'Accesso negato. Verifica che l\'app Strava abbia i permessi necessari.'
        );
      }

      if (response.status === 429) {
        throw new Error(
          'Limite di richieste superato. Riprova più tardi.'
        );
      }

      throw new Error(
        `Errore dal server Strava (${response.status}): ${errorData}`
      );
    }

    const activities: StravaActivity[] = await response.json();

    if (!Array.isArray(activities)) {
      throw new Error('Risposta Strava non è un array di attività');
    }

    console.log(`[STRAVA] ✓ Retrieved ${activities.length} activities`);

    return activities;
  } catch (error) {
    if (error instanceof Error) {
      console.error('[STRAVA] Activities fetch error:', error.message);
      throw error;
    }

    console.error('[STRAVA] Unexpected activities fetch error:', error);
    throw new Error('Errore imprevisto durante il recupero delle attività Strava');
  }
}

export async function getAuthenticatedStravaAthlete(accessToken: string): Promise<StravaAthleteProfile> {
  if (!accessToken) {
    throw new Error('Access token è obbligatorio');
  }

  const response = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('[STRAVA] Athlete profile fetch failed:', {
      status: response.status,
      body: errorData,
    });
    throw new Error(`Errore recupero atleta Strava (${response.status})`);
  }

  const athlete = (await response.json()) as StravaAthleteProfile;

  if (!athlete.id) {
    throw new Error('Risposta atleta Strava incompleta');
  }

  return athlete;
}

/**
 * Verifica se un'attività è una corsa (Run o TrailRun)
 * @param activity - Attività Strava
 * @returns boolean
 */
export function isRunningActivity(activity: StravaActivity): boolean {
  return activity.type === 'Run' || activity.type === 'TrailRun';
}

/**
 * Filtra solo le attività di corsa da un array
 * @param activities - Array di attività Strava
 * @returns StravaActivity[] - Solo attività di corsa
 */
export function filterRunningActivities(activities: StravaActivity[]): StravaActivity[] {
  return activities.filter(isRunningActivity);
}

/**
 * Converte un'attività Strava nel formato per il database
 * @param activity - Attività Strava
 * @returns Oggetto formattato per il database
 */
export function formatActivityForDB(activity: StravaActivity) {
  return {
    id: activity.id.toString(),
    strava_id: activity.id.toString(),
    name: activity.name,
    type: activity.type,
    start_date: activity.start_date,
    distance_m: activity.distance,
    moving_time_s: activity.moving_time,
    elapsed_time_s: activity.elapsed_time,
    average_speed: activity.average_speed,
    max_speed: activity.max_speed,
    average_heartrate: activity.average_heartrate,
    max_heartrate: activity.max_heartrate,
    total_elevation_gain: activity.total_elevation_gain,
    raw_json: activity, // Salva tutto l'oggetto originale
  };
}

/**
 * Verifica se un token è scaduto
 * @param expiresAt - Timestamp di scadenza (secondi)
 * @param bufferMinutes - Minuti di buffer prima della scadenza effettiva (default: 5)
 * @returns boolean
 */
export function isTokenExpired(expiresAt: number, bufferMinutes: number = 5): boolean {
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = bufferMinutes * 60;
  return now >= (expiresAt - bufferSeconds);
}

/**
 * Calcola quanti minuti mancano alla scadenza del token
 * @param expiresAt - Timestamp di scadenza (secondi)
 * @returns number - Minuti rimanenti (negativo se scaduto)
 */
export function getTokenMinutesRemaining(expiresAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  const remainingSeconds = expiresAt - now;
  return Math.floor(remainingSeconds / 60);
}
