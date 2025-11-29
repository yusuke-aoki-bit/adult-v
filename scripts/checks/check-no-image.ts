import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkNoImageIssue() {
  const db = getDb();

  console.log('=== Checking NO IMAGE Issue ===\n');

  // Check thumbnail status by ASP
  const aspStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(CASE WHEN thumbnail_url IS NULL OR thumbnail_url = '' THEN 1 END) as no_thumbnail,
      COUNT(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 END) as has_thumbnail
    FROM product_cache
    GROUP BY asp_name
    ORDER BY no_thumbnail DESC
  `);

  console.log('📊 Thumbnail Status by ASP:');
  console.table(aspStats.rows);

  // Get sample of products with no thumbnail for each ASP
  console.log('\n🔍 Sample Products with NO THUMBNAIL:\n');

  for (const asp of aspStats.rows as any[]) {
    if (asp.no_thumbnail > 0) {
      const samples = await db.execute(sql`
        SELECT pc.id, p.title, pc.asp_name, LEFT(pc.affiliate_url, 100) as affiliate_preview
        FROM product_cache pc
        JOIN products p ON pc.product_id = p.id
        WHERE pc.asp_name = ${asp.asp_name}
        AND (pc.thumbnail_url IS NULL OR pc.thumbnail_url = '')
        LIMIT 5
      `);

      console.log(`\n--- ${asp.asp_name} (${asp.no_thumbnail} missing) ---`);
      for (const sample of samples.rows as any[]) {
        console.log(`  Cache ID: ${sample.id}`);
        console.log(`  Title: ${sample.title?.substring(0, 50)}...`);
        console.log(`  Affiliate URL: ${sample.affiliate_preview}`);
        console.log('');
      }
    }
  }

  // Check sample products with thumbnail to see URL patterns
  console.log('\n✅ Sample Products WITH THUMBNAIL:\n');

  for (const asp of aspStats.rows as any[]) {
    if (asp.has_thumbnail > 0) {
      const samples = await db.execute(sql`
        SELECT pc.id, p.title, pc.asp_name, LEFT(pc.thumbnail_url, 100) as thumb_preview
        FROM product_cache pc
        JOIN products p ON pc.product_id = p.id
        WHERE pc.asp_name = ${asp.asp_name}
        AND pc.thumbnail_url IS NOT NULL AND pc.thumbnail_url != ''
        LIMIT 3
      `);

      console.log(`\n--- ${asp.asp_name} ---`);
      for (const sample of samples.rows as any[]) {
        console.log(`  Cache ID: ${sample.id}`);
        console.log(`  Title: ${sample.title?.substring(0, 50)}...`);
        console.log(`  Thumbnail: ${sample.thumb_preview}`);
        console.log('');
      }
    }
  }

  process.exit(0);
}

checkNoImageIssue().catch(console.error);
