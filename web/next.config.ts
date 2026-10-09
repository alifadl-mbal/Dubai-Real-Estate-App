import type { NextConfig } from "next";

// Fully static site: `next build` writes plain HTML/JS/JSON to `out/`, which any free static
// host (Cloudflare Pages, GitHub Pages, Netlify, Vercel) can serve with no server.
// Set NEXT_PUBLIC_BASE_PATH (e.g. "/Dubai-Real-Estate-App") when serving from a sub-path such
// as a GitHub Pages project site; leave it unset for a root domain.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
