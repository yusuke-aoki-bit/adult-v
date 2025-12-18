import { getWeeklyHighlights } from '@/lib/db/recommendations';
import { createWeeklyHighlightsHandler } from '@adult-v/shared/api-handlers';

export const GET = createWeeklyHighlightsHandler({
  getWeeklyHighlights,
});

// 1時間キャッシュ
export const revalidate = 3600;
