# @adult-v/fanza

Secondary web application (fanza variant) built with Next.js 16. Deployed to Firebase App Hosting at `https://www.f.adult-v.com`. Shares the same codebase architecture as `@adult-v/web` but operates with `SITE_MODE=fanza` for FANZA-specific product filtering and provider configuration.

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
# Start dev server on port 3001 (with Turbopack)
pnpm dev:fanza

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

Deployment is automatic via Firebase App Hosting on push to `master`. See `apphosting.yaml` for runtime configuration (Node.js 20, asia-east1, max 2 instances, 1536 MiB memory).

## Structure

```
app/
  [locale]/           # i18n routes (next-intl)
    page.tsx           # Home page
    products/[id]/     # Product detail pages
    search/            # Search (full-text, image)
    budget/            # Budget tracking
    compare/           # Comparison features
    discover/          # Discovery pages
    settings/          # User settings
  api/                 # API route handlers
components/            # App-specific React components (mirrors web app)
lib/
  db/queries.ts        # Database query wrappers (DI from @adult-v/shared)
```

## Differences from @adult-v/web

- `SITE_MODE=fanza` controls ASP filtering to show only FANZA-sourced products
- Runs on port 3001 (dev) to avoid conflicts with the web app
- Slightly smaller resource allocation (max 2 instances, 1536 MiB vs 3 instances, 1792 MiB)
- Separate Firebase app configuration and Sentry project
- Separate Google Analytics tracking ID

## Key Dependencies

Same dependency set as `@adult-v/web`. Both apps depend on `@adult-v/shared` and `@adult-v/database` workspace packages.
