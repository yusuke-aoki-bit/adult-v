/**
 * 商品タイトルから演者名を抽出して紐付けるスクリプト
 *
 * 既存のperformersテーブルに登録されている演者名を使って、
 * 商品タイトルとマッチングし、未紐付けの商品に演者を紐付ける
 */

import { getDb } from '../lib/db';
import { performers, products, productPerformers, productSources } from '../lib/db/schema';
import { sql, eq, and, isNull, inArray, like, not } from 'drizzle-orm';

const db = getDb();

// 無効な演者名パターン（これらはマッチング対象から除外）
const INVALID_PERFORMER_NAMES = new Set([
  '他', '素人', '応募者', '企画', '不明', '-', '---', 'N/A',
]);

// 最低文字数（短すぎる名前は誤マッチしやすい）
const MIN_PERFORMER_NAME_LENGTH = 3;

interface PerformerInfo {
  id: number;
  name: string;
}

async function loadValidPerformers(): Promise<PerformerInfo[]> {
  console.log('📋 有効な演者名をロード中...');

  const allPerformers = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers);

  // フィルタリング
  const validPerformers = allPerformers.filter(p => {
    if (!p.name) return false;
    if (p.name.length < MIN_PERFORMER_NAME_LENGTH) return false;
    if (INVALID_PERFORMER_NAMES.has(p.name)) return false;
    // 数字のみ、タブ含み、括弧付き数字などを除外
    if (/^\d+$/.test(p.name)) return false;
    if (p.name.includes('\t')) return false;
    if (/\(\d+\)$/.test(p.name)) return false;
    return true;
  });

  console.log(`✅ ${validPerformers.length}人の有効な演者名をロード（全${allPerformers.length}人中）`);
  return validPerformers;
}

function findPerformersInTitle(title: string, performerList: PerformerInfo[]): PerformerInfo[] {
  const found: PerformerInfo[] = [];
  const foundNames = new Set<string>();

  for (const performer of performerList) {
    // 既に見つかった演者名の部分文字列は除外
    let isSubstring = false;
    for (const existingName of foundNames) {
      if (existingName.includes(performer.name) || performer.name.includes(existingName)) {
        isSubstring = true;
        break;
      }
    }
    if (isSubstring) continue;

    // 正確なマッチング
    if (title.includes(performer.name)) {
      // 重複チェック
      if (!found.some(p => p.id === performer.id)) {
        found.push(performer);
        foundNames.add(performer.name);
      }
    }
  }

  return found;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000');
  const aspFilter = args.find(a => a.startsWith('--asp='))?.split('=')[1] || null;
  const dryRun = args.includes('--dry-run');

  console.log('=== タイトルから演者名を抽出 ===\n');
  console.log(`設定: limit=${limit}, asp=${aspFilter || 'all'}, dryRun=${dryRun}\n`);

  // 1. 有効な演者名をロード
  const validPerformers = await loadValidPerformers();

  // 2. 名前の長い順にソート（長い名前を先にマッチさせる）
  validPerformers.sort((a, b) => b.name.length - a.name.length);

  // 3. 未紐付け商品を取得
  console.log('\n🔍 未紐付け商品を検索中...');

  let query;
  if (aspFilter) {
    query = sql`
      SELECT p.id, p.title, ps.asp_name
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      WHERE pp.product_id IS NULL
      AND ps.asp_name = ${aspFilter}
      LIMIT ${limit}
    `;
  } else {
    query = sql`
      SELECT DISTINCT p.id, p.title,
        (SELECT ps2.asp_name FROM product_sources ps2 WHERE ps2.product_id = p.id LIMIT 1) as asp_name
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      WHERE pp.product_id IS NULL
      LIMIT ${limit}
    `;
  }

  const unlinkedProducts = await db.execute(query);
  console.log(`✅ ${unlinkedProducts.rows.length}件の未紐付け商品を取得`);

  // 4. マッチング処理
  let matchedProducts = 0;
  let newRelations = 0;
  let noMatch = 0;
  const matchedPerformerCounts: Record<string, number> = {};

  console.log('\n🔄 マッチング処理開始...\n');

  for (const row of unlinkedProducts.rows as any[]) {
    const { id: productId, title, asp_name } = row;

    if (!title) {
      noMatch++;
      continue;
    }

    const foundPerformers = findPerformersInTitle(title, validPerformers);

    if (foundPerformers.length === 0) {
      noMatch++;
      continue;
    }

    matchedProducts++;

    for (const performer of foundPerformers) {
      // カウント
      matchedPerformerCounts[performer.name] = (matchedPerformerCounts[performer.name] || 0) + 1;

      if (!dryRun) {
        try {
          await db
            .insert(productPerformers)
            .values({
              productId: productId,
              performerId: performer.id,
            })
            .onConflictDoNothing();

          newRelations++;
        } catch (error) {
          // 重複エラーは無視
        }
      } else {
        newRelations++;
      }
    }

    if (matchedProducts % 500 === 0) {
      console.log(`進捗: ${matchedProducts}件マッチ / ${unlinkedProducts.rows.length}件処理 (新規紐付け: ${newRelations}件)`);
    }
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${unlinkedProducts.rows.length}件`);
  console.log(`マッチした商品: ${matchedProducts}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`マッチなし: ${noMatch}件`);

  // よくマッチした演者TOP20
  const topMatched = Object.entries(matchedPerformerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  console.log('\n=== よくマッチした演者TOP20 ===');
  for (const [name, count] of topMatched) {
    console.log(`  ${name}: ${count}件`);
  }

  // 最終統計（dry-runでなければ）
  if (!dryRun) {
    const stats = await db.execute(sql`
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN p.id END) as with_performer
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
    `);
    console.log('\n=== 全体統計 ===');
    console.table(stats.rows);
  }

  process.exit(0);
}

main().catch(console.error);
