import Image from 'next/image';

export default function Loading() {
  return (
    <main className="min-h-dvh bg-app-bg text-app-text" style={{ backgroundColor: '#050505', color: '#f5f5f5' }}>
      <div className="flex min-h-dvh items-center justify-center px-6 py-[calc(env(safe-area-inset-top,0px)+2rem)]">
        <section className="flex w-full max-w-xs flex-col items-center text-center">
          <div className="splash-logo-wrapper mb-7">
            <Image
              src="/logo.svg"
              alt="Veiro"
              width={112}
              height={42}
              priority
              className="splash-logo"
            />
          </div>

          <div className="mb-3 h-px w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full w-2/3 animate-[loading-bar_1.25s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
          </div>
        </section>
      </div>
    </main>
  );
}
