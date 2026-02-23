import { getDb } from '../lib/db';
import { performers, performerAliases } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * 既存の女優名から別名を自動生成するスクリプト
 *
 * 生成ルール:
 * 1. 全角/半角変換
 * 2. スペースありなし
 * 3. ひらがな/カタカナ変換
 * 4. 漢字の読み仮名バリエーション
 */

interface AliasCandidate {
  performerId: number;
  performerName: string;
  aliasName: string;
  reason: string;
}

/**
 * 全角/半角変換
 */
function toHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });
}

function toFullWidth(str: string): string {
  return str.replace(/[A-Za-z0-9]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
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
 * スペースバリエーション生成
 */
function generateSpaceVariations(name: string): string[] {
  const variations: string[] = [];

  // スペースあり → スペースなし
  if (name.includes(' ')) {
    variations.push(name.replace(/\s+/g, ''));
  }

  // スペースなし → スペースあり (カタカナ/ひらがなの境界に追加)
  if (!name.includes(' ')) {
    const withSpace = name.replace(/([ぁ-ん]+)([ぁ-ん]+)/g, '$1 $2');
    if (withSpace !== name) {
      variations.push(withSpace);
    }
  }

  return variations;
}

/**
 * 文字種バリエーション生成
 */
function generateCharVariations(name: string): string[] {
  const variations: string[] = [];

  // 全角英数字 → 半角英数字
  const halfWidth = toHalfWidth(name);
  if (halfWidth !== name) {
    variations.push(halfWidth);
  }

  // 半角英数字 → 全角英数字
  const fullWidth = toFullWidth(name);
  if (fullWidth !== name) {
    variations.push(fullWidth);
  }

  // ひらがな → カタカナ
  const katakana = hiraganaToKatakana(name);
  if (katakana !== name) {
    variations.push(katakana);
  }

  // カタカナ → ひらがな
  const hiragana = katakanaToHiragana(name);
  if (hiragana !== name) {
    variations.push(hiragana);
  }

  return variations;
}

/**
 * 別名候補を生成
 */
function generateAliasCandidates(performer: any): AliasCandidate[] {
  const candidates: AliasCandidate[] = [];
  const { id, name } = performer;

  // 1. スペースバリエーション
  const spaceVariations = generateSpaceVariations(name);
  for (const alias of spaceVariations) {
    candidates.push({
      performerId: id,
      performerName: name,
      aliasName: alias,
      reason: 'space_variation',
    });
  }

  // 2. 文字種バリエーション
  const charVariations = generateCharVariations(name);
  for (const alias of charVariations) {
    candidates.push({
      performerId: id,
      performerName: name,
      aliasName: alias,
      reason: 'char_variation',
    });
  }

  // 3. 組み合わせ (スペース + 文字種)
  for (const spaceVar of spaceVariations) {
    const charVars = generateCharVariations(spaceVar);
    for (const alias of charVars) {
      candidates.push({
        performerId: id,
        performerName: name,
        aliasName: alias,
        reason: 'combined_variation',
      });
    }
  }

  return candidates;
}

async function main() {
  const db = getDb();

  console.log('=== 別名自動生成スクリプト ===\n');

  // 全女優を取得
  const allPerformers = await db.select().from(performers);
  console.log(`対象女優数: ${allPerformers.length}\n`);

  let generatedCount = 0;
  let skippedCount = 0;

  for (const [index, performer] of allPerformers.entries()) {
    if ((index + 1) % 1000 === 0) {
      console.log(`進捗: ${index + 1}/${allPerformers.length} 処理完了`);
    }

    // 別名候補を生成
    const candidates = generateAliasCandidates(performer);

    for (const candidate of candidates) {
      try {
        // 既存の別名をチェック
        const existing = await db.execute(sql`
          SELECT id FROM performer_aliases
          WHERE performer_id = ${candidate.performerId}
          AND alias_name = ${candidate.aliasName}
        `);

        if (existing.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // 同名の女優が既に存在する場合はスキップ
        const sameNamePerformer = await db.execute(sql`
          SELECT id FROM performers
          WHERE name = ${candidate.aliasName}
          AND id != ${candidate.performerId}
        `);

        if (sameNamePerformer.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // 別名を登録
        await db.execute(sql`
          INSERT INTO performer_aliases (performer_id, alias_name, source, is_primary)
          VALUES (${candidate.performerId}, ${candidate.aliasName}, 'auto_generated', false)
        `);

        generatedCount++;

        if (generatedCount <= 10) {
          console.log(`  生成: "${candidate.performerName}" → "${candidate.aliasName}" (${candidate.reason})`);
        }
      } catch (error: any) {
        // 重複エラーは無視
        if (error.code === '23505') {
          skippedCount++;
        } else {
          console.error(`  エラー: ${performer.name}`, error.message);
        }
      }
    }
  }

  console.log('\n=== 結果 ===');
  console.log(`生成した別名: ${generatedCount}件`);
  console.log(`スキップ: ${skippedCount}件`);

  // 最終統計
  const finalStats = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count
    FROM performer_aliases
    GROUP BY source
    ORDER BY count DESC
  `);

  console.log('\n別名データソース別統計:');
  console.table(finalStats.rows);

  process.exit(0);
}

main().catch(console.error);
