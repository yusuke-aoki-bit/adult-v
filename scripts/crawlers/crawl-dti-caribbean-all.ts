/**
 * DTI系（カリビアン）全サイトクローラー（Cloud Run Job用ラッパー）
 *
 * 対象サイト:
 * - caribbeancom (カリビアンコム)
 * - caribbeancompr (カリビアンコムプレミアム)
 * - 1pondo (一本道)
 * - heyzo (HEYZO)
 * - 10musume (天然むすめ)
 * - pacopacomama (パコパコママ)
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-dti-caribbean-all.ts
 */

import { execSync } from 'child_process';

const DTI_CARIBBEAN_SITES = ['caribbeancom', 'caribbeancompr', '1pondo', 'heyzo', '10musume', 'pacopacomama'];

async function main() {
  console.log('=== DTI Caribbean Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Sites:', DTI_CARIBBEAN_SITES.join(', '));

  const results: { site: string; success: boolean }[] = [];

  for (const site of DTI_CARIBBEAN_SITES) {
    console.log(`\n--- ${site.toUpperCase()} ---`);
    try {
      // 各サイトを新着50ページクロール
      const command = `npx tsx packages/crawlers/src/products/crawl-caribbean.ts --site=${site} --pages=50`;
      console.log(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit', env: process.env });
      results.push({ site, success: true });
    } catch (error) {
      console.error(`${site} failed:`, error);
      results.push({ site, success: false });
    }
  }

  console.log('\n=== DTI Caribbean Sites Crawler Summary ===');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.site}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`${failures.length}/${results.length} sites failed`);
    process.exit(1);
  }

  console.log('=== DTI Caribbean Sites Crawler Completed ===');
}

main().catch(console.error);
