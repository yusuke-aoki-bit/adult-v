/**
 * MGS動画の全カテゴリ・チャンネルの商品数を確認
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface CategoryInfo {
  name: string;
  url: string;
  productCount: number | null;
  maxPage: number | null;
  estimatedCount: number | null;
}

const MGS_CATEGORIES = [
  // 動画配信 - range=latestを外して全件対象に
  { name: '動画配信(全件)', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&list_cnt=120&type=haishin' },
  // DVD
  { name: 'DVD', url: 'https://www.mgstage.com/ppv/dvd/' },
  // 月額チャンネル
  { name: 'S1ch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=superch&type=monthly' },
  { name: 'DOCch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=docch&type=monthly' },
  { name: 'プレステージBB', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=prestigebb&type=monthly' },
  { name: 'かんぱにBB', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=kanbich&type=monthly' },
  { name: 'SODch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=sodch&type=monthly' },
  { name: 'HMPch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=hmpbb&type=monthly' },
  { name: 'HOTch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=hotbb&type=monthly' },
  { name: 'NEXTch', url: 'https://www.mgstage.com/search/cSearch.php?sort=new&search_shop_id=nextbb&type=monthly' },
];

async function getCategoryInfo(page: Page, category: { name: string; url: string }): Promise<CategoryInfo> {
  console.log(`\n📋 ${category.name} を確認中...`);
  console.log(`   URL: ${category.url}`);

  try {
    await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 年齢確認ページかチェック
    const currentUrl = page.url();
    if (currentUrl.includes('adc.php')) {
      console.log('   ⚠️ 年齢確認ページにリダイレクト、確認をクリック');
      // 「はい」ボタンをクリック
      await page.click('a.enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    const html = await page.content();

    // 件数パターンを探す（複数パターン対応）
    let productCount: number | null = null;

    // パターン1: "112,166件" - カンマ区切りの数字 + 件
    const patterns = [
      /(\d{1,3}(?:,\d{3})+)\s*件/,  // カンマ区切り数字 + 件
      /全\s*(\d{1,3}(?:,\d{3})+)/,  // 全 + 数字
      /(\d+)\s*件/,  // 単純な数字 + 件
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1].replace(/,/g, ''), 10);
        if (num > 100) { // 100件以上の場合のみ採用
          productCount = num;
          break;
        }
      }
    }

    // ページネーションから最大ページを取得
    const pageLinks = await page.$$eval('a[href*="page="]', (links) => {
      const pages: number[] = [];
      links.forEach(link => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/page=(\d+)/);
        if (match) {
          pages.push(parseInt(match[1], 10));
        }
      });
      return pages;
    });
    const maxPage = pageLinks.length > 0 ? Math.max(...pageLinks) : null;

    // 商品リンク数をカウント
    const productLinks = await page.$$('a[href*="/product/product_detail/"]');

    // 推定件数（最大ページ × 120）
    const estimatedCount = maxPage ? maxPage * 120 : null;

    console.log(`   📦 件数: ${productCount?.toLocaleString() || '不明'}`);
    console.log(`   📄 最大ページ: ${maxPage || '不明'}`);
    console.log(`   📊 推定件数: ${estimatedCount?.toLocaleString() || '不明'} (最大ページ×120)`);
    console.log(`   🔗 このページの商品: ${productLinks.length}件`);

    return {
      name: category.name,
      url: category.url,
      productCount,
      maxPage,
      estimatedCount,
    };
  } catch (error) {
    console.error(`   ❌ エラー: ${error}`);
    return {
      name: category.name,
      url: category.url,
      productCount: null,
      maxPage: null,
      estimatedCount: null,
    };
  }
}

async function main() {
  console.log('=== MGS動画 全カテゴリ商品数チェック ===\n');

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

  const results: CategoryInfo[] = [];

  for (const category of MGS_CATEGORIES) {
    const info = await getCategoryInfo(page, category);
    results.push(info);
    // レート制限
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // 結果サマリ
  console.log('\n========================================');
  console.log('=== MGS動画 カテゴリ別商品数サマリ ===');
  console.log('========================================\n');

  const channelProducts: { name: string; count: number; estimated: number; maxPage: number }[] = [];
  let haishinResult: CategoryInfo | null = null;
  let dvdResult: CategoryInfo | null = null;

  for (const result of results) {
    const count = result.productCount || 0;
    const estimated = result.estimatedCount || 0;
    console.log(`${result.name}: ${count > 0 ? count.toLocaleString() : '不明'}件 (最大ページ: ${result.maxPage || '?'}, 推定: ${estimated.toLocaleString()})`);

    if (result.name === '動画配信(全件)') {
      haishinResult = result;
    } else if (result.name === 'DVD') {
      dvdResult = result;
    } else if (result.name.includes('ch') || result.name.includes('BB')) {
      channelProducts.push({ name: result.name, count, estimated, maxPage: result.maxPage || 0 });
    }
  }

  console.log('\n--- 月額チャンネル ---');
  let channelTotalEstimated = 0;
  for (const ch of channelProducts) {
    console.log(`  ${ch.name}: 最大${ch.maxPage}ページ, 推定${ch.estimated.toLocaleString()}件`);
    channelTotalEstimated += ch.estimated;
  }
  console.log(`  チャンネル推定合計: ${channelTotalEstimated.toLocaleString()}件`);

  console.log('\n--- 推定総商品数 ---');
  const haishinEstimated = haishinResult?.estimatedCount || 0;
  const dvdEstimated = dvdResult?.estimatedCount || 0;
  console.log(`動画配信(推定): ${haishinEstimated.toLocaleString()}件 (最大${haishinResult?.maxPage || '?'}ページ)`);
  console.log(`DVD(推定): ${dvdEstimated.toLocaleString()}件`);
  console.log(`チャンネル(推定合計): ${channelTotalEstimated.toLocaleString()}件`);
  console.log(`\n総計(重複除く): ${(haishinEstimated + dvdEstimated).toLocaleString()}件 + チャンネル独自分`);
  console.log(`\n※チャンネル商品は配信と重複している可能性があります`);
}

main().catch(console.error);
