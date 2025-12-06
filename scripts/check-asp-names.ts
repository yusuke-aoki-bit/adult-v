import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== ASP名一覧と件数 ===\n');

  const aspStats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as count,
      COUNT(price) as with_price,
      MIN(price) as min_price,
      MAX(price) as max_price
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  for (const row of aspStats.rows as any[]) {
    console.log(`${row.asp_name}: ${row.count}件 (価格あり: ${row.with_price}, ¥${row.min_price}〜¥${row.max_price})`);
  }

  // DTI系かもしれないURLを探す
  console.log('\n=== caribbeancom/heyzoを含むURL ===');
  const dtiUrls = await db.execute(sql`
    SELECT DISTINCT asp_name, affiliate_url
    FROM product_sources
    WHERE affiliate_url LIKE '%caribbeancom%'
       OR affiliate_url LIKE '%heyzo%'
       OR affiliate_url LIKE '%1pondo%'
    LIMIT 20
  `);

  for (const row of dtiUrls.rows as any[]) {
    console.log(`${row.asp_name}: ${(row.affiliate_url as string)?.substring(0, 80)}`);
  }
}

check().catch(console.error);
