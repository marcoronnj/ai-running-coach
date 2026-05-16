import Image from 'next/image';
import { Activity } from 'lucide-react';
import { getCurrentLanguage } from '@/lib/athlete-settings';
import { t, type Language } from '@/lib/i18n';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }> | { next?: string };
}) {
  const params = searchParams ? await searchParams : {};
  let language: Language = 'it';

  try {
    language = await getCurrentLanguage();
  } catch (error) {
    console.error('[HOME PERF]', {
      loginLanguage: 'fallback',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const nextPath = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/';

  return (
    <main className="app-screen flex min-h-screen items-center justify-center px-4 py-10">
      <section className="premium-card w-full max-w-md p-5 sm:p-6">
        <div className="mb-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-primary text-black">
            <Activity size={21} strokeWidth={2} />
          </div>
          <p className="eyebrow mb-1">single user</p>
          <Image
            src="/logo.svg"
            alt="Veiro"
            width={80}
            height={30}
            priority
            className="block h-6 w-auto sm:h-[30px]"
          />
          <p className="mt-1 text-sm text-app-muted">{t(language, 'login.subtitle')}</p>
        </div>

        <LoginForm nextPath={nextPath} language={language} />
      </section>
    </main>
  );
}
