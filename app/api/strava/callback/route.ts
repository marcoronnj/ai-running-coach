import { NextRequest, NextResponse } from 'next/server';

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
    profile_medium: string;
    profile: string;
    city: string;
    state: string;
    country: string;
    sex: string;
    summit: boolean;
    created_at: string;
    updated_at: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Gestisci errori di Strava
    if (error) {
      return createErrorResponse(
        `Errore da Strava: ${error}`,
        'L\'utente ha negato l\'accesso o si è verificato un errore durante l\'autenticazione.'
      );
    }

    // Verifica che il code sia presente
    if (!code) {
      return createErrorResponse(
        'Code mancante',
        'Il parametro code è obbligatorio ma non è stato ricevuto da Strava.'
      );
    }

    // Verifica che le variabili di ambiente siano configurate
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return createErrorResponse(
        'Configurazione mancante',
        'STRAVA_CLIENT_ID o STRAVA_CLIENT_SECRET non configurati in .env.local'
      );
    }

    // Scambia il code con access_token e refresh_token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Errore da Strava:', {
        status: tokenResponse.status,
        body: errorData,
      });
      return createErrorResponse(
        'Errore nello scambio del code',
        `Strava ha restituito lo status ${tokenResponse.status}. Verifica che il code non sia scaduto e che le credenziali siano corrette.`
      );
    }

    const data: StravaTokenResponse = await tokenResponse.json();

    // Verifica la risposta
    if (!data.access_token || !data.refresh_token || !data.athlete) {
      return createErrorResponse(
        'Risposta Strava non valida',
        'La risposta di Strava non contiene i campi attesi (access_token, refresh_token o athlete).'
      );
    }

    // Estrai i dati dell'atleta
    const athleteName = `${data.athlete.firstname} ${data.athlete.lastname}`;
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const expiresAt = new Date(data.expires_at * 1000).toISOString();

    // Ritorna una pagina HTML con i dati
    const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strava OAuth - Success</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            color: #1f2937;
            font-size: 28px;
            margin-bottom: 8px;
        }
        .header p {
            color: #6b7280;
            font-size: 16px;
        }
        .success-icon {
            display: inline-block;
            width: 60px;
            height: 60px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
            margin-bottom: 16px;
        }
        .info-section {
            margin-bottom: 32px;
        }
        .info-section h2 {
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }
        .info-box {
            background: #f3f4f6;
            border-left: 4px solid #667eea;
            padding: 16px;
            border-radius: 4px;
            word-break: break-all;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            color: #1f2937;
            line-height: 1.6;
        }
        .info-label {
            font-size: 12px;
            color: #9ca3af;
            margin-bottom: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI';
            font-weight: 500;
        }
        .copy-button {
            display: inline-block;
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            margin-top: 8px;
            transition: background 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI';
            font-weight: 500;
        }
        .copy-button:hover {
            background: #5568d3;
        }
        .instructions {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 16px;
            border-radius: 4px;
            margin-top: 32px;
            font-size: 14px;
            color: #1e40af;
            line-height: 1.8;
        }
        .instructions h3 {
            margin-bottom: 12px;
            font-size: 14px;
        }
        .instructions ol {
            margin-left: 20px;
        }
        .instructions li {
            margin-bottom: 8px;
        }
        code {
            background: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">✓</div>
            <h1>Autenticazione Riuscita! 🎉</h1>
            <p>I tuoi token di Strava sono pronti</p>
        </div>

        <div class="info-section">
            <h2>Atleta</h2>
            <div class="info-box">
                <div class="info-label">Nome:</div>
                ${athleteName}
            </div>
        </div>

        <div class="info-section">
            <h2>Access Token</h2>
            <div class="info-box">
                ${accessToken}
                <br><br>
                <button class="copy-button" onclick="copyToClipboard('${accessToken}')">Copia</button>
            </div>
        </div>

        <div class="info-section">
            <h2>Refresh Token ⭐</h2>
            <div class="info-box">
                ${refreshToken}
                <br><br>
                <button class="copy-button" onclick="copyToClipboard('${refreshToken}')">Copia</button>
            </div>
            <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                <strong>Importante:</strong> Salva questo token nel .env.local come <code>STRAVA_REFRESH_TOKEN</code>
            </p>
        </div>

        <div class="info-section">
            <h2>Expires At</h2>
            <div class="info-box">
                ${expiresAt}
            </div>
        </div>

        <div class="instructions">
            <h3>📋 Prossimi Passi:</h3>
            <ol>
                <li>Copia il <strong>Refresh Token</strong> usando il pulsante sopra</li>
                <li>Apri il file <code>.env.local</code> nel tuo editor</li>
                <li>Aggiungi o aggiorna la riga: <code>STRAVA_REFRESH_TOKEN=${refreshToken}</code></li>
                <li>Salva il file</li>
                <li>Riavvia il server (<code>npm run dev</code>)</li>
            </ol>
        </div>
    </div>

    <script>
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('✓ Copiato negli appunti!');
            }).catch(() => {
                alert('❌ Copia fallita. Copia manualmente.');
            });
        }
    </script>
</body>
</html>
    `;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Errore nel callback di Strava:', error);
    return createErrorResponse(
      'Errore interno',
      error instanceof Error ? error.message : 'Si è verificato un errore inatteso'
    );
  }
}

/**
 * Crea una risposta di errore formattata in HTML
 */
function createErrorResponse(title: string, message: string): NextResponse {
  const htmlContent = `
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strava OAuth - Errore</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        .error-icon {
            display: inline-block;
            width: 60px;
            height: 60px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 32px;
            margin-bottom: 16px;
        }
        h1 {
            color: #1f2937;
            font-size: 28px;
            margin-bottom: 12px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .back-link {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            transition: background 0.2s;
        }
        .back-link:hover {
            background: #5568d3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">✗</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="http://localhost:3000" class="back-link">Torna alla Home</a>
    </div>
</body>
</html>
  `;

  return new NextResponse(htmlContent, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
