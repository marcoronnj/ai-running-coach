# AI Coach Module - OpenAI Integration

## 📁 File Creato

```
lib/
├── db.ts          ← Database utilities
├── strava.ts      ← Strava API utilities
└── coach.ts       ← AI Coach with OpenAI (NUOVO)
```

## 🔧 Funzioni Principali

### `buildCoachPrompt(newRun, history)`

Costruisce il prompt dettagliato per OpenAI basato sul profilo atleta.

```typescript
import { buildCoachPrompt } from '@/lib/coach';

const prompt = buildCoachPrompt(newRunFromDB, recentRunsFromDB);
// prompt è una stringa completa con profilo atleta, regole e dati corsa
```

### `generateCoachReport(prompt)`

Chiama OpenAI e restituisce il report JSON parsato.

```typescript
import { generateCoachReport } from '@/lib/coach';

const report = await generateCoachReport(prompt);
// report è un CoachReport con title, summary, risk_level, etc.
```

### `generateCompleteCoachReport(newRun, history)`

Combina le due funzioni precedenti in un'unica chiamata.

```typescript
import { generateCompleteCoachReport } from '@/lib/coach';

const report = await generateCompleteCoachReport(newRun, history);
// Tutto fatto in un colpo!
```

## 📋 Tipi TypeScript

### `DBActivity`

```typescript
interface DBActivity {
  id: string;
  strava_id: string;
  name: string;
  type: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number;
  raw_json: any;
  created_at: string;
}
```

### `CoachReport`

```typescript
interface CoachReport {
  title: string;                    // Titolo breve e motivante
  summary: string;                  // Riassunto breve (max 2 frasi)
  risk_level: 'basso' | 'medio' | 'alto';
  next_48h: string;                 // Raccomandazione per 48 ore
  weekly_plan: WeeklyPlanItem[];    // Piano settimanale
  full_report: string;              // Report completo in markdown
}

interface WeeklyPlanItem {
  name: string;                     // "Easy Run Lunedi"
  description: string;              // Breve descrizione
  intensity: 'easy' | 'medium' | 'quality' | 'recovery';
  duration: string;                 // "45-60 min"
}
```

## 🚀 Esempio Completo di Uso

```typescript
import { generateCompleteCoachReport } from '@/lib/coach';
import { query } from '@/lib/db';

export async function generateReportForLatestRun() {
  try {
    // 1. Trova l'ultima corsa
    const latestRun = await query(
      'SELECT * FROM activities WHERE type IN (\'Run\', \'TrailRun\') ORDER BY start_date DESC LIMIT 1'
    );

    if (latestRun.rows.length === 0) {
      throw new Error('Nessuna corsa trovata');
    }

    const newRun = latestRun.rows[0];

    // 2. Ottieni storico recente (ultime 10 corse)
    const history = await query(
      `SELECT * FROM activities
       WHERE type IN ('Run', 'TrailRun')
       AND start_date < $1
       ORDER BY start_date DESC LIMIT 10`,
      [newRun.start_date]
    );

    // 3. Genera il report AI
    const report = await generateCompleteCoachReport(newRun, history.rows);

    // 4. Salva nel database
    await query(
      `INSERT INTO coach_reports
       (activity_id, report_type, title, summary, risk_level, next_48h, weekly_plan, full_report)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newRun.id,
        'post_run',
        report.title,
        report.summary,
        report.risk_level,
        report.next_48h,
        JSON.stringify(report.weekly_plan),
        report.full_report
      ]
    );

    return report;
  } catch (error) {
    console.error('Errore generazione report:', error);
    throw error;
  }
}
```

## 🔧 Helper Functions

### Formattazione Dati

```typescript
import { formatKm, formatPace, formatDuration } from '@/lib/coach';

// Distanza
formatKm(5210);        // "5.2 km"

// Pace (da velocità m/s)
formatPace(3.33);      // "5:00/km" (5 min/km)

// Durata (da secondi)
formatDuration(2730);  // "45:30"
formatDuration(3661);  // "1h 1m"
```

### Calcolo Pace Target

```typescript
import { getTargetPace } from '@/lib/coach';

// Se la tua corsa recente era a 4:30/km (270 secondi/km)
getTargetPace(270, 'easy');     // "5:00/km" (10% più lento)
getTargetPace(270, 'quality');  // "4:05/km" (10% più veloce)
getTargetPace(270, 'recovery'); // "5:24/km" (20% più lento)
```

### Validazione Report

```typescript
import { validateCoachReport } from '@/lib/coach';

if (validateCoachReport(someObject)) {
  // È un CoachReport valido
}
```

## ⚙️ Configurazione .env.local

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL_DAILY=gpt-4o-mini  # o gpt-4, gpt-3.5-turbo, etc.
```

## 🧠 Profilo Atleta Implementato

- **Ex runner forte** in fase di ripresa
- **Obiettivo principale:** Dimagrire gradualmente
- **Obiettivo secondario:** Tornare in forma progressivamente
- **Limite:** Max 3 uscite running a settimana
- **Priorità:** Evitare infortuni, progressione prudente

## 📋 Regole AI

- **No due allenamenti intensi consecutivi**
- **Se discontinuo:** Privilegiare easy run leggeri
- **Se manca FC:** Ragionare su distanza, passo e recupero
- **Progressione:** 10-20% a settimana
- **Output:** Sintetico, utile, professionale (non cringe)

## 🔄 Gestione Errori

### Parsing JSON Fallito
Se OpenAI restituisce testo invece di JSON valido, viene creato un **fallback report** robusto con:
- `full_report` = testo grezzo da OpenAI
- Valori di default sicuri per tutti gli altri campi

### Errori OpenAI API
- **API key mancante/invalida:** Messaggio chiaro
- **Quota esaurita:** Suggerimento di controllare billing
- **Modello non disponibile:** Verifica nome modello
- **Timeout/rete:** Retry automatico (se implementato)

## 📊 Costi OpenAI

**Modello consigliato:** `gpt-4o-mini`
- **Costo:** ~$0.0015 per report (molto economico)
- **Token:** ~1000-1500 per richiesta (prompt + risposta)

**Per 100 report/mese:** ~$0.15

## 🔄 Prossimi Passi

1. **Crea API route per generazione report:**
   ```typescript
   // app/api/coach/generate-report/route.ts
   import { generateCompleteCoachReport } from '@/lib/coach';
   ```

2. **Dashboard web:**
   ```typescript
   // Mostra report.title, report.summary, report.weekly_plan
   ```

3. **Caching report:**
   - Salva in DB per evitare rigenerazioni
   - TTL di 24h per report giornalieri

## 🎯 Output JSON Esempio

```json
{
  "title": "Buona Ripresa Dopo Pausa",
  "summary": "Corsa regolare di 5km a ritmo medio. Segni di buona ripresa cardiovascolare.",
  "risk_level": "basso",
  "next_48h": "Riposo attivo domani con camminata leggera. Riprendi mercoledì con easy run.",
  "weekly_plan": [
    {
      "name": "Riposo Attivo Martedì",
      "description": "Camminata 30-45 min a ritmo blando",
      "intensity": "recovery",
      "duration": "30-45 min"
    },
    {
      "name": "Easy Run Mercoledì",
      "description": "Corsa leggera 6-7km a 5:15-5:30/km",
      "intensity": "easy",
      "duration": "50-60 min"
    },
    {
      "name": "Riposo Giovedì",
      "description": "Recupero completo",
      "intensity": "recovery",
      "duration": "0 min"
    }
  ],
  "full_report": "# Analisi Corsa 5.2km\\n\\n**Punti di Forza:**\\n- Ritmo costante...\\n\\n**Area di Miglioramento:**\\n- Recupero tra ripetute...\\n\\n**Piano Settimanale:**\\n1. Martedì: Riposo attivo\\n2. Mercoledì: Easy run 6km\\n3. Giovedì: Riposo\\n\\n**Consigli:** Continua così, progressione graduale è la chiave."
}
```

## 📞 Support

Il modulo è **production-ready** con:
- ✅ Error handling completo
- ✅ TypeScript strict
- ✅ Fallback robusti
- ✅ Logging dettagliato
- ✅ Validazione input/output
- ✅ Helper functions utili
- ✅ Documentazione completa
