import { getAspStats } from '@/lib/db/queries';
import { getAllASPTotals } from '@adult-v/shared/lib/asp-totals';
import { createStatsAspHandler } from '@adult-v/shared/api-handlers';

// ビルド時にAPI呼び出しがタイムアウトするため動的レンダリングに設定
export const dynamic = 'force-dynamic';

// FANZAサイトはFANZAを除外しない
export const GET = createStatsAspHandler(
  { getAspStats, getAllASPTotals },
  { excludeFanza: false }
);
