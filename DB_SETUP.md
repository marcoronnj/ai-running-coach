# Database Setup - Neon Postgres

## 📁 Struttura Cartelle Finale

```
ai-running-coach/
├── lib/
│   └── db.ts                    ← Gestione connessione Postgres
├── app/
│   ├── api/
│   │   ├── strava/
│   │   └── setup-db/
│   │       └── route.ts         ← Route per inizializzare DB
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── .env.local                   ← Contiene DATABASE_URL
├── package.json
├── tsconfig.json
└── ...
```

## 🔧 Configurazione .env.local

Il file `.env.local` deve contenere:

```env
# Neon Postgres
DATABASE_URL=postgresql://neondb_owner:npg_...@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require

# Opzionale: protezione route setup-db
SETUP_SECRET=your-secret-key-here

# Altre variabili...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
APP_URL=http://localhost:3000
```

### Note su SETUP_SECRET:
- **Se NON presente:** La route `/api/setup-db` è pubblica (perfetto per locale)
- **Se presente:** La route richiede `?secret=SETUP_SECRET` nel query string
- **In produzione:** Sempre configura SETUP_SECRET in Vercel/hosting

## 🚀 Come Testare Localmente

### 1️⃣ Verifica che pg sia installato

```bash
npm list pg
```

Deve mostrare:
```
└── pg@8.20.0
```

Se manca, installa:
```bash
npm install pg
npm install -D @types/pg
```

### 2️⃣ Avvia il server di sviluppo

```bash
npm run dev
```

Output atteso:
```
▲ Next.js 16.2.4
  - Local:        http://localhost:3000
  ✓ Ready in 2.1s
  [DB] Connessione al database stabilita
```

### 3️⃣ Esegui il setup del database

Apri nel browser:

```
http://localhost:3000/api/setup-db
```

Se hai configurato `SETUP_SECRET` in `.env.local`, usa:

```
http://localhost:3000/api/setup-db?secret=your-secret-key-here
```

### 4️⃣ Verifica la risposta

Dovresti vedere JSON:

```json
{
  "ok": true,
  "message": "Database setup completato con successo",
  "tablesCreated": ["activities", "coach_reports", "sync_logs"],
  "indicesCreated": 6
}
```

### 5️⃣ Verifica le tabelle su Neon

1. Vai su https://console.neon.tech
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**
4. Esegui:
   ```sql
   \dt
   ```
   Dovresti vedere:
   ```
                     List of relations
    Schema |         Name         | Type  |  Owner
   --------+----------------------+-------+---------
    public | activities           | table | neondb_owner
    public | coach_reports        | table | neondb_owner
    public | sync_logs            | table | neondb_owner
   (3 rows)
   ```

5. Verifica gli indici:
   ```sql
   \di
   ```

## 📋 Struttura delle Tabelle

### Tabella: `activities`

```sql
CREATE TABLE activities (
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
```

**Indici:**
- `idx_activities_strava_id` su `strava_id` (cerca veloce per ID Strava)
- `idx_activities_created_at` su `created_at DESC` (query cronologiche)

**Uso:**
```typescript
import { query } from '@/lib/db';

// Inserisci un'attività
await query(
  'INSERT INTO activities (id, strava_id, name, type, start_date, distance_m) VALUES ($1, $2, $3, $4, $5, $6)',
  [id, stravaId, name, type, startDate, distance]
);

// Leggi un'attività
const activity = await query(
  'SELECT * FROM activities WHERE strava_id = $1',
  [stravaId]
);
```

### Tabella: `coach_reports`

```sql
CREATE TABLE coach_reports (
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
```

**Indici:**
- `idx_coach_reports_activity_id` su `activity_id` (query join con activities)
- `idx_coach_reports_created_at` su `created_at DESC`

**Uso:**
```typescript
// Inserisci un report
await query(
  `INSERT INTO coach_reports 
   (activity_id, report_type, title, summary, risk_level, full_report) 
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [activityId, type, title, summary, risk, fullReport]
);

// Leggi i report di un'attività
const reports = await query(
  'SELECT * FROM coach_reports WHERE activity_id = $1 ORDER BY created_at DESC',
  [activityId]
);
```

### Tabella: `sync_logs`

```sql
CREATE TABLE sync_logs (
  id SERIAL PRIMARY KEY,
  status TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indice:**
- `idx_sync_logs_created_at` su `created_at DESC`

**Uso:**
```typescript
// Log di una sincronizzazione
await query(
  'INSERT INTO sync_logs (status, message) VALUES ($1, $2)',
  ['success', 'Sincronizzati 42 attività da Strava']
);
```

## 🔌 Modulo `lib/db.ts`

Esporta le seguenti funzioni:

### `query<T>(text, params?): Promise<QueryResult<T>>`

Esegue una query generica e ritorna il QueryResult completo di pg.

```typescript
const result = await query(
  'SELECT * FROM activities LIMIT 10'
);
console.log(result.rows);      // Array di righe
console.log(result.rowCount);  // Numero di righe
```

### `queryOne<T>(text, params?): Promise<T | undefined>`

Esegue una query e ritorna **solo la prima riga** (più conveniente).

```typescript
const activity = await queryOne(
  'SELECT * FROM activities WHERE id = $1',
  [activityId]
);
// activity è { id: '...', strava_id: '...', ... } oppure undefined
```

### `execute(text, params?): Promise<void>`

Esegue un comando senza aspettare risultati.

```typescript
await execute(
  'DELETE FROM sync_logs WHERE created_at < NOW() - INTERVAL \'30 days\''
);
```

### `checkConnection(): Promise<boolean>`

Verifica la connessione al database.

```typescript
const connected = await checkConnection();
if (!connected) {
  console.error('Errore di connessione al database');
}
```

### `closePool(): Promise<void>`

Chiude il pool di connessioni (utile solo per cleanup).

```typescript
// Solo in caso di shutdown
await closePool();
```

## 🔐 Sicurezza

### ✅ Best Practices Implementate

1. **Singleton Pool:** Evita di creare troppe connessioni in Next.js/Vercel
2. **SSL con Neon:** `ssl: { rejectUnauthorized: false }` (necessario per Neon)
3. **Connection Pooling:** Max 1 connessione per ottimizzare Neon
4. **Timeout:** 30s idle, 2s connection
5. **Error Handling:** Log dettagliati di errori
6. **Secret Protection:** SETUP_SECRET opzionale per proteggere la route
7. **Parametrized Queries:** Sempre usa `$1`, `$2` per evitare SQL injection
8. **TypeScript:** Type-safe con generics

### ⚠️ In Produzione (Vercel)

1. Configura `DATABASE_URL` in Project Settings → Environment Variables
2. Configura `SETUP_SECRET` in Environment Variables
3. La route setup-db sarà protetta da secret
4. Non committare `.env.local` (è in `.gitignore`)
5. Esegui il setup UNA SOLA VOLTA:
   ```
   https://tuodominio.com/api/setup-db?secret=SETUP_SECRET
   ```

## 🐛 Troubleshooting

### Errore: "DATABASE_URL non è configurato"

```
ERROR: DATABASE_URL non è configurato in .env.local
```

**Soluzione:**
1. Apri `.env.local`
2. Aggiungi:
   ```env
   DATABASE_URL=postgresql://...
   ```
3. Riavvia il server: `npm run dev`

### Errore: "ECONNREFUSED"

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Soluzione:**
- Verifica che `DATABASE_URL` sia corretto
- Controlla che Neon sia online
- Copia di nuovo la CONNECTION STRING da Neon

### Errore: "SSL certificate problem"

```
Error: ssl check failed
```

**Soluzione:**
- Il codice ha `ssl: { rejectUnauthorized: false }` per Neon
- Se il problema persiste, verifica che DATABASE_URL abbia `?sslmode=require`

### Errore: "relation already exists"

```
ERROR:  relation "activities" already exists
```

**Soluzione:**
- Le tabelle sono già state create
- Se vuoi ricreari, devi eliminarle manualmente su Neon:
  ```sql
  DROP TABLE IF EXISTS coach_reports;
  DROP TABLE IF EXISTS activities;
  DROP TABLE IF EXISTS sync_logs;
  ```
- Poi esegui di nuovo `/api/setup-db`

### La route `/api/setup-db` restituisce 403

```json
{"ok": false, "error": "Secret non valido o mancante"}
```

**Soluzione:**
- Hai configurato `SETUP_SECRET` in `.env.local`?
- Se sì, usa: `http://localhost:3000/api/setup-db?secret=SETUP_SECRET`
- Se no, accedi senza parametri: `http://localhost:3000/api/setup-db`

## 📊 Prossimi Passi

Dopo aver completato il setup:

1. **Importa il modulo db in altre route/componenti:**
   ```typescript
   import { query, queryOne } from '@/lib/db';
   ```

2. **Crea una route per sincronizzare da Strava:**
   ```typescript
   // app/api/strava/sync/route.ts
   import { query } from '@/lib/db';
   
   export async function POST() {
     // Usa il refresh_token per ottenere gli attacchi
     // Poi inserisci in activities
   }
   ```

3. **Crea una route per generare i report con OpenAI:**
   ```typescript
   // app/api/coach-report/route.ts
   import { queryOne } from '@/lib/db';
   
   export async function POST(request: Request) {
     // Leggi l'attività
     // Chiama OpenAI
     // Salva il report in coach_reports
   }
   ```

## 📝 Comandi Utili

```bash
# Installa dipendenze se mancano
npm install pg
npm install -D @types/pg

# Avvia il server
npm run dev

# Build per produzione
npm run build

# Avvia il server di produzione
npm start
```

## 🔗 Link Utili

- [Documentazione Neon](https://neon.tech/docs)
- [Documentazione pg (Node.js Postgres Client)](https://node-postgres.com/)
- [Next.js API Routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes)
- [TypeScript + Postgres](https://www.postgresql.org/docs/current/)
