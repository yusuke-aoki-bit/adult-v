/**
 * Pre-wired Cron Route Handlers
 *
 * All dependencies resolved internally — app route files only need to re-export.
 * Route segment config (dynamic, maxDuration) must still be declared in each route file.
 */

import { getDb as _getDb } from '@adult-v/database';
import { sql as _sql } from 'drizzle-orm';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import { getDugaClient } from '../providers/duga-client';
import { getSokmilClient } from '../providers/sokmil-client';

// Cast to `any` to bridge drizzle-orm type mismatch between @adult-v/database and shared package.
// Runtime types are identical — only TS sees them as separate due to duplicate drizzle-orm instances.
const getDb = _getDb as any;
const sql = _sql as any;
import {
  detectFaces,
  labelImage,
  translateText,
  searchYouTubeVideos,
  checkGoogleApiConfig,
  requestIndexing,
  getAnalyticsReport,
} from '../lib/google-apis';
import { generateNewsContent, classifyPerformerByProducts } from '../lib/llm-service';
import {
  createCrawlMgsHandler,
  createCrawlDugaHandler,
  createCrawlSokmilHandler,
  createCrawlSokmilScrapeHandler,
  createCrawlFc2Handler,
  createCrawlFanzaHandler,
  createCrawlB10fHandler,
  createCrawlDtiHandler,
  createCrawlJapanskaHandler,
  createCrawlHeydougaHandler,
  createCrawlPerformerLookupHandler,
  createEnhanceContentHandler,
  createSeoEnhanceHandler,
  createBackfillImagesHandler,
  createBackfillVideosHandler,
  createBackfillReviewsHandler,
  createBackfillPerformerProfilesHandler,
  createNormalizePerformersHandler,
  createPerformerPipelineHandler,
  createProcessRawDataHandler,
  createStatusHandler,
  createCleanupHandler,
  createRevalidateHandler,
  createGenerateNewsHandler,
  createClassifyPerformersAiHandler,
  createDataQualityReportHandler,
  createIndexNowNotifyHandler,
} from '../cron-handlers';

// Common dependency groups
const auth = { verifyCronRequest, unauthorizedResponse };
const dbDeps = { getDb, sql };

// --- Pattern A: auth + getDb ---
export const cronCrawlMgs = createCrawlMgsHandler({ ...auth, getDb });
export const cronCrawlB10f = createCrawlB10fHandler({ ...auth, getDb });
export const cronCrawlDti = createCrawlDtiHandler({ ...auth, getDb });
export const cronCrawlFc2 = createCrawlFc2Handler({ ...auth, getDb });
export const cronCrawlFanza = createCrawlFanzaHandler({ ...auth, getDb });
export const cronCrawlJapanska = createCrawlJapanskaHandler({ ...auth, getDb });
export const cronCrawlSokmilScrape = createCrawlSokmilScrapeHandler({ ...auth, getDb });
export const cronCrawlPerformerLookup = createCrawlPerformerLookupHandler({ ...auth, getDb });
export const cronNormalizePerformers = createNormalizePerformersHandler({ ...auth, getDb });
export const cronProcessRawData = createProcessRawDataHandler({ ...auth, getDb });
export const cronBackfillImages = createBackfillImagesHandler({ ...auth, getDb });
export const cronBackfillVideos = createBackfillVideosHandler({ ...auth, getDb });
export const cronCrawlHeydouga = createCrawlHeydougaHandler({ ...auth, getDb });
export const cronBackfillReviews = createBackfillReviewsHandler({ ...auth, getDb });
export const cronPerformerPipeline = createPerformerPipelineHandler({ ...auth, getDb });

// --- Pattern B: getDb + sql only (auth handled internally) ---
export const cronStatus = createStatusHandler({ ...dbDeps });
export const cronCleanup = createCleanupHandler({ ...dbDeps });
export const cronDataQualityReport = createDataQualityReportHandler({ ...dbDeps });
export const cronBackfillPerformerProfiles = createBackfillPerformerProfilesHandler({ ...dbDeps });

// --- Pattern C: + provider client ---
export const cronCrawlDuga = createCrawlDugaHandler({ ...auth, getDb, getDugaClient });
export const cronCrawlSokmil = createCrawlSokmilHandler({ ...auth, getDb, getSokmilClient });

// --- Pattern D: + Google APIs ---
export const cronEnhanceContent = createEnhanceContentHandler({
  ...auth,
  getDb,
  detectFaces,
  labelImage,
  translateText,
  searchYouTubeVideos,
  checkGoogleApiConfig,
});
export const cronSeoEnhance = createSeoEnhanceHandler({
  ...auth,
  getDb,
  requestIndexing,
  getAnalyticsReport,
  checkGoogleApiConfig,
});

// --- Pattern E: + LLM service ---
export const cronGenerateNews = createGenerateNewsHandler({ ...auth, getDb, generateNewsContent });
export const cronClassifyPerformersAi = createClassifyPerformersAiHandler({
  ...auth,
  getDb,
  classifyPerformerByProducts,
});

// --- Revalidate (GET + POST) ---
const _revalidate = createRevalidateHandler({ ...auth });
export const cronRevalidateGET = _revalidate;
export const cronRevalidatePOST = _revalidate;

// --- IndexNow notification (GET + POST) ---
const _indexNowNotify = createIndexNowNotifyHandler({ ...auth, getDb });
export const cronIndexNowNotifyGET = _indexNowNotify.GET;
export const cronIndexNowNotifyPOST = _indexNowNotify.POST;

// --- Re-export special handlers from separate files ---
export { cronRunMigration } from './run-migration';
export { cronContentEnrichmentPipeline } from './content-enrichment-pipeline';
