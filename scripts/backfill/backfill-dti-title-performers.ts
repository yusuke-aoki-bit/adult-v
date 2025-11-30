/**
 * DTI商品タイトルから演者名を抽出して紐付けるスクリプト
 *
 * パターン: 「女優名 【よみがな】 作品タイトル」
 * 例: 「時東くるみ 【ときとうくるみ】 放課後美少女ファイル No.36～ミニスカ娘をじっくり堪能～」
 */

import { getDb } from '../../lib/db';
import { performers, productPerformers } from '../../lib/db/schema';
import { sql, eq } from 'drizzle-orm';

const db = getDb();

// 無効な演者名パターン
const INVALID_PERFORMER_NAMES = new Set([
  '他', '素人', '応募者', '企画', '不明', '-', '---', 'N/A',
  '巨乳', '美乳', '貧乳', '美少女', '美女', '熟女', '若妻', '人妻',
  '処女', '素人娘', 'ギャル', 'OL', 'JK', 'JD', 'ナース', 'メイド',
  '中出し', 'ごっくん', '顔射', 'ぶっかけ', '潮吹き', '連続', '複数',
  '痴女', '淫乱', 'ドM', 'ドS', '変態', 'エロ', 'Hカップ', 'Iカップ',
]);

// DTIタイトルから演者名を抽出するパターン
// パターン1: 「女優名 【よみがな】 タイトル」
// パターン2: 「女優名【よみがな】タイトル」(スペースなし)
// パターン3: 「女優名 タイトル」(よみがななし、最初のスペースで区切り)
function extractPerformerFromDtiTitle(title: string): { name: string; kana: string | null } | null {
  if (!title) return null;

  // パターン1&2: 「女優名 【よみがな】」形式
  const bracketMatch = title.match(/^([^\s【]+)\s*【([^】]+)】/);
  if (bracketMatch) {
    const name = bracketMatch[1].trim();
    const kana = bracketMatch[2].trim();

    // 有効性チェック
    if (isValidPerformerName(name)) {
      return { name, kana };
    }
  }

  return null;
}

function isValidPerformerName(name: string): boolean {
  if (!name) return false;
  if (name.length < 2) return false;
  if (name.length > 20) return false;
  if (INVALID_PERFORMER_NAMES.has(name)) return false;

  // 数字のみ、記号のみは除外
  if (/^[\d\s]+$/.test(name)) return false;
  if (/^[a-zA-Z0-9\s]+$/.test(name) && name.length < 4) return false;

  // ジャンル名っぽいものを除外
  if (/^(巨|美|貧|爆|微|超|激|極|鬼|神)/.test(name)) return false;
  if (/(乳|尻|脚|膣|穴|汁)$/.test(name)) return false;

  return true;
}

async function findOrCreatePerformer(name: string, kana: string | null): Promise<number | null> {
  try {
    // 既存演者を検索
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      // 読みがなを更新（未設定の場合）
      if (kana && !performer.nameKana) {
        await db.update(performers)
          .set({ nameKana: kana })
          .where(eq(performers.id, performer.id));
      }
      return performer.id;
    }

    // 新規作成
    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: kana,
      })
      .returning();

    return newPerformer.id;
  } catch {
    // 競合エラーの場合は既存を検索
    const existing = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existing?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10000');
  const batch = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');
  const dryRun = args.includes('--dry-run');

  console.log('=== DTIタイトルから演者名を抽出 ===\n');
  console.log(`設定: limit=${limit}, batch=${batch}, dryRun=${dryRun}\n`);

  // 未紐付けのDTI商品を取得
  console.log('🔍 未紐付けDTI商品を検索中...\n');

  const unlinkedProducts = await db.execute(sql`
    SELECT p.id, p.title
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
    AND ps.asp_name = 'DTI'
    AND p.title ~ '^[^\\s【]+\\s*【[^】]+】'
    LIMIT ${limit}
  `);

  console.log(`✅ ${unlinkedProducts.rows.length}件の未紐付けDTI商品を取得（パターンマッチ）\n`);

  let processed = 0;
  let newRelations = 0;
  let newPerformers = 0;
  let skipped = 0;
  const extractedNames: Record<string, number> = {};

  for (const row of unlinkedProducts.rows as any[]) {
    const { id: productId, title } = row;

    const extracted = extractPerformerFromDtiTitle(title);

    if (!extracted) {
      skipped++;
      continue;
    }

    // カウント
    extractedNames[extracted.name] = (extractedNames[extracted.name] || 0) + 1;

    if (!dryRun) {
      const performerId = await findOrCreatePerformer(extracted.name, extracted.kana);

      if (!performerId) {
        skipped++;
        continue;
      }

      // 紐付け
      try {
        await db
          .insert(productPerformers)
          .values({
            productId: productId,
            performerId: performerId,
          })
          .onConflictDoNothing();

        newRelations++;
      } catch {
        // 重複エラーは無視
      }
    } else {
      newRelations++;
    }

    processed++;

    if (processed % batch === 0) {
      console.log(`進捗: ${processed}/${unlinkedProducts.rows.length} (新規紐付け: ${newRelations}件)`);
    }
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`スキップ: ${skipped}件`);

  // 抽出された演者名TOP30
  const topExtracted = Object.entries(extractedNames)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  console.log('\n=== 抽出された演者名TOP30 ===');
  for (const [name, count] of topExtracted) {
    console.log(`  ${name}: ${count}件`);
  }

  // 最終統計
  if (!dryRun) {
    const stats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT ps.product_id) as total,
        COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as rate
      FROM product_sources ps
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      WHERE ps.asp_name = 'DTI'
    `);
    console.log('\n=== DTI紐付け状況 ===');
    console.table(stats.rows);
  }

  process.exit(0);
}

main().catch(console.error);
