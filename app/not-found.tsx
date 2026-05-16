import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-app-bg text-app-text" style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
      <div className="flex min-h-dvh items-center justify-center px-4 py-[calc(env(safe-area-inset-top,0px)+2rem)]">
        <section className="premium-card fade-in w-full max-w-md p-5 text-center sm:p-6">
          <Image
            src="/logo.svg"
            alt="Veiro"
            width={77}
            height={29}
            priority
            className="mx-auto mb-4 block h-auto w-[4.8rem]"
          />
          <h1 className="mb-3 text-xl font-semibold tracking-tight text-app-text">
            Schermata non trovata
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-app-muted">
            Torna alla dashboard per continuare.
          </p>
          <Link
            href="/"
            className="pressable inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 text-sm font-bold text-black"
          >
            Dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
