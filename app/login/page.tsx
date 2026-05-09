import { Activity } from 'lucide-react';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }> | { next?: string };
}) {
  const params = searchParams ? await searchParams : {};
  const nextPath = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/';

  return (
    <main className="app-screen flex min-h-screen items-center justify-center px-4 py-10">
      <section className="premium-card w-full max-w-md p-5 sm:p-6">
        <div className="mb-6">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-primary text-black">
            <Activity size={21} strokeWidth={2} />
          </div>
          <p className="eyebrow mb-1">single user</p>
          <h1 className="text-2xl font-semibold tracking-tight text-app-text">AI Running Coach</h1>
          <p className="mt-1 text-sm text-app-muted">Accedi alla tua dashboard atleta</p>
        </div>

        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
