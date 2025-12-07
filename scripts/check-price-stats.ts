import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkPrices() {
  const db = getDb();

  // ASP別の価格分布を確認（通貨込み）
  const priceStats = await db.execute(sql`
    SELECT
      asp_name,
      currency,
      COUNT(*)::int as total,
      COUNT(CASE WHEN price IS NULL THEN 1 END)::int as null_prices,
      COUNT(CASE WHEN price = 0 THEN 1 END)::int as zero_prices,
      COUNT(CASE WHEN price > 0 THEN 1 END)::int as has_price,
      MIN(price)::int as min_price,
      MAX(price)::int as max_price
    FROM product_sources
    GROUP BY asp_name, currency
    ORDER BY total DESC
  `);

  console.log('=== ASP別 価格統計 ===');
  for (const row of priceStats.rows) {
    const r = row as { asp_name: string; total: number; null_prices: number; zero_prices: number; has_price: number; min_price: number | null; max_price: number | null };
    console.log(`${r.asp_name}: total=${r.total}, null=${r.null_prices}, zero=${r.zero_prices}, has_price=${r.has_price}, min=${r.min_price}, max=${r.max_price}`);
  }

  // 価格0の具体例を確認
  console.log('\n=== 価格0の例（各ASP 2件ずつ） ===');
  const zeroPriceExamples = await db.execute(sql`
    SELECT DISTINCT ON (ps.asp_name)
      ps.asp_name,
      ps.original_product_id,
      ps.price,
      LEFT(p.title, 50) as title
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.price = 0
    ORDER BY ps.asp_name, ps.id
    LIMIT 10
  `);

  for (const row of zeroPriceExamples.rows) {
    const r = row as { asp_name: string; original_product_id: string; price: number; title: string };
    console.log(`[${r.asp_name}] ${r.original_product_id}: ¥${r.price} - ${r.title}`);
  }

  // 価格が設定されている例
  console.log('\n=== 価格設定済みの例（各ASP 2件ずつ） ===');
  const hasPriceExamples = await db.execute(sql`
    SELECT DISTINCT ON (ps.asp_name)
      ps.asp_name,
      ps.original_product_id,
      ps.price,
      LEFT(p.title, 50) as title
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.price > 0
    ORDER BY ps.asp_name, ps.id
    LIMIT 10
  `);

  for (const row of hasPriceExamples.rows) {
    const r = row as { asp_name: string; original_product_id: string; price: number; title: string };
    console.log(`[${r.asp_name}] ${r.original_product_id}: ¥${r.price.toLocaleString()} - ${r.title}`);
  }

  process.exit(0);
}

checkPrices().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
