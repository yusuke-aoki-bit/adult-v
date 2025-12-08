/**
 * FC2 無効レコード一括削除スクリプト
 * 「お探しの商品が見つかりませんでした」タイトルのレコードをバッチで削除
 *
 * サブクエリを使用して効率的に削除
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 10000;
const MAX_ITERATIONS = 50;

async function main() {
  console.log('=== FC2 無効レコード一括削除 ===');
  console.log('対象: title = "お探しの商品が見つかりませんでした"');
  console.log(`バッチサイズ: ${BATCH_SIZE}`);
  console.log('');

  // 初期カウント
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE title = 'お探しの商品が見つかりませんでした'
  `);
  console.log(`対象レコード総数: ${countResult.rows[0].count}件`);
  console.log('');

  let totalDeleted = 0;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    const startTime = Date.now();

    // 関連テーブルから先に削除（サブクエリ使用）
    await db.execute(sql`
      DELETE FROM product_images WHERE product_id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);
    await db.execute(sql`
      DELETE FROM product_videos WHERE product_id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);
    await db.execute(sql`
      DELETE FROM product_performers WHERE product_id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);
    await db.execute(sql`
      DELETE FROM product_tags WHERE product_id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);
    await db.execute(sql`
      DELETE FROM product_sources WHERE product_id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);

    // 商品テーブルから削除（LIMITで件数制限）
    const result = await db.execute(sql`
      DELETE FROM products WHERE id IN (
        SELECT id FROM products WHERE title = 'お探しの商品が見つかりませんでした' LIMIT ${BATCH_SIZE}
      )
    `);

    const deleted = (result as any).rowCount || 0;

    if (deleted === 0) {
      console.log('削除完了 - 対象レコードなし');
      break;
    }

    totalDeleted += deleted;
    const elapsed = Date.now() - startTime;
    console.log(`バッチ ${iteration}: ${deleted}件削除 (${elapsed}ms) - 累計: ${totalDeleted}件`);

    // 少し待機（DBへの負荷軽減）
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('');
  console.log('=== 完了 ===');
  console.log(`削除件数: ${totalDeleted}件`);
}

main().catch(console.error).finally(() => process.exit(0));
