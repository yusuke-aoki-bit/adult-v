import { getDb } from '@/lib/db';
import { productSources } from '@/lib/db/schema';
import { createRankingProductsHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export const GET = createRankingProductsHandler({
  getDb,
  productSources,
});
