/**
 * MGS商品一覧ページから商品URLを抽出し、各商品をクロールするスクリプト
 */

import * as cheerio from 'cheerio';
import { execSync } from 'child_process';

interface CrawlOptions {
  maxPages?: number;
  startPage?: number;
  delay?: number; // ページ間の待機時間(ms)
}

/**
 * MGS商品一覧ページから商品URLを抽出
 */
async function extractProductUrls(listUrl: string): Promise<string[]> {
  try {
    console.log(`Fetching list page: ${listUrl}`);

    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const urls: string[] = [];

    // 商品リンクを抽出（MGSの商品一覧ページの構造に合わせて調整が必要）
    // 例: <a href="/product/product_detail/857OMG-018/">
    $('a[href*="/product/product_detail/"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = `https://www.mgstage.com${href}`;
        }
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    });

    console.log(`Found ${urls.length} product URLs`);
    return urls;
  } catch (error) {
    console.error('Error extracting product URLs:', error);
    return [];
  }
}

/**
 * 複数ページから商品URLを収集
 */
async function crawlMultiplePages(
  baseUrl: string,
  options: CrawlOptions = {},
): Promise<string[]> {
  const { maxPages = 5, startPage = 1, delay = 2000 } = options;
  const allUrls: string[] = [];

  for (let page = startPage; page < startPage + maxPages; page++) {
    // URLにすでにクエリパラメータがある場合は&を使用
    const separator = baseUrl.includes('?') ? '&' : '?';
    const pageUrl = `${baseUrl}${separator}page=${page}`;
    console.log(`\n--- Page ${page} ---`);

    const urls = await extractProductUrls(pageUrl);
    allUrls.push(...urls);

    if (urls.length === 0) {
      console.log('No more products found. Stopping.');
      break;
    }

    // レート制限対策
    if (page < startPage + maxPages - 1) {
      console.log(`Waiting ${delay}ms before next page...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 重複を除去
  return Array.from(new Set(allUrls));
}

/**
 * 商品URLリストをバッチ処理
 */
async function processBatch(urls: string[], batchSize: number = 10): Promise<void> {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    console.log(`\n=== Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} products) ===`);

    // crawl-mgs.tsスクリプトを実行
    try {
      const command = `npx tsx scripts/crawl-mgs.ts ${batch.join(' ')}`;
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error('Batch processing error:', error);
    }

    // バッチ間の待機
    if (i + batchSize < urls.length) {
      console.log('Waiting 3 seconds before next batch...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/crawl-mgs-list.ts <list-url> [options]');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/crawl-mgs-list.ts https://www.mgstage.com/product/product_list.php');
    console.log('  npx tsx scripts/crawl-mgs-list.ts https://www.mgstage.com/product/product_list.php --pages 10');
    console.log('\nOptions:');
    console.log('  --pages <n>      Maximum number of pages to crawl (default: 5)');
    console.log('  --start <n>      Starting page number (default: 1)');
    console.log('  --batch <n>      Batch size for processing (default: 10)');
    process.exit(1);
  }

  const listUrl = args[0];
  const maxPages = parseInt(args.find((arg, i) => args[i - 1] === '--pages') || '5');
  const startPage = parseInt(args.find((arg, i) => args[i - 1] === '--start') || '1');
  const batchSize = parseInt(args.find((arg, i) => args[i - 1] === '--batch') || '10');

  console.log('MGS List Crawler Configuration:');
  console.log(`  List URL: ${listUrl}`);
  console.log(`  Max Pages: ${maxPages}`);
  console.log(`  Start Page: ${startPage}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log('');

  // 商品URLを収集
  console.log('Step 1: Collecting product URLs...\n');
  const productUrls = await crawlMultiplePages(listUrl, {
    maxPages,
    startPage,
  });

  console.log(`\nTotal unique products found: ${productUrls.length}`);

  if (productUrls.length === 0) {
    console.log('No products to process. Exiting.');
    return;
  }

  // 確認
  console.log('\nSample URLs:');
  productUrls.slice(0, 5).forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  if (productUrls.length > 5) {
    console.log(`  ... and ${productUrls.length - 5} more`);
  }

  // 処理開始
  console.log('\nStep 2: Processing products...\n');
  await processBatch(productUrls, batchSize);

  console.log('\n=== All done! ===');
}

main().catch(console.error);
