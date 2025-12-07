import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  // DUGA製品で出演者がいるか
  const dugaWithPerformers = await db.execute(sql`
    SELECT COUNT(DISTINCT pp.product_id) as count
    FROM product_performers pp
    JOIN product_sources ps ON pp.product_id = ps.product_id
    WHERE ps.asp_name = 'DUGA'
  `);
  console.log('DUGA products with performers:', dugaWithPerformers.rows[0].count);

  // DUGA製品の総数
  const dugaTotal = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'DUGA'
  `);
  console.log('DUGA total products:', dugaTotal.rows[0].count);

  // 通貨確認
  const currencies = await db.execute(sql`
    SELECT asp_name, currency, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name, currency
    ORDER BY asp_name
  `);
  console.log('\nCurrency by ASP:');
  for (const row of currencies.rows as any[]) {
    console.log(`  ${row.asp_name}: ${row.currency || 'NULL'} (${row.count})`);
  }

  // サンプル：DUGAの出演者情報
  const sample = await db.execute(sql`
    SELECT p.id, p.title, per.name as performer_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers per ON pp.performer_id = per.id
    WHERE ps.asp_name = 'DUGA'
    LIMIT 10
  `);
  console.log('\nSample DUGA products:');
  for (const row of sample.rows as any[]) {
    console.log(`  ${row.id}: ${row.performer_name || '(no performer)'} - ${(row.title || '').substring(0, 40)}`);
  }

  // DUGA画像確認 - タイプ別
  const dugaImageTypes = await db.execute(sql`
    SELECT pi.image_type, COUNT(*) as count
    FROM product_images pi
    JOIN product_sources ps ON pi.product_id = ps.product_id
    WHERE ps.asp_name = 'DUGA'
    GROUP BY pi.image_type
  `);
  console.log('\nDUGA image types:');
  for (const row of dugaImageTypes.rows as any[]) {
    console.log(`  ${row.image_type}: ${row.count}`);
  }

  // package画像のサンプルURL
  const packageImages = await db.execute(sql`
    SELECT pi.image_url
    FROM product_images pi
    JOIN product_sources ps ON pi.product_id = ps.product_id
    WHERE ps.asp_name = 'DUGA' AND pi.image_type = 'package'
    LIMIT 3
  `);
  console.log('\nDUGA package images:');
  for (const row of packageImages.rows as any[]) {
    console.log(`  ${row.image_url}`);
  }
}

check().catch(console.error);
