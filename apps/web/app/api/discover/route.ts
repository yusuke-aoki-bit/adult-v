/**
 * Discover API Route
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { getRandomProducts } from '@/lib/db/discover-queries';
import { createDiscoverHandler } from '@adult-v/shared/api-handlers';

export const revalidate = 300; // 5分キャッシュ

export const GET = createDiscoverHandler({
  getRandomProducts,
});
