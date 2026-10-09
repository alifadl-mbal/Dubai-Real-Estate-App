import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 pt-24 text-center">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold/90">404</div>
      <h1 className="mt-3 font-display text-5xl text-ink">
        This plot is <span className="italic text-gradient-gold">unregistered.</span>
      </h1>
      <p className="mt-4 text-muted">The page you&apos;re after doesn&apos;t exist. Try the map or search for an area.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-bg">
          Home
        </Link>
        <Link href="/map/" className="rounded-full px-5 py-2.5 text-sm text-ink ring-1 ring-line-strong hover:bg-white/5">
          Open the map
        </Link>
      </div>
    </div>
  );
}
