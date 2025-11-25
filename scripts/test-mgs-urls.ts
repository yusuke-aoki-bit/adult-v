/**
 * MGS商品URLのアクセス可能性をテストするスクリプト
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

interface TestResult {
  originalProductId: string;
  url: string;
  statusCode: number;
  hasImages: boolean;
  errorMessage?: string;
}

async function testMgsUrls() {
  const db = getDb();

  console.log('🔍 Testing MGS Product URLs...\n');

  // 各パターンから5件ずつサンプルを取得
  const patterns = ['SIRO', '300M', 'ABP-', 'STAR', '259L', 'CAWD', '300N', 'ABW-', 'MFCS'];
  const results: TestResult[] = [];

  for (const pattern of patterns) {
    console.log(`\n📋 Testing pattern: ${pattern}%`);

    const samples = await db.execute(sql`
      SELECT original_product_id
      FROM product_sources
      WHERE asp_name = 'MGS'
      AND original_product_id LIKE ${pattern + '%'}
      LIMIT 5
    `);

    for (const sample of samples.rows) {
      const productId = (sample as any).original_product_id;
      const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        const hasImages = response.ok;
        results.push({
          originalProductId: productId,
          url,
          statusCode: response.status,
          hasImages,
        });

        console.log(`  ${hasImages ? '✅' : '❌'} ${productId}: ${response.status}`);

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          originalProductId: productId,
          url,
          statusCode: 0,
          hasImages: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
        console.log(`  ❌ ${productId}: ERROR - ${error}`);
      }
    }
  }

  // 結果のサマリー
  console.log('\n\n=== Summary ===\n');
  const successCount = results.filter(r => r.hasImages).length;
  const failCount = results.filter(r => !r.hasImages).length;

  console.log(`Total tested: ${results.length}`);
  console.log(`Success (200): ${successCount}`);
  console.log(`Failed: ${failCount}`);

  // 成功したパターンを抽出
  const successfulPatterns = new Set<string>();
  results.filter(r => r.hasImages).forEach(r => {
    const prefix = r.originalProductId.substring(0, 4);
    successfulPatterns.add(prefix);
  });

  console.log('\n✅ Successful patterns:');
  if (successfulPatterns.size > 0) {
    successfulPatterns.forEach(p => console.log(`  - ${p}`));
  } else {
    console.log('  None');
  }

  // 画像がある商品のパターンもチェック
  console.log('\n\n=== Testing product WITH image (300MIUM-1150) ===\n');
  const testUrl = 'https://www.mgstage.com/product/product_detail/300MIUM-1150/';
  try {
    const response = await fetch(testUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    console.log(`Status: ${response.status}`);
    console.log(`OK: ${response.ok}`);
  } catch (error) {
    console.log(`Error: ${error}`);
  }

  // 詳細結果をJSON出力
  console.log('\n\n=== Detailed Results ===\n');
  console.log(JSON.stringify(results, null, 2));
}

testMgsUrls()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
