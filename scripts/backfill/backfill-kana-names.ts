/**
 * カタカナ/ひらがな名をnameKanaに自動変換するバックフィルスクリプト
 *
 * このスクリプトはAPIを使わずに以下を実行:
 * 1. カタカナ名 → ひらがなに変換してnameKanaに設定
 * 2. ひらがな名 → そのままnameKanaに設定
 *
 * 使用方法:
 *   npx tsx scripts/backfill/backfill-kana-names.ts
 *   npx tsx scripts/backfill/backfill-kana-names.ts --dry-run
 *   npx tsx scripts/backfill/backfill-kana-names.ts --limit=1000
 */

import { getDb } from '../../lib/db';
import { performers } from '../../lib/db/schema';
import { sql, eq, isNull, or } from 'drizzle-orm';

const db = getDb();

/**
 * カタカナをひらがなに変換
 */
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

/**
 * 名前がカタカナのみかチェック
 */
function isKatakanaOnly(name: string): boolean {
  return /^[ァ-ヺー\s]+$/.test(name);
}

/**
 * 名前がひらがなのみかチェック
 */
function isHiraganaOnly(name: string): boolean {
  return /^[ぁ-ゖー\s]+$/.test(name);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0');

  console.log('=== カタカナ/ひらがな名の自動変換 ===\n');
  console.log(`設定: dryRun=${dryRun}, limit=${limit || '無制限'}\n`);

  // nameKanaが未設定の演者を取得
  const query = limit > 0
    ? sql`
        SELECT id, name, name_kana as "nameKana"
        FROM performers
        WHERE (name_kana IS NULL OR name_kana = '')
        LIMIT ${limit}
      `
    : sql`
        SELECT id, name, name_kana as "nameKana"
        FROM performers
        WHERE (name_kana IS NULL OR name_kana = '')
      `;

  const result = await db.execute(query);
  const targetPerformers = result.rows as { id: number; name: string; nameKana: string | null }[];

  console.log(`📋 対象演者: ${targetPerformers.length}人\n`);

  // 統計
  let katakanaConverted = 0;
  let hiraganaSet = 0;
  let skipped = 0;

  // バッチ更新用
  const katakanaUpdates: { id: number; nameKana: string }[] = [];
  const hiraganaUpdates: { id: number; nameKana: string }[] = [];

  for (const performer of targetPerformers) {
    const { id, name } = performer;

    if (!name) {
      skipped++;
      continue;
    }

    // カタカナのみの場合
    if (isKatakanaOnly(name)) {
      const hiragana = katakanaToHiragana(name.replace(/\s+/g, ''));
      katakanaUpdates.push({ id, nameKana: hiragana });
      katakanaConverted++;
      continue;
    }

    // ひらがなのみの場合
    if (isHiraganaOnly(name)) {
      hiraganaUpdates.push({ id, nameKana: name.replace(/\s+/g, '') });
      hiraganaSet++;
      continue;
    }

    // それ以外はスキップ
    skipped++;
  }

  console.log(`カタカナ→ひらがな変換: ${katakanaConverted}人`);
  console.log(`ひらがなそのまま設定: ${hiraganaSet}人`);
  console.log(`スキップ（漢字等）: ${skipped}人`);

  // 更新実行
  if (!dryRun) {
    console.log('\n📝 データベースを更新中...');

    // カタカナ変換を一括更新
    let updated = 0;
    for (const item of katakanaUpdates) {
      await db
        .update(performers)
        .set({ nameKana: item.nameKana })
        .where(eq(performers.id, item.id));
      updated++;
      if (updated % 1000 === 0) {
        console.log(`  進捗: ${updated}/${katakanaUpdates.length + hiraganaUpdates.length}件`);
      }
    }

    // ひらがな設定を一括更新
    for (const item of hiraganaUpdates) {
      await db
        .update(performers)
        .set({ nameKana: item.nameKana })
        .where(eq(performers.id, item.id));
      updated++;
      if (updated % 1000 === 0) {
        console.log(`  進捗: ${updated}/${katakanaUpdates.length + hiraganaUpdates.length}件`);
      }
    }

    console.log(`\n✅ ${updated}件のレコードを更新しました`);
  } else {
    console.log('\n⚠️ dry-runモードのため、実際の更新は行われていません');

    // サンプル表示
    if (katakanaUpdates.length > 0) {
      console.log('\n=== カタカナ変換サンプル (最大10件) ===');
      for (const item of katakanaUpdates.slice(0, 10)) {
        const original = targetPerformers.find(p => p.id === item.id);
        console.log(`  ${original?.name} → ${item.nameKana}`);
      }
    }

    if (hiraganaUpdates.length > 0) {
      console.log('\n=== ひらがな設定サンプル (最大10件) ===');
      for (const item of hiraganaUpdates.slice(0, 10)) {
        const original = targetPerformers.find(p => p.id === item.id);
        console.log(`  ${original?.name} → ${item.nameKana}`);
      }
    }
  }

  // 最終統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN name_kana IS NOT NULL AND name_kana != '' THEN 1 END) as with_kana,
      ROUND(100.0 * COUNT(CASE WHEN name_kana IS NOT NULL AND name_kana != '' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as rate
    FROM performers
  `);
  console.log('\n=== 全体統計 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
