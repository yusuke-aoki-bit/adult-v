# @adult-v/database

PostgreSQL database schema, client, and type definitions using Drizzle ORM. Provides the single source of truth for all database tables and a connection pool manager.

## Setup

```bash
pnpm install

# Required environment variable
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

## Development

```bash
# Generate migration files from schema changes
pnpm db:generate

# Push schema changes directly to database
pnpm db:push

# Run pending migrations
pnpm db:migrate
```

Configuration is in `drizzle.config.ts` at the package root.

## Structure

```
src/
  index.ts              # Main export (schema + client + drizzle-orm re-exports)
  client.ts             # Database connection pool (pg + drizzle)
  schema.ts             # Schema barrel re-export
  types.ts              # Shared TypeScript types
  schema/
    index.ts            # Schema barrel
    products.ts         # Products, product_sources, product_images, product_videos
    performers.ts       # Performers, performer aliases, performer stats
    tags.ts             # Tags, product-tag joins, performer-tag joins
    reviews.ts          # User reviews, AI reviews
    raw-data.ts         # Raw crawled data tables
    user-content.ts     # User-generated content (corrections, suggestions, favorites)
    analytics.ts        # View history, analytics events
    news.ts             # News/announcements
```

## Usage

Other packages import the schema, client, and Drizzle operators:

```typescript
// Schema tables and types
import { products, performers, tags } from '@adult-v/database/schema';

// Database client
import { db, getDb, closeDb } from '@adult-v/database/client';

// Drizzle operators (re-exported for consistency)
import { eq, sql, desc, and, inArray } from '@adult-v/database';
```

## Connection Pool

The client (`src/client.ts`) manages a singleton `pg.Pool` with environment-aware configuration:

- **Dev**: 5 max connections, 10s idle timeout
- **Production (Web)**: 10 max connections, 60s idle timeout, SSL enabled
- **Cloud Run Jobs**: 8 max connections, 120s query timeout

Graceful shutdown is handled automatically via `SIGTERM`/`SIGINT` listeners.

## Notes

- The `search_vector` column exists in the database via raw SQL migration but is NOT defined in the Drizzle schema. Access it via `sql\`${table}.search_vector\``.
- The `product_sources` table uses `last_updated` (not `created_at`/`updated_at`).
- Drizzle `sql` template expands JS arrays as individual params. Use `sql.join()` with `ARRAY[...]::type[]` for PostgreSQL `ANY()` calls. See MEMORY.md for the correct pattern.
