/**
 * FANZA継続クロールスクリプト
 * 新商品がなくなるまで繰り返し実行
 */

import { execSync } from 'child_process';
import { getDb } from '../packages/crawlers/src/lib/db/index.js';
import { sql } from 'drizzle-orm';

const db = getDb();

async function getProductCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FANZA'
  `);
  return Number(result.rows[0]?.count || 0);
}

async function main() {
  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 100;
  const pagesArg = args.find(a => a.startsWith('--pages='));
  const pages = pagesArg ? parseInt(pagesArg.split('=')[1], 10) : 10;
  const maxBatches = 200; // 安全のため最大バッチ数を制限

  console.log('=== FANZA継続クロールスクリプト ===\n');
  console.log(`1バッチあたりページ数: ${pages}`);
  console.log(`1バッチあたり上限商品数: ${batchSize}`);
  console.log(`最大バッチ数: ${maxBatches}\n`);

  let batchNumber = 0;
  let totalNewProducts = 0;
  let consecutiveZero = 0;
  let currentStartPage = 1;

  while (batchNumber < maxBatches) {
    batchNumber++;
    console.log(`\n===== バッチ ${batchNumber} 開始 (ページ ${currentStartPage}～${currentStartPage + pages - 1}) =====`);

    const beforeCount = await getProductCount();
    console.log(`現在の商品数: ${beforeCount}`);

    try {
      const command = `npx tsx packages/crawlers/src/products/crawl-fanza.ts --pages=${pages} --start-page=${currentStartPage} --limit=${batchSize} --no-ai`;
      console.log(`実行: ${command}\n`);
      execSync(command, { stdio: 'inherit', env: process.env });
    } catch (error) {
      console.error('クロールエラー:', error);
      // FANZAはPuppeteerエラーが出やすいので継続
      console.log('エラー後も続行...');
    }

    const afterCount = await getProductCount();
    const newProducts = afterCount - beforeCount;
    totalNewProducts += newProducts;

    console.log(`\n--- バッチ ${batchNumber} 結果 ---`);
    console.log(`新規商品: ${newProducts}`);
    console.log(`累計新規: ${totalNewProducts}`);

    if (newProducts === 0) {
      consecutiveZero++;
      console.log(`連続0回: ${consecutiveZero}`);
      if (consecutiveZero >= 5) {
        console.log('\n✅ 5回連続で新規商品なし。クロール完了！');
        break;
      }
    } else {
      consecutiveZero = 0;
    }

    currentStartPage += pages;

    // 短い待機（レート制限）
    console.log('10秒待機...');
    await new Promise(r => setTimeout(r, 10000));
  }

  console.log('\n=== 最終結果 ===');
  console.log(`総バッチ数: ${batchNumber}`);
  console.log(`総ページ数: ${currentStartPage - 1}`);
  console.log(`総新規商品数: ${totalNewProducts}`);
}

main()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });
