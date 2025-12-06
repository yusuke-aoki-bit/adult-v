import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== DTI価格データ確認 ===\n');

  // まず件数と価格の有無を確認
  const overview = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(price) as with_price,
      COUNT(*) - COUNT(price) as null_price,
      COUNT(*) FILTER (WHERE price > 0) as positive_price
    FROM product_sources
    WHERE asp_name = 'dti'
  `);
  console.log('Overview:', overview.rows[0]);

  // 最新のDTIレコードのサンプル
  console.log('\n=== 最新DTIレコード ===');
  const samples = await db.execute(sql`
    SELECT
      id,
      price,
      original_product_id,
      affiliate_url
    FROM product_sources
    WHERE asp_name = 'dti'
    ORDER BY id DESC
    LIMIT 10
  `);

  for (const row of samples.rows as any[]) {
    console.log(`ID: ${row.id} | 価格: ${row.price} | ${row.original_product_id}`);
    console.log(`  URL: ${(row.affiliate_url as string)?.substring(0, 100)}`);
  }

  // 価格がある場合のサンプル
  console.log('\n=== 価格が設定されているDTIレコード ===');
  const priced = await db.execute(sql`
    SELECT
      id,
      price,
      original_product_id,
      affiliate_url
    FROM product_sources
    WHERE asp_name = 'dti' AND price IS NOT NULL AND price > 0
    ORDER BY id DESC
    LIMIT 10
  `);

  for (const row of priced.rows as any[]) {
    console.log(`ID: ${row.id} | 価格: ¥${Number(row.price).toLocaleString()} | ${row.original_product_id}`);
    console.log(`  URL: ${(row.affiliate_url as string)?.substring(0, 100)}`);
  }
}

check().catch(console.error);
