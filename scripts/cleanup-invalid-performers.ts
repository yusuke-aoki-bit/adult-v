import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  parsePerformerNames,
} from '../lib/performer-validation';

const db = getDb();

interface PerformerRow {
  id: number;
  name: string;
  image_url: string | null;
  product_count?: number;
}

async function cleanupInvalidPerformers() {
  console.log('=== 無効な演者データのクリーンアップ ===\n');

  const shouldExecute = process.argv.includes('--execute');
  const forceDelete = process.argv.includes('--force');
  const splitOnly = process.argv.includes('--split-only');

  // 1. 無効なデータを確認（performer-validation.tsのルールを使用）
  console.log('【1】無効な演者データを確認中...');
  const allPerformers = await db.execute(sql`
    SELECT p.id, p.name, p.image_url, COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    GROUP BY p.id, p.name, p.image_url
    ORDER BY p.id
  `);

  const performers = allPerformers.rows as unknown as PerformerRow[];
  const invalidPerformers: PerformerRow[] = [];
  const multiNamePerformers: { performer: PerformerRow; splitNames: string[] }[] = [];

  // isValidPerformerName()でバリデーション
  for (const performer of performers) {
    if (!isValidPerformerName(performer.name)) {
      invalidPerformers.push(performer);
      continue;
    }

    // スペース区切りの複数名前チェック
    const splitNames = parsePerformerNames(performer.name, /[、,\/・\n\t\s　]+/);
    if (splitNames.length > 1) {
      multiNamePerformers.push({ performer, splitNames });
    }
  }

  console.log(`見つかった無効データ: ${invalidPerformers.length}件`);
  console.table(invalidPerformers.slice(0, 20));

  // 2. 商品との紐づけを確認
  console.log('\n【2】商品との紐づけを確認中...');
  const withProducts = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE
      LENGTH(p.name) <= 2
      OR p.name LIKE '%→%'
      OR p.name IN ('デ', 'ラ', 'ゆ', 'な', '他')
    GROUP BY p.id, p.name
    HAVING COUNT(pp.product_id) > 0
    ORDER BY COUNT(pp.product_id) DESC
    LIMIT 20
  `);

  console.log('商品と紐づいている無効データ:');
  console.table(withProducts.rows);

  // 3. DRY RUN: 削除対象を表示
  console.log('\n【3】削除対象の演者データ:');
  const toDelete = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE
      (LENGTH(p.name) <= 2 OR p.name LIKE '%→%' OR p.name IN ('デ', 'ラ', 'ゆ', 'な', '他'))
      AND NOT EXISTS (
        SELECT 1 FROM product_performers pp2 WHERE pp2.performer_id = p.id
      )
    GROUP BY p.id, p.name
    ORDER BY p.name
  `);

  console.log(`削除予定: ${toDelete.rows.length}件 (商品と紐づいていないもののみ)`);
  console.table(toDelete.rows.slice(0, 30));

  // 4. 実際に削除（--executeオプションがある場合のみ）
  if (shouldExecute) {
    console.log('\n【4】削除を実行中...');

    if (forceDelete) {
      // --force: 商品との紐づけも含めて強制削除
      console.log('⚠️  --force モード: 商品との紐づけも含めて強制削除します');

      // まず performer_aliases から削除
      const deleteAliases = await db.execute(sql`
        DELETE FROM performer_aliases
        WHERE performer_id IN (
          SELECT id FROM performers
          WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
        )
      `);
      console.log(`performer_aliases から削除: ${deleteAliases.rowCount}件`);

      // product_performers から削除
      const deleteLinks = await db.execute(sql`
        DELETE FROM product_performers
        WHERE performer_id IN (
          SELECT id FROM performers
          WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
        )
      `);
      console.log(`product_performers から削除: ${deleteLinks.rowCount}件`);

      // 演者自体を削除
      const deletePerformers = await db.execute(sql`
        DELETE FROM performers
        WHERE LENGTH(name) <= 1 OR name LIKE '%→%' OR name IN ('デ', 'ラ', 'ゆ', 'な', '他')
      `);
      console.log(`performers から削除: ${deletePerformers.rowCount}件`);
    } else {
      // 通常モード: 商品と紐づいていないもののみ削除
      const deleteLinks = await db.execute(sql`
        DELETE FROM product_performers
        WHERE performer_id IN (
          SELECT p.id FROM performers p
          WHERE
            (LENGTH(p.name) <= 2 OR p.name LIKE '%→%' OR p.name IN ('デ', 'ラ', 'ゆ', 'な', '他'))
            AND NOT EXISTS (
              SELECT 1 FROM product_performers pp WHERE pp.performer_id = p.id LIMIT 1
            )
        )
      `);
      console.log(`product_performers から削除: ${deleteLinks.rowCount}件`);

      const deletePerformers = await db.execute(sql`
        DELETE FROM performers
        WHERE id IN (
          SELECT p.id
          FROM performers p
          WHERE
            (LENGTH(p.name) <= 2 OR p.name LIKE '%→%' OR p.name IN ('デ', 'ラ', 'ゆ', 'な', '他'))
            AND NOT EXISTS (
              SELECT 1 FROM product_performers pp WHERE pp.performer_id = p.id
            )
        )
      `);
      console.log(`performers から削除: ${deletePerformers.rowCount}件`);
    }

    console.log('\n✅ クリーンアップ完了');
  } else {
    console.log('\n⚠️  DRY RUN モード。実際に削除するには --execute オプションを付けて実行してください');
    console.log('   コマンド: DATABASE_URL="..." npx tsx scripts/cleanup-invalid-performers.ts --execute');
    console.log('   強制削除: DATABASE_URL="..." npx tsx scripts/cleanup-invalid-performers.ts --execute --force');
  }

  // 5. 統計を表示
  console.log('\n【5】クリーンアップ後の統計:');
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total_performers,
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_image,
      COUNT(CASE WHEN LENGTH(name) <= 2 THEN 1 END) as short_names_remaining
    FROM performers
  `);
  console.table(stats.rows);

  process.exit(0);
}

cleanupInvalidPerformers().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
