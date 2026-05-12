import Image from 'next/image';

export default function Loading() {
  return (
    <main className="min-h-dvh bg-app-bg text-app-text">
      <div className="flex min-h-dvh items-center justify-center px-6 py-[calc(env(safe-area-inset-top,0px)+2rem)]">
        <section className="flex w-full max-w-xs flex-col items-center text-center">
          <Image
            src="/logo.svg"
            alt="Veiro"
            width={112}
            height={42}
            priority
            className="mb-7 block h-[30px] w-auto"
          />

          <div className="mb-3 h-px w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full w-2/3 animate-[loading-bar_1.25s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-muted">
            Preparazione dashboard
          </p>
        </section>
      </div>
    </main>
  );
}
