/**
 * 全ASP統合クローラー（Cloud Run Job用）
 *
 * すべてのASPクローラーを順次実行:
 *
 * グループ1 (API系 - 高速):
 * - FANZA (fanza-daily)
 * - MGS (mgs-daily)
 * - DUGA (crawl-duga)
 * - Sokmil (crawl-sokmil)
 *
 * グループ2 (スクレイピング系):
 * - DTI全サイト (crawl-dti-all)
 * - TMP (crawl-tmp)
 * - Tokyo-Hot (crawl-tokyohot)
 * - B10F (crawl-b10f)
 * - FC2 (crawl-fc2)
 * - Japanska (crawl-japanska)
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-all-asp.ts [--group=all|api|scrape] [--asp=specific-asp]
 */

import { execSync } from 'child_process';
import { parseArgs } from 'util';

interface CrawlerConfig {
  name: string;
  group: 'api' | 'scrape';
  command: string;
  timeout: number; // seconds
}

const CRAWLERS: CrawlerConfig[] = [
  // API系 (高速)
  {
    name: 'FANZA',
    group: 'api',
    command: 'npx tsx packages/crawlers/src/products/crawl-fanza.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'MGS',
    group: 'api',
    command: 'npx tsx packages/crawlers/src/products/crawl-mgs-api.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'DUGA',
    group: 'api',
    command: 'npx tsx packages/crawlers/src/products/crawl-duga-api-v2.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'Sokmil',
    group: 'api',
    command: 'npx tsx packages/crawlers/src/products/crawl-sokmil-api-v2.ts --limit=100',
    timeout: 600,
  },
  // スクレイピング系
  {
    name: 'DTI-All',
    group: 'scrape',
    command: 'npx tsx scripts/crawlers/crawl-dti-all.ts --group=all --pages=30',
    timeout: 14400,
  },
  {
    name: 'TMP',
    group: 'scrape',
    command: 'npx tsx scripts/crawlers/crawl-tmp-all.ts',
    timeout: 3600,
  },
  {
    name: 'Tokyo-Hot',
    group: 'scrape',
    command: 'npx tsx scripts/crawlers/crawl-tokyohot-all.ts',
    timeout: 1800,
  },
  {
    name: 'B10F',
    group: 'scrape',
    command: 'npx tsx packages/crawlers/src/products/crawl-b10f-csv.ts',
    timeout: 1800,
  },
  {
    name: 'FC2',
    group: 'scrape',
    command: 'npx tsx packages/crawlers/src/products/crawl-fc2-video.ts --limit=100',
    timeout: 1800,
  },
  {
    name: 'Japanska',
    group: 'scrape',
    command: 'npx tsx packages/crawlers/src/products/crawl-japanska.ts --limit=100',
    timeout: 1800,
  },
];

interface CrawlResult {
  name: string;
  group: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function main() {
  const { values } = parseArgs({
    options: {
      group: { type: 'string', default: 'all' },
      asp: { type: 'string', default: '' },
    },
  });

  const groupFilter = (values.group as string).toLowerCase();
  const aspFilter = (values.asp as string).toLowerCase();

  console.log('=== All ASP Crawler Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Group:', groupFilter);
  if (aspFilter) console.log('ASP:', aspFilter);

  const results: CrawlResult[] = [];
  const startTime = Date.now();

  // 対象クローラーをフィルタリング
  let targetCrawlers = CRAWLERS;

  if (aspFilter) {
    targetCrawlers = CRAWLERS.filter(c => c.name.toLowerCase().includes(aspFilter));
  } else if (groupFilter !== 'all') {
    targetCrawlers = CRAWLERS.filter(c => c.group === groupFilter);
  }

  if (targetCrawlers.length === 0) {
    console.error(`No crawlers found for filter: group=${groupFilter}, asp=${aspFilter}`);
    console.log('Available crawlers:', CRAWLERS.map(c => c.name).join(', '));
    process.exit(1);
  }

  console.log(`Running ${targetCrawlers.length} crawlers...\n`);

  for (const crawler of targetCrawlers) {
    const crawlStart = Date.now();
    console.log(`\n========== ${crawler.name} (${crawler.group}) ==========`);

    try {
      console.log(`Command: ${crawler.command}`);
      console.log(`Timeout: ${crawler.timeout}s`);

      execSync(crawler.command, {
        stdio: 'inherit',
        env: process.env,
        timeout: crawler.timeout * 1000,
      });

      results.push({
        name: crawler.name,
        group: crawler.group,
        success: true,
        duration: Date.now() - crawlStart,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${crawler.name} failed:`, errorMessage);

      results.push({
        name: crawler.name,
        group: crawler.group,
        success: false,
        duration: Date.now() - crawlStart,
        error: errorMessage.slice(0, 200),
      });
    }
  }

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== All ASP Crawler Pipeline Summary ===');
  console.log('========================================');

  // グループ別に結果を表示
  for (const group of ['api', 'scrape']) {
    const groupResults = results.filter(r => r.group === group);
    if (groupResults.length === 0) continue;

    const successCount = groupResults.filter(r => r.success).length;
    console.log(`\n${group.toUpperCase()} (${successCount}/${groupResults.length}):`);

    for (const r of groupResults) {
      const status = r.success ? '✅' : '❌';
      const duration = Math.round(r.duration / 1000);
      console.log(`  ${status} ${r.name} (${duration}s)`);
      if (r.error) {
        console.log(`     Error: ${r.error.slice(0, 100)}`);
      }
    }
  }

  // 全体統計
  const successTotal = results.filter(r => r.success).length;
  const failureTotal = results.filter(r => !r.success).length;

  console.log('\n----------------------------------------');
  console.log(`Total: ${successTotal} succeeded, ${failureTotal} failed`);
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / 60000)}min)`);
  console.log('========================================');

  if (failureTotal > 0) {
    console.error(`\n${failureTotal} crawlers failed`);
    process.exit(1);
  }

  console.log('\n=== All ASP Crawler Pipeline Completed ===');
}

main().catch(console.error);
