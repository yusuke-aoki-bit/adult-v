/**
 * DTI系（人妻）全サイトクローラー（Cloud Run Job用ラッパー）
 *
 * 対象サイト:
 * - h4610 (エッチな4610)
 * - h0930 (エッチな0930)
 * - c0930 (人妻斬り)
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-dti-hitozuma-all.ts
 */

import { execSync } from 'child_process';

const DTI_HITOZUMA_SITES = ['h4610', 'h0930', 'c0930'];

async function main() {
  console.log('=== DTI Hitozuma Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Sites:', DTI_HITOZUMA_SITES.join(', '));

  const results: { site: string; success: boolean }[] = [];

  for (const site of DTI_HITOZUMA_SITES) {
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

  console.log('\n=== DTI Hitozuma Sites Crawler Summary ===');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.site}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`${failures.length}/${results.length} sites failed`);
    process.exit(1);
  }

  console.log('=== DTI Hitozuma Sites Crawler Completed ===');
}

main().catch(console.error);
