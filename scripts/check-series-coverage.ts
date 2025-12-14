import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // EDD, MANシリーズの取得状況を確認
  const eddProducts = await db.execute(sql`
    SELECT original_product_id
    FROM product_sources
    WHERE asp_name = 'MGS'
    AND original_product_id LIKE 'EDD-%'
    ORDER BY original_product_id
  `);

  const manProducts = await db.execute(sql`
    SELECT original_product_id
    FROM product_sources
    WHERE asp_name = 'MGS'
    AND original_product_id LIKE 'MAN-%'
    ORDER BY original_product_id
  `);

  console.log('=== EDDシリーズ ===');
  console.log('取得数:', eddProducts.rows.length);
  console.log('最初の10件:', eddProducts.rows.slice(0, 10).map(r => r.original_product_id).join(', '));

  // EDD-001〜010があるか
  for (let i = 1; i <= 10; i++) {
    const id = `EDD-${String(i).padStart(3, '0')}`;
    const has = eddProducts.rows.some(r => r.original_product_id === id);
    console.log(`  ${id}: ${has ? '✅' : '❌'}`);
  }

  console.log();
  console.log('=== MANシリーズ ===');
  console.log('取得数:', manProducts.rows.length);
  console.log('最初の10件:', manProducts.rows.slice(0, 10).map(r => r.original_product_id).join(', '));

  // MAN-001〜010があるか
  for (let i = 1; i <= 10; i++) {
    const id = `MAN-${String(i).padStart(3, '0')}`;
    const has = manProducts.rows.some(r => r.original_product_id === id);
    console.log(`  ${id}: ${has ? '✅' : '❌'}`);
  }

  // サイトでEDD-001, MAN-001が存在するか確認
  console.log('\n=== サイト確認 ===');

  const checkUrls = ['EDD-001', 'MAN-001', 'EDD-002', 'MAN-002'];
  for (const productId of checkUrls) {
    const url = `https://www.mgstage.com/product/product_detail/${productId}/`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Cookie': 'adc=1',
        },
      });

      const html = await response.text();
      const exists = !html.includes('お探しのページは見つかりませんでした') &&
                     !html.includes('ページが見つかりません') &&
                     html.includes('product_detail');

      const titleMatch = html.match(/<h1[^>]*class="tag"[^>]*>([^<]+)<\/h1>/);
      const title = titleMatch ? titleMatch[1].trim().slice(0, 40) : '(不明)';

      console.log(`${productId}: ${exists ? '✅ 存在' : '❌ なし'} - ${title}`);
    } catch (e) {
      console.log(`${productId}: ⚠️ エラー`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
