import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function dataCleansing() {
  console.log('=== データクレンジング ===\n');

  const shouldExecute = process.argv.includes('--execute');

  // 1. 現在の統計
  console.log('【1】現在の統計:');
  const stats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM product_sources) as sources,
      (SELECT COUNT(*) FROM performers) as performers,
      (SELECT COUNT(*) FROM product_performers) as product_performers,
      (SELECT COUNT(*) FROM product_images) as images,
      (SELECT COUNT(*) FROM tags) as tags,
      (SELECT COUNT(*) FROM product_tags) as product_tags
  `);
  console.table(stats.rows);

  // 2. 重複normalized_product_idを確認
  console.log('\n【2】重複normalized_product_idを確認:');
  const duplicates = await db.execute(sql`
    SELECT normalized_product_id, COUNT(*) as count
    FROM products
    GROUP BY normalized_product_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `);
  console.log(`重複: ${duplicates.rows.length}件`);
  if (duplicates.rows.length > 0) {
    console.table(duplicates.rows.slice(0, 10));
  }

  // 3. サムネイルがない商品
  console.log('\n【3】サムネイルがない商品:');
  const noThumbnail = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products
    WHERE default_thumbnail_url IS NULL OR default_thumbnail_url = ''
  `);
  console.log(`サムネイルなし: ${noThumbnail.rows[0].count}件`);

  // 4. 演者がいない商品
  console.log('\n【4】演者がいない商品:');
  const noPerformer = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id
    )
  `);
  console.log(`演者なし: ${noPerformer.rows[0].count}件`);

  // 5. 商品に紐づいていない演者（孤立演者）
  console.log('\n【5】孤立演者（商品に紐づいていない）:');
  const orphanPerformers = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.performer_id = p.id
    )
  `);
  console.log(`孤立演者: ${orphanPerformers.rows[0].count}件`);

  // 6. 商品に紐づいていないタグ
  console.log('\n【6】孤立タグ（商品に紐づいていない）:');
  const orphanTags = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM tags t
    WHERE NOT EXISTS (
      SELECT 1 FROM product_tags pt WHERE pt.tag_id = t.id
    )
  `);
  console.log(`孤立タグ: ${orphanTags.rows[0].count}件`);

  // 7. product_sourcesがない商品
  console.log('\n【7】product_sourcesがない商品:');
  const noSource = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id
    )
  `);
  console.log(`ソースなし商品: ${noSource.rows[0].count}件`);

  // 8. 無効な演者名（まだ残っているか確認）
  console.log('\n【8】無効な演者名:');
  const invalidPerformers = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers
    WHERE LENGTH(name) <= 1
       OR name LIKE '%→%'
       OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
  `);
  console.log(`無効な演者: ${invalidPerformers.rows[0].count}件`);

  if (!shouldExecute) {
    console.log('\n⚠️  DRY RUN モード');
    console.log('クレンジングを実行するには --execute オプションを付けてください');
    process.exit(0);
  }

  console.log('\n=== クレンジング実行 ===\n');

  // A. 重複商品の削除（古いIDを保持）
  if (duplicates.rows.length > 0) {
    console.log('【A】重複商品の削除...');
    const deleteDuplicates = await db.execute(sql`
      DELETE FROM products
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM products
        GROUP BY normalized_product_id
      )
    `);
    console.log(`削除した重複商品: ${deleteDuplicates.rowCount}件`);
  }

  // B. 孤立演者の削除
  if (Number(orphanPerformers.rows[0].count) > 0) {
    console.log('\n【B】孤立演者の削除...');

    // まずperformer_aliasesから削除
    const deleteAliases = await db.execute(sql`
      DELETE FROM performer_aliases
      WHERE performer_id IN (
        SELECT p.id FROM performers p
        WHERE NOT EXISTS (
          SELECT 1 FROM product_performers pp WHERE pp.performer_id = p.id
        )
      )
    `);
    console.log(`削除したエイリアス: ${deleteAliases.rowCount}件`);

    // 演者自体を削除
    const deleteOrphanPerformers = await db.execute(sql`
      DELETE FROM performers
      WHERE NOT EXISTS (
        SELECT 1 FROM product_performers pp WHERE pp.performer_id = performers.id
      )
    `);
    console.log(`削除した孤立演者: ${deleteOrphanPerformers.rowCount}件`);
  }

  // C. 孤立タグの削除
  if (Number(orphanTags.rows[0].count) > 0) {
    console.log('\n【C】孤立タグの削除...');
    const deleteOrphanTags = await db.execute(sql`
      DELETE FROM tags
      WHERE NOT EXISTS (
        SELECT 1 FROM product_tags pt WHERE pt.tag_id = tags.id
      )
    `);
    console.log(`削除した孤立タグ: ${deleteOrphanTags.rowCount}件`);
  }

  // D. ソースなし商品の削除
  if (Number(noSource.rows[0].count) > 0) {
    console.log('\n【D】ソースなし商品の削除...');

    // まず関連データを削除
    await db.execute(sql`
      DELETE FROM product_performers
      WHERE product_id IN (
        SELECT p.id FROM products p
        WHERE NOT EXISTS (
          SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id
        )
      )
    `);

    await db.execute(sql`
      DELETE FROM product_tags
      WHERE product_id IN (
        SELECT p.id FROM products p
        WHERE NOT EXISTS (
          SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id
        )
      )
    `);

    await db.execute(sql`
      DELETE FROM product_images
      WHERE product_id IN (
        SELECT p.id FROM products p
        WHERE NOT EXISTS (
          SELECT 1 FROM product_sources ps WHERE ps.product_id = p.id
        )
      )
    `);

    const deleteNoSource = await db.execute(sql`
      DELETE FROM products
      WHERE NOT EXISTS (
        SELECT 1 FROM product_sources ps WHERE ps.product_id = products.id
      )
    `);
    console.log(`削除したソースなし商品: ${deleteNoSource.rowCount}件`);
  }

  // E. 無効な演者の削除
  if (Number(invalidPerformers.rows[0].count) > 0) {
    console.log('\n【E】無効な演者の削除...');

    await db.execute(sql`
      DELETE FROM performer_aliases
      WHERE performer_id IN (
        SELECT id FROM performers
        WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
      )
    `);

    await db.execute(sql`
      DELETE FROM product_performers
      WHERE performer_id IN (
        SELECT id FROM performers
        WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
      )
    `);

    const deleteInvalid = await db.execute(sql`
      DELETE FROM performers
      WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
    `);
    console.log(`削除した無効な演者: ${deleteInvalid.rowCount}件`);
  }

  // 最終統計
  console.log('\n=== クレンジング後の統計 ===');
  const finalStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM product_sources) as sources,
      (SELECT COUNT(*) FROM performers) as performers,
      (SELECT COUNT(*) FROM product_performers) as product_performers,
      (SELECT COUNT(*) FROM product_images) as images,
      (SELECT COUNT(*) FROM tags) as tags,
      (SELECT COUNT(*) FROM product_tags) as product_tags
  `);
  console.table(finalStats.rows);

  console.log('\n✅ クレンジング完了');
  process.exit(0);
}

dataCleansing().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
