/**
 * DTI製品の文字化けを修正するスクリプト
 * raw_html_dataのキャッシュを削除し、DBの文字化けデータを修正
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function fixDtiEncoding() {
  const db = getDb();

  console.log('=== Fixing DTI Encoding Issues ===\n');

  // 1. まず文字化けしているDTI製品の数を確認
  const mojibakeCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`Total DTI products: ${mojibakeCount.rows[0].count}`);

  // 2. raw_html_dataのキャッシュを削除（DTIサイトのみ）
  console.log('\nDeleting cached raw HTML data for DTI sites...');
  const deleteResult = await db.execute(sql`
    DELETE FROM raw_html_data
    WHERE source IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log('Deleted cached HTML data');

  // 3. 文字化けしているproductsのデータを削除
  console.log('\nDeleting corrupted DTI products...');

  // product_sourcesから関連データを削除
  await db.execute(sql`
    DELETE FROM product_sources
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);

  // product_cacheから関連データを削除
  await db.execute(sql`
    DELETE FROM product_cache
    WHERE asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);

  console.log('Deleted corrupted DTI data');

  // 4. 孤立したproductsを削除（他のASPにも存在しない場合）
  console.log('\nCleaning up orphaned products...');
  await db.execute(sql`
    DELETE FROM products
    WHERE id NOT IN (SELECT DISTINCT product_id FROM product_sources)
  `);
  console.log('Cleaned up orphaned products');

  // 5. 確認
  const afterCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name IN ('カリビアンコムプレミアム', '一本道', 'カリビアンコム', 'HEYZO', 'DTI')
  `);
  console.log(`\nDTI products after cleanup: ${afterCount.rows[0].count}`);

  console.log('\n=== Done! ===');
  console.log('Now run the DTI crawler again with: npx tsx scripts/crawl-dti-sites.ts');
}

fixDtiEncoding()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
