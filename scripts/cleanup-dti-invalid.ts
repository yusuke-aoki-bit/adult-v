import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== DTI不正データのクリーンアップ ===\n');

  // 1. 不正なタイトルパターンを確認
  // 不正パターン: サイト名だけのタイトル、またはサイトの説明文
  console.log('【1】不正なタイトルパターン:');
  const invalid = await db.execute(sql`
    SELECT title, COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
      AND (
        title LIKE '%| 美を追求する高画質アダルト動画サイト'
        OR title LIKE '%高画質無修正動画サイト%'
        OR title = 'カリビアンコム'
        OR title = '一本道'
        OR title = 'HEYZO'
        OR LENGTH(title) < 5
      )
    GROUP BY title
    ORDER BY count DESC
    LIMIT 20
  `);
  console.table(invalid.rows);

  // 2. サイト別のDTI商品数
  console.log('\n【2】DTI商品のサイト別内訳:');
  const byNormalized = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE '一本道-%' THEN '一本道'
        WHEN p.normalized_product_id LIKE 'カリビアンコム-%' THEN 'カリビアンコム'
        WHEN p.normalized_product_id LIKE 'カリビアンコムプレミアム-%' THEN 'カリビアンコムプレミアム'
        WHEN p.normalized_product_id LIKE 'HEYZO-%' THEN 'HEYZO'
        ELSE 'その他'
      END as site,
      COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    GROUP BY 1
    ORDER BY count DESC
  `);
  console.table(byNormalized.rows);

  // 3. 正常なデータのサンプル
  console.log('\n【3】正常なデータサンプル:');
  const validSamples = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, LEFT(p.title, 50) as title
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
      AND p.title NOT LIKE '%| 美を追求する%'
      AND p.title NOT LIKE '%| カリビアンコムプレミアム'
      AND p.title NOT LIKE '%| HEYZO%'
      AND p.title NOT LIKE '%無修正動画サイト%'
      AND LENGTH(p.title) > 10
    ORDER BY p.created_at DESC
    LIMIT 10
  `);
  console.table(validSamples.rows);

  // 4. 削除対象の確認
  console.log('\n【4】削除対象（不正なタイトル）:');
  const toDelete = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
      AND (
        p.title LIKE '%| 美を追求する高画質アダルト動画サイト'
        OR p.title LIKE '%高画質無修正動画サイト%'
        OR p.title = 'カリビアンコム'
        OR p.title = '一本道'
        OR p.title = 'HEYZO'
        OR LENGTH(p.title) < 5
      )
  `);
  console.log(`削除対象: ${toDelete.rows[0].count}件`);

  const shouldExecute = process.argv.includes('--execute');

  if (!shouldExecute) {
    console.log('\n⚠️  DRY RUN モード');
    console.log('削除を実行するには --execute オプションを付けてください');
    process.exit(0);
  }

  console.log('\n=== 削除実行 ===\n');

  // 不正なDTI商品を削除
  // まず関連データを削除
  const deletePerformers = await db.execute(sql`
    DELETE FROM product_performers
    WHERE product_id IN (
      SELECT p.id FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'DTI'
        AND (
          p.title LIKE '%| 美を追求する高画質アダルト動画サイト'
          OR p.title LIKE '%高画質無修正動画サイト%'
          OR p.title = 'カリビアンコム'
          OR p.title = '一本道'
          OR p.title = 'HEYZO'
          OR LENGTH(p.title) < 5
        )
    )
  `);
  console.log(`product_performers 削除: ${deletePerformers.rowCount}件`);

  const deleteTags = await db.execute(sql`
    DELETE FROM product_tags
    WHERE product_id IN (
      SELECT p.id FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'DTI'
        AND (
          p.title LIKE '%| 美を追求する高画質アダルト動画サイト'
          OR p.title LIKE '%高画質無修正動画サイト%'
          OR p.title = 'カリビアンコム'
          OR p.title = '一本道'
          OR p.title = 'HEYZO'
          OR LENGTH(p.title) < 5
        )
    )
  `);
  console.log(`product_tags 削除: ${deleteTags.rowCount}件`);

  const deleteImages = await db.execute(sql`
    DELETE FROM product_images
    WHERE product_id IN (
      SELECT p.id FROM products p
      INNER JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'DTI'
        AND (
          p.title LIKE '%| 美を追求する高画質アダルト動画サイト'
          OR p.title LIKE '%高画質無修正動画サイト%'
          OR p.title = 'カリビアンコム'
          OR p.title = '一本道'
          OR p.title = 'HEYZO'
          OR LENGTH(p.title) < 5
        )
    )
  `);
  console.log(`product_images 削除: ${deleteImages.rowCount}件`);

  const deleteSources = await db.execute(sql`
    DELETE FROM product_sources
    WHERE product_id IN (
      SELECT p.id FROM products p
      INNER JOIN product_sources ps2 ON p.id = ps2.product_id
      WHERE ps2.asp_name = 'DTI'
        AND (
          p.title LIKE '%| 美を追求する高画質アダルト動画サイト'
          OR p.title LIKE '%高画質無修正動画サイト%'
          OR p.title = 'カリビアンコム'
          OR p.title = '一本道'
          OR p.title = 'HEYZO'
          OR LENGTH(p.title) < 5
        )
    )
  `);
  console.log(`product_sources 削除: ${deleteSources.rowCount}件`);

  // productsのソースがなくなったものを削除
  const deleteProducts = await db.execute(sql`
    DELETE FROM products
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps WHERE ps.product_id = products.id
    )
  `);
  console.log(`products 削除: ${deleteProducts.rowCount}件`);

  // 最終統計
  console.log('\n=== 最終統計 ===');
  const finalStats = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(finalStats.rows);

  console.log('\n✅ クリーンアップ完了');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
