'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, LogIn, Mail, AlertCircle, LoaderCircle } from 'lucide-react';
import { t, type Language } from '@/lib/i18n';

export default function LoginForm({ nextPath, language }: { nextPath: string; language: Language }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !data.ok) {
        setError(t(language, 'login.invalidCredentials'));
        return;
      }

      router.replace(nextPath || '/');
      router.refresh();
    } catch {
      setError(t(language, 'login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[rgba(255,98,98,0.22)] bg-[rgba(255,98,98,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          <AlertCircle size={16} strokeWidth={1.8} />
          {error}
        </div>
      ) : null}

      <label className="block">
        <span className="eyebrow mb-2 block">{t(language, 'common.email')}</span>
        <span className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-app-text focus-within:border-[rgba(54,252,225,0.36)]">
          <Mail size={17} strokeWidth={1.8} className="text-app-muted" />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
            placeholder="tu@email.com"
          />
        </span>
      </label>

      <label className="block">
        <span className="eyebrow mb-2 block">{t(language, 'common.password')}</span>
        <span className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-app-text focus-within:border-[rgba(54,252,225,0.36)]">
          <Lock size={17} strokeWidth={1.8} className="text-app-muted" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
            placeholder="Password"
          />
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="pressable inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <LoaderCircle size={17} strokeWidth={2} className="animate-spin" />
        ) : (
          <LogIn size={17} strokeWidth={2} />
        )}
        {loading ? t(language, 'login.signingIn') : t(language, 'common.login')}
      </button>
    </form>
  );
}
