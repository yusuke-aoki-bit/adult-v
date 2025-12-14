import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.mgstage.com';

// カテゴリ検索から全商品IDを取得（84ページ分）
async function getCategoryProducts(): Promise<Set<string>> {
  const products = new Set<string>();

  console.log('カテゴリ検索から商品ID取得中...');

  for (let page = 1; page <= 84; page++) {
    const url = `${BASE_URL}/search/cSearch.php?sort=new&list_cnt=120&type=haishin&page=${page}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    $('a[href*="/product/product_detail/"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const match = href.match(/product_detail\/([^\/]+)/);
        if (match) {
          products.add(match[1]);
        }
      }
    });

    if (page % 10 === 0) {
      console.log(`  Page ${page}/84: 累計 ${products.size}件`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return products;
}

async function main() {
  console.log('=== MGS カテゴリ非表示商品の特定 ===\n');

  // DBからMGS動画配信の商品IDを取得
  const dbProducts = await db.execute(sql`
    SELECT ps.original_product_id
    FROM product_sources ps
    WHERE ps.asp_name = 'MGS' AND ps.product_type = 'haishin'
  `);

  const dbProductIds = new Set(dbProducts.rows.map(r => r.original_product_id as string));
  console.log(`DB上の動画配信商品数: ${dbProductIds.size}`);

  // カテゴリ検索から商品を取得
  const categoryProducts = await getCategoryProducts();
  console.log(`\nカテゴリ検索の商品数: ${categoryProducts.size}`);

  // DBにあってカテゴリ検索にない商品を特定
  const extraProducts: string[] = [];
  for (const productId of dbProductIds) {
    if (!categoryProducts.has(productId)) {
      extraProducts.push(productId);
    }
  }

  console.log(`\n=== カテゴリ非表示商品 ===`);
  console.log(`件数: ${extraProducts.length}`);

  // 最初の10件を表示
  console.log(`\nサンプル（最初の10件）:`);
  for (let i = 0; i < Math.min(10, extraProducts.length); i++) {
    const productId = extraProducts[i];
    console.log(`  ${i + 1}. ${productId}`);
    console.log(`     URL: https://www.mgstage.com/product/product_detail/${productId}/`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
