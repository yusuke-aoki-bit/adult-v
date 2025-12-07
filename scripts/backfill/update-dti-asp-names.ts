/**
 * DTI product_sourcesのasp_nameを個別サイト名に更新
 * normalized_product_idのプレフィックスからサイトを特定
 */

import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('Updating DTI product_sources to individual site names...');

  // カリビアンコムプレミアム
  const caribprResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = 'カリビアンコムプレミアム'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
  `);
  console.log('Updated カリビアンコムプレミアム:', caribprResult.rowCount);

  // HEYZO
  const heyzoResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = 'HEYZO'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE 'HEYZO-%'
  `);
  console.log('Updated HEYZO:', heyzoResult.rowCount);

  // カリビアンコム (not premium)
  const caribResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = 'カリビアンコム'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE 'カリビアンコム-%'
      AND p.normalized_product_id NOT LIKE 'カリビアンコムプレミアム-%'
  `);
  console.log('Updated カリビアンコム:', caribResult.rowCount);

  // 一本道
  const iponResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = '一本道'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE '一本道-%'
  `);
  console.log('Updated 一本道:', iponResult.rowCount);

  // 天然むすめ
  const musumeResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = '天然むすめ'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE '天然むすめ-%'
  `);
  console.log('Updated 天然むすめ:', musumeResult.rowCount);

  // パコパコママ
  const pacoResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = 'パコパコママ'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE 'パコパコママ-%'
  `);
  console.log('Updated パコパコママ:', pacoResult.rowCount);

  // 人妻斬り
  const hitozumaResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = '人妻斬り'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE '人妻斬り-%'
  `);
  console.log('Updated 人妻斬り:', hitozumaResult.rowCount);

  // ムラムラ
  const muramuraResult = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = 'ムラムラ'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE 'ムラムラ-%'
  `);
  console.log('Updated ムラムラ:', muramuraResult.rowCount);

  // 金髪天國
  const kin8Result = await db.execute(sql`
    UPDATE product_sources ps
    SET asp_name = '金髪天國'
    FROM products p
    WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
      AND p.normalized_product_id LIKE '金髪天國-%'
  `);
  console.log('Updated 金髪天國:', kin8Result.rowCount);

  // Verify remaining
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'DTI'
  `);
  console.log('\nRemaining DTI records:', remaining.rows[0].count);

  // Show current ASP stats
  const aspStats = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.log('\nCurrent ASP stats:');
  for (const row of aspStats.rows) {
    console.log(`  ${row.asp_name}: ${row.count}`);
  }

  // Categories count
  const categories = await db.execute(sql`SELECT COUNT(*) as count FROM categories`);
  console.log('\nCategories count:', categories.rows[0].count);

  // Tags count
  const tagsCount = await db.execute(sql`SELECT COUNT(*) as count FROM tags`);
  console.log('Tags count:', tagsCount.rows[0].count);

  // MGS prices
  const mgsPrices = await db.execute(sql`
    SELECT ps.price, COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    GROUP BY ps.price
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\nMGS price distribution:');
  for (const row of mgsPrices.rows) {
    console.log('  ¥' + row.price + ': ' + row.count);
  }

  // caribbeancompr prices
  const caribprPrices = await db.execute(sql`
    SELECT ps.price, COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'カリビアンコムプレミアム'
    GROUP BY ps.price
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\nカリビアンコムプレミアム price distribution:');
  for (const row of caribprPrices.rows) {
    console.log('  ¥' + row.price + ': ' + row.count);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
