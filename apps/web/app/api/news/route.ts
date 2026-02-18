import { getLatestNews, getNewsByCategory } from '@/lib/db/news-queries';
import { createNewsHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createNewsHandler({
  getLatestNews,
  getNewsByCategory,
});
