/**
 * 仮名演者（ナンパ系）を探すスクリプト
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
  console.log('=== 仮名演者（○○ N歳 職業パターン）を検索 ===\n');

  // ナンパ系の仮名演者を探す
  const result = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    LEFT JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.name ~ '.+ [0-9]+歳'
    GROUP BY p.id, p.name
    HAVING COUNT(pp.product_id) > 0
    ORDER BY COUNT(pp.product_id) DESC
    LIMIT 30
  `);

  for (const row of result.rows as { id: number; name: string; product_count: string }[]) {
    console.log(`ID: ${row.id}, 名前: ${row.name}, 商品数: ${row.product_count}`);
  }

  console.log(`\n合計: ${result.rows.length}件の仮名演者が見つかりました`);

  await closeDb();
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
