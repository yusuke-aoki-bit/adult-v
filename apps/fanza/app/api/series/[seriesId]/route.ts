import { getSeriesByTagId } from '@/lib/db/queries';
import { createSeriesHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createSeriesHandler({
  getSeriesByTagId,
});
