import { query, queryOne } from '@/lib/db';
import { getAuthenticatedStravaAthlete, isTokenExpired, refreshStravaToken, type StravaAthleteProfile } from '@/lib/strava';

export interface StravaConnection {
  id: string;
  user_id: string;
  strava_athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  athlete_firstname?: string | null;
  athlete_lastname?: string | null;
  athlete_username?: string | null;
  athlete_profile?: string | null;
  athlete_profile_medium?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicStravaConnectionStatus {
  connected: boolean;
  stravaAthleteId?: string;
  expiresAt?: number;
  updatedAt?: string;
  athlete?: {
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    profile?: string | null;
    profileMedium?: string | null;
  };
}

let tableEnsured = false;

export async function ensureStravaConnectionsTable(): Promise<void> {
  if (tableEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS strava_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      strava_athlete_id TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      scope TEXT NOT NULL,
      athlete_firstname TEXT,
      athlete_lastname TEXT,
      athlete_username TEXT,
      athlete_profile TEXT,
      athlete_profile_medium TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE strava_connections
    ADD COLUMN IF NOT EXISTS athlete_firstname TEXT,
    ADD COLUMN IF NOT EXISTS athlete_lastname TEXT,
    ADD COLUMN IF NOT EXISTS athlete_username TEXT,
    ADD COLUMN IF NOT EXISTS athlete_profile TEXT,
    ADD COLUMN IF NOT EXISTS athlete_profile_medium TEXT
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_strava_connections_user_id
    ON strava_connections(user_id)
  `);

  tableEnsured = true;
}

export async function getStravaConnection(userId: string): Promise<StravaConnection | undefined> {
  await ensureStravaConnectionsTable();

  return queryOne<StravaConnection>(
    `SELECT *
     FROM strava_connections
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
}

export async function getStravaConnectionByAthleteId(stravaAthleteId: string | number): Promise<StravaConnection | undefined> {
  await ensureStravaConnectionsTable();

  return queryOne<StravaConnection>(
    `SELECT *
     FROM strava_connections
     WHERE strava_athlete_id = $1
     LIMIT 1`,
    [String(stravaAthleteId)]
  );
}

export async function getPublicStravaConnectionStatus(userId: string): Promise<PublicStravaConnectionStatus> {
  const connection = await getStravaConnection(userId);

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    stravaAthleteId: connection.strava_athlete_id,
    expiresAt: connection.expires_at,
    updatedAt: connection.updated_at,
    athlete: {
      firstname: connection.athlete_firstname,
      lastname: connection.athlete_lastname,
      username: connection.athlete_username,
      profile: connection.athlete_profile,
      profileMedium: connection.athlete_profile_medium,
    },
  };
}

export async function upsertStravaConnection(input: {
  userId: string;
  stravaAthleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  athlete?: {
    firstname?: string | null;
    lastname?: string | null;
    username?: string | null;
    profile?: string | null;
    profileMedium?: string | null;
  };
}): Promise<void> {
  await ensureStravaConnectionsTable();

  await query(
    `INSERT INTO strava_connections
     (id, user_id, strava_athlete_id, access_token, refresh_token, expires_at, scope,
      athlete_firstname, athlete_lastname, athlete_username, athlete_profile, athlete_profile_medium)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (user_id)
     DO UPDATE SET
       strava_athlete_id = EXCLUDED.strava_athlete_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       scope = EXCLUDED.scope,
       athlete_firstname = COALESCE(EXCLUDED.athlete_firstname, strava_connections.athlete_firstname),
       athlete_lastname = COALESCE(EXCLUDED.athlete_lastname, strava_connections.athlete_lastname),
       athlete_username = COALESCE(EXCLUDED.athlete_username, strava_connections.athlete_username),
       athlete_profile = COALESCE(EXCLUDED.athlete_profile, strava_connections.athlete_profile),
       athlete_profile_medium = COALESCE(EXCLUDED.athlete_profile_medium, strava_connections.athlete_profile_medium),
       updated_at = NOW()`,
    [
      input.userId,
      input.userId,
      input.stravaAthleteId,
      input.accessToken,
      input.refreshToken,
      input.expiresAt,
      input.scope,
      input.athlete?.firstname ?? null,
      input.athlete?.lastname ?? null,
      input.athlete?.username ?? null,
      input.athlete?.profile ?? null,
      input.athlete?.profileMedium ?? null,
    ]
  );
}

export async function updateStravaAthleteProfile(userId: string, athlete: StravaAthleteProfile): Promise<void> {
  await ensureStravaConnectionsTable();

  await query(
    `UPDATE strava_connections
     SET strava_athlete_id = $2,
         athlete_firstname = $3,
         athlete_lastname = $4,
         athlete_username = $5,
         athlete_profile = $6,
         athlete_profile_medium = $7,
         updated_at = NOW()
     WHERE user_id = $1`,
    [
      userId,
      String(athlete.id),
      athlete.firstname ?? null,
      athlete.lastname ?? null,
      athlete.username ?? null,
      athlete.profile ?? null,
      athlete.profile_medium ?? null,
    ]
  );
}

export async function refreshStravaAthleteProfile(userId: string): Promise<StravaAthleteProfile> {
  const { accessToken } = await getValidStravaAccessToken(userId);
  const athlete = await getAuthenticatedStravaAthlete(accessToken);
  await updateStravaAthleteProfile(userId, athlete);
  return athlete;
}

export async function disconnectStravaConnection(userId: string): Promise<void> {
  await ensureStravaConnectionsTable();

  await query(
    `DELETE FROM strava_connections
     WHERE user_id = $1`,
    [userId]
  );
}

export async function getValidStravaAccessToken(userId: string): Promise<{
  accessToken: string;
  connection: StravaConnection;
  tokenRefreshed: boolean;
  athleteRefreshed: boolean;
}> {
  const startTime = Date.now();
  let connection = await getStravaConnection(userId);

  if (!connection) {
    throw new Error('Connessione Strava non trovata');
  }

  if (!isTokenExpired(connection.expires_at)) {
    const athleteRefreshed = await refreshMissingAthleteProfile(userId, connection.access_token, connection);
    if (athleteRefreshed) {
      connection = await getStravaConnection(userId) ?? connection;
    }
    console.log(`[STRAVA CONNECTION][PERF] token refresh skipped duration=${Date.now() - startTime}ms`);
    return { accessToken: connection.access_token, connection, tokenRefreshed: false, athleteRefreshed };
  }

  console.log('[STRAVA CONNECTION] Access token scaduto, refresh in corso');
  const refreshed = await refreshStravaToken(connection.refresh_token);

  await upsertStravaConnection({
    userId,
    stravaAthleteId: connection.strava_athlete_id,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at,
    scope: connection.scope,
    athlete: {
      firstname: connection.athlete_firstname,
      lastname: connection.athlete_lastname,
      username: connection.athlete_username,
      profile: connection.athlete_profile,
      profileMedium: connection.athlete_profile_medium,
    },
  });

  let updatedConnection = await getStravaConnection(userId);
  const athleteRefreshed = await refreshMissingAthleteProfile(
    userId,
    refreshed.access_token,
    updatedConnection ?? {
      ...connection,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    }
  );
  if (athleteRefreshed) {
    updatedConnection = await getStravaConnection(userId);
  }
  console.log(`[STRAVA CONNECTION][PERF] token refresh completed duration=${Date.now() - startTime}ms`);

  return {
    accessToken: refreshed.access_token,
    connection: updatedConnection ?? {
      ...connection,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    },
    tokenRefreshed: true,
    athleteRefreshed,
  };
}

async function refreshMissingAthleteProfile(
  userId: string,
  accessToken: string,
  connection: StravaConnection
): Promise<boolean> {
  const hasAthleteProfile = Boolean(
    connection.athlete_firstname ||
    connection.athlete_lastname ||
    connection.athlete_username ||
    connection.athlete_profile ||
    connection.athlete_profile_medium
  );

  if (hasAthleteProfile) {
    return false;
  }

  const startTime = Date.now();
  console.log('[STRAVA CONNECTION] Athlete profile missing in DB, fetching once');
  try {
    const athlete = await getAuthenticatedStravaAthlete(accessToken);
    await updateStravaAthleteProfile(userId, athlete);
    console.log(`[STRAVA CONNECTION][PERF] athlete fallback refresh duration=${Date.now() - startTime}ms`);
    return true;
  } catch (error) {
    console.warn(
      '[STRAVA CONNECTION] Athlete fallback refresh skipped:',
      error instanceof Error ? error.message : String(error)
    );
    console.log(`[STRAVA CONNECTION][PERF] athlete fallback refresh duration=${Date.now() - startTime}ms failed=yes`);
    return false;
  }
}
