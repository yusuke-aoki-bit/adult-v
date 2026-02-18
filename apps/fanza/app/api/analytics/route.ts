/**
 * Analytics API Route
 *
 * Uses shared handler with dependency injection for DB operations
 */

import { getAnalyticsData } from '@/lib/db/analytics-queries';
import { createAnalyticsHandler } from '@adult-v/shared/api-handlers';

export const dynamic = 'force-dynamic';

export const GET = createAnalyticsHandler({
  getAnalyticsData,
});
