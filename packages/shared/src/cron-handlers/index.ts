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
export { createCrawlB10fHandler } from './crawl-b10f';
export { createCrawlDtiHandler } from './crawl-dti';
export { createCrawlJapanskaHandler } from './crawl-japanska';
export { createCrawlPerformerLookupHandler } from './crawl-performer-lookup';

// Content enhancement handlers
export { createEnhanceContentHandler } from './enhance-content';
export { createSeoEnhanceHandler } from './seo-enhance';

// Backfill handlers
export { createBackfillVideosHandler } from './backfill-videos';
export { createBackfillImagesHandler } from './backfill-images';

// Performer normalization handler
export { createNormalizePerformersHandler } from './normalize-performers';

// Performer pipeline handler
export { createPerformerPipelineHandler } from './performer-pipeline';

// Content enrichment pipeline handler
export { createContentEnrichmentPipelineHandler } from './content-enrichment-pipeline';

// Raw data processing handler
export { createProcessRawDataHandler } from './process-raw-data';
