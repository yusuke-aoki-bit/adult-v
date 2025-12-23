/**
 * 新DTI系全サイトクローラー（Cloud Run Job用ラッパー）
 *
 * 対象サイト:
 * - kin8tengoku (金髪天國)
 * - nyoshin (女体のしんぴ)
 * - h0230 (エッチな0230)
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-dti-new-all.ts
 */

import { execSync } from 'child_process';

const DTI_NEW_SITES = ['kin8tengoku', 'nyoshin', 'h0230'];

async function main() {
  console.log('=== New DTI Sites Crawler Starting ===');
  console.log('Time:', new Date().toISOString());
  console.log('Sites:', DTI_NEW_SITES.join(', '));

  const results: { site: string; success: boolean }[] = [];

  for (const site of DTI_NEW_SITES) {
    console.log(`\n--- ${site.toUpperCase()} ---`);
    try {
      // 各サイトを新着50ページクロール (crawl-caribbean.tsを使用)
      const command = `npx tsx packages/crawlers/src/products/crawl-caribbean.ts --site=${site} --pages=50`;
      console.log(`Executing: ${command}`);
      execSync(command, { stdio: 'inherit', env: process.env });
      results.push({ site, success: true });
    } catch (error) {
      console.error(`${site} failed:`, error);
      results.push({ site, success: false });
    }
  }

  console.log('\n=== New DTI Sites Crawler Summary ===');
  for (const r of results) {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.site}`);
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error(`${failures.length}/${results.length} sites failed`);
    process.exit(1);
  }

  console.log('=== New DTI Sites Crawler Completed ===');
}

main().catch(console.error);
