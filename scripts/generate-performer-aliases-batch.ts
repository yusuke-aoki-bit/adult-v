import { getDb } from '../lib/db';
import { performers, performerAliases } from '../lib/db/schema';
import { sql, inArray, and, eq } from 'drizzle-orm';

/**
 * 既存の女優名から別名を自動生成するスクリプト（バッチ処理版）
 *
 * 生成ルール:
 * 1. ひらがな/カタカナ変換のみ（スペース変換は無効化）
 */

interface AliasCandidate {
  performerId: number;
  performerName: string;
  aliasName: string;
}

/**
 * ひらがな→カタカナ
 */
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * カタカナ→ひらがな
 */
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * 別名候補を生成（シンプル版：ひらがな/カタカナ変換のみ）
 */
function generateAliasCandidates(performer: { id: number; name: string }): AliasCandidate[] {
  const candidates: AliasCandidate[] = [];
  const { id, name } = performer;

  // ひらがな → カタカナ
  const katakana = hiraganaToKatakana(name);
  if (katakana !== name) {
    candidates.push({
      performerId: id,
      performerName: name,
      aliasName: katakana,
    });
  }

  // カタカナ → ひらがな
  const hiragana = katakanaToHiragana(name);
  if (hiragana !== name) {
    candidates.push({
      performerId: id,
      performerName: name,
      aliasName: hiragana,
    });
  }

  return candidates;
}

async function main() {
  const db = getDb();

  console.log('=== 別名自動生成スクリプト（バッチ版） ===\n');

  // 既存の別名を全削除（auto_generated のみ）
  await db.execute(sql`
    DELETE FROM performer_aliases
    WHERE source = 'auto_generated'
  `);
  console.log('既存の自動生成別名を削除しました\n');

  // 全女優を取得
  const allPerformers = await db
    .select({
      id: performers.id,
      name: performers.name,
    })
    .from(performers);
  console.log(`対象女優数: ${allPerformers.length}\n`);

  // 全ての別名候補を生成
  const allCandidates: AliasCandidate[] = [];
  for (const performer of allPerformers) {
    const candidates = generateAliasCandidates(performer);
    allCandidates.push(...candidates);
  }
  console.log(`生成した候補数: ${allCandidates.length}\n`);

  // 既存の女優名を取得（重複チェック用）
  const existingNames = new Set(allPerformers.map((p) => p.name));

  // 重複しない候補のみをフィルタ
  const validCandidates = allCandidates.filter((c) => !existingNames.has(c.aliasName));
  console.log(`有効な候補数（既存名と重複しない）: ${validCandidates.length}\n`);

  // バッチ挿入（1000件ずつ）
  const BATCH_SIZE = 1000;
  let insertedCount = 0;

  for (let i = 0; i < validCandidates.length; i += BATCH_SIZE) {
    const batch = validCandidates.slice(i, i + BATCH_SIZE);

    // VALUES句を構築
    const values = batch.map((c) => sql`(${c.performerId}, ${c.aliasName}, 'auto_generated', false)`);

    if (values.length === 0) continue;

    try {
      await db.execute(sql`
        INSERT INTO performer_aliases (performer_id, alias_name, source, is_primary)
        VALUES ${sql.join(values, sql`, `)}
        ON CONFLICT (performer_id, alias_name) DO NOTHING
      `);
      insertedCount += batch.length;
      console.log(`進捗: ${insertedCount}/${validCandidates.length} 挿入`);
    } catch (error) {
      console.error('バッチ挿入エラー:', error);
    }
  }

  // 最終統計
  const finalStats = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count
    FROM performer_aliases
    GROUP BY source
    ORDER BY count DESC
  `);

  console.log('\n=== 結果 ===');
  console.log('別名データソース別統計:');
  console.table(finalStats.rows);

  // サンプル表示
  const sample = await db.execute(sql`
    SELECT p.name, pa.alias_name
    FROM performers p
    INNER JOIN performer_aliases pa ON p.id = pa.performer_id
    WHERE pa.is_primary = false
    LIMIT 10
  `);
  console.log('\nサンプル:');
  console.table(sample.rows);

  process.exit(0);
}

main().catch(console.error);
