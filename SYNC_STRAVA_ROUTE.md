# Sync Strava Route - Documentazione Completa

## 📁 File Creato

```
app/
├── api/
│   └── sync-strava/
│       └── route.ts              ← Route principale di sync
```

## 🚀 Come Usare la Route

### URL della Route
```
GET /api/sync-strava?secret=CRON_SECRET
```

### Esempio Completo
```bash
# Con il tuo CRON_SECRET
curl "http://localhost:3000/api/sync-strava?secret=agsdigadsi6hajks3233dd"
```

## ⚙️ Configurazione Richiesta

Assicurati che `.env.local` contenga:

```env
# Strava
STRAVA_CLIENT_ID=236533
STRAVA_CLIENT_SECRET=400f74441f7f327fe60729821d091f0635fea372
STRAVA_REFRESH_TOKEN=d559c750d04355ef254004c8d1773cae12a34869

# OpenAI
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL_DAILY=gpt-4o-mini

# Telegram (opzionale)
TELEGRAM_BOT_TOKEN=8203843600:...
TELEGRAM_CHAT_ID=686664665

# Sicurezza
CRON_SECRET=agsdigadsi6hajks3233dd

# App
APP_URL=http://localhost:3000
```

## 🔄 Flusso di Sincronizzazione

### 1. **Verifica Sicurezza**
- Controlla `CRON_SECRET` in `.env.local`
- Valida parametro `?secret=...` nella richiesta
- **Timeout:** 60 secondi (Vercel limit)

### 2. **Refresh Token Strava**
- Chiama `refreshStravaToken()` da `lib/strava.ts`
- Ottiene nuovo `access_token` valido

### 3. **Scarica Attività**
- Chiama `getRecentActivities()` - ultime 30 attività
- Filtra solo `Run` e `TrailRun` con `filterRunningActivities()`

### 4. **Salva nel Database**
- Per ogni corsa: `formatActivityForDB()` + INSERT
- Usa `ON CONFLICT (strava_id) DO NOTHING` per evitare duplicati
- Se nessuna nuova corsa → termina con successo

### 5. **Processa Nuove Corse**
Per ogni nuova corsa:

#### a) **Ottieni Storico**
```sql
SELECT * FROM activities
WHERE type IN ('Run', 'TrailRun')
AND start_date < $1
ORDER BY start_date DESC
LIMIT 50
```

#### b) **Genera Report AI**
- `buildCoachPrompt(newRun, history)` - costruisce prompt
- `generateCoachReport(prompt)` - chiama OpenAI
- Salva in `coach_reports`

#### c) **Invia Telegram**
- Format messaggio con: titolo, distanza, pace, FC, summary, rischio, prossime 48h
- Include link dashboard: `${APP_URL}/runs/${run.id}`
- Chiama `sendTelegramMessage()`

### 6. **Logging**
- **Success:** Salva in `sync_logs` con status "success"
- **Error:** Salva in `sync_logs` con status "error"

## 📊 Risposte della Route

### ✅ Sincronizzazione Riuscita
```json
{
  "ok": true,
  "message": "Sincronizzazione completata con successo",
  "activitiesChecked": 30,
  "runningActivities": 5,
  "newActivities": 2,
  "processedActivities": [
    {
      "id": "1234567890",
      "name": "Corsa Parco",
      "reportGenerated": true,
      "telegramSent": true
    }
  ],
  "duration": "45.2s"
}
```

### ✅ Nessuna Nuova Corsa
```json
{
  "ok": true,
  "message": "Nessuna nuova corsa da sincronizzare",
  "activitiesChecked": 30,
  "runningActivities": 3,
  "newActivities": 0
}
```

### ❌ Errore
```json
{
  "ok": false,
  "error": "Errore durante la sincronizzazione",
  "message": "Token Strava scaduto",
  "duration": "5.1s"
}
```

## 🧪 Come Testare Localmente

### 1. **Avvia il Server**
```bash
npm run dev
```

### 2. **Test della Route**
```bash
# Sostituisci con il tuo CRON_SECRET
curl "http://localhost:3000/api/sync-strava?secret=agsdigadsi6hajks3233dd"
```

### 3. **Verifica Database**
```sql
-- Controlla nuove attività
SELECT id, name, start_date, distance_m
FROM activities
ORDER BY created_at DESC
LIMIT 5;

-- Controlla report generati
SELECT title, summary, risk_level, created_at
FROM coach_reports
ORDER BY created_at DESC
LIMIT 5;

-- Controlla log sync
SELECT status, message, created_at
FROM sync_logs
ORDER BY created_at DESC
LIMIT 5;
```

### 4. **Verifica Telegram**
Dovresti ricevere messaggi come:
```
🏃‍♂️ Buona Ripresa Dopo Pausa

📊 Corsa Parco 5km
📏 5.2 km • ⏱️ 5:30/km • FC 150 bpm

📝 Riepilogo:
Corsa regolare a ritmo medio...

⚠️ Rischio: 🟢 BASSO

⏰ Prossime 48h:
Riposo attivo domani...

🔗 Vedi Report Completo
```

## ⏰ Scheduling Automatico

### **Vercel Cron Jobs**
Aggiungi in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/sync-strava?secret=agsdigadsi6hajks3233dd",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Ogni 6 ore** alle 00:00, 06:00, 12:00, 18:00.

### **GitHub Actions**
Crea `.github/workflows/sync-strava.yml`:
```yaml
name: Sync Strava Activities
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger sync
        run: |
          curl -X GET "https://tuodominio.com/api/sync-strava?secret=${{ secrets.CRON_SECRET }}"
```

## 🛡️ Gestione Errori

### **Errori Gestiti**
- ✅ **Token Strava scaduto** → Log errore, status 500
- ✅ **OpenAI quota esaurita** → Log errore, continua con altre corse
- ✅ **Telegram non configurato** → Salta invio, continua
- ✅ **Database connection** → Log errore, status 500
- ✅ **Timeout 60s** → Vercel interrompe automaticamente

### **Errori Non Bloccanti**
- **Report AI fallito** → Salva attività senza report
- **Telegram fallito** → Log warning, continua
- **Storico non disponibile** → Usa array vuoto

### **Logging Completo**
Ogni sync viene loggato in `sync_logs`:
```sql
SELECT * FROM sync_logs ORDER BY created_at DESC;
```

## 📈 Performance

### **Ottimizzazioni Implementate**
- **Batch processing:** Una corsa alla volta per evitare timeout
- **Connection pooling:** Riutilizzo connessioni DB
- **Efficient queries:** LIMIT e indici sulle date
- **Error recovery:** Continua con altre corse se una fallisce

### **Limiti e Timeout**
- **60 secondi** massimo (Vercel)
- **~30 attività** scaricate da Strava
- **50 corse** storiche per report AI
- **Rate limit Strava:** 100 req/15min, 1000/giorno

## 🔍 Debug e Troubleshooting

### **Log Console**
```bash
npm run dev
# Guarda i log durante il sync
```

### **Verifica Stato**
```sql
-- Ultimo sync
SELECT status, message, created_at
FROM sync_logs
ORDER BY created_at DESC
LIMIT 1;

-- Corse oggi
SELECT COUNT(*) as corse_oggi
FROM activities
WHERE DATE(start_date) = CURRENT_DATE;

-- Report oggi
SELECT COUNT(*) as report_oggi
FROM coach_reports
WHERE DATE(created_at) = CURRENT_DATE;
```

### **Test Manuale**
```bash
# Test senza salvare nel DB
curl "http://localhost:3000/api/sync-strava?secret=agsdigadsi6hajks3233dd"

# Verifica risposta JSON
```

### **Problemi Comuni**

#### **"Secret non valido"**
- Verifica `CRON_SECRET` in `.env.local`
- Controlla parametro `?secret=` nell'URL

#### **"Token Strava scaduto"**
- Rinnova OAuth flow: `/api/strava/auth-url`
- Aggiorna `STRAVA_REFRESH_TOKEN`

#### **"OpenAI quota esaurita"**
- Controlla billing OpenAI
- Cambia modello a `gpt-3.5-turbo`

#### **"Database connection"**
- Verifica `DATABASE_URL`
- Controlla che Neon sia attivo

#### **Timeout 60s**
- Troppi dati da processare
- Riduci a 20 attività storiche
- Implementa pagination

## 🔄 Prossimi Passi

1. **Dashboard Web**
   - Crea `/runs/[id]` per vedere report
   - Lista corse con filtri

2. **Metriche Avanzate**
   - Grafici progresso
   - Statistiche settimanali/mensili

3. **Notifiche Smart**
   - Solo per corse lunghe (>10km)
   - Riepiloghi settimanali

4. **Integrazione App Mobile**
   - API per app React Native
   - Push notifications

## 📞 Support

**Route completamente funzionale per:**
- ✅ Sincronizzazione automatica Strava
- ✅ Generazione report AI con OpenAI
- ✅ Notifiche Telegram formattate
- ✅ Logging completo errori/successi
- ✅ Sicurezza con CRON_SECRET
- ✅ Gestione timeout Vercel
- ✅ Error recovery intelligente

**Pronto per deploy in produzione!** 🚀
