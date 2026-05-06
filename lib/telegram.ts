/**
 * Utility per l'integrazione con Telegram Bot API
 */

/**
 * Invia un messaggio Telegram
 * @param text - Testo del messaggio (supporta HTML)
 * @returns Promise<boolean> - true se inviato con successo, false altrimenti
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Se mancano le credenziali, logga warning e continua senza errori
  if (!botToken || !chatId) {
    console.warn(
      '[TELEGRAM] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID non configurati. ' +
      'Il messaggio non verrà inviato. Aggiungi le variabili in .env.local per abilitare Telegram.'
    );
    return false;
  }

  try {
    console.log('[TELEGRAM] Invio messaggio...');

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[TELEGRAM] Errore API Telegram:', {
        status: response.status,
        body: errorData,
      });

      // Logga errori specifici di Telegram
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.description) {
          console.error('[TELEGRAM] Descrizione errore:', errorJson.description);
        }
      } catch {
        // Se non è JSON, logga il testo grezzo
        console.error('[TELEGRAM] Risposta errore:', errorData);
      }

      return false;
    }

    const result = await response.json();

    if (result.ok) {
      console.log('[TELEGRAM] ✓ Messaggio inviato con successo');
      return true;
    } else {
      console.error('[TELEGRAM] Errore Telegram:', result);
      return false;
    }

  } catch (error) {
    console.error('[TELEGRAM] Errore di rete:', error);
    return false;
  }
}

/**
 * Invia un messaggio di test per verificare la configurazione
 * @returns Promise<boolean>
 */
export async function sendTestMessage(): Promise<boolean> {
  const testMessage = `
🤖 <b>AI Running Coach</b>

✅ <i>Test Telegram riuscito!</i>

Il bot è configurato correttamente e può ricevere notifiche.
  `.trim();

  return await sendTelegramMessage(testMessage);
}

/**
 * Formatta un report del coach per Telegram
 * @param report - Report del coach
 * @param activityName - Nome dell'attività
 * @returns string - Messaggio formattato per Telegram
 */
export function formatCoachReportForTelegram(
  report: {
    title: string;
    summary: string;
    risk_level: string;
    next_48h: string;
    full_report: string;
  },
  activityName: string
): string {
  const riskEmoji = {
    basso: '🟢',
    medio: '🟡',
    alto: '🔴',
  }[report.risk_level] || '🟡';

  const message = `
🏃‍♂️ <b>${report.title}</b>

📊 <b>Attività:</b> ${activityName}

📝 <b>Riepilogo:</b>
${report.summary}

⚠️ <b>Livello Rischio:</b> ${riskEmoji} ${report.risk_level.toUpperCase()}

⏰ <b>Prossime 48h:</b>
${report.next_48h}

📋 <b>Report Completo:</b>
${report.full_report.replace(/\n/g, '\n')}
  `.trim();

  return message;
}

/**
 * Verifica se Telegram è configurato correttamente
 * @returns boolean
 */
export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Ottiene informazioni di debug sulla configurazione Telegram
 * @returns object
 */
export function getTelegramConfig(): {
  configured: boolean;
  hasToken: boolean;
  hasChatId: boolean;
  tokenPrefix?: string;
} {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  return {
    configured: !!(token && chatId),
    hasToken: !!token,
    hasChatId: !!chatId,
    tokenPrefix: token ? token.substring(0, 10) + '...' : undefined,
  };
}
