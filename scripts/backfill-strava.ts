import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env.local') });

import { query, closePool } from '../lib/db';
import {
  refreshStravaToken,
  filterRunningActivities,
  formatActivityForDB,
  StravaActivity,
} from '../lib/strava';

const PER_PAGE = 100;

function safeTokenPreview(token: string | undefined): string {
  if (!token || token.length < 10) {
    return token ? `${token.slice(0, 6)}...` : 'missing';
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile di ambiente mancante: ${name}`);
  }
  return value;
}

async function refreshAccessToken(): Promise<string> {
  const tokenResponse = await refreshStravaToken();
  const scopes = (tokenResponse as any).scope || 'non disponibile';

  console.log('[DEBUG] Strava token refresh completato');
  console.log('[DEBUG] Scopes ricevuti:', scopes);
  console.log('[DEBUG] Access token preview:', safeTokenPreview(tokenResponse.access_token));
  console.log(
    '[DEBUG] expires_at:', new Date(tokenResponse.expires_at * 1000).toISOString()
  );

  return tokenResponse.access_token;
}

async function fetchActivitiesPage(accessToken: string, page: number): Promise<StravaActivity[]> {
  const url = new URL('https://www.strava.com/api/v3/athlete/activities');
  url.searchParams.set('page', page.toString());
  url.searchParams.set('per_page', PER_PAGE.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Errore Strava API pagina ${page}: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const activities = (await response.json()) as StravaActivity[];

  if (!Array.isArray(activities)) {
    throw new Error(`Risposta Strava non valida per pagina ${page}`);
  }

  return activities;
}

async function saveActivities(activities: StravaActivity[]): Promise<{ inserted: number; skipped: number }> {
  if (activities.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const columns = [
    'id',
    'strava_id',
    'name',
    'type',
    'start_date',
    'distance_m',
    'moving_time_s',
    'elapsed_time_s',
    'average_speed',
    'max_speed',
    'average_heartrate',
    'max_heartrate',
    'total_elevation_gain',
    'raw_json',
  ];

  const values: string[] = [];
  const params: any[] = [];

  activities.forEach((activity, index) => {
    const dbData = formatActivityForDB(activity);
    const offset = index * columns.length;

    values.push(
      `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`
    );

    params.push(
      dbData.id,
      dbData.strava_id,
      dbData.name,
      dbData.type,
      dbData.start_date,
      dbData.distance_m,
      dbData.moving_time_s,
      dbData.elapsed_time_s,
      dbData.average_speed,
      dbData.max_speed,
      dbData.average_heartrate,
      dbData.max_heartrate,
      dbData.total_elevation_gain,
      JSON.stringify(dbData.raw_json)
    );
  });

  const sql = `INSERT INTO activities (${columns.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (strava_id) DO NOTHING RETURNING id`;
  const result = await query(sql, params);

  const inserted = result.rowCount ?? 0;
  const skipped = activities.length - inserted;

  return { inserted, skipped };
}

async function run(): Promise<void> {
  console.log('Inizio backfill Strava...');
  console.log('[DEBUG] current working directory:', process.cwd());
  console.log('[DEBUG] STRAVA_CLIENT_ID:', process.env.STRAVA_CLIENT_ID ? 'present' : 'missing');
  console.log('[DEBUG] STRAVA_CLIENT_SECRET:', process.env.STRAVA_CLIENT_SECRET ? 'present' : 'missing');
  console.log('[DEBUG] STRAVA_REFRESH_TOKEN:', process.env.STRAVA_REFRESH_TOKEN ? safeTokenPreview(process.env.STRAVA_REFRESH_TOKEN) : 'missing');

  requireEnv('DATABASE_URL');
  requireEnv('STRAVA_CLIENT_ID');
  requireEnv('STRAVA_CLIENT_SECRET');
  requireEnv('STRAVA_REFRESH_TOKEN');

  const accessToken = await refreshAccessToken();

  let page = 1;
  let pagesRead = 0;
  let totalFetched = 0;
  let totalRuns = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  while (true) {
    console.log(`\nCaricamento pagina ${page}...`);
    const activities = await fetchActivitiesPage(accessToken, page);
    pagesRead += 1;

    const fetched = activities.length;
    totalFetched += fetched;
    console.log(`Attività lette: ${fetched}`);

    if (fetched === 0) {
      console.log('Pagina vuota ricevuta, interrompo il backfill.');
      break;
    }

    const runningActivities = filterRunningActivities(activities);
    const found = runningActivities.length;
    totalRuns += found;
    console.log(`Corse trovate (Run / TrailRun): ${found}`);

    const { inserted, skipped } = await saveActivities(runningActivities);
    totalInserted += inserted;
    totalSkipped += skipped;

    console.log(`Nuove inserite: ${inserted}`);
    console.log(`Duplicate saltate: ${skipped}`);

    page += 1;
  }

  console.log('\n=== Riepilogo importazione Strava ===');
  console.log(`Total fetched: ${totalFetched}`);
  console.log(`Total runs filtered: ${totalRuns}`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Skipped duplicates: ${totalSkipped}`);
  console.log(`Pages read: ${pagesRead}`);
}

run()
  .catch((error) => {
    console.error('\nErrore durante il backfill Strava:');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
    console.log('Connessione al database chiusa.');
  });
