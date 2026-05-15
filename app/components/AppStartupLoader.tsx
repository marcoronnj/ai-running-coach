'use client';

import { useEffect, useState } from 'react';

export default function AppStartupLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, 700);

    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 980);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: '#050505', color: '#f5f5f5' }}
      className={`splash-screen fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center px-6 py-[calc(env(safe-area-inset-top,0px)+2rem)] text-app-text transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <section className="flex w-full max-w-xs flex-col items-center text-center">
        <img
          src="/logo-veiro.svg"
          alt="Veiro"
          width={132}
          height={50}
          className="splash-veiro-logo mb-7"
        />

        <div className="mb-3 h-px w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full w-2/3 animate-[loading-bar_1.25s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
        </div>
      </section>
    </div>
  );
}
