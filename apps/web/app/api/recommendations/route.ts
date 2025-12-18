import { getRecommendationsFromFavorites } from '@/lib/db/recommendations';
import { createRecommendationsHandler } from '@adult-v/shared/api-handlers';

export const POST = createRecommendationsHandler({
  getRecommendationsFromFavorites,
});
