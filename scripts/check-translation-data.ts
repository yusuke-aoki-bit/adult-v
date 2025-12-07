import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // ASP names check
  const aspStats = await db.execute(sql`
    SELECT DISTINCT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('ASP names in DB:');
  for (const row of aspStats.rows) {
    console.log(`  ${row.asp_name}: ${row.count}`);
  }
  console.log('');

  // DTI site prefixes check
  const dtiPrefixes = await db.execute(sql`
    SELECT
      SUBSTRING(normalized_product_id FROM 1 FOR POSITION('-' IN normalized_product_id) - 1) as site_prefix,
      COUNT(*) as count
    FROM products
    WHERE normalized_product_id LIKE 'カリビアンコム-%'
       OR normalized_product_id LIKE '一本道-%'
       OR normalized_product_id LIKE 'HEYZO-%'
       OR normalized_product_id LIKE '天然むすめ-%'
       OR normalized_product_id LIKE 'パコパコママ-%'
       OR normalized_product_id LIKE 'カリビアンコムプレミアム-%'
       OR normalized_product_id LIKE '人妻斬り-%'
       OR normalized_product_id LIKE '金髪天國-%'
       OR normalized_product_id LIKE 'ムラムラ-%'
    GROUP BY site_prefix
    ORDER BY count DESC
  `);
  console.log('DTI site prefixes in products:');
  for (const row of dtiPrefixes.rows) {
    console.log(`  ${row.site_prefix}: ${row.count}`);
  }
  console.log('');

  // Products翻訳状況
  const productStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(title_en) as with_en,
      COUNT(title_zh) as with_zh,
      COUNT(title_ko) as with_ko
    FROM products
  `);
  console.log('Products:', JSON.stringify(productStats.rows[0]));

  // Performers翻訳状況
  const performerStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(name_en) as with_en,
      COUNT(name_zh) as with_zh,
      COUNT(name_ko) as with_ko
    FROM performers
  `);
  console.log('Performers:', JSON.stringify(performerStats.rows[0]));

  // Tags翻訳状況
  const tagStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(name_en) as with_en,
      COUNT(name_zh) as with_zh,
      COUNT(name_ko) as with_ko
    FROM tags
  `);
  console.log('Tags:', JSON.stringify(tagStats.rows[0]));

  // サンプルデータを1件表示
  const sample = await db.execute(sql`
    SELECT id, title, title_en, title_zh, title_ko
    FROM products
    WHERE title_en IS NOT NULL
    LIMIT 3
  `);
  console.log('Sample products with translations:', JSON.stringify(sample.rows, null, 2));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
