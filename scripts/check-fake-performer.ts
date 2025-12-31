/**
 * 仮名演者の商品を確認するスクリプト
 */

import * as fs from 'fs';
import * as path from 'path';
import { sql } from 'drizzle-orm';

// 環境変数を読み込み
function loadEnv() {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  if (!fs.existsSync(envLocalPath)) {
    console.error('.env.local が見つかりません');
    return;
  }
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

import { db, closeDb } from '../packages/database/src/client';

async function main() {
  const performerId = parseInt(process.argv[2] || '195479', 10);

  console.log(`=== 演者 ID: ${performerId} の情報 ===\n`);

  // 演者情報を取得
  const performer = await db.execute(sql`
    SELECT id, name FROM performers WHERE id = ${performerId}
  `);

  if (performer.rows.length === 0) {
    console.log('演者が見つかりません');
    await closeDb();
    return;
  }

  const performerName = (performer.rows[0] as { name: string }).name;
  console.log(`演者名: ${performerName}\n`);

  // リンクされている商品を取得
  const products = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.performer_id = ${performerId}
    LIMIT 5
  `);

  console.log('リンクされている商品:');
  for (const row of products.rows as { id: number; normalized_product_id: string; title: string }[]) {
    console.log(`  ID: ${row.id}`);
    console.log(`  品番: ${row.normalized_product_id}`);
    console.log(`  タイトル: ${row.title.substring(0, 60)}...`);
    console.log('');
  }

  await closeDb();
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
