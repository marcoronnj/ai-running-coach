import { NextRequest, NextResponse } from 'next/server';
import { sendTestMessage } from '@/lib/telegram';

/**
 * API Route: GET /api/test-telegram
 * Invia un messaggio di test a Telegram per verificare la configurazione
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica il secret
    const cronSecret = process.env.CRON_SECRET;
    const secretParam = request.nextUrl.searchParams.get('secret');

    if (!cronSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'CRON_SECRET non configurato',
          message: 'Aggiungi CRON_SECRET in .env.local per proteggere questa route',
        },
        { status: 500 }
      );
    }

    if (!secretParam || secretParam !== cronSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Secret non valido',
          message: 'Fornisci il parametro ?secret=CRON_SECRET corretto',
        },
        { status: 403 }
      );
    }

    console.log('[TEST-TELEGRAM] Invio messaggio di test...');

    // Invia il messaggio di test
    const success = await sendTestMessage();

    if (success) {
      console.log('[TEST-TELEGRAM] ✓ Test completato con successo');
      return NextResponse.json(
        {
          ok: true,
          message: 'Messaggio di test inviato con successo a Telegram',
        },
        { status: 200 }
      );
    } else {
      console.error('[TEST-TELEGRAM] ✗ Invio messaggio fallito');
      return NextResponse.json(
        {
          ok: false,
          error: 'Invio messaggio fallito',
          message: 'Controlla i log del server per i dettagli dell\'errore',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[TEST-TELEGRAM] Errore durante il test:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        error: 'Errore interno',
        message: errorMessage,
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
