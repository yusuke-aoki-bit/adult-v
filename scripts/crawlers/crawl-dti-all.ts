/**
 * DTI系全サイト統合クローラー（Cloud Run Job用）
 *
 * すべてのDTI系サイトを順次クロール:
 *
 * Caribbean Group (カリビアン系):
 * - caribbeancom (カリビアンコム)
 * - caribbeancompr (カリビアンコムプレミアム)
 * - 1pondo (一本道)
 * - heyzo (HEYZO)
 * - 10musume (天然むすめ)
 * - pacopacomama (パコパコママ)
 *
 * Hitozuma Group (人妻系):
 * - h4610 (エッチな4610)
 * - h0930 (エッチな0930)
 * - c0930 (人妻斬り)
 *
 * New Group (新規):
 * - kin8tengoku (金髪天國)
 * - nyoshin (女体のしんぴ)
 * - h0230 (エッチな0230)
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-dti-all.ts [--group=all|caribbean|hitozuma|new] [--pages=50]
 */

import { execSync } from 'child_process';
import { parseArgs } from 'util';

const DTI_GROUPS = {
  caribbean: [
    'caribbeancom',
    'caribbeancompr',
    '1pondo',
    'heyzo',
    '10musume',
    'pacopacomama',
  ],
  hitozuma: ['h4610', 'h0930', 'c0930'],
  new: ['kin8tengoku', 'nyoshin', 'h0230'],
};

interface CrawlResult {
  group: string;
  site: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function main() {
  const { values } = parseArgs({
    options: {
      group: { type: 'string', default: 'all' },
      pages: { type: 'string', default: '50' },
    },
  });

  const groupFilter = values.group as string;
  const pages = parseInt(values.pages as string, 10);

  console.log('=== DTI All Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Group:', groupFilter);
  console.log('Pages per site:', pages);

  const results: CrawlResult[] = [];
  const startTime = Date.now();

  // 対象グループを決定
  const targetGroups = groupFilter === 'all'
    ? Object.keys(DTI_GROUPS) as (keyof typeof DTI_GROUPS)[]
    : [groupFilter as keyof typeof DTI_GROUPS];

  for (const group of targetGroups) {
    const sites = DTI_GROUPS[group];
    if (!sites) {
      console.error(`Unknown group: ${group}`);
      continue;
    }

    console.log(`\n========== ${group.toUpperCase()} GROUP ==========`);

    for (const site of sites) {
      const siteStart = Date.now();
      console.log(`\n--- ${site.toUpperCase()} ---`);

      try {
        const command = `npx tsx packages/crawlers/src/products/crawl-caribbean.ts --site=${site} --pages=${pages}`;
        console.log(`Executing: ${command}`);
        execSync(command, { stdio: 'inherit', env: process.env });

        results.push({
          group,
          site,
          success: true,
          duration: Date.now() - siteStart,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`${site} failed:`, errorMessage);

        results.push({
          group,
          site,
          success: false,
          duration: Date.now() - siteStart,
          error: errorMessage,
        });
      }
    }
  }

  // サマリー出力
  const totalDuration = Date.now() - startTime;
  console.log('\n========================================');
  console.log('=== DTI All Sites Crawler Summary ===');
  console.log('========================================');

  // グループ別に結果を表示
  for (const group of targetGroups) {
    const groupResults = results.filter(r => r.group === group);
    const successCount = groupResults.filter(r => r.success).length;
    console.log(`\n${group.toUpperCase()} (${successCount}/${groupResults.length}):`);

    for (const r of groupResults) {
      const status = r.success ? '✅' : '❌';
      const duration = Math.round(r.duration / 1000);
      console.log(`  ${status} ${r.site} (${duration}s)`);
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
    console.error(`\n${failureTotal} sites failed`);
    process.exit(1);
  }

  console.log('\n=== DTI All Sites Crawler Completed ===');
}

main().catch(console.error);
