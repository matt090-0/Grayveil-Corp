import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vendor chunks are split manually so first load doesn't have to ship
// every heavy lib at once. Route-level code-splitting (see App.jsx)
// further isolates each page into its own async chunk.
//
// Strategy:
// - vendor-react: framework, always loaded.
// - vendor-supabase: data layer, always loaded.
// - vendor-sentry: error reporting, includes the sub-packages that
//   ship with @sentry/react (replay, browser, core, etc).
// - vendor-recharts: charts. Only Dashboard uses these — splitting
//   saves ~75 KB gzipped on every other page.
// - vendor-markdown: MDX/markdown. Only Wiki + OpTemplates use it.
// - vendor-motion: framer-motion (PageTransition uses it everywhere
//   so it ends up loaded but shouldn't bloat individual pages).
// - vendor-confetti / qrcode / datefns: small, isolated, easy splits.
// - vendor-misc: catch-all for everything else from node_modules.
//
// Match using prefix tests on package names so transitive deps like
// `@sentry/replay` land with their parent.
const VENDOR_RULES = [
  { chunk: 'vendor-react',     match: id => /node_modules[/\\](react|react-dom|react-router-dom|react-router|scheduler|use-sync-external-store|@remix-run[/\\]router)[/\\]/.test(id) },
  { chunk: 'vendor-supabase',  match: id => /node_modules[/\\]@supabase[/\\]/.test(id) },
  { chunk: 'vendor-sentry',    match: id => /node_modules[/\\]@sentry[/\\]/.test(id) },
  { chunk: 'vendor-recharts',  match: id => /node_modules[/\\](recharts|victory-vendor|d3-(shape|scale|array|time|time-format|color|interpolate|format|path|ease|geo))[/\\]/.test(id) },
  { chunk: 'vendor-markdown',  match: id => /node_modules[/\\](react-markdown|micromark|micromark-[^/\\]+|mdast|mdast-[^/\\]+|remark-[^/\\]+|hast-[^/\\]+|unified|vfile|trough|bail|is-plain-obj|character-entities|character-reference|decode-named-character-reference|comma-separated-tokens|space-separated-tokens|property-information|html-url-attributes|html-void-elements|zwitch|estree-util-[^/\\]+|unist-[^/\\]+|@types[/\\]mdast|@types[/\\]hast|@types[/\\]unist)[/\\]/.test(id) },
  { chunk: 'vendor-motion',    match: id => /node_modules[/\\](framer-motion|motion)[/\\]/.test(id) },
  { chunk: 'vendor-confetti',  match: id => /node_modules[/\\]canvas-confetti[/\\]/.test(id) },
  { chunk: 'vendor-qrcode',    match: id => /node_modules[/\\]qrcode\.react[/\\]/.test(id) },
  { chunk: 'vendor-datefns',   match: id => /node_modules[/\\]date-fns[/\\]/.test(id) },
]

export default defineConfig({
  plugins: [react()],
  build: {
    // Each individual chunk should comfortably fit under 500KB after
    // this config. Bumping slightly covers the React vendor bundle.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          for (const rule of VENDOR_RULES) {
            if (rule.match(id)) return rule.chunk
          }
          return 'vendor-misc'
        },
      },
    },
  },
})
