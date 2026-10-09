import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";

import { Logo, SiteNav } from "@/components/site-nav";
import { NAV } from "@/lib/nav";
import { getMeta } from "@/lib/server-data";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// Author credit shown in the footer.
const AUTHOR = "Ali Fadlalla";
const AUTHOR_LINKEDIN = "https://www.linkedin.com/in/ali-fadlalla/";

export const metadata: Metadata = {
  title: { default: "Skyline — Dubai property, decoded", template: "%s · Skyline" },
  description:
    "Every Dubai Land Department sale and lease turned into prices, yields, valuations and supply signals. Free and open.",
};

export const viewport: Viewport = { themeColor: "#05070c", colorScheme: "dark" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const meta = await getMeta();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-gold px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="mt-24 border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="space-y-3">
              <Logo />
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                Built on {meta.transactions.toLocaleString("en-US")} registered transactions and{" "}
                {meta.leases.toLocaleString("en-US")} new leases from the Dubai Land Department. Data to{" "}
                {meta.asOf}.
              </p>
              <p className="text-xs text-faint">
                Figures are derived from public records for research. They are not official DLD statistics
                or investment advice.
              </p>
            </div>
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">Explore</div>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-muted transition hover:text-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">Built by</div>
              <a
                href={AUTHOR_LINKEDIN}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2.5 text-sm text-muted transition hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className="size-5 text-gold">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
                </svg>
                <span>
                  by <span className="font-medium text-ink group-hover:text-gold">{AUTHOR}</span>
                </span>
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
