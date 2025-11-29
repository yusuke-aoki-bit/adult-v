import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== ASP別アフィリエイトURL格納状況 ===\n');

  // ASP別の統計
  const stats = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(*) as total,
      COUNT(CASE WHEN affiliate_url IS NOT NULL AND affiliate_url != '' THEN 1 END) as with_url,
      COUNT(CASE WHEN affiliate_url IS NULL OR affiliate_url = '' THEN 1 END) as without_url
    FROM product_sources
    GROUP BY asp_name
    ORDER BY total DESC
  `);
  console.table(stats.rows);

  // 各ASPのサンプルURLを表示
  console.log('\n=== 各ASPのアフィリエイトURLサンプル ===\n');

  const asps = ['DTI', 'MGS', 'DUGA', 'b10f', 'ソクミル', 'Japanska'];

  for (const asp of asps) {
    const sample = await db.execute(sql`
      SELECT original_product_id, affiliate_url
      FROM product_sources
      WHERE asp_name = ${asp}
        AND affiliate_url IS NOT NULL
        AND affiliate_url != ''
      LIMIT 1
    `);

    console.log(`【${asp}】`);
    if (sample.rows.length > 0) {
      console.log(`  商品ID: ${sample.rows[0].original_product_id}`);
      console.log(`  URL: ${sample.rows[0].affiliate_url}`);
    } else {
      console.log(`  アフィリエイトURLなし`);
    }
    console.log();
  }

  // アフィリエイトURLがないものをチェック
  console.log('=== アフィリエイトURLがない商品 ===\n');

  const noUrl = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    WHERE affiliate_url IS NULL OR affiliate_url = ''
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  if (noUrl.rows.length > 0) {
    console.table(noUrl.rows);
  } else {
    console.log('全商品にアフィリエイトURLあり');
  }

  process.exit(0);
}

main().catch(console.error);
