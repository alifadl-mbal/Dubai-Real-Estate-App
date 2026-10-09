"use client";

import { Command } from "cmdk";
import Fuse from "fuse.js";
import { Building2, MapPin, Menu, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useJson } from "@/lib/client-data";
import { cn } from "@/lib/format";
import { NAV } from "@/lib/nav";
import type { SearchIndex } from "@/lib/types";


export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)} aria-label="Home">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f6dfaa" />
            <stop offset="1" stopColor="#b9853a" />
          </linearGradient>
        </defs>
        <path d="M16 2 L19 30 H13 Z" fill="url(#logo-g)" />
        <path d="M9 30 L11 14 L13.5 30 Z" fill="url(#logo-g)" opacity="0.65" />
        <path d="M18.5 30 L21 11 L23 30 Z" fill="url(#logo-g)" opacity="0.8" />
        <path d="M24 30 L25.5 19 L27 30 Z" fill="url(#logo-g)" opacity="0.5" />
        <path d="M5 30 L6.5 21 L8 30 Z" fill="url(#logo-g)" opacity="0.4" />
      </svg>
      <span className="font-display text-xl tracking-tight text-ink">
        Skyline<span className="text-gold">.</span>
      </span>
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onOpen = () => setOpen(true);
    window.addEventListener("open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("open-search", onOpen);
    };
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled || pathname !== "/" ? "border-b border-line bg-bg/70 backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-full px-3.5 py-1.5 text-sm transition-colors",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.07]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-full border border-line bg-white/[0.03] py-1.5 pl-3 pr-2 text-sm text-muted transition hover:border-line-strong hover:text-ink"
            >
              <Search className="size-4" aria-hidden />
              <span className="hidden sm:inline">Search areas, projects</span>
              <kbd className="hidden rounded-md border border-line bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">
                Ctrl K
              </kbd>
            </button>
            <button
              className="rounded-full p-2 text-muted hover:text-ink lg:hidden"
              onClick={() => setMenu((m) => !m)}
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
            >
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
              aria-label="Mobile"
            >
              <div className="grid grid-cols-2 gap-1 p-4">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenu(false)}
                    className={cn(
                      "rounded-xl px-4 py-3 text-sm",
                      pathname.startsWith(item.href) ? "bg-white/[0.07] text-ink" : "text-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <SearchPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

function SearchPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { data } = useJson<SearchIndex>(open ? "search.json" : null);
  const [query, setQuery] = useState("");

  const fuse = useMemo(() => {
    if (!data) return null;
    const items = [
      ...data.areas.map(([slug, name, knownAs]) => ({
        kind: "area" as const,
        slug,
        title: knownAs ?? name,
        subtitle: knownAs ? name : "Area",
        weight: 1000,
      })),
      ...data.projects.map(([name, slug, n]) => ({
        kind: "project" as const,
        slug,
        title: name,
        subtitle: data.areas.find((a) => a[0] === slug)?.[2] ?? data.areas.find((a) => a[0] === slug)?.[1] ?? "",
        weight: n,
      })),
    ];
    return new Fuse(items, { keys: ["title", "subtitle"], threshold: 0.32, ignoreLocation: true });
  }, [data]);

  const results = useMemo(() => {
    if (!fuse || !data) return [];
    if (!query.trim()) {
      return data.areas.slice(0, 8).map(([slug, name, knownAs]) => ({
        kind: "area" as const,
        slug,
        title: knownAs ?? name,
        subtitle: knownAs ? name : "Area",
        weight: 0,
      }));
    }
    return fuse.search(query, { limit: 30 }).map((r) => r.item);
  }, [fuse, data, query]);

  const go = (item: (typeof results)[number]) => {
    onOpenChange(false);
    setQuery("");
    router.push(
      item.kind === "area"
        ? `/areas/${item.slug}/`
        : `/valuation/?area=${item.slug}&project=${encodeURIComponent(item.title)}`,
    );
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong bg-elevated/95 shadow-2xl backdrop-blur-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-faint" aria-hidden />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search an area, community or project…"
          className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-faint"
        />
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-8 text-center text-sm text-muted">
          {data ? "No matches." : "Loading…"}
        </Command.Empty>
        {results.map((item) => (
          <Command.Item
            key={`${item.kind}-${item.title}-${item.slug}`}
            value={`${item.kind}-${item.title}-${item.slug}`}
            onSelect={() => go(item)}
            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-white/[0.07]"
          >
            <span className="grid size-8 place-items-center rounded-lg border border-line bg-white/[0.03] text-gold">
              {item.kind === "area" ? <MapPin className="size-4" /> : <Building2 className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink">{item.title}</span>
              <span className="block truncate text-xs text-faint">{item.subtitle}</span>
            </span>
            <span className="text-[11px] text-faint">{item.kind === "area" ? "Area profile" : "Value a unit"}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
