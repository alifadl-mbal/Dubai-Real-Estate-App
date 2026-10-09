import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="mx-auto max-w-7xl px-4 pb-10 pt-28 sm:px-6 sm:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-gold/90">{eyebrow}</div>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight text-ink sm:text-6xl">{title}</h1>
          {children && <div className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{children}</div>}
        </div>
        {aside}
      </div>
    </header>
  );
}
