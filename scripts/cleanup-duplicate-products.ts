/**
 * 重複商品のクリーンアップスクリプト
 *
 * 同じoriginal_product_idを持つ商品が複数ある場合、不正なデータを削除する
 * - タイトルが品番のままになっている
 * - normalized_product_idにduga-プレフィックスが付いている（本来不要）
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const DRY_RUN = !process.argv.includes('--execute');

async function main() {
  const db = getDb();

  console.log(`=== 重複商品のクリーンアップ (${DRY_RUN ? 'DRY RUN' : '実行モード'}) ===`);

  // 同じoriginal_product_idを持つ重複を検索
  // 条件: normalized_product_idが duga- で始まり、タイトルが品番と一致する
  const duplicates = await db.execute<{ id: number }>(sql`
    SELECT
      p.id,
      p.title,
      p.normalized_product_id,
      ps.original_product_id,
      ps.asp_name
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.original_product_id IN (
      SELECT ps2.original_product_id
      FROM product_sources ps2
      GROUP BY ps2.original_product_id
      HAVING COUNT(DISTINCT ps2.product_id) > 1
    )
    AND (
      -- normalized_product_idにduga-プレフィックスが付いている
      p.normalized_product_id LIKE 'duga-%'
      -- またはタイトルが品番のまま
      OR p.title = ps.original_product_id
      OR p.title = p.normalized_product_id
    )
    ORDER BY ps.original_product_id, p.id
  `);

  console.log(`\n重複候補: ${duplicates.rows.length}件`);

  if (duplicates.rows.length === 0) {
    console.log('削除対象の重複商品はありません。');
    process.exit(0);
  }

  // サンプルを表示
  console.log('\nサンプル（最初の10件）:');
  for (const row of duplicates.rows.slice(0, 10)) {
    console.log(`  ID: ${row.id}`);
  }

  if (DRY_RUN) {
    console.log('\n--execute オプションを付けて実行すると、上記の商品を削除します。');
    process.exit(0);
  }

  // 全てのIDを収集
  const productIds = duplicates.rows.map(row => row.id);
  console.log(`\n${productIds.length}件の商品を一括削除します...`);

  // バッチ削除（1000件ずつ）
  const BATCH_SIZE = 1000;
  let deleted = 0;

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batchIds = productIds.slice(i, i + BATCH_SIZE);
    const idList = sql.join(batchIds.map(id => sql`${id}`), sql`, `);

    // 関連テーブルから一括削除
    await db.execute(sql`DELETE FROM product_performers WHERE product_id IN (${idList})`);
    await db.execute(sql`DELETE FROM product_images WHERE product_id IN (${idList})`);
    await db.execute(sql`DELETE FROM product_videos WHERE product_id IN (${idList})`);
    await db.execute(sql`DELETE FROM product_tags WHERE product_id IN (${idList})`);
    await db.execute(sql`DELETE FROM product_sources WHERE product_id IN (${idList})`);
    await db.execute(sql`DELETE FROM products WHERE id IN (${idList})`);

    deleted += batchIds.length;
    console.log(`  削除完了: ${deleted}/${productIds.length}件`);
  }

  console.log(`\n${productIds.length}件の重複商品を削除しました。`);
  process.exit(0);
}

main().catch(console.error);
