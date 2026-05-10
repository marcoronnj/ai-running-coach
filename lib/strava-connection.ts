import { query, queryOne } from '@/lib/db';
import { isTokenExpired, refreshStravaToken } from '@/lib/strava';

export interface StravaConnection {
  id: string;
  user_id: string;
  strava_athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  created_at: string;
  updated_at: string;
}

export interface PublicStravaConnectionStatus {
  connected: boolean;
  stravaAthleteId?: string;
  scope?: string;
  expiresAt?: number;
  updatedAt?: string;
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
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

export async function getPublicStravaConnectionStatus(userId: string): Promise<PublicStravaConnectionStatus> {
  const connection = await getStravaConnection(userId);

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: true,
    stravaAthleteId: connection.strava_athlete_id,
    scope: connection.scope,
    expiresAt: connection.expires_at,
    updatedAt: connection.updated_at,
  };
}

export async function upsertStravaConnection(input: {
  userId: string;
  stravaAthleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}): Promise<void> {
  await ensureStravaConnectionsTable();

  await query(
    `INSERT INTO strava_connections
     (id, user_id, strava_athlete_id, access_token, refresh_token, expires_at, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id)
     DO UPDATE SET
       strava_athlete_id = EXCLUDED.strava_athlete_id,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at,
       scope = EXCLUDED.scope,
       updated_at = NOW()`,
    [
      input.userId,
      input.userId,
      input.stravaAthleteId,
      input.accessToken,
      input.refreshToken,
      input.expiresAt,
      input.scope,
    ]
  );
}

export async function disconnectStravaConnection(userId: string): Promise<void> {
  await ensureStravaConnectionsTable();

  await query(
    `DELETE FROM strava_connections
     WHERE user_id = $1`,
    [userId]
  );
}

export async function getValidStravaAccessToken(userId: string): Promise<{ accessToken: string; connection: StravaConnection }> {
  const connection = await getStravaConnection(userId);

  if (!connection) {
    throw new Error('Connessione Strava non trovata');
  }

  if (!isTokenExpired(connection.expires_at)) {
    return { accessToken: connection.access_token, connection };
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
  });

  const updatedConnection = await getStravaConnection(userId);

  return {
    accessToken: refreshed.access_token,
    connection: updatedConnection ?? {
      ...connection,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at,
    },
  };
}
