# @adult-v/shared

Shared library providing components, hooks, API handlers, database query builders, and utilities used by both `@adult-v/web` and `@adult-v/fanza` applications. Uses a dependency injection (DI) pattern so apps pass their own schema tables and operators.

## Setup

```bash
# No separate build step needed - consumed as TypeScript via workspace protocol
pnpm install
```

## Structure

```
src/
  index.ts                # Main barrel export
  components/             # Shared React components
    ProductCard/           # Product card variants
    ActressCard/           # Performer card variants
    Header/, Footer/       # Layout components
    SimilarProductMap/     # Visualization components
    sections/              # Home page section components
    stats/                 # Analytics/stats components
  hooks/                   # Shared React hooks (useHomeSections, usePreferenceAnalysis, etc.)
  contexts/                # React contexts (compare, theme, etc.)
  api-handlers/            # API route handler factories (40+ handlers)
  api-routes/              # Shared API route wiring
  cron-handlers/           # Cron job handler factories
  cron-routes/             # Shared cron route wiring
  db-queries/              # Database query builders
    core-queries.ts        # Core CRUD queries
    product-queries.ts     # Product-specific queries
    actress-queries.ts     # Performer-specific queries
    product-list-queries.ts
    actress-list-queries.ts
    asp-filter.ts          # ASP/provider filtering logic
    mappers.ts             # DB row to type mappers
    create-app-queries.ts  # Factory to create app-level query set
  lib/
    cache.ts, cache-utils.ts  # Caching (memory + Upstash Redis)
    seo.ts, seo-utils.ts      # SEO metadata generation
    llm-service.ts             # LLM integration (Gemini/OpenAI)
    embedding-service.ts       # Vector embedding for semantic search
    firebase.ts                # Firebase client utilities
    affiliate.ts               # Affiliate link generation
    api-schemas.ts             # Zod validation schemas
  types/                   # Shared TypeScript types
  constants/               # App constants and filter definitions
  providers/               # External provider clients (DUGA, SOKMIL)
  i18n/                    # Internationalization utilities
  prompts/                 # LLM prompt templates
```

## Usage

Apps import via the package exports defined in `package.json`:

```typescript
// Components
import { ProductCard } from '@adult-v/shared/components';

// API handler factories (DI pattern)
import { createProductsHandler } from '@adult-v/shared/api-handlers';

// Database queries
import { createAppQueries } from '@adult-v/shared/db-queries';

// Hooks
import { useHomeSections } from '@adult-v/shared/hooks';

// Utilities
import { LLMService } from '@adult-v/shared/lib/llm-service';
import { CACHE_CONFIG } from '@adult-v/shared/lib/cache';
```

## DI Pattern

The shared package does not import app-specific schemas directly. Instead, apps create query/handler instances by passing their schema tables and Drizzle operators:

```typescript
const queries = createAppQueries({
  db,
  products,
  performers,
  tags, // from app's schema
  eq,
  sql,
  desc,
  and,
  or, // from drizzle-orm
});
```

## Key Dependencies

- `@adult-v/database` - Schema types (peer via workspace)
- `@upstash/redis` - Redis caching
- `zod` - Request validation
- `firebase` - Auth utilities
- Peer: `next`, `react`, `lucide-react`, `recharts`
