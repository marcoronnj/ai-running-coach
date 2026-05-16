'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[APP_GLOBAL_ERROR_BOUNDARY] Root render failed', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en" style={{ backgroundColor: '#050505', colorScheme: 'dark' }}>
      <body
        style={{
          minHeight: '100dvh',
          margin: 0,
          backgroundColor: '#050505',
          color: '#f5f5f5',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <title>Veiro</title>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'calc(env(safe-area-inset-top, 0px) + 2rem) 1rem 2rem',
            backgroundColor: '#050505',
          }}
        >
          <section
            style={{
              width: '100%',
              maxWidth: '26rem',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, rgba(23,23,23,0.92), rgba(13,13,13,0.94))',
              padding: '24px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.38)',
            }}
          >
            <img
              src="/logo.svg"
              alt="Veiro"
              width={77}
              height={29}
              style={{ display: 'block', width: '77px', height: 'auto', margin: '0 auto 18px' }}
            />
            <h1 style={{ margin: '0 0 10px', fontSize: '20px', lineHeight: 1.2 }}>
              Non siamo riusciti a caricare Veiro.
            </h1>
            <p style={{ margin: '0 0 22px', color: '#9ca3af', fontSize: '14px', lineHeight: 1.55 }}>
              Riprova tra un istante.
            </p>
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                minHeight: '44px',
                border: 0,
                borderRadius: '12px',
                padding: '0 18px',
                background: 'linear-gradient(90deg, #d7ff3f, #36fce1)',
                color: '#050505',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Riprova
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
