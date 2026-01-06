/**
 * 商品同一性バッチ処理
 *
 * 品番、タイトル、演者情報を使用して同一商品を検出し、グルーピングする
 *
 * Usage:
 *   npx tsx packages/crawlers/src/enrichment/product-identity-batch.ts --mode=full
 *   npx tsx packages/crawlers/src/enrichment/product-identity-batch.ts --mode=incremental
 *   npx tsx packages/crawlers/src/enrichment/product-identity-batch.ts --mode=full --dry-run
 *   npx tsx packages/crawlers/src/enrichment/product-identity-batch.ts --mode=full --asps=FANZA,MGS
 */

import {
  processProductIdentity,
  fetchUngroupedProducts,
  fetchRecentProducts,
  countUngroupedProducts,
  getGroupStats,
  createInitialStats,
  type BatchProcessingOptions,
  type BatchProcessingStats,
  type MatchingMethod,
} from '../lib/product-identity';
import { DEFAULT_MATCHING_CONFIG } from '../lib/product-identity/types';

// ============================================================
// CLI引数パース
// ============================================================

interface CliArgs {
  mode: 'full' | 'incremental';
  batchSize: number;
  minConfidence: number;
  dryRun: boolean;
  verbose: boolean;
  targetAsps?: string[];
  limit?: number;
  offset?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    mode: 'incremental',
    batchSize: 1000,
    minConfidence: 60,
    dryRun: false,
    verbose: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1];
      if (mode === 'full' || mode === 'incremental') {
        result.mode = mode;
      }
    } else if (arg.startsWith('--batch-size=')) {
      result.batchSize = parseInt(arg.split('=')[1] ?? '500', 10);
    } else if (arg.startsWith('--min-confidence=')) {
      result.minConfidence = parseInt(arg.split('=')[1] ?? '50', 10);
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg.startsWith('--asps=')) {
      result.targetAsps = (arg.split('=')[1] ?? '').split(',');
    } else if (arg.startsWith('--limit=')) {
      result.limit = parseInt(arg.split('=')[1] ?? '0', 10);
    } else if (arg.startsWith('--offset=')) {
      result.offset = parseInt(arg.split('=')[1] ?? '0', 10);
    }
  }

  return result;
}

// ============================================================
// ログ出力
// ============================================================

function log(message: string, verbose: boolean = false): void {
  if (verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  } else {
    console.log(message);
  }
}

function logProgress(current: number, total: number, stats: BatchProcessingStats): void {
  const percent = ((current / total) * 100).toFixed(1);
  const elapsed = Date.now() - stats.startedAt.getTime();
  const rate = (current / (elapsed / 1000)).toFixed(1);

  process.stdout.write(
    `\r[${percent}%] ${current}/${total} | ` +
    `New: ${stats.newGroupsCreated} | Added: ${stats.addedToExistingGroups} | ` +
    `Skip: ${stats.skippedAlreadyGrouped + stats.skippedNoMatch} | ` +
    `Err: ${stats['errorCount']} | ${rate}/sec`
  );
}

function logSummary(stats: BatchProcessingStats): void {
  stats.completedAt = new Date();
  const durationMs = stats.completedAt.getTime() - stats.startedAt.getTime();
  const durationSec = (durationMs / 1000).toFixed(1);

  console.log('\n');
  console.log('='.repeat(60));
  console.log('Processing Complete');
  console.log('='.repeat(60));
  console.log(`Duration: ${durationSec}s`);
  console.log(`Processed: ${stats.processedCount}`);
  console.log(`New Groups: ${stats.newGroupsCreated}`);
  console.log(`Added to Existing: ${stats.addedToExistingGroups}`);
  console.log(`Skipped (Already Grouped): ${stats.skippedAlreadyGrouped}`);
  console.log(`Skipped (No Match): ${stats.skippedNoMatch}`);
  console.log(`Errors: ${stats['errorCount']}`);
  console.log('');
  console.log('Matching Methods:');
  for (const [method, count] of Object.entries(stats.matchMethodStats)) {
    if (count > 0) {
      console.log(`  ${method}: ${count}`);
    }
  }
  console.log('='.repeat(60));
}

// ============================================================
// メイン処理
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('='.repeat(60));
  console.log('Product Identity Batch Processing');
  console.log('='.repeat(60));
  console.log(`Mode: ${args.mode}`);
  console.log(`Batch Size: ${args.batchSize}`);
  console.log(`Min Confidence: ${args.minConfidence}`);
  console.log(`Dry Run: ${args.dryRun}`);
  if (args.targetAsps) {
    console.log(`Target ASPs: ${args.targetAsps.join(', ')}`);
  }
  console.log('');

  // 現在のグループ統計を表示
  const initialStats = await getGroupStats();
  console.log('Current Group Stats:');
  console.log(`  Total Groups: ${initialStats.totalGroups}`);
  console.log(`  Total Grouped Products: ${initialStats.totalGroupedProducts}`);
  console.log(`  Avg Members/Group: ${initialStats.avgMembersPerGroup.toFixed(2)}`);
  console.log('');

  // 処理対象の商品数を取得
  const totalUngrouped = await countUngroupedProducts(args.targetAsps);
  console.log(`Ungrouped Products: ${totalUngrouped}`);

  if (totalUngrouped === 0) {
    console.log('No ungrouped products to process.');
    return;
  }

  const stats = createInitialStats();
  const config = {
    ...DEFAULT_MATCHING_CONFIG,
    autoMergeThreshold: args.minConfidence,
    reviewThreshold: args.minConfidence,
  };

  let processed = 0;
  let offset = args.offset || 0;
  const limit = args.limit || (args.mode === 'full' ? totalUngrouped : 10000);

  console.log(`Processing up to ${limit} products...`);
  console.log('');

  while (processed < limit) {
    // 商品をフェッチ
    const products = args.mode === 'full'
      ? await fetchUngroupedProducts(args.batchSize, offset, args.targetAsps)
      : await fetchRecentProducts(24, args.batchSize);

    if (products.length === 0) {
      break;
    }

    // 各商品を処理
    for (const product of products) {
      try {
        if (args.dryRun) {
          // ドライラン: 実際に保存しない
          stats.processedCount++;
          if (args.verbose) {
            log(`[DRY-RUN] Would process: ${product['id']} - ${product['title'].substring(0, 50)}...`, true);
          }
        } else {
          const result = await processProductIdentity(product, config);

          stats.processedCount++;

          switch (result.action) {
            case 'created':
              stats.newGroupsCreated++;
              if (result.matchResult) {
                stats.matchMethodStats[result.matchResult.matchingMethod]++;
              }
              break;
            case 'added':
              stats.addedToExistingGroups++;
              if (result.matchResult) {
                stats.matchMethodStats[result.matchResult.matchingMethod]++;
              }
              break;
            case 'skipped':
              stats.skippedAlreadyGrouped++;
              break;
          }

          if (args.verbose && result.matchResult) {
            log(
              `${product['id']}: ${result.action} (${result.matchResult.matchingMethod}, ` +
              `confidence: ${result.matchResult.confidenceScore})`,
              true
            );
          }
        }

        processed++;
        if (processed % 100 === 0) {
          logProgress(processed, Math.min(limit, totalUngrouped), stats);
        }
      } catch (error) {
        stats['errorCount']++;
        if (args.verbose) {
          console.error(`Error processing product ${product['id']}:`, error);
        }
      }

      if (processed >= limit) {
        break;
      }
    }

    offset += products.length;

    // incrementalモードは1バッチで終了
    if (args.mode === 'incremental') {
      break;
    }
  }

  logSummary(stats);

  // 最終的なグループ統計を表示
  const finalStats = await getGroupStats();
  console.log('');
  console.log('Final Group Stats:');
  console.log(`  Total Groups: ${finalStats.totalGroups} (+${finalStats.totalGroups - initialStats.totalGroups})`);
  console.log(`  Total Grouped Products: ${finalStats.totalGroupedProducts} (+${finalStats.totalGroupedProducts - initialStats.totalGroupedProducts})`);
  console.log(`  Avg Members/Group: ${finalStats.avgMembersPerGroup.toFixed(2)}`);
}

// ============================================================
// エントリーポイント
// ============================================================

main()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
