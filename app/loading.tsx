export default function Loading() {
  return (
    <main className="app-screen">
      <div className="app-container space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="h-7 w-28 animate-pulse rounded-xl bg-white/[0.08]" />
            <div className="mt-2 h-4 w-40 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-white/[0.08]" />
        </div>

        <section className="premium-card p-4 sm:p-5">
          <div className="h-4 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="mt-3 h-8 w-48 animate-pulse rounded-xl bg-white/[0.08]" />
          <div className="mt-3 h-4 w-full max-w-sm animate-pulse rounded-lg bg-white/[0.05]" />
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className="premium-card p-4 sm:p-5 lg:col-span-2">
            <div className="h-5 w-44 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="mt-4 space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/[0.05]" />
            </div>
          </section>

          <section className="premium-card p-4 sm:p-5">
            <div className="h-5 w-32 animate-pulse rounded-lg bg-white/[0.08]" />
            <div className="mt-4 space-y-3">
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
