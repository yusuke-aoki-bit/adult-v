/**
 * Pre-wired content-enrichment-pipeline handler
 *
 * Uses DeepL for translation (not Google Translate)
 */

import { getDb as _getDb } from '@adult-v/database';

const getDb = _getDb as any;
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import { checkGoogleApiConfig, requestIndexing } from '../lib/google-apis';
import { createContentEnrichmentPipelineHandler } from '../cron-handlers';
import { translateWithDeepL } from '../lib/deepl';

export const cronContentEnrichmentPipeline = createContentEnrichmentPipelineHandler({
  verifyCronRequest,
  unauthorizedResponse,
  getDb,
  translateText: translateWithDeepL,
  requestIndexing: checkGoogleApiConfig().indexing ? requestIndexing : undefined,
  siteBaseUrl: process.env['NEXT_PUBLIC_SITE_URL'] || 'https://adult-v.com',
});
