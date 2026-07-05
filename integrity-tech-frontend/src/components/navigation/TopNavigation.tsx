import Link from 'next/link';

export function TopNavigation({ variant = 'fixed' }: { variant?: 'fixed' | 'inline' }) {
  const position = variant === 'fixed' ? 'fixed left-4 top-4 z-50 md:left-6 md:top-6' : '';
  return (
    <div className={position}>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900/95 px-3 py-2 text-xs font-bold text-slate-200 shadow-lg shadow-slate-950/20 transition hover:border-indigo-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        ← Inicio
      </Link>
    </div>
  );
}
