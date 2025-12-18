/**
 * Discover API Route
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { getRandomProduct } from '@/lib/db/discover-queries';
import { createDiscoverHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createDiscoverHandler({
  getRandomProduct,
});
