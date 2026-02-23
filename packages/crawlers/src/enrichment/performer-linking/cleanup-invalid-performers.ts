/**
 * 無効な演者紐付けをクリーンアップするスクリプト
 *
 * performer-validation.tsのisValidPerformerName関数を使用して
 * 無効な演者名を検出し、削除する
 *
 * 使用方法:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/enrichment/performer-linking/cleanup-invalid-performers.ts [--dry-run]
 */

import { getDb } from '../../lib/db';
import { performers, productPerformers, wikiCrawlData } from '../../lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import { isValidPerformerName } from '../../lib/performer-validation';

const db = getDb();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('=== 無効な演者紐付けのクリーンアップ ===');
  console.log(`モード: ${dryRun ? 'ドライラン（実際の削除なし）' : '本番実行'}\n`);

  // 1. wiki_crawl_dataから無効なエントリを検索
  console.log('1. wiki_crawl_dataの無効エントリ検索...');
  const allWikiEntries = await db
    .select({
      id: wikiCrawlData.id,
      productCode: wikiCrawlData.productCode,
      performerName: wikiCrawlData.performerName,
    })
    .from(wikiCrawlData);

  const invalidWikiEntries = allWikiEntries.filter((entry) => !isValidPerformerName(entry['performerName']));

  console.log(`   総レコード: ${allWikiEntries.length}件`);
  console.log(`   ✓ ${invalidWikiEntries.length}件の無効エントリを発見`);

  if (invalidWikiEntries.length > 0) {
    console.log('\n   無効エントリ:');
    for (const entry of invalidWikiEntries.slice(0, 30)) {
      console.log(`   - ${entry['productCode']}: "${entry['performerName']}"`);
    }
    if (invalidWikiEntries.length > 30) {
      console.log(`   ... 他${invalidWikiEntries.length - 30}件`);
    }
  }

  // 2. performersテーブルから無効な演者を検索
  console.log('\n2. performersテーブルの無効エントリ検索...');
  const allPerformers = await db
    .select({
      id: performers['id'],
      name: performers['name'],
    })
    .from(performers);

  const invalidPerformers = allPerformers.filter((p) => !isValidPerformerName(p.name));

  console.log(`   総演者: ${allPerformers.length}件`);
  console.log(`   ✓ ${invalidPerformers.length}件の無効演者を発見`);

  for (const p of invalidPerformers.slice(0, 30)) {
    console.log(`   - ID ${p.id}: "${p.name}"`);
  }
  if (invalidPerformers.length > 30) {
    console.log(`   ... 他${invalidPerformers.length - 30}件`);
  }

  // 3. product_performersから該当する紐付けを検索
  console.log('\n3. product_performersの無効紐付け検索...');
  let invalidLinkCount = 0;
  const invalidPerformerIds = invalidPerformers.map((p) => p.id);

  if (invalidPerformerIds.length > 0) {
    // バッチで取得
    const links = await db
      .select({ performerId: productPerformers.performerId })
      .from(productPerformers)
      .where(inArray(productPerformers.performerId, invalidPerformerIds));

    invalidLinkCount = links.length;

    // 上位10件の詳細を表示
    const linkCounts = new Map<number, number>();
    for (const link of links) {
      linkCounts.set(link.performerId, (linkCounts.get(link.performerId) || 0) + 1);
    }
    const sortedCounts = [...linkCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [performerId, count] of sortedCounts) {
      const performer = invalidPerformers.find((p) => p.id === performerId);
      console.log(`   - "${performer?.name}": ${count}件の紐付け`);
    }
  }
  console.log(`   ✓ 合計${invalidLinkCount}件の無効紐付け`);

  if (dryRun) {
    console.log('\n⚠️ ドライランモードのため、実際の削除は行われていません');
    process.exit(0);
  }

  // 4. 削除実行
  console.log('\n4. 削除実行...');

  // wiki_crawl_dataから削除（バッチ処理）
  if (invalidWikiEntries.length > 0) {
    const batchSize = 1000;
    let deletedCount = 0;
    for (let i = 0; i < invalidWikiEntries.length; i += batchSize) {
      const batch = invalidWikiEntries.slice(i, i + batchSize);
      const ids = batch.map((e) => e.id);
      await db['delete'](wikiCrawlData).where(inArray(wikiCrawlData.id, ids));
      deletedCount += ids.length;
      console.log(`   wiki_crawl_data: ${deletedCount}/${invalidWikiEntries.length}件削除`);
    }
    console.log(`   ✓ wiki_crawl_dataから${invalidWikiEntries.length}件削除完了`);
  }

  // product_performersから削除（バッチ処理）
  if (invalidPerformerIds.length > 0) {
    const batchSize = 100;
    let deletedCount = 0;
    for (let i = 0; i < invalidPerformerIds.length; i += batchSize) {
      const batch = invalidPerformerIds.slice(i, i + batchSize);
      await db['delete'](productPerformers).where(inArray(productPerformers.performerId, batch));
      deletedCount += batch.length;
      console.log(`   product_performers: ${deletedCount}/${invalidPerformerIds.length}演者の紐付け削除`);
    }
    console.log(`   ✓ product_performersから${invalidLinkCount}件削除完了`);
  }

  // performersから削除（バッチ処理）
  if (invalidPerformerIds.length > 0) {
    const batchSize = 100;
    let deletedCount = 0;
    for (let i = 0; i < invalidPerformerIds.length; i += batchSize) {
      const batch = invalidPerformerIds.slice(i, i + batchSize);
      await db['delete'](performers).where(inArray(performers['id'], batch));
      deletedCount += batch.length;
      console.log(`   performers: ${deletedCount}/${invalidPerformerIds.length}件削除`);
    }
    console.log(`   ✓ performersから${invalidPerformers.length}件削除完了`);
  }

  console.log('\n=== 完了 ===');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
