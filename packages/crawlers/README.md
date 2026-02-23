# @adult-v/crawlers

Data collection package containing crawlers for multiple adult content providers, performer profile scrapers, data enrichment scripts, and SEO analysis tools. All scripts run via `tsx` and connect to PostgreSQL through `@adult-v/database`.

## Setup

```bash
pnpm install

# Required environment variables
DATABASE_URL=postgresql://...
# Provider-specific credentials (varies by crawler)
DUGA_APP_ID=...
DUGA_AGENT_ID=...
SOKMIL_API_KEY=...
GEMINI_API_KEY=...        # For AI-powered enrichment
```

## Running Crawlers

```bash
# From monorepo root
pnpm crawl:fanza          # FANZA products
pnpm crawl:duga           # DUGA products (API)
pnpm crawl:sokmil         # SOKMIL products (API)
pnpm crawl:mgs            # MGS products
pnpm crawl:fc2            # FC2 video products
pnpm crawl:japanska       # Japanska products
pnpm crawl:b10f           # B10F products (CSV import)

# From this directory
pnpm crawl:duga
pnpm crawl:sokmil
# etc.

# SEO tools
pnpm fetch:gsc            # Fetch Google Search Console data
pnpm check:pagespeed      # Run PageSpeed Insights checks
```

## Structure

```
src/
  products/               # Product crawlers (one per provider)
    crawl-fanza.ts         # FANZA crawler
    crawl-duga-api.ts      # DUGA API crawler
    crawl-sokmil-api.ts    # SOKMIL API crawler
    crawl-mgs.ts           # MGS scraper
    crawl-fc2-video.ts     # FC2 video crawler
    crawl-japanska.ts      # Japanska scraper
    crawl-b10f-csv.ts      # B10F CSV importer
    crawl-caribbean.ts     # Caribbean crawler
    crawl-tokyohot.ts      # TokyoHot crawler
  performers/
    crawl-performer-info.ts       # Performer data aggregator
    profiles/                     # Profile scrapers (gravurefit, minnano-av, sokmil)
    wiki-sources/                 # Wiki scrapers (avwiki, seesaawiki, wikipedia, etc.)
  enrichment/
    generate-embeddings.ts        # Vector embedding generation
    translation-backfill.ts       # Backfill missing translations
    crawl-sales.ts                # Sale/discount data collection
    performer-linking/            # Performer-to-product linking and wiki enrichment
    product-identity-batch.ts     # Cross-provider product matching
    update-performer-stats.ts     # Recalculate performer statistics
    price-alert-check.ts          # Check and trigger price alerts
    extract-sample-videos.ts      # Extract sample video URLs
    backfill-*.ts                 # Various backfill scripts
  seo/
    fetch-gsc-data.ts             # Google Search Console data fetcher
    check-pagespeed.ts            # PageSpeed Insights checker
  lib/
    crawler/
      base-crawler.ts             # Abstract base crawler class
      browser-crawler.ts          # Puppeteer-based browser crawler
      rate-limiter.ts             # Request rate limiting
      retry.ts                    # Retry with backoff
      batch-helpers.ts            # Batch processing utilities
    db/                           # Crawler-specific DB helpers
    product-identity/             # Cross-provider product matching logic
    providers/                    # Provider API clients (DUGA, SOKMIL, DTI)
    stealth-browser.ts            # Puppeteer stealth configuration
    translate.ts                  # Translation utilities
    notifications/                # Slack notifications
  config/
    crawler-config.ts             # Crawler configuration constants
```

## Architecture

Crawlers extend `BaseCrawler` or `BrowserCrawler` (for Puppeteer-based scraping). Common features:

- **Rate limiting** per provider domain
- **Retry with exponential backoff** for transient failures
- **Batch upsert** for efficient database writes
- **Deduplication** via product identity matching across providers
- **Slack notifications** for crawler completion/failure
- **GCS integration** for storing raw crawled data

## Key Dependencies

- `@adult-v/database` - Schema and DB client
- `@adult-v/shared` - Provider utilities, validation
- `puppeteer` / `puppeteer-extra` - Browser automation with stealth plugin
- `cheerio` - HTML parsing
- `googleapis` - Google Search Console API
- `@google/generative-ai` - Gemini for AI enrichment
