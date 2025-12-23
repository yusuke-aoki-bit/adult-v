/**
 * Tokyo-Hot系全サイトクローラー（Cloud Run Job用ラッパー）
 *
 * 対象サイト:
 * - Tokyo-Hot
 * - TVDEAV
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-tokyohot-all.ts
 */

import { execSync } from 'child_process';

const TOKYOHOT_SITES = ['tokyo-hot', 'tvdeav'];

async function main() {
  console.log('=== Tokyo-Hot Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Sites:', TOKYOHOT_SITES.join(', '));

  const results: { site: string; success: boolean }[] = [];

  for (const site of TOKYOHOT_SITES) {
    console.log(`\n--- ${site.toUpperCase()} ---`);
    try {
      // 各サイトを新着50ページクロール
      const command = `npx tsx packages/crawlers/src/products/crawl-tokyohot.ts --site=${site} --pages=50`;
      console.log(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit', env: process.env });
      results.push({ site, success: true });
    } catch (error) {
      console.error(`${site} failed:`, error);
      results.push({ site, success: false });
    }
  }

  console.log('\n=== Tokyo-Hot Sites Crawler Summary ===');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.site}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`${failures.length}/${results.length} sites failed`);
    process.exit(1);
  }

  console.log('=== Tokyo-Hot Sites Crawler Completed ===');
}

main().catch(console.error);
