/**
 * 仮名演者パターンのテスト
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
  // まず「歳」を含む演者を確認
  const ageResult = await db.execute(sql`
    SELECT pf.id, pf.name
    FROM performers pf
    WHERE pf.name LIKE '%歳%'
    LIMIT 30
  `);

  console.log('「歳」を含む演者:');
  for (const row of ageResult.rows as Array<{ id: number; name: string }>) {
    console.log(`  ${row.name} (ID: ${row.id})`);
  }
  console.log(`合計: ${ageResult.rows.length}件\n`);

  // 仮名演者パターンにマッチする演者を確認
  // PostgreSQLの正規表現は ~ 演算子を使用
  // \s は空白, \d は数字
  const result = await db.execute(sql`
    SELECT DISTINCT pf.id, pf.name, COUNT(pp.product_id) as product_count
    FROM performers pf
    JOIN product_performers pp ON pf.id = pp.performer_id
    JOIN products p ON pp.product_id = p.id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'MGS'
    AND pf.name LIKE '%歳%'
    GROUP BY pf.id, pf.name
    ORDER BY product_count DESC
    LIMIT 20
  `);

  console.log('仮名演者パターンにマッチ (上位20件):');
  for (const row of result.rows as Array<{ id: number; name: string; product_count: string }>) {
    console.log(`  ${row.name} (ID: ${row.id}, products: ${row.product_count})`);
  }
  console.log(`\n合計: ${result.rows.length}件`);

  await closeDb();
}

main().catch(console.error);
