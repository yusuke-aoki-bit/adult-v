import { getDb } from '@/lib/db';
import { productSources } from '@/lib/db/schema';
import { createRankingProductsHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createRankingProductsHandler({
  getDb,
  productSources,
});
