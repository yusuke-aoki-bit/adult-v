import { getAspStats } from '@/lib/db/queries';
import { getAllASPTotals } from '@/lib/asp-totals';
import { createStatsAspHandler } from '@adult-v/shared/api-handlers';

// Cache for 5 minutes
export const revalidate = 300;

// FANZAサイトはFANZAを除外しない
export const GET = createStatsAspHandler(
  { getAspStats, getAllASPTotals },
  { excludeFanza: false }
);
