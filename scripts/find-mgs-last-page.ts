import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.mgstage.com';

async function getProductCount(page: number): Promise<{ count: number; products: string[] }> {
  const url = `${BASE_URL}/search/cSearch.php?sort=new&list_cnt=120&type=haishin&page=${page}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  const html = await response.text();
  const $ = cheerio.load(html);

  const products: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const match = href.match(/product_detail\/([^\/]+)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        products.push(match[1]);
      }
    }
  });

  return { count: products.length, products };
}

async function main() {
  console.log('=== MGS 動画配信 最終ページ探索 ===\n');

  // バイナリサーチで最終ページを探す
  let low = 1;
  let high = 2000; // 最大推定ページ数
  let lastValidPage = 1;
  let lastValidProducts: string[] = [];

  // まず high が有効かチェック
  const highResult = await getProductCount(high);
  console.log(`Page ${high}: ${highResult.count}件`);

  if (highResult.count > 0) {
    // high でも商品がある場合は上限を上げる
    high = 5000;
    const newHighResult = await getProductCount(high);
    console.log(`Page ${high}: ${newHighResult.count}件`);

    if (newHighResult.count > 0) {
      high = 10000;
    }
  }

  // 連続するページで同じ商品が返されるか確認
  console.log('\n=== 連続ページの内容比較 ===');

  const page1 = await getProductCount(1);
  const page2 = await getProductCount(2);
  const page84 = await getProductCount(84);
  const page85 = await getProductCount(85);
  const page100 = await getProductCount(100);
  const page1000 = await getProductCount(1000);

  console.log(`Page 1: ${page1.count}件 - 先頭: ${page1.products[0]}`);
  console.log(`Page 2: ${page2.count}件 - 先頭: ${page2.products[0]}`);
  console.log(`Page 84: ${page84.count}件 - 先頭: ${page84.products[0]}`);
  console.log(`Page 85: ${page85.count}件 - 先頭: ${page85.products[0]}`);
  console.log(`Page 100: ${page100.count}件 - 先頭: ${page100.products[0]}`);
  console.log(`Page 1000: ${page1000.count}件 - 先頭: ${page1000.products[0]}`);

  // ページ84と85の商品が同じかチェック
  const overlap84_85 = page84.products.filter(p => page85.products.includes(p));
  console.log(`\nPage 84-85 重複: ${overlap84_85.length}件`);

  const overlap85_100 = page85.products.filter(p => page100.products.includes(p));
  console.log(`Page 85-100 重複: ${overlap85_100.length}件`);

  const overlap100_1000 = page100.products.filter(p => page1000.products.includes(p));
  console.log(`Page 100-1000 重複: ${overlap100_1000.length}件`);

  // 実際の総件数を計算
  console.log('\n=== 総件数推定 ===');

  // ユニークな商品を集める（最初の100ページ）
  const allProducts = new Set<string>();
  let emptyPages = 0;
  let lastNonEmptyPage = 0;

  for (let page = 1; page <= 100; page++) {
    const result = await getProductCount(page);
    const newProducts = result.products.filter(p => !allProducts.has(p));

    if (newProducts.length === 0) {
      emptyPages++;
      if (emptyPages >= 3) {
        console.log(`Page ${page}: 新規商品0件 (連続${emptyPages}回) - 終了と判断`);
        break;
      }
    } else {
      emptyPages = 0;
      lastNonEmptyPage = page;
      newProducts.forEach(p => allProducts.add(p));
    }

    if (page % 10 === 0) {
      console.log(`Page ${page}: 累計 ${allProducts.size}件 (このページ新規: ${newProducts.length}件)`);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`\n最終有効ページ: ${lastNonEmptyPage}`);
  console.log(`ユニーク商品数: ${allProducts.size}`);
  console.log(`推定総件数: ${lastNonEmptyPage * 120} (${lastNonEmptyPage}ページ × 120件)`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
