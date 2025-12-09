/**
 * 演者名のスペース修正バックフィルスクリプト
 *
 * SOKMIL等から取得した演者名で、文字間にスペースが入っている名前を修正
 * 例: "波 多 野 結 衣" → "波多野結衣"
 *
 * 使い方:
 * npx tsx scripts/backfill/fix-performer-spaces.ts [--dry-run] [--limit=1000]
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10000');

/**
 * 日本語名からスペースを削除
 */
function normalizeJapaneseName(name: string): string {
  // 全角スペースを半角に
  let normalized = name.replace(/　/g, ' ');

  // 日本語文字（ひらがな、カタカナ、漢字）のみで構成されている場合、スペースを削除
  if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\s]+$/.test(normalized)) {
    normalized = normalized.replace(/\s+/g, '');
  }

  return normalized.trim();
}

/**
 * スペースが入っている日本語名を検出する正規表現パターン
 * 例: "波 多 野 結 衣" - 各文字の間にスペース
 */
function hasJapaneseSpaces(name: string): boolean {
  // 日本語文字の間にスペースがあるパターン
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]\s+[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(name);
}

async function main() {
  console.log('='.repeat(60));
  console.log('演者名スペース修正バックフィル');
  console.log('='.repeat(60));
  console.log(`モード: ${DRY_RUN ? 'DRY RUN (変更しない)' : '実行'}`);
  console.log(`処理上限: ${LIMIT}件`);
  console.log('');

  // スペースを含む日本語名のパフォーマーを検索
  // PostgreSQLの正規表現: 日本語文字 + 空白 + 日本語文字
  const result = await db.execute(sql`
    SELECT id, name
    FROM performers
    WHERE name ~ '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]\s+[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]'
    ORDER BY id
    LIMIT ${LIMIT}
  `);

  const performers = result.rows as Array<{ id: number; name: string }>;
  console.log(`検出された対象演者: ${performers.length}件\n`);

  if (performers.length === 0) {
    console.log('✅ スペースを含む日本語名の演者は見つかりませんでした');
    return;
  }

  // サンプル表示
  console.log('サンプル（最初の20件）:');
  console.log('-'.repeat(60));
  for (const performer of performers.slice(0, 20)) {
    const normalized = normalizeJapaneseName(performer.name);
    console.log(`  [${performer.id}] "${performer.name}" → "${normalized}"`);
  }
  console.log('-'.repeat(60));
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUNモードのため、変更は実行されません');
    console.log('実際に修正するには --dry-run オプションを外して実行してください');
    return;
  }

  console.log('🔄 演者名の修正を開始します...\n');

  let updated = 0;
  let merged = 0;
  let errors = 0;

  for (const performer of performers) {
    try {
      const normalizedName = normalizeJapaneseName(performer.name);

      if (normalizedName === performer.name) {
        continue; // 変更なし
      }

      // 同じ名前の演者が既に存在するかチェック
      const existingResult = await db.execute(sql`
        SELECT id FROM performers WHERE name = ${normalizedName} LIMIT 1
      `);

      if (existingResult.rows.length > 0) {
        // 既存の演者が存在する場合、product_performersを移行してから削除
        const existingId = (existingResult.rows[0] as { id: number }).id;

        // product_performersを既存の演者に移行
        await db.execute(sql`
          UPDATE product_performers
          SET performer_id = ${existingId}
          WHERE performer_id = ${performer.id}
            AND NOT EXISTS (
              SELECT 1 FROM product_performers pp2
              WHERE pp2.product_id = product_performers.product_id
                AND pp2.performer_id = ${existingId}
            )
        `);

        // 重複するリンクを削除
        await db.execute(sql`
          DELETE FROM product_performers
          WHERE performer_id = ${performer.id}
        `);

        // スペース入りの演者を削除
        await db.execute(sql`
          DELETE FROM performers WHERE id = ${performer.id}
        `);

        merged++;
        console.log(`  🔀 マージ: "${performer.name}" → 既存の "${normalizedName}" (ID: ${existingId})`);
      } else {
        // 名前を更新
        await db.execute(sql`
          UPDATE performers SET name = ${normalizedName} WHERE id = ${performer.id}
        `);
        updated++;
        console.log(`  ✅ 更新: "${performer.name}" → "${normalizedName}"`);
      }

    } catch (error) {
      errors++;
      console.error(`  ❌ エラー [${performer.id}]: ${error}`);
    }

    // 進捗表示
    if ((updated + merged + errors) % 100 === 0) {
      console.log(`\n  進捗: ${updated + merged + errors}/${performers.length} (更新: ${updated}, マージ: ${merged}, エラー: ${errors})\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('完了');
  console.log('='.repeat(60));
  console.log(`  更新: ${updated}件`);
  console.log(`  マージ: ${merged}件`);
  console.log(`  エラー: ${errors}件`);
}

main().catch(console.error).finally(() => process.exit(0));
