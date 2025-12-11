/**
 * 演者紐付け改善スクリプト
 *
 * 商品タイトルや説明文から演者名を抽出し、
 * 既存の演者データと照合して紐付けを行う
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/enrichment/link-performers.ts [--limit 1000] [--dry-run]
 */

import { getDb } from '../../lib/db';
import { products, performers, productPerformers, performerAliases, productSources } from '../../lib/db/schema';
import { eq, sql, and, isNull, notInArray, inArray } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';

const db = getDb();

interface PerformerMatch {
  performerId: number;
  performerName: string;
  matchedName: string;
  matchType: 'exact' | 'alias' | 'title_extract';
}

/**
 * 全演者名とエイリアスをメモリにロード
 */
async function loadPerformerIndex(): Promise<Map<string, number>> {
  console.log('📚 演者インデックスを構築中...');

  const index = new Map<string, number>();

  // 本名をロード
  const allPerformers = await db.select({
    id: performers.id,
    name: performers.name,
  }).from(performers);

  for (const p of allPerformers) {
    const normalized = normalizePerformerName(p.name);
    index.set(normalized, p.id);
    index.set(p.name, p.id);
  }

  // エイリアスをロード
  const allAliases = await db.select({
    performerId: performerAliases.performerId,
    aliasName: performerAliases.aliasName,
  }).from(performerAliases);

  for (const a of allAliases) {
    const normalized = normalizePerformerName(a.aliasName);
    if (!index.has(normalized)) {
      index.set(normalized, a.performerId);
    }
    if (!index.has(a.aliasName)) {
      index.set(a.aliasName, a.performerId);
    }
  }

  console.log(`  ✓ ${allPerformers.length}人の演者、${allAliases.length}件のエイリアスをロード`);
  console.log(`  ✓ インデックスサイズ: ${index.size}件`);

  return index;
}

/**
 * 商品タイトルから演者名を抽出
 */
function extractPerformersFromTitle(title: string): string[] {
  const extracted: string[] = [];

  // よくあるパターン:
  // 1. 「○○ ××」のように名前がスペース区切りで含まれる
  // 2. 【○○】や（○○）で囲まれた名前
  // 3. 「出演：○○」「主演：○○」のパターン

  // 括弧内の名前を抽出
  const bracketPatterns = [
    /【([^】]+)】/g,
    /（([^）]+)）/g,
    /\(([^)]+)\)/g,
    /「([^」]+)」/g,
  ];

  for (const pattern of bracketPatterns) {
    const matches = title.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      if (isValidPerformerName(name) && name.length <= 20) {
        extracted.push(name);
      }
    }
  }

  // 出演/主演パターン
  const actorPatterns = [
    /出演[：:]\s*([^\s【（]+)/,
    /主演[：:]\s*([^\s【（]+)/,
    /女優[：:]\s*([^\s【（]+)/,
  ];

  for (const pattern of actorPatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (isValidPerformerName(name)) {
        extracted.push(name);
      }
    }
  }

  return [...new Set(extracted)];
}

/**
 * 名前がフルネームかどうか判定
 * 漢字のみの名前は3文字以上、それ以外は4文字以上必要
 */
function isFullName(name: string): boolean {
  if (!name) return false;

  // 姓名の間にスペースがある
  if (name.includes(' ') || name.includes('　')) {
    return true;
  }

  // 漢字のみで構成されている場合は3文字以上
  const kanjiOnly = /^[\u4e00-\u9faf]+$/.test(name);
  if (kanjiOnly && name.length >= 3) {
    return true;
  }

  // それ以外（ひらがな・カタカナ混じり）は4文字以上
  if (name.length >= 4) {
    return true;
  }

  return false;
}

/**
 * 商品タイトルを演者インデックスと照合
 */
function matchPerformersInTitle(
  title: string,
  performerIndex: Map<string, number>,
  allPerformerNames: string[]
): PerformerMatch[] {
  const matches: PerformerMatch[] = [];
  const matchedIds = new Set<number>();

  // タイトルに含まれる演者名を検索（長い名前優先）
  const sortedNames = allPerformerNames.sort((a, b) => b.length - a.length);

  for (const name of sortedNames) {
    // フルネームのみマッチング（短い名前の誤検出を防ぐ）
    if (!isFullName(name)) continue;

    // タイトルに名前が含まれているか
    if (title.includes(name)) {
      const performerId = performerIndex.get(name);
      if (performerId && !matchedIds.has(performerId)) {
        matches.push({
          performerId,
          performerName: name,
          matchedName: name,
          matchType: 'title_extract',
        });
        matchedIds.add(performerId);
      }
    }
  }

  return matches;
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  let limit = 5000;
  const dryRun = args.includes('--dry-run');
  const includeLinked = args.includes('--include-linked'); // 既存紐付け商品も対象

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--limit=')) {
      limit = parseInt(args[i].split('=')[1], 10);
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log('=== 演者紐付け改善スクリプト ===');
  console.log(`モード: ${dryRun ? 'ドライラン（実際の更新なし）' : '本番実行'}`);
  console.log(`対象: ${includeLinked ? '全商品' : '未紐付け商品のみ'}`);
  console.log(`処理上限: ${limit}件\n`);

  // 演者インデックスを構築
  const performerIndex = await loadPerformerIndex();
  const allPerformerNames = [...performerIndex.keys()].filter(n => n && n.length >= 2);

  // 商品を取得
  console.log('\n🔍 商品を取得中...');

  let targetProducts;
  if (includeLinked) {
    // 全商品を対象
    targetProducts = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
      })
      .from(products)
      .limit(limit);
  } else {
    // 演者未紐付け商品のみ
    targetProducts = await db
      .select({
        id: products.id,
        title: products.title,
        normalizedProductId: products.normalizedProductId,
      })
      .from(products)
      .leftJoin(productPerformers, eq(products.id, productPerformers.productId))
      .where(isNull(productPerformers.productId))
      .limit(limit);
  }

  console.log(`  ✓ ${targetProducts.length}件の商品を取得\n`);

  let totalLinked = 0;
  let totalProducts = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const product = targetProducts[i];
    totalProducts++;

    if (i % 500 === 0) {
      console.log(`[${i + 1}/${targetProducts.length}] 処理中...`);
    }

    // タイトルから演者を抽出
    const extractedNames = extractPerformersFromTitle(product.title);

    // タイトル内の演者名をマッチング
    const matches = matchPerformersInTitle(product.title, performerIndex, allPerformerNames);

    // 抽出した名前もマッチング
    for (const name of extractedNames) {
      const normalized = normalizePerformerName(name);
      const performerId = performerIndex.get(normalized) || performerIndex.get(name);

      if (performerId && !matches.some(m => m.performerId === performerId)) {
        matches.push({
          performerId,
          performerName: name,
          matchedName: normalized,
          matchType: 'title_extract',
        });
      }
    }

    // マッチした演者を紐付け
    if (matches.length > 0) {
      for (const match of matches) {
        // バリデーション
        if (!isValidPerformerForProduct(match.performerName, product.title)) {
          continue;
        }

        if (!dryRun) {
          // 既存リンクをチェック
          const existing = await db
            .select()
            .from(productPerformers)
            .where(
              and(
                eq(productPerformers.productId, product.id),
                eq(productPerformers.performerId, match.performerId)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            await db.insert(productPerformers).values({
              productId: product.id,
              performerId: match.performerId,
            });
            totalLinked++;
          }
        } else {
          totalLinked++;
        }
      }

      if (i < 20 && matches.length > 0) {
        console.log(`  📌 ${product.title.substring(0, 40)}...`);
        console.log(`     → ${matches.map(m => m.performerName).join(', ')}`);
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理商品数: ${totalProducts}件`);
  console.log(`新規紐付け: ${totalLinked}件`);

  if (dryRun) {
    console.log('\n⚠️ ドライランモードのため、実際のデータベース更新は行われていません');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
