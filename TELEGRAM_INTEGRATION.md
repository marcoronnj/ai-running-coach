# Telegram Integration

## 📁 File Creati

```
lib/
├── telegram.ts                    ← Utility Telegram
app/
├── api/
│   └── test-telegram/
│       └── route.ts              ← Route di test
```

## 🔧 Funzione Principale

### `sendTelegramMessage(text: string)`

Invia un messaggio HTML a Telegram in modo sicuro.

```typescript
import { sendTelegramMessage } from '@/lib/telegram';

// Messaggio semplice
await sendTelegramMessage('Ciao dal bot!');

// Messaggio con HTML
await sendTelegramMessage('<b>Grassetto</b> e <i>corsivo</i>');
```

**Caratteristiche:**
- ✅ **Graceful degradation:** Se mancano le credenziali, logga warning e continua
- ✅ **Error handling:** Logga errori specifici di Telegram
- ✅ **HTML support:** `parse_mode: 'HTML'`
- ✅ **No previews:** `disable_web_page_preview: true`

## 🚀 Come Testare

### 1. Verifica Configurazione

```bash
# Controlla che le variabili siano in .env.local
cat .env.local | grep TELEGRAM
```

Dovresti vedere:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=686664665
CRON_SECRET=agsdigadsi6hajks3233dd
```

### 2. Avvia il Server

```bash
npm run dev
```

### 3. Testa la Route

Apri nel browser:

```
http://localhost:3000/api/test-telegram?secret=agsdigadsi6hajks3233dd
```

**Risposta attesa:**
```json
{
  "ok": true,
  "message": "Messaggio di test inviato con successo a Telegram"
}
```

### 4. Verifica su Telegram

Dovresti ricevere questo messaggio:

```
🤖 AI Running Coach

✅ Test Telegram riuscito!

Il bot è configurato correttamente e può ricevere notifiche.
```

## 📋 Funzioni Helper

### `sendTestMessage()`

Invia automaticamente un messaggio di test.

```typescript
import { sendTestMessage } from '@/lib/telegram';

const success = await sendTestMessage();
// true se inviato, false se errore
```

### `formatCoachReportForTelegram(report, activityName)`

Formatta un report del coach per Telegram.

```typescript
import { formatCoachReportForTelegram } from '@/lib/telegram';

const message = formatCoachReportForTelegram(report, 'Corsa Parco 5km');
// message è pronto per sendTelegramMessage()
```

**Output esempio:**
```
🏃‍♂️ Buona Ripresa Dopo Pausa

📊 Attività: Corsa Parco 5km

📝 Riepilogo:
Corsa regolare di 5km a ritmo medio...

⚠️ Livello Rischio: 🟢 BASSO

⏰ Prossime 48h:
Riposo attivo domani...

📋 Report Completo:
# Analisi Corsa 5.2km
...
```

### `isTelegramConfigured()`

Verifica se Telegram è configurato.

```typescript
import { isTelegramConfigured } from '@/lib/telegram';

if (isTelegramConfigured()) {
  // Invia notifiche
} else {
  // Salta Telegram
}
```

### `getTelegramConfig()`

Ottieni info di debug sulla configurazione.

```typescript
import { getTelegramConfig } from '@/lib/telegram';

const config = getTelegramConfig();
// { configured: true, hasToken: true, hasChatId: true, tokenPrefix: "8203843600..." }
```

## 🔧 Integrazione con Sync Strava

Da `/api/sync-strava/route.ts`:

```typescript
import { sendTelegramMessage, formatCoachReportForTelegram } from '@/lib/telegram';
import { generateCompleteCoachReport } from '@/lib/coach';

// Dopo aver salvato la corsa e generato il report
const report = await generateCompleteCoachReport(newRun, history);

// Invia notifica Telegram
const telegramMessage = formatCoachReportForTelegram(report, newRun.name);
await sendTelegramMessage(telegramMessage);
```

## ⚙️ Configurazione .env.local

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=REMOVED_TELEGRAM_TOKEN
TELEGRAM_CHAT_ID=686664665

# Protezione route test
CRON_SECRET=agsdigadsi6hajks3233dd
```

### Come Ottenere le Credenziali

1. **Crea un bot Telegram:**
   - Messaggia a [@BotFather](https://t.me/botfather)
   - Comando: `/newbot`
   - Segui le istruzioni
   - Copia il token ricevuto

2. **Ottieni il Chat ID:**
   - Avvia il bot appena creato
   - Messaggia qualcosa al bot
   - Vai su: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Trova il `"chat":{"id":686664665,...}`

3. **CRON_SECRET:**
   - Genera una stringa casuale per proteggere la route di test

## 🛡️ Sicurezza

### ✅ Best Practices Implementate

1. **Credenziali opzionale:** L'app non si rompe se manca Telegram
2. **Secret protection:** Route di test protetta da `CRON_SECRET`
3. **Error logging:** Errori specifici senza esporre dati sensibili
4. **HTML sanitization:** Telegram valida automaticamente l'HTML
5. **Rate limiting:** Rispetta i limiti di Telegram (30 msg/sec)

### ⚠️ In Produzione

- **Non committare** `.env.local` (è in `.gitignore`)
- **Configura** le variabili su Vercel/Netlify
- **Monitora** gli errori nei log di produzione
- **Rate limiting:** Aggiungi delay tra messaggi multipli

## 🐛 Troubleshooting

### Errore: "403 Forbidden"

```
[TELEGRAM] Errore API Telegram: 403
Descrizione errore: Forbidden: bot was blocked by the user
```

**Soluzione:**
- Avvia una chat con il bot su Telegram
- Invia `/start` al bot

### Errore: "400 Bad Request"

```
[TELEGRAM] Errore API Telegram: 400
Descrizione errore: Bad Request: can't parse entities
```

**Soluzione:**
- Errore nell'HTML. Controlla tag aperti/chiusi
- Usa caratteri di escape: `<` → `&lt;`, `>` → `&gt;`

### Errore: "429 Too Many Requests"

```
[TELEGRAM] Errore API Telegram: 429
```

**Soluzione:**
- Aspetta qualche secondo tra i messaggi
- Implementa retry con exponential backoff

### Test route restituisce 403

```json
{"ok": false, "error": "Secret non valido"}
```

**Soluzione:**
- Verifica `CRON_SECRET` in `.env.local`
- Usa: `?secret=CRON_SECRET` nell'URL

### Nessun messaggio ricevuto

- Verifica che il bot sia avviato
- Controlla che `TELEGRAM_CHAT_ID` sia corretto
- Prova a mandare `/start` al bot

## 📊 Limiti Telegram

- **30 messaggi/secondo** per bot
- **4096 caratteri** per messaggio
- **HTML limitato:** non tutti i tag sono supportati
- **Media:** foto, video, documenti fino 50MB

## 🔄 Prossimi Passi

1. **Integrazione con sync:**
   ```typescript
   // In /api/sync-strava/route.ts
   await sendTelegramMessage(formatCoachReportForTelegram(report, activity.name));
   ```

2. **Notifiche giornaliere:**
   - Cron job per riepilogo giornaliero
   - Motivazionali quotes

3. **Interattività:**
   - Rispondi a comandi dell'utente
   - Inline keyboard per feedback

4. **Gruppi:**
   - Supporto per chat multiple
   - Canali pubblici

## 📞 Support

**Tag HTML supportati da Telegram:**
- `<b>bold</b>`
- `<i>italic</i>`
- `<u>underline</u>`
- `<s>strikethrough</s>`
- `<code>code</code>`
- `<pre>pre</pre>`
- `<a href="...">link</a>`

**Non supportati:**
- `<br>`, `<p>`, `<div>`, CSS, etc.
