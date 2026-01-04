import { getDb } from '@/lib/db';
import { productSources } from '@/lib/db/schema';
import { createRankingProductsHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 60; // 1分キャッシュ（ランキングは頻繁に更新）

export const GET = createRankingProductsHandler({
  getDb,
  productSources,
});
