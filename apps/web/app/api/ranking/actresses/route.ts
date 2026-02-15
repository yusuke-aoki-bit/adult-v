import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { createRankingActressesHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createRankingActressesHandler({
  getDb,
  performers,
});
