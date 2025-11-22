/**
 * MGS商品IDリストから一括でアフィリエイトリンクを収集
 *
 * 商品IDリストをファイルまたはコマンドライン引数で指定して実行
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

interface BulkCrawlOptions {
  batchSize?: number;
  delay?: number; // バッチ間の待機時間(ms)
}

/**
 * 商品IDからURLを生成
 */
function generateProductUrl(productId: string): string {
  return `https://www.mgstage.com/product/product_detail/${productId}/`;
}

/**
 * URLリストをバッチ処理
 */
async function processBatch(urls: string[], batchSize: number = 10, delay: number = 3000): Promise<void> {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`\n=== Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(urls.length / batchSize)} (${batch.length} products) ===`);

    // crawl-mgs.tsスクリプトを実行
    try {
      const command = `npx tsx scripts/crawl-mgs.ts ${batch.join(' ')}`;
      execSync(command, { stdio: 'inherit', env: process.env });
    } catch (error) {
      console.error('Batch processing error:', error);
    }

    // バッチ間の待機
    if (i + batchSize < urls.length) {
      console.log(`Waiting ${delay}ms before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * ファイルから商品IDを読み込み
 */
function loadProductIdsFromFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')); // 空行とコメント行を除外
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/crawl-mgs-bulk.ts <product-ids> [options]');
    console.log('       npx tsx scripts/crawl-mgs-bulk.ts --file <file-path> [options]');
    console.log('\nExamples:');
    console.log('  # From command line arguments:');
    console.log('  npx tsx scripts/crawl-mgs-bulk.ts 300MIUM-1135 300MIUM-1136 300MIUM-1137');
    console.log('');
    console.log('  # From file (one product ID per line):');
    console.log('  npx tsx scripts/crawl-mgs-bulk.ts --file product-ids.txt');
    console.log('');
    console.log('Options:');
    console.log('  --batch <n>      Batch size for processing (default: 10)');
    console.log('  --delay <ms>     Delay between batches in milliseconds (default: 3000)');
    console.log('');
    console.log('File format (product-ids.txt):');
    console.log('  300MIUM-1135');
    console.log('  300MIUM-1136');
    console.log('  # This is a comment');
    console.log('  300MIUM-1137');
    process.exit(1);
  }

  let productIds: string[] = [];
  const batchSize = parseInt(args.find((arg, i) => args[i - 1] === '--batch') || '10');
  const delay = parseInt(args.find((arg, i) => args[i - 1] === '--delay') || '3000');

  // ファイルから読み込むか、コマンドライン引数から取得
  if (args[0] === '--file') {
    const filePath = args[1];
    if (!filePath) {
      console.error('Error: File path not specified');
      process.exit(1);
    }
    productIds = loadProductIdsFromFile(filePath);
  } else {
    // コマンドライン引数から取得（オプションを除外）
    productIds = args.filter((arg) => !arg.startsWith('--') && !['--batch', '--delay'].includes(args[args.indexOf(arg) - 1]));
  }

  if (productIds.length === 0) {
    console.error('Error: No product IDs provided');
    process.exit(1);
  }

  console.log('MGS Bulk Crawler Configuration:');
  console.log(`  Product IDs: ${productIds.length}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log(`  Delay: ${delay}ms`);
  console.log('');

  // URLに変換
  const productUrls = productIds.map(generateProductUrl);

  console.log('Sample product URLs:');
  productUrls.slice(0, 5).forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  if (productUrls.length > 5) {
    console.log(`  ... and ${productUrls.length - 5} more`);
  }
  console.log('');

  // 処理開始
  console.log('Processing products...\n');
  await processBatch(productUrls, batchSize, delay);

  console.log('\n=== All done! ===');
}

main().catch(console.error);
