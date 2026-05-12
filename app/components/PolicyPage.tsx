import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type PolicySection = {
  title?: string;
  paragraphs?: string[];
  bullets?: Array<string | { text: string; children: string[] }>;
  afterBullets?: string[];
};

export type PolicyPageProps = {
  title: string;
  updated?: string;
  intro?: string[];
  sections: PolicySection[];
  dashboardLabel: string;
};

function BulletList({ bullets }: { bullets: NonNullable<PolicySection['bullets']> }) {
  return (
    <ul className="mt-4 space-y-2 pl-5 text-[15px] leading-7 text-white/72 marker:text-[#D6FF3F] sm:text-base sm:leading-8">
      {bullets.map((bullet) => {
        if (typeof bullet === 'string') {
          return <li key={bullet}>{bullet}</li>;
        }

        return (
          <li key={bullet.text}>
            {bullet.text}
            <ul className="mt-2 space-y-1 pl-5 marker:text-white/35">
              {bullet.children.map((child) => (
                <li key={child}>{child}</li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function PolicyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-white/[0.08] py-7 first:border-t-0 first:pt-0 last:pb-0 sm:py-9">
      {children}
    </div>
  );
}

export default function PolicyPage({ title, updated, intro = [], sections, dashboardLabel }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
        <div className="mb-8">
          <Link
            href="/"
            className="pressable inline-flex h-10 w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-app-text"
          >
            <ArrowLeft size={16} strokeWidth={1.8} />
            {dashboardLabel}
          </Link>
        </div>

        <div className="mb-10 sm:mb-14">
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          {updated ? (
            <p className="mt-5 text-sm font-medium leading-6 text-white/48 sm:text-base">
              {updated}
            </p>
          ) : null}
        </div>

        <article className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.025] px-5 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] sm:px-8 sm:py-9">
          {intro.length > 0 ? (
            <PolicyBlock>
              <div className="space-y-5">
                {intro.map((paragraph) => (
                  <p key={paragraph} className="text-[15px] leading-7 text-white/74 sm:text-base sm:leading-8">
                    {paragraph}
                  </p>
                ))}
              </div>
            </PolicyBlock>
          ) : null}

          {sections.map((section, index) => (
            <PolicyBlock key={section.title ?? index}>
              {section.title ? (
                <h2 className="mb-4 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
                  {section.title}
                </h2>
              ) : null}
              {section.paragraphs?.length ? (
                <div className="space-y-5">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[15px] leading-7 text-white/72 sm:text-base sm:leading-8">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
              {section.bullets?.length ? <BulletList bullets={section.bullets} /> : null}
              {section.afterBullets?.length ? (
                <div className="mt-5 space-y-5">
                  {section.afterBullets.map((paragraph) => (
                    <p key={paragraph} className="text-[15px] leading-7 text-white/72 sm:text-base sm:leading-8">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
            </PolicyBlock>
          ))}
        </article>
      </section>
    </main>
  );
}
