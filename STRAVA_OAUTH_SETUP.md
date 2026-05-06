# Flusso OAuth Strava - Documentazione Completa

## 📁 Struttura Cartelle Finale

```
ai-running-coach/
├── app/
│   ├── api/
│   │   └── strava/
│   │       ├── auth-url/
│   │       │   └── route.ts          ← Inizia il flusso OAuth
│   │       └── callback/
│   │           └── route.ts          ← Riceve il code e scambia i token
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── .env.local                         ← Contiene credenziali Strava
├── next.config.ts
├── package.json
├── tsconfig.json
└── ...
```

## 🔧 Configurazione .env.local

Il file `.env.local` nella root del progetto deve contenere:

```env
# Strava OAuth Credentials (già presenti)
STRAVA_CLIENT_ID=236533
STRAVA_CLIENT_SECRET=400f74441f7f327fe60729821d091f0635fea372

# Dopo il primo login con OAuth, aggiungi:
STRAVA_REFRESH_TOKEN=<il-token-ricevuto-dal-callback>

# URL dell'applicazione (per redirect_uri)
APP_URL=http://localhost:3000
```

## 🚀 Come Testare Localmente

### 1️⃣ Avvia il Server di Sviluppo

```bash
# Dalla radice del progetto
npm run dev
```

Output atteso:
```
> ai-running-coach@0.1.0 dev
> next dev

  ▲ Next.js 16.2.4
  - Local:        http://localhost:3000
  - Environments: .env.local
  ✓ Ready in 2.1s
```

### 2️⃣ Apri il Browser e Naviga alla Route di Autenticazione

Apri questo URL nel browser:

```
http://localhost:3000/api/strava/auth-url
```

**Cosa succede:**
- La pagina reindirizza automaticamente a `https://www.strava.com/oauth/authorize?...`
- Strava ti chiede di autorizzare l'accesso

### 3️⃣ Autorizza su Strava

- Accedi con il tuo account Strava
- Clicca **"Authorize"** per concedere i permessi richiesti (activity:read_all)
- Strava ti reindirizza a `http://localhost:3000/api/strava/callback?code=...`

### 4️⃣ Vedi i Tuoi Token

La pagina di callback mostra:
- ✅ Nome atleta
- ✅ Access Token
- ✅ **Refresh Token** (⭐ quello importante)
- ✅ Scadenza (expires_at)

Ogni token ha un pulsante **Copia** per copiarli facilmente.

### 5️⃣ Salva il Refresh Token in .env.local

1. Clicca il pulsante **Copia** accanto al **Refresh Token**
2. Apri il file `.env.local` nel tuo editor
3. Aggiungi o aggiorna questa riga:
   ```env
   STRAVA_REFRESH_TOKEN=d559c750d04355ef254004c8d1773cae12a34869
   ```
4. Salva il file
5. Riavvia il server:
   ```bash
   # Ctrl+C per stoppare il server
   npm run dev
   ```

### 6️⃣ Verifica

Puoi verificare che il token è caricato correttamente eseguendo in Node.js:

```javascript
console.log(process.env.STRAVA_REFRESH_TOKEN);
// Dovrebbe stampare il token, non undefined
```

## 📋 Dettagli Tecnici delle Route

### Route: `/api/strava/auth-url`

**File:** `app/api/strava/auth-url/route.ts`

**Cosa fa:**
- Legge `STRAVA_CLIENT_ID` da `.env.local`
- Costruisce l'URL OAuth con i parametri:
  - `client_id`: identificativo dell'app
  - `response_type=code`: tipo di flusso OAuth
  - `redirect_uri`: dove Strava invia il code
  - `approval_prompt=force`: forza la richiesta anche se già autorizzato
  - `scope=activity:read_all`: permesso per leggere tutte le attività
- Fa redirect automatico verso Strava

**Parametri richiesti:**
- `STRAVA_CLIENT_ID` (da .env.local)
- `APP_URL` (opzionale, default: http://localhost:3000)

### Route: `/api/strava/callback`

**File:** `app/api/strava/callback/route.ts`

**Cosa fa:**
1. Riceve il `code` dal query parameter di Strava
2. Scambia il code con i token:
   - Fa POST a `https://www.strava.com/oauth/token`
   - Invia: client_id, client_secret, code, grant_type
   - Riceve: access_token, refresh_token, expires_at
3. Valida la risposta
4. Ritorna una pagina HTML con:
   - Dati dell'atleta
   - Token con pulsanti "Copia"
   - Istruzioni per salvare nel .env.local
   - Styling moderno e responsive

**Parametri richiesti:**
- `code` (dal query string di Strava)
- `STRAVA_CLIENT_ID` (da .env.local)
- `STRAVA_CLIENT_SECRET` (da .env.local)

**Risposta in caso di errore:**
- Pagina HTML con errore leggibile
- Messaggi di errore dettagliati per:
  - Code mancante
  - Credenziali mancanti
  - Risposta Strava non valida
  - Errori di fetch

## 🔐 Sicurezza

### ✅ Best Practices Implementate

1. **Client Secret protetto:** Il `STRAVA_CLIENT_SECRET` rimane nel server (non esposto al client)
2. **Environment variables:** Tutte le credenziali sono in `.env.local`
3. **Errore handling:** Validazione completa di tutti i possibili errori
4. **HTTPS in produzione:** Usa `APP_URL` con https:// in produzione
5. **Approval prompt:** Force reauthorization per aumentare la sicurezza
6. **TypeScript:** Type-safe con interfacce per la risposta di Strava

### ⚠️ Attenzione in Produzione

1. Cambia `APP_URL` a `https://tuodominio.com`
2. Non commitare `.env.local` su git (è già in `.gitignore`)
3. Configura le variabili su:
   - **Vercel:** Project Settings → Environment Variables
   - **Heroku:** Settings → Config Vars
   - **Self-hosted:** Variabili di sistema del server

## 🐛 Troubleshooting

### Problema: "STRAVA_CLIENT_ID non configurato"

**Soluzione:**
```bash
# Verifica che .env.local esista e contenga:
cat .env.local | grep STRAVA_CLIENT_ID
```

### Problema: "Code mancante"

**Soluzione:**
- Verifica che il redirect_uri nel callback corrisponda a quello registrato su Strava
- Default è `http://localhost:3000/api/strava/callback`

### Problema: "Errore 401 da Strava"

**Soluzione:**
- Verifica che `STRAVA_CLIENT_SECRET` sia corretto
- Controlla che il code non sia scaduto (valid per pochi minuti)

### Problema: Token non funziona

**Soluzione:**
- Verifica che `STRAVA_REFRESH_TOKEN` sia stato salvato correttamente in `.env.local`
- Riavvia il server (`npm run dev`)
- Non usare il token access_token per le richieste successive, usa il refresh_token

## 📝 Codice Pronto per Produzione

Entrambi i file:
- ✅ Sono in TypeScript con strict mode
- ✅ Usano NextResponse moderno
- ✅ Hanno gestione errori completa
- ✅ Hanno logging per debug
- ✅ Hanno validazione dei dati
- ✅ Hanno interfacce TypeScript per la risposta Strava
- ✅ Hanno CSS moderno e responsive
- ✅ Sono pronti per il deploy su Vercel

## 🔄 Prossimi Passi per Usare i Token

Dopo aver salvato il `STRAVA_REFRESH_TOKEN`, puoi usarlo per:

```typescript
// Esempio: Refresh l'access token
const response = await fetch('https://www.strava.com/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: process.env.STRAVA_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
});

const { access_token, expires_at } = await response.json();

// Usa access_token per chiamare l'API di Strava:
const activities = await fetch('https://www.strava.com/api/v3/athlete/activities', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
  },
});
```

## 📞 Support

Se riscontri problemi:

1. **Controlla i logs del server:** `npm run dev` mostra gli errori
2. **Verifica il browser console:** F12 → Console tab
3. **Controlla le credenziali:** Verificale su https://www.strava.com/settings/api
4. **Leggi la documentazione Strava:** https://developers.strava.com/docs/authentication/
