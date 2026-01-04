import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { createRankingActressesHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 60; // 1分キャッシュ（ランキングは頻繁に更新）

export const GET = createRankingActressesHandler({
  getDb,
  performers,
});
