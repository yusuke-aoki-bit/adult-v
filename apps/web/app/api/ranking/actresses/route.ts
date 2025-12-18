import { getDb } from '@/lib/db';
import { performers } from '@/lib/db/schema';
import { createRankingActressesHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export const GET = createRankingActressesHandler({
  getDb,
  performers,
});
