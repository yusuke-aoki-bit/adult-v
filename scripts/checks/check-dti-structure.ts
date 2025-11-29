import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== DTI商品データ構造確認 ===\n');

  // DTI商品のサンプル（normalized_product_idとoriginal_product_id）
  const samples = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
      ps.asp_name,
      ps.original_product_id,
      p.default_thumbnail_url
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    LIMIT 20
  `);

  console.log('=== DTI商品サンプル（画像なし）===');
  console.table(samples.rows);

  // asp_name一覧
  const aspNames = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    WHERE asp_name LIKE '%pondo%'
       OR asp_name LIKE '%carib%'
       OR asp_name LIKE '%paco%'
       OR asp_name LIKE '%10musume%'
       OR asp_name LIKE '%heyzo%'
       OR asp_name = 'DTI'
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('\n=== DTI関連asp_name一覧 ===');
  console.table(aspNames.rows);

  // normalized_product_idのパターン
  const patterns = await db.execute(sql`
    SELECT
      SUBSTRING(p.normalized_product_id FROM '^([^-]+)') as site_prefix,
      COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY site_prefix
    ORDER BY count DESC
  `);

  console.log('\n=== normalized_product_id のサイトプレフィックス ===');
  console.table(patterns.rows);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
