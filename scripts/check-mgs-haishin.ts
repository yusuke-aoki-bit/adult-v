/**
 * MGS動画の配信ページから総商品数を確認
 */

import puppeteer from 'puppeteer';

async function main() {
  console.log('=== MGS動画 配信ページチェック ===\n');

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

  const url = 'https://www.mgstage.com/ppv/haishin/';
  console.log('Fetching:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  const html = await page.content();

  // 件数パターンを探す
  const patterns = [
    /(\d{1,3}(?:,\d{3})+)\s*件/g,  // カンマ区切り数字 + 件
    /全\s*(\d{1,3}(?:,\d{3})+)/g,  // 全 + 数字
    /総\s*(\d{1,3}(?:,\d{3})+)/g,  // 総 + 数字
    /配信中[^0-9]*(\d{1,3}(?:,\d{3})+)/g,  // 配信中 + 数字
  ];

  const foundCounts = new Set<string>();

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        foundCounts.add(match[1]);
      } else if (match[0]) {
        foundCounts.add(match[0]);
      }
    }
  }

  console.log('\n見つかった件数表示:');
  for (const count of foundCounts) {
    const num = parseInt(count.replace(/,/g, ''), 10);
    if (num > 1000) {
      console.log(`  ★ ${count} (${num.toLocaleString()})`);
    }
  }

  // 112166を探す
  if (html.includes('112166') || html.includes('112,166')) {
    console.log('\n✅ 112,166件 が見つかりました！');
  }

  // 5桁以上の数字を全て探す
  const fiveDigitNumbers = html.match(/\d{5,}/g);
  if (fiveDigitNumbers) {
    const unique = [...new Set(fiveDigitNumbers)].filter(n => parseInt(n) > 10000);
    console.log('\n5桁以上の数字:', unique.slice(0, 20));
  }

  // HTMLの一部を出力してデバッグ
  console.log('\nHTML長さ:', html.length);
  console.log('タイトル:', html.match(/<title>([^<]+)<\/title>/)?.[1]);

  // ページ内の大きな数字を全て探す
  const largeNumbers = html.match(/(\d{1,3}(?:,\d{3}){2,})/g);
  if (largeNumbers) {
    console.log('\n大きな数字:');
    const uniqueNumbers = [...new Set(largeNumbers)];
    for (const num of uniqueNumbers) {
      console.log(`  ${num}`);
    }
  }

  await browser.close();
}

main().catch(console.error);
