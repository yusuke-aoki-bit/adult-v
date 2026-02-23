# @adult-v/web

Primary web application (adult-v) built with Next.js 16. Deployed to Firebase App Hosting at `https://www.adult-v.com`. Provides product browsing, performer profiles, search, recommendations, and user features with multi-language support (ja, en, ko, zh, zh-TW).

## Setup

```bash
# From monorepo root
pnpm install

# Required environment variables (see apphosting.yaml for full list)
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
```

## Development

```bash
# Start dev server on port 3000 (with Turbopack)
pnpm dev:web

# Or from this directory
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Build & Deploy

```bash
pnpm build
```

Deployment is automatic via Firebase App Hosting on push to `master`. See `apphosting.yaml` for runtime configuration (Node.js 20, asia-east1, VPC connector).

## Structure

```
app/
  [locale]/           # i18n routes (next-intl)
    page.tsx           # Home page with performer grid, sections, hero
    products/[id]/     # Product detail pages
    actresses/         # Performer listing
    search/            # Full-text, image, and semantic search
    budget/            # Budget tracking
    compare/           # Product and performer comparison
    discover/          # Discovery/recommendation pages
    settings/          # User settings
  api/                 # API route handlers
components/            # App-specific React components
lib/
  db/queries.ts        # Database query wrappers (DI from @adult-v/shared)
  seo.ts               # SEO metadata and structured data
  server/              # Server-side utilities
messages/              # i18n translation files (en.json, ja.json, etc.)
```

## Key Dependencies

- `@adult-v/shared` - Shared components, hooks, API handlers, DB queries
- `@adult-v/database` - Drizzle ORM schema and database client
- `next-intl` - Internationalization (5 locales)
- `firebase` - Authentication
- `@sentry/nextjs` - Error monitoring
- `meilisearch` - Full-text search
- `recharts` - Data visualization

## Environment

The app uses `SITE_MODE=adult-v` to differentiate from the fanza variant. This controls ASP filtering, provider selection, and UI theming via the shared package's DI pattern.
