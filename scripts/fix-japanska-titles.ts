/**
 * Japanska商品のタイトルを修正するスクリプト
 *
 * 問題：
 * - サイトが会員専用のため、クローラーがホームページの内容を取得してしまっている
 * - タイトルがサイトキャッチコピーまたはID形式になっている
 *
 * 修正：
 * - すべてのJapanska商品タイトルを「Japanska作品 #XXXXX」形式に統一
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== Japanskaタイトル修正スクリプト ===\n');

  // 修正前の状態を確認
  const before = await db.execute(sql`
    SELECT
      p.title,
      p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    LIMIT 5
  `);
  console.log('修正前のサンプル:');
  console.table(before.rows);

  // タイトルを修正
  // normalized_product_idが 'Japanska-XXXXX' なので、IDを抽出して新タイトルを生成
  const updateResult = await db.execute(sql`
    UPDATE products p
    SET
      title = 'Japanska作品 #' || SUBSTRING(p.normalized_product_id FROM 10),
      updated_at = NOW()
    WHERE p.id IN (
      SELECT ps.product_id
      FROM product_sources ps
      WHERE ps.asp_name = 'Japanska'
    )
    AND (
      p.title LIKE '%JAPANSKA%'
      OR p.title LIKE 'Japanska-%'
      OR p.title LIKE '%幅広いジャンル%'
      OR p.title LIKE '%30日%'
    )
  `);

  console.log('\n修正件数:', updateResult.rowCount);

  // 修正後の確認
  const after = await db.execute(sql`
    SELECT
      p.title,
      p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    ORDER BY p.normalized_product_id
    LIMIT 10
  `);
  console.log('\n修正後のサンプル:');
  console.table(after.rows);

  // 統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN title LIKE 'Japanska作品%' THEN 1 END) as fixed_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
  `);
  console.log('\n統計:');
  console.table(stats.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
