/**
 * Cron Handlers
 *
 * Shared cron job handlers with dependency injection pattern
 */

// Types
export type { CronDbDeps } from './types';

// Status handler
export type { StatusHandlerDeps } from './status';
export { createStatusHandler } from './status';

// Cleanup handler
export type { CleanupHandlerDeps } from './cleanup';
export { createCleanupHandler } from './cleanup';

// Crawler handlers
export { createCrawlMgsHandler } from './crawl-mgs';
export { createCrawlDugaHandler } from './crawl-duga';
export { createCrawlSokmilHandler } from './crawl-sokmil';
export { createCrawlSokmilScrapeHandler } from './crawl-sokmil-scrape';
export { createCrawlFc2Handler } from './crawl-fc2';
export { createCrawlFanzaHandler } from './crawl-fanza';
export { createCrawlB10fHandler } from './crawl-b10f';
export { createCrawlDtiHandler } from './crawl-dti';
export { createCrawlJapanskaHandler } from './crawl-japanska';
export { createCrawlHeydougaHandler } from './crawl-heydouga';
export { createCrawlPerformerLookupHandler } from './crawl-performer-lookup';

// Content enhancement handlers
export { createEnhanceContentHandler } from './enhance-content';
export { createSeoEnhanceHandler } from './seo-enhance';

// Backfill handlers
export { createBackfillVideosHandler } from './backfill-videos';
export { createBackfillImagesHandler } from './backfill-images';
export type { BackfillPerformerProfilesDeps } from './backfill-performer-profiles';
export { createBackfillPerformerProfilesHandler } from './backfill-performer-profiles';
export type { BackfillReviewsHandlerDeps } from './backfill-reviews';
export { createBackfillReviewsHandler } from './backfill-reviews';

// Data quality report handler
export type { DataQualityReportDeps } from './data-quality-report';
export { createDataQualityReportHandler } from './data-quality-report';

// Performer normalization handler
export { createNormalizePerformersHandler } from './normalize-performers';

// Performer pipeline handler
export { createPerformerPipelineHandler } from './performer-pipeline';

// Content enrichment pipeline handler
export { createContentEnrichmentPipelineHandler } from './content-enrichment-pipeline';

// Raw data processing handler
export { createProcessRawDataHandler } from './process-raw-data';

// Migration handler
export { createRunMigrationHandler } from './run-migration';

// News generation handler
export { createGenerateNewsHandler } from './generate-news';

// On-demand revalidation handler
export { createRevalidateHandler } from './revalidate';
