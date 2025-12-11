import { getDb } from '../apps/fanza/lib/db/index';
import { products, productSources } from '../apps/fanza/lib/db/schema';
import { desc, sql, eq } from 'drizzle-orm';

async function checkData() {
  const db = getDb();

  // FANZAの価格詳細を確認
  const fanzaSamples = await db.execute(sql`
    SELECT ps.id, ps.product_id, ps.original_product_id, ps.asp_name, ps.price, ps.currency, p.title
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'FANZA' AND ps.price > 0
    ORDER BY ps.updated_at DESC
    LIMIT 20
  `);
  console.log('FANZA価格サンプル:');
  for (const p of fanzaSamples.rows as any[]) {
    console.log(`品番: ${p.original_product_id}, Price: ${p.price}${p.currency || '円'}, Title: ${p.title?.substring(0, 50)}`);
  }

  // ASPごとの価格統計
  const aspPriceStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      AVG(price) as avg_price,
      MIN(CASE WHEN price > 0 THEN price END) as min_price,
      MAX(price) as max_price
    FROM product_sources
    WHERE price > 0
    GROUP BY asp_name
    ORDER BY avg_price DESC
  `);
  console.log('\nASPごとの価格統計:');
  for (const row of aspPriceStats.rows as any[]) {
    console.log(`${row.asp_name}: total=${row.total}, avg=${Math.round(row.avg_price)}円, min=${row.min_price}円, max=${row.max_price}円`);
  }

  process.exit(0);
}

checkData().catch(console.error);
