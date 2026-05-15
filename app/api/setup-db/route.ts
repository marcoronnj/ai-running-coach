import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Definizione degli statement SQL per creare le tabelle
 */
const SQL_STATEMENTS = [
  // Tabella activities
  `
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      strava_id TEXT UNIQUE NOT NULL,
      name TEXT,
      type TEXT,
      sport_type TEXT,
      start_date TIMESTAMPTZ,
      distance_m REAL,
      moving_time_s INTEGER,
      elapsed_time_s INTEGER,
      average_speed REAL,
      max_speed REAL,
      average_heartrate REAL,
      max_heartrate REAL,
      total_elevation_gain REAL,
      raw_json JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  `
    ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS sport_type TEXT;
  `,

  // Indice su strava_id per query veloce
  `
    CREATE INDEX IF NOT EXISTS idx_activities_strava_id 
    ON activities(strava_id);
  `,

  // Indice su created_at per query cronologiche
  `
    CREATE INDEX IF NOT EXISTS idx_activities_created_at 
    ON activities(created_at DESC);
  `,

  // Tabella coach_reports
  `
    CREATE TABLE IF NOT EXISTS coach_reports (
      id SERIAL PRIMARY KEY,
      activity_id TEXT REFERENCES activities(id) ON DELETE CASCADE,
      report_type TEXT DEFAULT 'post_run',
      title TEXT,
      summary TEXT,
      risk_level TEXT,
      next_48h TEXT,
      weekly_plan JSONB,
      full_report TEXT,
      readiness_score INTEGER,
      readiness_label TEXT,
      readiness_explanation TEXT,
      fatigue_score INTEGER,
      fatigue_label TEXT,
      fatigue_explanation TEXT,
      consistency_score INTEGER,
      consistency_label TEXT,
      consistency_explanation TEXT,
      overload_explanation TEXT,
      suggested_focus TEXT,
      coach_notes JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // Aggiungi colonne mancanti se non esistono (per aggiornamenti)
  `
    ALTER TABLE coach_reports
    ADD COLUMN IF NOT EXISTS readiness_score INTEGER,
    ADD COLUMN IF NOT EXISTS readiness_label TEXT,
    ADD COLUMN IF NOT EXISTS readiness_explanation TEXT,
    ADD COLUMN IF NOT EXISTS fatigue_score INTEGER,
    ADD COLUMN IF NOT EXISTS fatigue_label TEXT,
    ADD COLUMN IF NOT EXISTS fatigue_explanation TEXT,
    ADD COLUMN IF NOT EXISTS consistency_score INTEGER,
    ADD COLUMN IF NOT EXISTS consistency_label TEXT,
    ADD COLUMN IF NOT EXISTS consistency_explanation TEXT,
    ADD COLUMN IF NOT EXISTS overload_explanation TEXT,
    ADD COLUMN IF NOT EXISTS suggested_focus TEXT,
    ADD COLUMN IF NOT EXISTS coach_notes JSONB;
  `,

  // Indice su activity_id per query join
  `
    CREATE INDEX IF NOT EXISTS idx_coach_reports_activity_id 
    ON coach_reports(activity_id);
  `,

  // Indice su created_at per query cronologiche
  `
    CREATE INDEX IF NOT EXISTS idx_coach_reports_created_at 
    ON coach_reports(created_at DESC);
  `,

  // Tabella sync_logs
  `
    CREATE TABLE IF NOT EXISTS sync_logs (
      id SERIAL PRIMARY KEY,
      status TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  // Indice su created_at per query cronologiche
  `
    CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at 
    ON sync_logs(created_at DESC);
  `,

  // Tabella connessione OAuth Strava admin
  `
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
    );
  `,

  `
    ALTER TABLE strava_connections
    ADD COLUMN IF NOT EXISTS athlete_firstname TEXT,
    ADD COLUMN IF NOT EXISTS athlete_lastname TEXT,
    ADD COLUMN IF NOT EXISTS athlete_username TEXT,
    ADD COLUMN IF NOT EXISTS athlete_profile TEXT,
    ADD COLUMN IF NOT EXISTS athlete_profile_medium TEXT;
  `,

  // Indice su user_id per connessione single-admin
  `
    CREATE INDEX IF NOT EXISTS idx_strava_connections_user_id
    ON strava_connections(user_id);
  `,

  // Tabella athlete_settings
  `
    CREATE TABLE IF NOT EXISTS athlete_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      profile_summary TEXT,
      weight_kg REAL,
      height_cm REAL,
      age INTEGER,
      birth_date DATE,
      main_goal TEXT,
      secondary_goal TEXT,
      available_days TEXT[],
      target_runs_per_week INTEGER,
      target_weekly_volume_km REAL,
      target_pace TEXT,
      target_hr TEXT,
      injuries TEXT,
      experience_level TEXT,
      language TEXT DEFAULT 'it',
      avoid_overload BOOLEAN DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,

  `
    ALTER TABLE athlete_settings
    ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'it';
  `,

  `
    ALTER TABLE athlete_settings
    ADD COLUMN IF NOT EXISTS birth_date DATE;
  `,
];

/**
 * Verifica il secret se è configurato
 */
function verifySecret(request: NextRequest): boolean {
  const setupSecret = process.env.SETUP_SECRET;

  // Se SETUP_SECRET non è configurato, permetti l'accesso (solo per locale)
  if (!setupSecret) {
    console.warn(
      '[SETUP] SETUP_SECRET non configurato. La route setup-db è pubblica (SOLO per development!).'
    );
    return true;
  }

  // Se SETUP_SECRET è configurato, richiedi il parametro secret
  const secretParam = request.nextUrl.searchParams.get('secret');

  if (!secretParam || secretParam !== setupSecret) {
    return false;
  }

  return true;
}

/**
 * API Route: POST /api/setup-db
 * Crea le tabelle del database se non esistono
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica il secret
    if (!verifySecret(request)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Secret non valido o mancante',
          message:
            'Se SETUP_SECRET è configurato, fornisci il parametro ?secret=...',
        },
        { status: 403 }
      );
    }

    console.log('[SETUP] Inizio creazione tabelle...');

    // Esegui tutti gli statement SQL
    for (let i = 0; i < SQL_STATEMENTS.length; i++) {
      const statement = SQL_STATEMENTS[i].trim();

      if (!statement) {
        continue;
      }

      try {
        await query(statement);
        console.log(`[SETUP] ✓ Statement ${i + 1}/${SQL_STATEMENTS.length} eseguito`);
      } catch (error) {
        console.error(`[SETUP] ✗ Errore nel statement ${i + 1}:`, error);
        throw error;
      }
    }

    console.log('[SETUP] ✓ Tutte le tabelle create con successo!');

    // Inserisci impostazioni atleta default se non esistono
    try {
      await query(`
        INSERT INTO athlete_settings (id, profile_summary, main_goal, secondary_goal, target_runs_per_week, avoid_overload, experience_level, language)
        VALUES ('default', 'ex runner forte, ora discontinuo', 'dimagrire', 'tornare competitivo', 3, true, 'ex runner forte, ora in ripresa', 'it')
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('[SETUP] ✓ Impostazioni atleta default inserite');
    } catch (error) {
      console.error('[SETUP] ✗ Errore inserimento impostazioni default:', error);
      // Non bloccare il setup per questo errore
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Database setup completed successfully',
        tablesCreated: ['activities', 'coach_reports', 'sync_logs', 'strava_connections', 'athlete_settings'],
        indicesCreated: 7,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SETUP] Setup error:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        error: 'Database setup failed',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Rifiuta altri metodi HTTP
 */
export async function POST() {
  return NextResponse.json(
    { error: 'POST method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'PUT method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'DELETE method not allowed. Use GET.' },
    { status: 405 }
  );
}
