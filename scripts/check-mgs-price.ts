import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // MGSの価格状況を確認
  const mgsProducts = await db.execute(sql`
    SELECT ps.price, ps.currency, COUNT(*) as count
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS'
    GROUP BY ps.price, ps.currency
    ORDER BY count DESC
    LIMIT 15
  `);
  console.log('=== MGS Price Distribution ===');
  for (const row of mgsProducts.rows) {
    const r = row as Record<string, unknown>;
    console.log(`Price: ${r.price} ${r.currency || 'JPY'} - Count: ${r.count}`);
  }

  // サンプル商品を確認
  const samples = await db.execute(sql`
    SELECT p.id, p.title, ps.price, ps.currency, ps.affiliate_url
    FROM products p
    JOIN product_sources ps ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
    LIMIT 5
  `);
  console.log('\n=== Sample MGS Products ===');
  for (const row of samples.rows) {
    const r = row as Record<string, unknown>;
    console.log(`ID: ${r.id}, Price: ${r.price} ${r.currency || 'JPY'}`);
    console.log(`  Title: ${String(r.title).substring(0, 50)}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
