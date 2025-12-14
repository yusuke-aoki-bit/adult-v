/**
 * MGS動画の総商品数を確認するスクリプト
 */

import puppeteer from 'puppeteer';

async function main() {
  console.log('=== MGS動画 総商品数チェック ===\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // 年齢確認クッキーを設定
  await page.setCookie({
    name: 'adc',
    value: '1',
    domain: '.mgstage.com'
  });

  const url = 'https://www.mgstage.com/search/cSearch.php?search_word=&sort=new&list_cnt=100&page=1';
  console.log('Fetching:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  const html = await page.content();

  // 総件数を探す - 複数パターン
  // パターン1: "全10,033件"
  let totalMatch = html.match(/全([0-9,]+)件/);

  // パターン2: "10,033件中"
  if (!totalMatch) {
    totalMatch = html.match(/([0-9,]+)件中/);
  }

  // ページネーションから推測
  const lastPageMatch = html.match(/page=(\d+)[^>]*>[^<]*(?:最後|Last)/i);

  if (totalMatch) {
    const totalProducts = parseInt(totalMatch[1].replace(/,/g, ''), 10);
    console.log(`\n🎯 MGS動画サイト総商品数: ${totalProducts.toLocaleString()}件`);

    const pagesNeeded = Math.ceil(totalProducts / 100);
    console.log(`   必要なページ数 (100件/ページ): ${pagesNeeded}ページ`);
  } else if (lastPageMatch) {
    const lastPage = parseInt(lastPageMatch[1], 10);
    console.log(`最終ページ: ${lastPage}`);
    console.log(`推定総商品数: 約${lastPage * 100}件`);
  }

  // 商品リンクをカウント
  const productLinks = await page.$$('a[href*="/product/product_detail/"]');
  console.log(`このページの商品リンク数: ${productLinks.length}件`);

  // ページネーション情報
  const pageLinks = await page.$$eval('a[href*="page="]', (links) => {
    const pages: number[] = [];
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/page=(\d+)/);
      if (match) {
        pages.push(parseInt(match[1], 10));
      }
    });
    return [...new Set(pages)].sort((a, b) => b - a);
  });

  if (pageLinks.length > 0) {
    console.log(`ページネーションの最大ページ: ${pageLinks[0]}`);
  }

  // 件数表示テキストを探す
  const counts = await page.$$eval('*', (elements) => {
    const results: string[] = [];
    elements.forEach(el => {
      const text = el.textContent || '';
      const matches = text.match(/(\d{1,3}(?:,\d{3})*)\s*件/g);
      if (matches) {
        results.push(...matches);
      }
    });
    return [...new Set(results)];
  });

  if (counts.length > 0) {
    console.log('\n見つかった件数表示:', counts.slice(0, 10));
  }

  await browser.close();
}

main().catch(console.error);
