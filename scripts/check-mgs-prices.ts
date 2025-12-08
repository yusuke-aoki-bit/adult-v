import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkMgsPrices() {
  // MGS商品数
  const mgsCount = await db.execute(sql`
    SELECT count(*) as count FROM product_sources WHERE asp_name = 'MGS'
  `);

  // product_sources テーブルの price がある商品
  const withPrice = await db.execute(sql`
    SELECT count(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS' AND price > 0
  `);

  // product_sources テーブルの price がない商品
  const noPrice = await db.execute(sql`
    SELECT count(*) as count
    FROM product_sources
    WHERE asp_name = 'MGS' AND (price IS NULL OR price = 0)
  `);

  // サンプル: 価格がある商品
  const samplesWithPrice = await db.execute(sql`
    SELECT ps.original_product_id, ps.price, ps.currency, p.title
    FROM product_sources ps
    INNER JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS' AND ps.price > 0
    ORDER BY ps.last_updated DESC
    LIMIT 5
  `);

  // サンプル: 価格がない商品
  const samplesNoPrice = await db.execute(sql`
    SELECT ps.original_product_id, ps.price, ps.currency, p.title
    FROM product_sources ps
    INNER JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS' AND (ps.price IS NULL OR ps.price = 0)
    ORDER BY ps.last_updated DESC
    LIMIT 5
  `);

  console.log('MGS商品統計:');
  console.log('  product_sources 総数:', mgsCount.rows[0].count);
  console.log('  price > 0:', withPrice.rows[0].count);
  console.log('  price なし/0:', noPrice.rows[0].count);
  console.log('');

  console.log('価格がある商品サンプル (max 5):');
  samplesWithPrice.rows.forEach((s: any) => {
    console.log('  ', s.original_product_id, 'price:', s.price, s.currency, (s.title || '').slice(0,35));
  });

  console.log('');
  console.log('価格がない商品サンプル (max 5):');
  samplesNoPrice.rows.forEach((s: any) => {
    console.log('  ', s.original_product_id, 'price:', s.price, s.currency, (s.title || '').slice(0,35));
  });
}

checkMgsPrices().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
