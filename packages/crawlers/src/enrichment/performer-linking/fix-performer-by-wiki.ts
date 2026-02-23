/**
 * wiki_crawl_dataを使って演者紐付けを修正するバックフィル
 *
 * 既存の間違った演者紐付けを、wiki_crawl_dataの正しい情報で置き換える
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/enrichment/performer-linking/fix-performer-by-wiki.ts [--limit 1000] [--dry-run]
 *
 * オプション:
 *   --limit N       処理する商品数の上限（デフォルト: 10000）
 *   --dry-run       実際のDB更新を行わずに結果を表示
 *   --product-code  特定の品番のみを処理（例: --product-code=MFCS-191）
 */

import { getDb } from '../../lib/db';
import { products, performers, productPerformers, performerAliases } from '../../lib/db/schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../../lib/performer-validation';
import { extractProductCodes, getPerformersFromWikiCrawlData } from '../../lib/crawler-utils';

const db = getDb();

interface PerformerFix {
  productId: number;
  normalizedProductId: string;
  title: string;
  oldPerformers: string[];
  newPerformers: string[];
}

/**
 * 演者名からperformer IDを取得または作成
 */
async function getOrCreatePerformer(name: string): Promise<number | null> {
  if (!isValidPerformerName(name)) {
    return null;
  }

  const normalizedName = normalizePerformerName(name);
  if (!normalizedName) {
    return null;
  }

  // 既存の演者を検索
  let [performer] = await db.select().from(performers).where(eq(performers['name'], normalizedName)).limit(1);

  // 存在しなければエイリアスで検索
  if (!performer) {
    const [alias] = await db
      .select({ performerId: performerAliases.performerId })
      .from(performerAliases)
      .where(eq(performerAliases.aliasName, normalizedName))
      .limit(1);

    if (alias) {
      return alias.performerId;
    }
  }

  // 存在しなければ作成
  if (!performer) {
    try {
      const [inserted] = await db.insert(performers).values({ name: normalizedName }).returning();
      return inserted!.id;
    } catch {
      // 競合の場合は再取得
      const [existing] = await db.select().from(performers).where(eq(performers['name'], normalizedName)).limit(1);
      if (existing) {
        return existing.id;
      }
      return null;
    }
  }

  return performer['id'];
}

/**
 * 商品の既存演者紐付けを取得
 */
async function getCurrentPerformers(productId: number): Promise<{ id: number; name: string }[]> {
  const result = await db
    .select({
      id: performers['id'],
      name: performers['name'],
    })
    .from(productPerformers)
    .innerJoin(performers, eq(productPerformers.performerId, performers['id']))
    .where(eq(productPerformers.productId, productId));

  return result;
}

/**
 * 商品の演者紐付けを置き換え
 */
async function replacePerformers(productId: number, newPerformerIds: number[]): Promise<void> {
  // 重複IDを除去
  const uniquePerformerIds = [...new Set(newPerformerIds)];

  // 既存の紐付けを削除
  await db.delete(productPerformers).where(eq(productPerformers.productId, productId));

  // 新しい紐付けを作成
  if (uniquePerformerIds.length > 0) {
    await db['insert'](productPerformers)
      .values(
        uniquePerformerIds.map((performerId) => ({
          productId,
          performerId,
        })),
      )
      .onConflictDoNothing();
  }
}

async function main() {
  const args = process.argv.slice(2);

  let limit = 10000;
  const dryRun = args.includes('--dry-run');
  let specificProductCode: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg?.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '10000', 10);
    } else if (arg === '--limit' && nextArg) {
      limit = parseInt(nextArg, 10);
      i++;
    } else if (arg?.startsWith('--product-code=')) {
      specificProductCode = arg.split('=')[1];
    }
  }

  console.log('=== wiki_crawl_dataによる演者紐付け修正 ===');
  console.log(`モード: ${dryRun ? 'ドライラン（実際の更新なし）' : '本番実行'}`);
  if (specificProductCode) {
    console.log(`対象品番: ${specificProductCode}`);
  }
  console.log(`処理上限: ${limit}件\n`);

  // 商品を取得
  console.log('🔍 商品を取得中...');

  let targetProducts;
  if (specificProductCode) {
    // 特定品番を検索
    const searchCodes = extractProductCodes(specificProductCode);
    console.log(`検索品番: ${searchCodes.join(', ')}`);

    targetProducts = await db
      .select({
        id: products['id'],
        normalizedProductId: products.normalizedProductId,
        title: products['title'],
      })
      .from(products)
      .where(
        sql`UPPER(${products.normalizedProductId}) = ANY(ARRAY[${sql.join(
          searchCodes.map((c) => sql`${c.toUpperCase()}`),
          sql`, `,
        )}]::text[])`,
      )
      .limit(limit);
  } else {
    // 演者が紐付けられている商品を取得
    targetProducts = await db
      .selectDistinct({
        id: products['id'],
        normalizedProductId: products.normalizedProductId,
        title: products['title'],
      })
      .from(products)
      .innerJoin(productPerformers, eq(products['id'], productPerformers.productId))
      .limit(limit);
  }

  console.log(`  ✓ ${targetProducts.length}件の商品を取得\n`);

  const fixes: PerformerFix[] = [];
  let totalProcessed = 0;
  let totalFixed = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const product = targetProducts[i];
    if (!product) continue;
    totalProcessed++;

    if (i % 500 === 0 && i > 0) {
      console.log(`[${i}/${targetProducts.length}] 処理中... (修正: ${totalFixed}件)`);
    }

    // wiki_crawl_dataから演者名を取得
    const wikiPerformers = await getPerformersFromWikiCrawlData(db, product.normalizedProductId);

    if (wikiPerformers.length === 0) {
      continue;
    }

    // 現在の演者を取得
    const currentPerformers = await getCurrentPerformers(product.id);
    const currentNames = currentPerformers.map((p) => p.name);

    // wiki演者をバリデーション
    const validWikiPerformers = wikiPerformers.filter(
      (name) => isValidPerformerName(name) && isValidPerformerForProduct(name, product.title),
    );

    if (validWikiPerformers.length === 0) {
      continue;
    }

    // 差分チェック（同じなら修正不要）
    const currentSet = new Set(currentNames.map((n) => n.toLowerCase()));
    const wikiSet = new Set(validWikiPerformers.map((n) => n.toLowerCase()));

    const isSame = currentSet.size === wikiSet.size && [...currentSet].every((n) => wikiSet.has(n));

    if (isSame) {
      continue;
    }

    // 修正対象として記録
    fixes.push({
      productId: product.id,
      normalizedProductId: product.normalizedProductId,
      title: product.title,
      oldPerformers: currentNames,
      newPerformers: validWikiPerformers,
    });

    if (dryRun) {
      console.log(`\n📌 [DRY] ${product.normalizedProductId}`);
      console.log(`   現在: ${currentNames.join(', ') || '(なし)'}`);
      console.log(`   修正: ${validWikiPerformers.join(', ')}`);
      totalFixed++;
    } else {
      // 実際に修正
      const newPerformerIds: number[] = [];
      for (const name of validWikiPerformers) {
        const performerId = await getOrCreatePerformer(name);
        if (performerId) {
          newPerformerIds.push(performerId);
        }
      }

      if (newPerformerIds.length > 0) {
        await replacePerformers(product.id, newPerformerIds);
        console.log(`✓ ${product.normalizedProductId}: ${currentNames.join(', ')} → ${validWikiPerformers.join(', ')}`);
        totalFixed++;
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理商品数: ${totalProcessed}件`);
  console.log(`修正件数: ${totalFixed}件`);

  if (dryRun) {
    console.log('\n⚠️ ドライランモードのため、実際のデータベース更新は行われていません');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
