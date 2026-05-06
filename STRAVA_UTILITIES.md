# Strava API Utilities

## 📁 File Creato

```
lib/
├── db.ts          ← Database utilities
└── strava.ts      ← Strava API utilities (NUOVO)
```

## 🔧 Funzioni Esportate

### `refreshStravaToken()`

Refresh del token di accesso Strava usando il refresh_token salvato.

```typescript
import { refreshStravaToken } from '@/lib/strava';

try {
  const tokenData = await refreshStravaToken();
  console.log('New access token:', tokenData.access_token);
  console.log('Expires at:', new Date(tokenData.expires_at * 1000));
} catch (error) {
  console.error('Token refresh failed:', error.message);
}
```

**Ritorna:**
```typescript
{
  token_type: "Bearer",
  expires_at: 1640995200,
  expires_in: 21600,
  refresh_token: "new_refresh_token...",
  access_token: "new_access_token...",
  athlete: { id, firstname, lastname, ... }
}
```

### `getRecentActivities(accessToken)`

Recupera le ultime 30 attività dell'atleta.

```typescript
import { getRecentActivities } from '@/lib/strava';

const tokenData = await refreshStravaToken();
const activities = await getRecentActivities(tokenData.access_token);

console.log(`Found ${activities.length} activities`);
```

**Ritorna:** `StravaActivity[]`

### `isRunningActivity(activity)`

Verifica se un'attività è una corsa (Run o TrailRun).

```typescript
import { isRunningActivity, filterRunningActivities } from '@/lib/strava';

const activities = await getRecentActivities(accessToken);

// Singola attività
if (isRunningActivity(activities[0])) {
  console.log('Questa è una corsa!');
}

// Filtra tutto l'array
const runningActivities = filterRunningActivities(activities);
console.log(`${runningActivities.length} corse trovate`);
```

### `formatActivityForDB(activity)`

Converte un'attività Strava nel formato per il database.

```typescript
import { formatActivityForDB } from '@/lib/strava';
import { query } from '@/lib/db';

const activity = await getRecentActivities(accessToken);
const dbFormat = formatActivityForDB(activity[0]);

await query(
  `INSERT INTO activities
   (id, strava_id, name, type, start_date, distance_m, raw_json)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [
    dbFormat.id,
    dbFormat.strava_id,
    dbFormat.name,
    dbFormat.type,
    dbFormat.start_date,
    dbFormat.distance_m,
    JSON.stringify(dbFormat.raw_json)
  ]
);
```

### Utility Aggiuntive

```typescript
import { isTokenExpired, getTokenMinutesRemaining } from '@/lib/strava';

// Verifica se token è scaduto (con 5 minuti di buffer)
const expired = isTokenExpired(tokenData.expires_at);

// Quanti minuti mancano alla scadenza
const minutesLeft = getTokenMinutesRemaining(tokenData.expires_at);
console.log(`${minutesLeft} minuti rimanenti`);
```

## 📋 Tipi TypeScript

### `StravaTokenResponse`

```typescript
interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    // ... altri campi atleta
  };
}
```

### `StravaActivity`

```typescript
interface StravaActivity {
  id: number;
  name: string;
  type: string; // "Run", "TrailRun", "Ride", etc.
  start_date: string;
  distance: number; // metri
  moving_time: number; // secondi
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number; // metri
  // ... molti altri campi
}
```

## 🚀 Esempio Completo di Uso

```typescript
import {
  refreshStravaToken,
  getRecentActivities,
  filterRunningActivities,
  formatActivityForDB
} from '@/lib/strava';
import { query } from '@/lib/db';

export async function syncStravaActivities() {
  try {
    // 1. Refresh token
    const tokenData = await refreshStravaToken();

    // 2. Ottieni attività recenti
    const activities = await getRecentActivities(tokenData.access_token);

    // 3. Filtra solo corse
    const runningActivities = filterRunningActivities(activities);
    console.log(`Syncing ${runningActivities.length} running activities`);

    // 4. Salva nel database
    for (const activity of runningActivities) {
      const dbData = formatActivityForDB(activity);

      await query(
        `INSERT INTO activities
         (id, strava_id, name, type, start_date, distance_m, raw_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (strava_id) DO NOTHING`,
        [
          dbData.id,
          dbData.strava_id,
          dbData.name,
          dbData.type,
          dbData.start_date,
          dbData.distance_m,
          JSON.stringify(dbData.raw_json)
        ]
      );
    }

    return { success: true, synced: runningActivities.length };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}
```

## 🔐 Gestione Errori

Tutte le funzioni gestiscono errori con messaggi chiari:

- **Token refresh fallito:** Credenziali mancanti, token scaduto, etc.
- **API call fallito:** Token non valido, rate limit, permessi mancanti
- **Risposta malformata:** JSON non valido, campi mancanti

## 📊 Rate Limiting

Strava ha limiti di richieste:
- **100 richieste/15 minuti** per atleta
- **1000 richieste/giorno** per atleta
- **100 richieste/15 minuti** per app

Il codice logga tutte le richieste per monitorare l'uso.

## 🔄 Prossimi Passi

1. **Crea una API route per la sincronizzazione:**
   ```typescript
   // app/api/strava/sync/route.ts
   import { syncStravaActivities } from '@/lib/strava';
   ```

2. **Aggiungi cron job per sync automatico:**
   - Usa Vercel Cron Jobs
   - O un servizio come GitHub Actions

3. **Implementa cache:**
   - Salva token in Redis/database
   - Evita refresh troppo frequenti

4. **Aggiungi retry logic:**
   - Per errori temporanei (429, 500)
   - Exponential backoff
