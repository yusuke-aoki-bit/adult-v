/**
 * TMP系全サイトクローラー（Cloud Run Job用ラッパー）
 *
 * 対象サイト:
 * - HEYDOUGA
 * - X1X
 * - ENKOU55
 * - UREKKO
 * - XXXURABI
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-tmp-all.ts
 */

import { execSync } from 'child_process';

const TMP_SITES = ['heydouga', 'x1x', 'enkou55', 'urekko', 'xxxurabi'];

async function main() {
  console.log('=== TMP Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Sites:', TMP_SITES.join(', '));

  const results: { site: string; success: boolean }[] = [];

  for (const site of TMP_SITES) {
    console.log(`\n--- ${site.toUpperCase()} ---`);
    try {
      // 各サイトを新着50ページクロール
      const command = `npx tsx packages/crawlers/src/products/crawl-tmp.ts --site=${site} --pages=50`;
      console.log(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit', env: process.env });
      results.push({ site, success: true });
    } catch (error) {
      console.error(`${site} failed:`, error);
      results.push({ site, success: false });
    }
  }

  console.log('\n=== TMP Sites Crawler Summary ===');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.site}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`${failures.length}/${results.length} sites failed`);
    process.exit(1);
  }

  console.log('=== TMP Sites Crawler Completed ===');
}

main().catch(console.error);
