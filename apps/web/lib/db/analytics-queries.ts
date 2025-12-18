/**
 * Analytics DB Query Functions
 *
 * These functions are used by the shared analytics handler
 */

import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { AnalyticsData } from '@adult-v/shared/api-handlers';

/**
 * Get analytics data for a given period
 */
export async function getAnalyticsData(daysBack: number): Promise<AnalyticsData> {
  const db = getDb();

  // Get total views in period
  const totalViewsResult = await db.execute(sql`
    SELECT COUNT(*) as total_views
    FROM product_views
    WHERE viewed_at >= NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
  `);
  const totalViews = Number(totalViewsResult.rows[0]?.total_views || 0);

  // Get total products
  const totalProductsResult = await db.execute(sql`
    SELECT COUNT(*) as total_products
    FROM products
  `);
  const totalProducts = Number(totalProductsResult.rows[0]?.total_products || 0);

  // Get total favorites (estimate based on localStorage usage pattern)
  // Since favorites are client-side, we can't track server-side
  // Return 0 or implement a tracking system if needed
  const totalFavorites = 0;

  // Get unique visitors (approximate using distinct view timestamps)
  const uniqueVisitorsResult = await db.execute(sql`
    SELECT COUNT(DISTINCT DATE_TRUNC('hour', viewed_at)) as unique_visitors
    FROM product_views
    WHERE viewed_at >= NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
  `);
  const uniqueVisitors = Number(uniqueVisitorsResult.rows[0]?.unique_visitors || 0);

  // Get top 5 products by views
  const topProductsResult = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      COUNT(pv.id) as views
    FROM products p
    JOIN product_views pv ON p.id = pv.product_id
    WHERE pv.viewed_at >= NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
    GROUP BY p.id, p.title
    ORDER BY views DESC
    LIMIT 5
  `);
  const topProducts = topProductsResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    views: Number(row.views),
  }));

  // Get top 5 performers by views
  const topPerformersResult = await db.execute(sql`
    SELECT
      perf.id,
      perf.name,
      COUNT(pv.id) as views
    FROM performers perf
    JOIN product_performers pp ON perf.id = pp.performer_id
    JOIN product_views pv ON pp.product_id = pv.product_id
    WHERE pv.viewed_at >= NOW() - INTERVAL '${sql.raw(daysBack.toString())} days'
    GROUP BY perf.id, perf.name
    ORDER BY views DESC
    LIMIT 5
  `);
  const topPerformers = topPerformersResult.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    views: Number(row.views),
  }));

  return {
    totalViews,
    totalProducts,
    totalFavorites,
    uniqueVisitors,
    topProducts,
    topPerformers,
  };
}
