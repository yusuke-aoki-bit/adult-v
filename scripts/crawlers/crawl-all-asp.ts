/**
 * 全ASP統合クローラー（Cloud Run Job用）
 *
 * 並列グループ実行で高速化:
 *
 * グループ1 (API系 - 並列実行可):
 * - FANZA, MGS, DUGA, Sokmil
 *
 * グループ2 (スクレイピング系 - サブグループ並列):
 * - 2a: DTI, TMP
 * - 2b: Tokyo-Hot, B10F
 * - 2c: FC2, Japanska
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-all-asp.ts [--group=all|api|scrape] [--asp=specific-asp] [--parallel]
 */

import { spawn, execSync } from 'child_process';
import { parseArgs } from 'util';
import {
  notifyPipelineComplete,
  type CrawlerSummary,
  type CrawlPipelineSummary,
} from '../../packages/crawlers/src/lib/notifications';

interface CrawlerConfig {
  name: string;
  group: 'api' | 'scrape';
  subgroup?: number; // 並列実行グループ内のサブグループ
  command: string;
  timeout: number; // seconds
}

const CRAWLERS: CrawlerConfig[] = [
  // API系 (高速) - すべて並列実行可能
  {
    name: 'FANZA',
    group: 'api',
    subgroup: 1,
    command: 'npx tsx packages/crawlers/src/products/crawl-fanza.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'MGS',
    group: 'api',
    subgroup: 1,
    command: 'npx tsx packages/crawlers/src/products/crawl-mgs-api.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'DUGA',
    group: 'api',
    subgroup: 1,
    command: 'npx tsx packages/crawlers/src/products/crawl-duga-api-v2.ts --limit=100',
    timeout: 600,
  },
  {
    name: 'Sokmil',
    group: 'api',
    subgroup: 1,
    command: 'npx tsx packages/crawlers/src/products/crawl-sokmil-api-v2.ts --limit=100',
    timeout: 600,
  },
  // スクレイピング系 - サブグループごとに並列実行
  {
    name: 'DTI-All',
    group: 'scrape',
    subgroup: 1, // サブグループ1: DTI + TMP
    command: 'npx tsx scripts/crawlers/crawl-dti-all.ts --group=all --pages=30',
    timeout: 14400,
  },
  {
    name: 'TMP',
    group: 'scrape',
    subgroup: 1,
    command: 'npx tsx scripts/crawlers/crawl-tmp-all.ts',
    timeout: 3600,
  },
  {
    name: 'Tokyo-Hot',
    group: 'scrape',
    subgroup: 2, // サブグループ2: Tokyo-Hot + B10F
    command: 'npx tsx scripts/crawlers/crawl-tokyohot-all.ts',
    timeout: 1800,
  },
  {
    name: 'B10F',
    group: 'scrape',
    subgroup: 2,
    command: 'npx tsx packages/crawlers/src/products/crawl-b10f-csv.ts',
    timeout: 1800,
  },
  {
    name: 'FC2',
    group: 'scrape',
    subgroup: 3, // サブグループ3: FC2 + Japanska
    command: 'npx tsx packages/crawlers/src/products/crawl-fc2-video.ts --limit=100',
    timeout: 1800,
  },
  {
    name: 'Japanska',
    group: 'scrape',
    subgroup: 3,
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

/**
 * 単一クローラーを実行（Promiseを返す）
 */
function runCrawler(crawler: CrawlerConfig): Promise<CrawlResult> {
  return new Promise((resolve) => {
    const crawlStart = Date.now();
    console.log(`[${crawler.name}] Starting... (timeout: ${crawler.timeout}s)`);

    const args = crawler.command.split(' ');
    const cmd = args[0];
    const cmdArgs = args.slice(1);

    const proc = spawn(cmd, cmdArgs, {
      stdio: 'pipe',
      env: process.env,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const line = data.toString();
      stdout += line;
      // 進捗を表示（最後の行のみ）
      const lastLine = line.trim().split('\n').pop();
      if (lastLine) {
        console.log(`[${crawler.name}] ${lastLine}`);
      }
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      proc.kill('SIGTERM');
      console.error(`[${crawler.name}] Timeout after ${crawler.timeout}s`);
    }, crawler.timeout * 1000);

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - crawlStart;

      if (code === 0) {
        console.log(`[${crawler.name}] ✅ Completed in ${Math.round(duration / 1000)}s`);
        resolve({
          name: crawler.name,
          group: crawler.group,
          success: true,
          duration,
        });
      } else {
        console.error(`[${crawler.name}] ❌ Failed with code ${code}`);
        resolve({
          name: crawler.name,
          group: crawler.group,
          success: false,
          duration,
          error: stderr.slice(0, 200) || `Exit code: ${code}`,
        });
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutHandle);
      console.error(`[${crawler.name}] ❌ Error:`, error.message);
      resolve({
        name: crawler.name,
        group: crawler.group,
        success: false,
        duration: Date.now() - crawlStart,
        error: error.message.slice(0, 200),
      });
    });
  });
}

/**
 * クローラーをグループ単位で並列実行
 */
async function runCrawlersParallel(crawlers: CrawlerConfig[]): Promise<CrawlResult[]> {
  // グループとサブグループでグループ化
  const groups = new Map<string, CrawlerConfig[]>();

  for (const crawler of crawlers) {
    const key = `${crawler.group}-${crawler.subgroup || 0}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(crawler);
  }

  // API系を先に並列実行
  const apiGroups = Array.from(groups.entries()).filter(([k]) => k.startsWith('api'));
  const scrapeGroups = Array.from(groups.entries()).filter(([k]) => k.startsWith('scrape'));

  const allResults: CrawlResult[] = [];

  // API系: 全クローラーを並列実行
  if (apiGroups.length > 0) {
    console.log('\n=== Running API crawlers in parallel ===\n');
    const apiCrawlers = apiGroups.flatMap(([, c]) => c);
    const apiResults = await Promise.all(apiCrawlers.map(runCrawler));
    allResults.push(...apiResults);
  }

  // スクレイピング系: サブグループ単位で順次実行（サブグループ内は並列）
  if (scrapeGroups.length > 0) {
    console.log('\n=== Running Scrape crawlers by subgroups ===\n');

    // サブグループ番号順にソート
    const sortedScrapeGroups = scrapeGroups.sort(([a], [b]) => {
      const numA = parseInt(a.split('-')[1]) || 0;
      const numB = parseInt(b.split('-')[1]) || 0;
      return numA - numB;
    });

    for (const [groupKey, groupCrawlers] of sortedScrapeGroups) {
      console.log(`\n--- Subgroup ${groupKey}: ${groupCrawlers.map((c) => c.name).join(', ')} ---\n`);
      const groupResults = await Promise.all(groupCrawlers.map(runCrawler));
      allResults.push(...groupResults);
    }
  }

  return allResults;
}

/**
 * クローラーを順次実行（従来方式）
 */
async function runCrawlersSequential(crawlers: CrawlerConfig[]): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  for (const crawler of crawlers) {
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

  return results;
}

async function main() {
  const { values } = parseArgs({
    options: {
      group: { type: 'string', default: 'all' },
      asp: { type: 'string', default: '' },
      parallel: { type: 'boolean', default: false },
    },
  });

  const groupFilter = (values.group as string).toLowerCase();
  const aspFilter = (values.asp as string).toLowerCase();
  const useParallel = values.parallel as boolean;

  console.log('=== All ASP Crawler Pipeline Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Group:', groupFilter);
  console.log('Mode:', useParallel ? 'PARALLEL' : 'SEQUENTIAL');
  if (aspFilter) console.log('ASP:', aspFilter);

  const startTime = Date.now();

  // 対象クローラーをフィルタリング
  let targetCrawlers = CRAWLERS;

  if (aspFilter) {
    targetCrawlers = CRAWLERS.filter((c) => c.name.toLowerCase().includes(aspFilter));
  } else if (groupFilter !== 'all') {
    targetCrawlers = CRAWLERS.filter((c) => c.group === groupFilter);
  }

  if (targetCrawlers.length === 0) {
    console.error(`No crawlers found for filter: group=${groupFilter}, asp=${aspFilter}`);
    console.log('Available crawlers:', CRAWLERS.map((c) => c.name).join(', '));
    process.exit(1);
  }

  console.log(`Running ${targetCrawlers.length} crawlers...\n`);

  // 並列または順次実行
  const results = useParallel ? await runCrawlersParallel(targetCrawlers) : await runCrawlersSequential(targetCrawlers);

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== All ASP Crawler Pipeline Summary ===');
  console.log('========================================');

  // グループ別に結果を表示
  for (const group of ['api', 'scrape']) {
    const groupResults = results.filter((r) => r.group === group);
    if (groupResults.length === 0) continue;

    const successCount = groupResults.filter((r) => r.success).length;
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
  const successTotal = results.filter((r) => r.success).length;
  const failureTotal = results.filter((r) => !r.success).length;

  console.log('\n----------------------------------------');
  console.log(`Total: ${successTotal} succeeded, ${failureTotal} failed`);
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s (${Math.round(totalDuration / 60000)}min)`);
  console.log('========================================');

  // Slack通知
  const pipelineSummary: CrawlPipelineSummary = {
    pipelineName: 'All ASP Crawler Pipeline',
    startTime: new Date(startTime),
    endTime: new Date(),
    crawlers: results.map(
      (r): CrawlerSummary => ({
        name: r.name,
        success: r.success,
        duration: r.duration,
        error: r.error,
      }),
    ),
  };

  try {
    await notifyPipelineComplete(pipelineSummary);
    console.log('Slack notification sent');
  } catch (notifyError) {
    console.warn('Failed to send Slack notification:', notifyError);
  }

  if (failureTotal > 0) {
    console.error(`\n${failureTotal} crawlers failed`);
    process.exit(1);
  }

  console.log('\n=== All ASP Crawler Pipeline Completed ===');
}

main().catch(console.error);
