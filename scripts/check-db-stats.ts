import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * Database statistics
 */

async function checkDbStats() {
  const db = getDb();

  console.log('=== Database Statistics ===\n');

  // Table counts
  const stats = await db.execute(sql`
    SELECT 'Products' as table_name, COUNT(*) as count FROM products
    UNION ALL SELECT 'Performers', COUNT(*) FROM performers
    UNION ALL SELECT 'Product Sources', COUNT(*) FROM product_sources
    UNION ALL SELECT 'Product Cache', COUNT(*) FROM product_cache
    UNION ALL SELECT 'Performer Aliases', COUNT(*) FROM performer_aliases
    UNION ALL SELECT 'Tags', COUNT(*) FROM tags
  `);

  console.table(stats.rows);

  // ASP distribution
  const aspDist = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('\n=== ASP Distribution ===');
  console.table(aspDist.rows);

  // Thumbnail coverage
  const thumbStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) as has_thumb,
      ROUND(100.0 * COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) / COUNT(*), 1) as coverage_pct
    FROM product_cache
    GROUP BY asp_name
    ORDER BY total DESC
  `);

  console.log('\n=== Thumbnail Coverage ===');
  console.table(thumbStats.rows);

  process.exit(0);
}

checkDbStats().catch(console.error);
