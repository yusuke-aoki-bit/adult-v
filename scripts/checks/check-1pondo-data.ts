/**
 * Check 一本道 data in database
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkData() {
  console.log('=== 一本道データの確認 ===\n');

  // 1. raw_html_dataの確認
  const rawHtmlResult = await db.execute(sql`
    SELECT COUNT(*) as total_raw_html, COUNT(DISTINCT product_id) as unique_products
    FROM raw_html_data
    WHERE source = '一本道'
  `);
  console.log('raw_html_data:');
  console.log(rawHtmlResult.rows[0]);
  console.log('');

  // 2. productsの確認
  const productsResult = await db.execute(sql`
    SELECT COUNT(*) as total_products
    FROM products p
    INNER JOIN product_tags pt ON p.id = pt.product_id
    INNER JOIN tags t ON pt.tag_id = t.id
    WHERE t.name = '一本道'
  `);
  console.log('products with 一本道 tag:');
  console.log(productsResult.rows[0]);
  console.log('');

  // 3. product_performersの確認
  const performersResult = await db.execute(sql`
    SELECT COUNT(DISTINCT pp.performer_id) as unique_performers
    FROM product_performers pp
    INNER JOIN products p ON pp.product_id = p.id
    INNER JOIN product_tags pt ON p.id = pt.product_id
    INNER JOIN tags t ON pt.tag_id = t.id
    WHERE t.name = '一本道'
  `);
  console.log('performers linked to 一本道 products:');
  console.log(performersResult.rows[0]);
  console.log('');

  // 4. サンプルデータの確認
  const sampleResult = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title,
           COUNT(pp.performer_id) as performer_count
    FROM products p
    INNER JOIN product_tags pt ON p.id = pt.product_id
    INNER JOIN tags t ON pt.tag_id = t.id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE t.name = '一本道'
    GROUP BY p.id, p.normalized_product_id, p.title
    LIMIT 10
  `);
  console.log('Sample 一本道 products:');
  for (const row of sampleResult.rows as any[]) {
    console.log(`  ID: ${row.id}, Normalized: ${row.normalized_product_id}, Performers: ${row.performer_count}`);
  }
}

checkData().catch(console.error).finally(() => process.exit(0));
