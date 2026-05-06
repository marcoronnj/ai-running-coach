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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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

    return NextResponse.json(
      {
        ok: true,
        message: 'Database setup completato con successo',
        tablesCreated: ['activities', 'coach_reports', 'sync_logs'],
        indicesCreated: 6,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SETUP] Errore durante setup:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        error: 'Errore durante il setup del database',
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
    { error: 'Metodo POST non consentito. Usa GET.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Metodo PUT non consentito. Usa GET.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Metodo DELETE non consentito. Usa GET.' },
    { status: 405 }
  );
}
