/**
 * wiki_crawl_dataから演者紐付けを行うスクリプト
 *
 * wiki_crawl_dataテーブルに保存された品番-演者のマッピングを使用して、
 * productsテーブルの商品に演者を紐付ける
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/enrichment/link-wiki-performers.ts [--limit 1000] [--dry-run]
 */

import { getDb } from '../../lib/db';
import { products, performers, productPerformers, performerAliases, wikiCrawlData } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  isValidPerformerForProduct,
} from '../../lib/performer-validation';

const db = getDb();

interface WikiPerformerMatch {
  productId: number;
  productCode: string;
  performerName: string;
  source: string;
}

/**
 * normalized_product_idから品番を抽出する
 * 例:
 *   FANZA-gvh00802 → GVH-802
 *   425bdsx-01902 → BDSX-01902
 *   HEYZO-0463 → HEYZO-0463
 *   112918_776 → 112918_776
 */
function extractProductCode(normalizedId: string): string[] {
  const codes: string[] = [];
  const upper = normalizedId.toUpperCase();

  // そのままの形式を追加
  codes.push(upper);

  // FANZA-xxx形式からプレフィックスを除去
  if (upper.startsWith('FANZA-')) {
    const withoutFanza = upper.replace('FANZA-', '');
    codes.push(withoutFanza);

    // gvh00802 → GVH-802 形式に変換（先頭0を除去）
    const match = withoutFanza.match(/^([A-Z]+)(\d+)$/);
    if (match && match[1] && match[2]) {
      const letters = match[1];
      const numbers = match[2].replace(/^0+/, ''); // 先頭の0を除去
      codes.push(`${letters}-${numbers}`);
    }
  }

  // MGS形式: 425bdsx-01902 → BDSX-01902
  const mgsMatch = upper.match(/^\d+([A-Z]+)-?(\d+)$/);
  if (mgsMatch && mgsMatch[1] && mgsMatch[2]) {
    const letters = mgsMatch[1];
    const numbers = mgsMatch[2].replace(/^0+/, '');
    codes.push(`${letters}-${numbers}`);
    codes.push(`${letters}${mgsMatch[2]}`); // ハイフンなし版も追加
  }

  // 数字プレフィックス + 品番形式: 425BDSX-01902 → BDSX-01902
  const numPrefixMatch = upper.match(/^(\d{2,3})([A-Z]+)-?(\d+)$/);
  if (numPrefixMatch && numPrefixMatch[2] && numPrefixMatch[3]) {
    const letters = numPrefixMatch[2];
    const numbers = numPrefixMatch[3];
    codes.push(`${letters}-${numbers}`);
    codes.push(`${letters}-${numbers.replace(/^0+/, '')}`);
  }

  return [...new Set(codes)];
}

/**
 * wiki_crawl_dataから品番-演者マッピングを取得（バッチ処理）
 */
async function loadWikiPerformerMappings(): Promise<Map<string, string[]>> {
  console.log('📚 wiki_crawl_dataを読み込み中...');

  const mapping = new Map<string, string[]>();
  const BATCH_SIZE = 10000;
  let lastId = 0;
  let totalLoaded = 0;

  while (true) {
    // IDベースのページネーション（OFFSETより高速）
    const wikiData = await db.execute<{ id: number; product_code: string; performer_name: string }>(
      sql`SELECT id, product_code, performer_name FROM wiki_crawl_data WHERE id > ${lastId} ORDER BY id LIMIT ${BATCH_SIZE}`,
    );

    if (wikiData.rows.length === 0) {
      break;
    }

    for (const row of wikiData.rows) {
      const code = row.product_code.toUpperCase();
      if (!mapping.has(code)) {
        mapping.set(code, []);
      }
      const performers = mapping.get(code)!;
      if (!performers.includes(row.performer_name)) {
        performers.push(row.performer_name);
      }
      lastId = row['id'];
    }

    totalLoaded += wikiData.rows.length;
    console.log(`  📖 ${totalLoaded}件ロード済み (lastId: ${lastId})...`);

    if (wikiData.rows.length < BATCH_SIZE) {
      break;
    }
  }

  console.log(`  ✓ ${totalLoaded}件のレコードをロード`);
  console.log(`  ✓ ${mapping.size}件のユニーク品番`);

  return mapping;
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
 * 商品に演者を紐付け
 */
async function linkPerformerToProduct(productId: number, performerId: number): Promise<boolean> {
  // 既存リンクをチェック
  const existing = await db
    .select()
    .from(productPerformers)
    .where(and(eq(productPerformers.productId, productId), eq(productPerformers.performerId, performerId)))
    .limit(1);

  if (existing.length > 0) {
    return false;
  }

  await db['insert'](productPerformers).values({
    productId,
    performerId,
  });

  return true;
}

async function main() {
  const args = process.argv.slice(2);

  let limit = 10000;
  const dryRun = args.includes('--dry-run');
  const onlyUnlinked = !args.includes('--include-linked');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg?.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '10000', 10);
    } else if (arg === '--limit' && nextArg) {
      limit = parseInt(nextArg, 10);
      i++;
    }
  }

  console.log('=== wiki_crawl_dataからの演者紐付け ===');
  console.log(`モード: ${dryRun ? 'ドライラン（実際の更新なし）' : '本番実行'}`);
  console.log(`対象: ${onlyUnlinked ? '未紐付け商品のみ' : '全商品'}`);
  console.log(`処理上限: ${limit}件\n`);

  // wiki_crawl_dataからマッピングをロード
  const wikiMappings = await loadWikiPerformerMappings();

  if (wikiMappings.size === 0) {
    console.log('wiki_crawl_dataにデータがありません');
    process.exit(0);
  }

  // 商品を取得
  console.log('\n🔍 商品を取得中...');

  // すでにリンク済みの商品IDを取得
  const linkedIds = onlyUnlinked
    ? new Set(
        (await db.selectDistinct({ productId: productPerformers.productId }).from(productPerformers)).map(
          (r) => r.productId,
        ),
      )
    : new Set<number>();

  // 全商品を取得
  const allProducts = await db
    .select({
      id: products['id'],
      normalizedProductId: products.normalizedProductId,
      title: products['title'],
    })
    .from(products)
    .limit(limit * 2);

  // 未紐付けでフィルタ
  let targetProducts = onlyUnlinked ? allProducts.filter((p) => !linkedIds.has(p.id)) : allProducts;

  targetProducts = targetProducts.slice(0, limit);

  console.log(`  ✓ ${targetProducts.length}件の商品を取得\n`);

  let totalLinked = 0;
  let totalMatched = 0;
  let totalProducts = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const product = targetProducts[i];
    if (!product) continue;
    totalProducts++;

    if (i % 500 === 0) {
      console.log(`[${i + 1}/${targetProducts.length}] 処理中... (紐付け: ${totalLinked}件)`);
    }

    // normalized_product_idから複数の品番形式を抽出してwikiデータを検索
    const productCodes = extractProductCode(product.normalizedProductId);
    let wikiPerformers: string[] | undefined;

    for (const code of productCodes) {
      wikiPerformers = wikiMappings.get(code);
      if (wikiPerformers && wikiPerformers.length > 0) {
        break;
      }
    }

    if (!wikiPerformers || wikiPerformers.length === 0) {
      continue;
    }

    totalMatched++;

    for (const performerName of wikiPerformers) {
      // バリデーション
      if (!isValidPerformerForProduct(performerName, product.title)) {
        continue;
      }

      if (dryRun) {
        console.log(`  📌 [DRY] ${product.normalizedProductId} → ${performerName}`);
        totalLinked++;
        continue;
      }

      const performerId = await getOrCreatePerformer(performerName);
      if (!performerId) {
        continue;
      }

      const linked = await linkPerformerToProduct(product.id, performerId);
      if (linked) {
        totalLinked++;

        if (i < 30) {
          console.log(`  📌 ${product.normalizedProductId} → ${performerName}`);
        }
      }
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理商品数: ${totalProducts}件`);
  console.log(`wikiマッチ: ${totalMatched}件`);
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
