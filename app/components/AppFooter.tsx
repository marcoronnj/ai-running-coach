import Link from 'next/link';

const footerLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/disclaimer', label: 'Disclaimer' },
];

export default function AppFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#050505]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-5 py-7 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
        <Link
          href="/"
          className="text-sm font-bold tracking-[0.16em] text-white transition-colors duration-200 [font-family:var(--font-satoshi),sans-serif] hover:text-[#D6FF3F]"
        >
          VEIRO
        </Link>
        <nav aria-label="Legal links" className="flex items-center gap-5">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-white/45 transition-colors duration-200 hover:text-[#D6FF3F]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
