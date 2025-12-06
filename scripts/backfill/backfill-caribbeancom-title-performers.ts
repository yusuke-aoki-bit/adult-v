/**
 * カリビアンコムプレミアムのタイトルから出演者を抽出
 * タイトル形式: "作品タイトル 出演者1 出演者2 | カリビアンコムプレミアム"
 */

import { getDb } from '../../lib/db/index.js';
import { performers, productPerformers } from '../../lib/db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation.js';

const db = getDb();

// 外国人名パターン: 名・姓の形式（カタカナ）
// 例: アントニア・セインツ, ダイド・エンジェル
const FOREIGN_NAME_PATTERN = /([ァ-ヶー]+[・][ァ-ヶー]+)/g;

// 日本人名パターン
const JAPANESE_NAME_PATTERN = /([一-龯]+[ぁ-んァ-ヶー]+|[ァ-ヶー]{2,8})/g;

// 除外ワード
const EXCLUDED_WORDS = new Set([
  'カリビアンコムプレミアム', 'カリビアンコム', 'プレミアム',
  'ストーリーズ', 'パーティー', 'サマータイム', 'トレーニング',
  'ガールフレンド', 'マッサージ', 'ボディ', 'セクシー',
  'ティーンエイジ', 'バウンシー', 'ブーブス', 'バンド',
]);

function extractPerformersFromTitle(title: string): string[] {
  const performers: string[] = [];

  // パイプで分割して前半を取得
  const parts = title.split(/[|｜]/);
  if (parts.length < 2) return [];

  const searchText = parts[0].trim();

  // 外国人名を抽出
  const foreignMatches = searchText.match(FOREIGN_NAME_PATTERN);
  if (foreignMatches) {
    for (const name of foreignMatches) {
      const trimmed = name.trim();
      if (trimmed.length >= 4 && !EXCLUDED_WORDS.has(trimmed) && isValidPerformerName(trimmed)) {
        if (!performers.includes(trimmed)) {
          performers.push(trimmed);
        }
      }
    }
  }

  // 日本人名を抽出（タイトル末尾に名前があるパターン）
  // 例: "スタイル抜群なハデ系熟女とたっぷりセックス ASUKA"
  const jpMatch = searchText.match(/\s+([A-Z]{2,10})\s*$/);
  if (jpMatch) {
    const name = jpMatch[1];
    if (isValidPerformerName(name) && !EXCLUDED_WORDS.has(name)) {
      if (!performers.includes(name)) {
        performers.push(name);
      }
    }
  }

  return performers;
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '100');

  console.log('=== カリビアンコムプレミアム タイトルから出演者抽出 ===\n');
  if (dryRun) {
    console.log('⚠️  DRY RUN モード（--execute で実行）\n');
  }
  console.log(`Limit: ${limit}\n`);

  const result = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title
    FROM products p
    WHERE NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    AND p.normalized_product_id LIKE 'カリビアンコムプレミアム-%'
    AND p.title IS NOT NULL
    AND p.title LIKE '%|%'
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = result.rows as any[];
  console.log(`✅ 対象製品: ${products.length}件\n`);

  let processed = 0;
  let extracted = 0;
  let newRelations = 0;

  for (const product of products) {
    const performerNames = extractPerformersFromTitle(product.title);

    if (performerNames.length > 0) {
      extracted++;
      console.log(`[${product.normalized_product_id}] ${performerNames.join(', ')}`);
      console.log(`  タイトル: ${product.title.substring(0, 80)}`);

      if (!dryRun) {
        for (const name of performerNames) {
          try {
            const performerId = await findOrCreatePerformer(name);
            if (performerId) {
              await db
                .insert(productPerformers)
                .values({
                  productId: product.id,
                  performerId: performerId,
                })
                .onConflictDoNothing();
              newRelations++;
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        newRelations += performerNames.length;
      }
    }

    processed++;
  }

  console.log('\n=== 結果 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`抽出成功: ${extracted}件`);
  console.log(`紐付け: ${newRelations}件`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN モード。実行するには --execute オプションを付けてください');
  } else {
    console.log('\n✅ 処理完了');
  }

  process.exit(0);
}

main().catch(console.error);
