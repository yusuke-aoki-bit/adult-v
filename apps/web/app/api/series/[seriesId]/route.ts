import { getSeriesByTagId } from '@/lib/db/queries';
import { createSeriesHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createSeriesHandler({
  getSeriesByTagId,
});
