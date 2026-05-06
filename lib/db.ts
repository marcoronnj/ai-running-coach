import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Singleton per il Pool di connessioni Postgres
 * Evita di creare troppe connessioni in Next.js/Vercel
 */
let pool: Pool | null = null;

/**
 * Ottiene il Pool di connessioni, creandolo se necessario
 */
function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL non è configurato in .env.local. ' +
      'Aggiungi la variabile di ambiente e riavvia il server.'
    );
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    // Limita il numero di connessioni idle per evitare problemi con Neon
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Log delle connessioni per debugging
  pool.on('error', (error: Error) => {
    console.error('Pool di database non previsto errore:', error);
  });

  pool.on('connect', () => {
    console.log('[DB] Connessione al database stabilita');
  });

  return pool;
}

/**
 * Esegue una query al database
 * @param text - Query SQL
 * @param params - Parametri della query (opzionale)
 * @returns Risultato della query
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Query eseguita:', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error('[DB] Errore query:', {
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Esegue una singola riga dal database
 * @param text - Query SQL
 * @param params - Parametri della query (opzionale)
 * @returns La prima riga del risultato o undefined
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | undefined> {
  const result = await query<T>(text, params);
  return result.rows[0];
}

/**
 * Esegue un comando senza aspettare risultati
 * @param text - Query SQL
 * @param params - Parametri della query (opzionale)
 */
export async function execute(text: string, params?: any[]): Promise<void> {
  await query(text, params);
}

/**
 * Chiude il pool di connessioni
 * Utile solo per cleanup nel testing
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[DB] Pool di connessioni chiuso');
  }
}

/**
 * Verifica la connessione al database
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
