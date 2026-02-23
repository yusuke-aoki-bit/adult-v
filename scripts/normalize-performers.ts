/**
 * カンマ区切りの女優名を正規化するスクリプト
 * "名前1,名前2,名前3" → 個別の女優レコードに分割
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log('=== 女優名正規化スクリプト ===\n');

  // 1. カンマを含む女優レコードを取得
  const commaPerformers = await db.execute(sql`
    SELECT id, name FROM performers WHERE name LIKE '%,%' ORDER BY id
  `);

  console.log(`処理対象: ${commaPerformers.rows.length}件\n`);

  let processed = 0;
  let created = 0;
  let skipped = 0;

  for (const row of commaPerformers.rows) {
    const oldPerformerId = row.id as number;
    const combinedName = row.name as string;

    // カンマで分割
    const names = combinedName
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length <= 1) {
      skipped++;
      continue;
    }

    console.log(`\n[${++processed}] ID:${oldPerformerId} "${combinedName}"`);
    console.log(`  → ${names.length}人に分割: ${names.join(', ')}`);

    // この女優に関連する商品を取得
    const relatedProducts = await db.execute(sql`
      SELECT product_id FROM product_performers WHERE performer_id = ${oldPerformerId}
    `);

    const productIds = relatedProducts.rows.map((r) => r.product_id as number);
    console.log(`  → 関連商品: ${productIds.length}件`);

    // 各名前に対して処理
    const newPerformerIds: number[] = [];
    for (const name of names) {
      // 既存の女優を検索
      const existing = await db.execute(sql`
        SELECT id FROM performers WHERE name = ${name} LIMIT 1
      `);

      let performerId: number;
      if (existing.rows.length > 0) {
        performerId = existing.rows[0].id as number;
        console.log(`  → "${name}" 既存ID:${performerId}`);
      } else {
        // 新規作成
        const inserted = await db.execute(sql`
          INSERT INTO performers (name, created_at, updated_at)
          VALUES (${name}, NOW(), NOW())
          RETURNING id
        `);
        performerId = inserted.rows[0].id as number;
        created++;
        console.log(`  → "${name}" 新規作成ID:${performerId}`);
      }
      newPerformerIds.push(performerId);
    }

    // 各商品に対して新しい関連を追加
    for (const productId of productIds) {
      for (const newPerformerId of newPerformerIds) {
        // 既存の関連がなければ追加
        await db.execute(sql`
          INSERT INTO product_performers (product_id, performer_id)
          VALUES (${productId}, ${newPerformerId})
          ON CONFLICT (product_id, performer_id) DO NOTHING
        `);
      }
    }

    // 古い関連を削除
    await db.execute(sql`
      DELETE FROM product_performers WHERE performer_id = ${oldPerformerId}
    `);

    // 古い女優レコードを削除
    await db.execute(sql`
      DELETE FROM performers WHERE id = ${oldPerformerId}
    `);

    console.log(`  → 完了`);

    // 100件ごとに進捗表示
    if (processed % 100 === 0) {
      console.log(`\n--- 進捗: ${processed}/${commaPerformers.rows.length} ---\n`);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理: ${processed}件`);
  console.log(`新規作成: ${created}件`);
  console.log(`スキップ: ${skipped}件`);

  await pool.end();
}

main().catch(console.error);
