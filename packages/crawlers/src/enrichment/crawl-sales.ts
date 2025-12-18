/**
 * セール情報クローラー
 *
 * 各ASPのセールページからセール情報を取得し、product_salesテーブルに保存
 *
 * Usage:
 *   npx tsx scripts/crawlers/crawl-sales.ts [--asp MGS|DUGA|SOKMIL|all] [--limit N]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  getFirstRow,
  IdRow,
  RateLimiter,
  crawlerLog,
  robustFetch,
} from '../lib/crawler';
import { getDugaClient, DugaProduct } from '../lib/providers/duga-client';
import { getSokmilClient } from '../lib/providers/sokmil-client';
import { StealthCrawler } from '../lib/stealth-browser';

interface SaleItem {
  originalProductId: string;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: Date | null;
}

const rateLimiter = new RateLimiter({ minDelayMs: 1500, maxDelayMs: 3000 });

/**
 * MGSのセールページからセール情報を取得
 */
async function crawlMgsSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  // MGSのセールページURL（複数カテゴリ）
  const salePageUrls = [
    { url: 'https://www.mgstage.com/search/cSearch.php?type=sale', type: 'campaign', name: 'セール' },
    { url: 'https://www.mgstage.com/search/cSearch.php?type=timesale', type: 'timesale', name: 'タイムセール' },
  ];

  for (const pageInfo of salePageUrls) {
    if (saleItems.length >= limit) break;

    try {
      crawlerLog.info(`Fetching MGS sale page: ${pageInfo.url}`);
      await rateLimiter.wait();

      const response = await robustFetch(pageInfo.url, {
        init: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': 'adc=1',
          },
        },
        timeoutMs: 30000,
        retry: { maxRetries: 3 },
      });

      rateLimiter.done();

      if (!response.ok) {
        crawlerLog.warn(`Failed to fetch: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // セール商品を抽出（複数セレクタに対応）
      // MGSの検索結果ページ構造: .search_list内の各商品
      const selectors = [
        '.search_list .data',      // 検索結果リスト
        '.rank_list li',           // ランキングリスト
        '.movie_list li',          // 動画リスト
        '.sale_container',         // セールコンテナ（親要素）
      ];

      // 商品リンクを直接検索
      $('a[href*="/product/product_detail/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        // 商品IDを抽出
        const productIdMatch = link.match(/product_detail\/([^\/\?]+)/);
        if (!productIdMatch) return;
        const productId = productIdMatch[1];

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 親要素から価格情報を探す
        const $parent = $(el).closest('.search_list, .rank_list, li, article, .data').first();
        if ($parent.length === 0) return;

        // 価格情報を抽出（セール価格のみ取得可能）
        const priceText = $parent.find('.min-price, .price, .sale_price').first().text();

        // 価格をパース
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        // セール終了日時を抽出
        let endAt: Date | null = null;
        const endTimeText = $parent.find('.sale_end, .end_time, .limit_time, .remaining').text();
        if (endTimeText) {
          const dateMatch = endTimeText.match(/(\d+)\/(\d+)/);
          if (dateMatch) {
            const now = new Date();
            const month = parseInt(dateMatch[1]);
            const day = parseInt(dateMatch[2]);
            endAt = new Date(now.getFullYear(), month - 1, day, 23, 59, 59);
            if (endAt < now) {
              endAt.setFullYear(now.getFullYear() + 1);
            }
          }
        }

        // 通常価格はDBから取得するため、ここではセール価格のみ記録
        // regularPriceは後でDB照合時に設定
        saleItems.push({
          originalProductId: productId,
          regularPrice: 0, // 後でDBから取得
          salePrice,
          discountPercent: 0, // 後で計算
          saleName: pageInfo.name,
          saleType: pageInfo.type,
          endAt,
        });
      });

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling ${pageInfo.url}:`, error);
    }
  }

  return saleItems;
}

/**
 * DUGAのセールページからセール情報を取得
 */
async function crawlDugaSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  // DUGAのセールページURL（複数ページ）
  const salePageUrls = [
    { url: 'https://duga.jp/search/=/campaignid=sale/', name: 'DUGAセール', type: 'campaign' },
    { url: 'https://duga.jp/search/=/sort=discount/', name: 'DUGA割引順', type: 'discount' },
  ];

  for (const pageInfo of salePageUrls) {
    if (saleItems.length >= limit) break;

    try {
      crawlerLog.info(`Fetching DUGA sale page: ${pageInfo.url}`);
      await rateLimiter.wait();

      const response = await robustFetch(pageInfo.url, {
        init: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          },
        },
        timeoutMs: 30000,
        retry: { maxRetries: 3 },
      });

      rateLimiter.done();

      if (!response.ok) {
        crawlerLog.warn(`Failed to fetch: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // セール商品を抽出 - DUGAの構造: .contentslist内の各商品
      // producthoverboxにpid属性、.moneyに価格
      $('.contentslist').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const $item = $(el);
        const $hoverbox = $item.find('[pid]');
        if ($hoverbox.length === 0) return;

        const productId = $hoverbox.attr('pid');
        if (!productId) return;

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 価格情報を抽出
        const priceText = $item.find('.money').text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        // 通常価格はDBから取得
        saleItems.push({
          originalProductId: productId,
          regularPrice: 0, // 後でDBから取得
          salePrice,
          discountPercent: 0, // 後で計算
          saleName: pageInfo.name,
          saleType: pageInfo.type || 'campaign',
          endAt: null,
        });
      });

      // 代替セレクタ（従来のli構造も試す）
      $('a[href*="/ppv/"]').each((_, el) => {
        if (saleItems.length >= limit) return false;

        const link = $(el).attr('href');
        if (!link) return;

        // 商品IDを抽出
        const productIdMatch = link.match(/\/ppv\/([^\/\?]+)/);
        if (!productIdMatch) return;
        const productId = productIdMatch[1];

        // 重複チェック
        if (saleItems.some(item => item.originalProductId === productId)) return;

        // 価格情報を抽出
        const $parent = $(el).closest('.contentslist, li, article');
        const priceText = $parent.find('.money, .price').first().text();
        const salePriceMatch = priceText.match(/[\d,]+/);
        if (!salePriceMatch) return;

        const salePrice = parseInt(salePriceMatch[0].replace(/,/g, ''));
        if (salePrice <= 0) return;

        saleItems.push({
          originalProductId: productId,
          regularPrice: 0,
          salePrice,
          discountPercent: 0,
          saleName: pageInfo.name,
          saleType: pageInfo.type || 'campaign',
          endAt: null,
        });
      });

      crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

    } catch (error) {
      crawlerLog.error(`Error crawling DUGA sales:`, error);
    }
  }

  return saleItems;
}

/**
 * SOKMILのセール情報をAPIから取得
 * APIでセール情報を直接取得できないため、価格安い順で取得して
 * listPriceとpriceを比較してセール品を検出
 */
async function crawlSokmilSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];

  try {
    crawlerLog.info('Fetching SOKMIL sales via API...');
    const sokmilClient = getSokmilClient();

    // APIで価格安い順に取得（セール品が多い可能性）
    const response = await sokmilClient.searchItems({
      hits: Math.min(limit * 2, 100), // セール品を見つけるために多めに取得
      offset: 1,
      sort: '-price', // 価格安い順
    });

    if (response.status !== 'success') {
      crawlerLog.warn(`SOKMIL API error: ${response.error}`);
      return saleItems;
    }

    crawlerLog.info(`Fetched ${response.data.length} items from SOKMIL API`);

    // セール品を抽出（listPriceとpriceを比較）
    for (const item of response.data) {
      if (saleItems.length >= limit) break;

      // listPriceがあり、priceより高い場合はセール
      // 注意: APIでlistPriceが提供されない場合はセール検出不可
      const price = item.price || 0;
      const listPrice = (item as any).listPrice || 0; // APIレスポンスにlistPriceがあるか確認

      if (listPrice > 0 && price > 0 && listPrice > price) {
        const discountPercent = Math.round((1 - price / listPrice) * 100);

        // 5%以上の割引のみ
        if (discountPercent >= 5) {
          saleItems.push({
            originalProductId: item.itemId,
            regularPrice: listPrice,
            salePrice: price,
            discountPercent,
            saleName: 'SOKMILセール',
            saleType: 'campaign',
            endAt: null,
          });
        }
      }
    }

    crawlerLog.success(`Found ${saleItems.length} sale items from SOKMIL API`);

  } catch (error) {
    crawlerLog.error('Error crawling SOKMIL sales via API:', error);
  }

  return saleItems;
}

/**
 * FANZAのセールページからセール情報を取得（Puppeteer + スクロール使用）
 * 商品クローラーと同じロジックを使用
 */
async function crawlFanzaSales(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];
  const crawler = new StealthCrawler({ timeout: 60000 });

  // FANZAのセールページURL
  const salePageUrls = [
    { url: 'https://video.dmm.co.jp/av/list/?article=sale', type: 'sale', name: 'FANZAセール' },
    { url: 'https://video.dmm.co.jp/av/list/?article=campaign', type: 'campaign', name: 'FANZAキャンペーン' },
  ];

  try {
    await crawler.init();
    const page = await crawler.getPage();

    // 年齢認証Cookieを設定
    await page.setCookie(
      { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
      { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' }
    );

    // まず年齢認証を通過
    crawlerLog.info('FANZA: Initializing session (age verification)...');
    await page.goto('https://www.dmm.co.jp/age_check/=/declared=yes/?rurl=https://www.dmm.co.jp/digital/videoa/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    for (const pageInfo of salePageUrls) {
      if (saleItems.length >= limit) break;

      try {
        crawlerLog.info(`Fetching FANZA sale page: ${pageInfo.url}`);

        // ページに移動
        await page.goto(pageInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 年齢認証ページにリダイレクトされた場合
        const currentUrl = page.url();
        if (currentUrl.includes('age_check')) {
          crawlerLog.info('FANZA: Age verification page detected, passing...');
          await page.goto('https://www.dmm.co.jp/age_check/=/declared=yes/?rurl=' + encodeURIComponent(pageInfo.url), {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });
        }

        // 商品リストがロードされるのを待つ
        await new Promise(r => setTimeout(r, 3000));

        // スクロールして商品をロード（商品クローラーと同じロジック）
        await page.evaluate(async () => {
          window.scrollTo(0, 500);
          await new Promise(r => setTimeout(r, 500));
          window.scrollTo(0, 1000);
          await new Promise(r => setTimeout(r, 500));
          window.scrollTo(0, 1500);
          await new Promise(r => setTimeout(r, 500));
          window.scrollTo(0, 2000);
        });

        await new Promise(r => setTimeout(r, 3000));

        // HTMLを取得
        const html = await page.content();
        const $ = cheerio.load(html);

        // ページ情報をログ
        const pageTitle = $('title').text();
        crawlerLog.info(`FANZA: Page title="${pageTitle}", URL=${page.url()}`);

        // 商品CIDを抽出（商品クローラーと同じロジック）
        const cidSet = new Set<string>();

        // 画像URLからCIDを抽出（/video/XXXXX/ パターン）
        $('img[src]').each((_, img) => {
          const src = $(img).attr('src') || '';
          const match = src.match(/\/video\/([a-z0-9]+)\//i);
          if (match && match[1]) {
            cidSet.add(match[1]);
          }
        });

        // aタグのhrefからもCIDを探す
        $('a[href]').each((_, a) => {
          const href = $(a).attr('href') || '';
          // /av/detail/xxx パターン
          const detailMatch = href.match(/\/av\/detail\/([a-z0-9]+)/i);
          if (detailMatch && detailMatch[1]) {
            cidSet.add(detailMatch[1]);
          }
          // cid=xxx パターン
          const cidMatch = href.match(/cid=([a-z0-9]+)/i);
          if (cidMatch && cidMatch[1]) {
            cidSet.add(cidMatch[1]);
          }
          // /av/content/?id=xxx パターン
          const contentMatch = href.match(/\/av\/content\/\?id=([a-z0-9]+)/i);
          if (contentMatch && contentMatch[1]) {
            cidSet.add(contentMatch[1]);
          }
        });

        const cids = Array.from(cidSet);
        crawlerLog.info(`FANZA: Found ${cids.length} product CIDs`);

        // 価格情報を持つ商品を抽出
        // 通常価格: line-through クラス（取り消し線）
        // セール価格: 取り消し線なしの価格
        let pricesFound = 0;

        for (const cid of cids) {
          if (saleItems.length >= limit) break;

          // 画像URLでCIDを含む要素を探す
          const $img = $(`img[src*="/video/${cid}/"]`).first();
          if ($img.length === 0) continue;

          // 親要素から価格情報を探す（複数の親レベルを試す）
          let $container = $img.closest('[class*="item"], [class*="card"], li, article');
          if ($container.length === 0) {
            $container = $img.parent().parent().parent();
          }

          // 価格要素を探す
          let regularPrice = 0;
          let salePrice = 0;

          // 取り消し線の価格（通常価格）
          const $strikePrice = $container.find('[class*="line-through"], del, .strike');
          if ($strikePrice.length > 0) {
            const text = $strikePrice.text();
            const match = text.match(/([\d,]+)/);
            if (match) {
              regularPrice = parseInt(match[1].replace(/,/g, ''));
            }
          }

          // 通常の価格テキスト
          const priceTexts = $container.find('span:contains("円")').map((_, e) => {
            const $e = $(e);
            // 取り消し線の価格は除外
            if ($e.hasClass('line-through') || $e.closest('[class*="line-through"]').length > 0) {
              return null;
            }
            return $e.text().trim();
          }).get().filter(Boolean);

          for (const text of priceTexts) {
            const match = text.match(/([\d,]+)円/);
            if (match) {
              const price = parseInt(match[0].replace(/[,円]/g, ''));
              if (price > 0 && (salePrice === 0 || price < salePrice)) {
                salePrice = price;
              }
            }
          }

          // セール価格が通常価格より高い場合はスワップ
          if (salePrice > 0 && regularPrice > 0 && salePrice > regularPrice) {
            [salePrice, regularPrice] = [regularPrice, salePrice];
          }

          // セール商品として記録（通常価格がある場合のみ）
          if (salePrice > 0 && regularPrice > 0 && salePrice < regularPrice) {
            const discountPercent = Math.round((1 - salePrice / regularPrice) * 100);

            // 割引率5%以上のみ
            if (discountPercent >= 5) {
              saleItems.push({
                originalProductId: cid,
                regularPrice,
                salePrice,
                discountPercent,
                saleName: pageInfo.name,
                saleType: pageInfo.type,
                endAt: null,
              });
              pricesFound++;
            }
          }
        }

        crawlerLog.success(`Found ${pricesFound} sale items with prices from ${pageInfo.name}`);

        // レート制限
        await new Promise(r => setTimeout(r, 2000));

      } catch (error) {
        crawlerLog.error(`Error crawling FANZA sale page ${pageInfo.url}:`, error);
      }
    }
  } finally {
    await crawler.close();
  }

  return saleItems;
}

/**
 * SOKMILのセールページからセール情報を取得（Puppeteer使用）
 */
async function crawlSokmilSalesScrape(limit: number = 100): Promise<SaleItem[]> {
  const saleItems: SaleItem[] = [];
  const crawler = new StealthCrawler({ timeout: 60000 });

  // SOKMILのセールページURL（正しいパス形式）
  const salePageUrls = [
    { url: 'https://www.sokmil.com/av/?sale=on&sort=popular', type: 'sale', name: 'SOKMILセール' },
    { url: 'https://www.sokmil.com/av/?sort=cheap', type: 'discount', name: 'SOKMIL価格安い順' },
  ];

  try {
    await crawler.init();
    const page = await crawler.getPage();

    for (const pageInfo of salePageUrls) {
      if (saleItems.length >= limit) break;

      try {
        crawlerLog.info(`Fetching SOKMIL sale page: ${pageInfo.url}`);

        await page.goto(pageInfo.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // 年齢認証ページをチェック・通過
        const currentUrl = page.url();
        if (currentUrl.includes('ageauth') || currentUrl.includes('age_check')) {
          crawlerLog.info('SOKMIL: Age verification page detected');

          // 「はいアダルト動画へ」ボタンをクリック
          // セレクタ: a.btn-ageauth-yes または a[href*="age=ok"]
          const selectors = [
            'a.btn-ageauth-yes',
            'a[href*="age=ok"]',
            'a[href*="over18"]',
          ];
          let clicked = false;
          for (const selector of selectors) {
            try {
              const button = await page.$(selector);
              if (button) {
                const btnText = await button.evaluate((el: Element) => el.textContent?.trim());
                crawlerLog.info(`SOKMIL: Found age button with selector ${selector}, text="${btnText}"`);
                await button.click();
                clicked = true;
                crawlerLog.info(`SOKMIL: Clicked ${selector}`);
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
                break;
              }
            } catch (e) {
              // セレクタがサポートされていない場合
            }
          }
          if (!clicked) {
            crawlerLog.warn('SOKMIL: Could not find age verification button');
          }
        }

        // 追加の待機
        await new Promise(r => setTimeout(r, 3000));

        const html = await page.content();
        const $ = cheerio.load(html);

        // デバッグ: ページタイトルとURL確認
        const pageTitle = $('title').text();
        const finalUrl = page.url();
        const allItemLinks = $('a[href*="item"]').length;
        crawlerLog.info(`SOKMIL: Page title="${pageTitle}", URL=${finalUrl}, itemLinks=${allItemLinks}`);

        // SOKMILの商品カードから情報を抽出
        // 商品カード構造: .horizontal-link-wrapper 内に商品情報
        // セール商品: クラスに package--campaign または package--sale が含まれる
        $('.horizontal-link-wrapper').each((_, wrapper) => {
          if (saleItems.length >= limit) return false;

          const $wrapper = $(wrapper);
          const wrapperClass = $wrapper.attr('class') || '';

          // セール商品のみ処理（package--campaign または package--sale クラスがある場合）
          if (!wrapperClass.includes('campaign') && !wrapperClass.includes('sale')) {
            return; // セール商品でなければスキップ
          }

          // 商品リンクを取得
          const $link = $wrapper.find('a.horizontal-link');
          const href = $link.attr('href') || '';

          // item ID を抽出
          const itemMatch = href.match(/item(\d+)\.htm/);
          if (!itemMatch) return;
          const productId = itemMatch[1];

          // 重複チェック
          if (saleItems.some(item => item.originalProductId === productId)) return;

          // 割引率を抽出（.sale-label-XX クラスから）
          let discountPercent = 0;
          const saleLabelClass = $wrapper.find('[class*="sale-label-"]').attr('class') || '';
          const discountMatch = saleLabelClass.match(/sale-label-(\d+)/);
          if (discountMatch) {
            discountPercent = parseInt(discountMatch[1]);
          }

          // セール価格を抽出（.min-price-area.campaign 内の .current-price）
          let salePrice = 0;
          const salePriceEl = $wrapper.find('.min-price-area.campaign .current-price');
          if (salePriceEl.length > 0) {
            const priceText = salePriceEl.text();
            const priceMatch = priceText.match(/[\d,]+/);
            if (priceMatch) {
              salePrice = parseInt(priceMatch[0].replace(/,/g, ''));
            }
          }

          // セール価格が取得できない場合は .current-price から取得
          if (salePrice === 0) {
            const currentPriceEl = $wrapper.find('.current-price').first();
            if (currentPriceEl.length > 0) {
              const priceText = currentPriceEl.text();
              const priceMatch = priceText.match(/[\d,]+/);
              if (priceMatch) {
                salePrice = parseInt(priceMatch[0].replace(/,/g, ''));
              }
            }
          }

          // 通常価格を計算（割引率から逆算）
          let regularPrice = 0;
          if (discountPercent > 0 && salePrice > 0) {
            // regularPrice * (1 - discountPercent/100) = salePrice
            // regularPrice = salePrice / (1 - discountPercent/100)
            regularPrice = Math.round(salePrice / (1 - discountPercent / 100));
          }

          // 0円や極端に安い商品はスキップ
          if (salePrice <= 0 || salePrice > 100000) return;

          saleItems.push({
            originalProductId: productId,
            regularPrice,
            salePrice,
            discountPercent,
            saleName: pageInfo.name,
            saleType: pageInfo.type,
            endAt: null,
          });
        });

        crawlerLog.success(`Found ${saleItems.length} sale items from ${pageInfo.name}`);

        // レート制限
        await new Promise(r => setTimeout(r, 2000));

      } catch (error) {
        crawlerLog.error(`Error crawling SOKMIL sale page ${pageInfo.url}:`, error);
      }
    }
  } finally {
    await crawler.close();
  }

  return saleItems;
}

/**
 * SOKMILの商品をAPIから取得してDBに自動登録
 */
async function registerSokmilProduct(productId: string): Promise<number | null> {
  const db = getDb();

  try {
    const sokmilClient = getSokmilClient();
    const response = await sokmilClient.getItemDetail(productId);

    if (response.status !== 'success' || !response.data) {
      crawlerLog.warn(`SOKMIL product not found via API: ${productId}`);
      return null;
    }

    const item = response.data;

    // productsテーブルに挿入
    const normalizedProductId = `sokmil-${productId}`;
    const productResult = await db.execute(sql`
      INSERT INTO products (
        normalized_product_id,
        title,
        description,
        release_date,
        duration,
        default_thumbnail_url
      ) VALUES (
        ${normalizedProductId},
        ${item.title},
        ${item.description || null},
        ${item.releaseDate || null},
        ${item.duration || null},
        ${item.thumbnailUrl || null}
      )
      ON CONFLICT (normalized_product_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW()
      RETURNING id
    `);

    const productRow = getFirstRow<IdRow>(productResult);
    if (!productRow) return null;

    // product_sourcesテーブルに挿入
    const sourceResult = await db.execute(sql`
      INSERT INTO product_sources (
        product_id,
        asp_name,
        original_product_id,
        affiliate_url,
        price,
        data_source
      ) VALUES (
        ${productRow.id},
        'SOKMIL',
        ${productId},
        ${item.affiliateUrl || `https://www.sokmil.com/av/item${productId}.htm`},
        ${item.price || null},
        'API'
      )
      ON CONFLICT (product_id, asp_name)
      DO UPDATE SET
        affiliate_url = EXCLUDED.affiliate_url,
        price = EXCLUDED.price,
        last_updated = NOW()
      RETURNING id
    `);

    const sourceRow = getFirstRow<IdRow>(sourceResult);
    crawlerLog.success(`Auto-registered SOKMIL product: ${productId} (source_id: ${sourceRow?.id})`);

    return sourceRow?.id || null;
  } catch (error) {
    crawlerLog.error(`Failed to register SOKMIL product ${productId}:`, error);
    return null;
  }
}

/**
 * FANZAの商品をスクレイピングしてDBに自動登録
 */
async function registerFanzaProduct(cid: string, salePrice: number, regularPrice: number): Promise<number | null> {
  const db = getDb();

  try {
    // FANZAの商品詳細ページURL
    const detailUrl = `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${cid}/`;

    // productsテーブルに挿入（最低限の情報で登録）
    const normalizedProductId = `fanza-${cid}`;
    const productResult = await db.execute(sql`
      INSERT INTO products (
        normalized_product_id,
        title,
        default_thumbnail_url
      ) VALUES (
        ${normalizedProductId},
        ${`FANZA商品 ${cid}`},
        ${`https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`}
      )
      ON CONFLICT (normalized_product_id)
      DO UPDATE SET
        updated_at = NOW()
      RETURNING id
    `);

    const productRow = getFirstRow<IdRow>(productResult);
    if (!productRow) return null;

    // product_sourcesテーブルに挿入
    const sourceResult = await db.execute(sql`
      INSERT INTO product_sources (
        product_id,
        asp_name,
        original_product_id,
        affiliate_url,
        price,
        data_source
      ) VALUES (
        ${productRow.id},
        'FANZA',
        ${cid},
        ${detailUrl},
        ${regularPrice || null},
        'SCRAPE'
      )
      ON CONFLICT (product_id, asp_name)
      DO UPDATE SET
        affiliate_url = EXCLUDED.affiliate_url,
        price = COALESCE(EXCLUDED.price, product_sources.price),
        last_updated = NOW()
      RETURNING id
    `);

    const sourceRow = getFirstRow<IdRow>(sourceResult);
    crawlerLog.success(`Auto-registered FANZA product: ${cid} (source_id: ${sourceRow?.id})`);

    return sourceRow?.id || null;
  } catch (error) {
    crawlerLog.error(`Failed to register FANZA product ${cid}:`, error);
    return null;
  }
}

/**
 * DUGAの商品をAPIから取得してDBに自動登録
 */
async function registerDugaProduct(productId: string): Promise<number | null> {
  const db = getDb();

  try {
    const dugaClient = getDugaClient();
    const response = await dugaClient.searchProducts({
      keyword: productId,
      hits: 1,
    });

    if (response.items.length === 0) {
      crawlerLog.warn(`DUGA product not found via API: ${productId}`);
      return null;
    }

    const item = response.items[0];

    // 完全一致チェック
    if (item.productId !== productId) {
      crawlerLog.warn(`Product ID mismatch: expected ${productId}, got ${item.productId}`);
      return null;
    }

    // productsテーブルに挿入
    const normalizedProductId = `duga-${productId}`;
    const productResult = await db.execute(sql`
      INSERT INTO products (
        normalized_product_id,
        title,
        description,
        release_date,
        duration,
        default_thumbnail_url
      ) VALUES (
        ${normalizedProductId},
        ${item.title},
        ${item.description || null},
        ${item.releaseDate || null},
        ${item.duration || null},
        ${item.thumbnailUrl || null}
      )
      ON CONFLICT (normalized_product_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        updated_at = NOW()
      RETURNING id
    `);

    const productRow = getFirstRow<IdRow>(productResult);
    if (!productRow) return null;

    // product_sourcesテーブルに挿入
    const sourceResult = await db.execute(sql`
      INSERT INTO product_sources (
        product_id,
        asp_name,
        original_product_id,
        affiliate_url,
        price,
        data_source
      ) VALUES (
        ${productRow.id},
        'DUGA',
        ${productId},
        ${item.affiliateUrl},
        ${item.price || null},
        'API'
      )
      ON CONFLICT (product_id, asp_name)
      DO UPDATE SET
        affiliate_url = EXCLUDED.affiliate_url,
        price = EXCLUDED.price,
        last_updated = NOW()
      RETURNING id
    `);

    const sourceRow = getFirstRow<IdRow>(sourceResult);
    crawlerLog.success(`Auto-registered DUGA product: ${productId} (source_id: ${sourceRow?.id})`);

    return sourceRow?.id || null;
  } catch (error) {
    crawlerLog.error(`Failed to register DUGA product ${productId}:`, error);
    return null;
  }
}

/**
 * セール情報をDBに保存
 * regularPriceが0の場合はDBから既存の価格を取得して比較
 * DBにない商品の場合はAPIから自動登録を試みる
 */
async function saveSaleItems(aspName: string, items: SaleItem[]): Promise<number> {
  const db = getDb();
  let savedCount = 0;

  for (const item of items) {
    try {
      // product_sourceを検索（価格も含めて取得）
      const sourceResult = await db.execute(sql`
        SELECT id, price FROM product_sources
        WHERE asp_name = ${aspName}
        AND original_product_id = ${item.originalProductId}
        LIMIT 1
      `);

      let sourceRow = sourceResult.rows[0] as { id: number; price: number | null } | undefined;

      // 商品が未登録の場合、ASPに応じて自動登録を試みる
      if (!sourceRow) {
        crawlerLog.info(`Product not found in DB, attempting auto-registration: ${aspName} ${item.originalProductId}`);
        let registeredSourceId: number | null = null;

        if (aspName === 'DUGA') {
          registeredSourceId = await registerDugaProduct(item.originalProductId);
        } else if (aspName === 'SOKMIL') {
          registeredSourceId = await registerSokmilProduct(item.originalProductId);
        } else if (aspName === 'FANZA') {
          registeredSourceId = await registerFanzaProduct(item.originalProductId, item.salePrice, item.regularPrice);
        }

        if (registeredSourceId) {
          // 登録成功した場合、価格を再取得
          const reResult = await db.execute(sql`
            SELECT id, price FROM product_sources
            WHERE id = ${registeredSourceId}
            LIMIT 1
          `);
          sourceRow = reResult.rows[0] as { id: number; price: number | null } | undefined;
        }

        if (!sourceRow) {
          crawlerLog.warn(`Skipping sale (could not register product): ${item.originalProductId}`);
          continue;
        }
      }

      const productSourceId = sourceRow.id;

      // regularPriceが0の場合、DBから取得
      let regularPrice = item.regularPrice;
      if (regularPrice === 0 && sourceRow.price) {
        regularPrice = sourceRow.price;
      }

      // 通常価格が取得できない、またはセール価格と同じ/高い場合はスキップ
      if (regularPrice === 0 || item.salePrice >= regularPrice) {
        continue;
      }

      // 割引率を計算
      const discountPercent = item.discountPercent || Math.round((1 - item.salePrice / regularPrice) * 100);

      // 割引率が5%未満はスキップ
      if (discountPercent < 5) {
        continue;
      }

      // 既存のアクティブなセールを非アクティブに
      await db.execute(sql`
        UPDATE product_sales
        SET is_active = FALSE, updated_at = NOW()
        WHERE product_source_id = ${productSourceId}
        AND is_active = TRUE
      `);

      // 新しいセール情報を挿入
      await db.execute(sql`
        INSERT INTO product_sales (
          product_source_id,
          regular_price,
          sale_price,
          discount_percent,
          sale_name,
          sale_type,
          end_at,
          is_active,
          fetched_at
        ) VALUES (
          ${productSourceId},
          ${regularPrice},
          ${item.salePrice},
          ${discountPercent},
          ${item.saleName},
          ${item.saleType},
          ${item.endAt},
          TRUE,
          NOW()
        )
      `);

      savedCount++;
    } catch (error) {
      crawlerLog.error(`Error saving sale for ${item.originalProductId}:`, error);
    }
  }

  return savedCount;
}

/**
 * 期限切れのセールを非アクティブに
 */
async function deactivateExpiredSales(): Promise<number> {
  const db = getDb();

  const result = await db.execute(sql`
    UPDATE product_sales
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE
    AND end_at IS NOT NULL
    AND end_at < NOW()
    RETURNING id
  `);

  return result.rows.length;
}

async function main() {
  const args = process.argv.slice(2);
  const aspIndex = args.indexOf('--asp');
  const limitIndex = args.indexOf('--limit');

  const targetAsp = aspIndex !== -1 ? args[aspIndex + 1]?.toUpperCase() : 'all';
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 100;

  console.log('========================================');
  console.log('🛒 セール情報クローラー');
  console.log('========================================');
  console.log(`Target ASP: ${targetAsp}`);
  console.log(`Limit: ${limit}`);
  console.log('========================================\n');

  const stats = {
    mgs: { crawled: 0, saved: 0 },
    duga: { crawled: 0, saved: 0 },
    sokmil: { crawled: 0, saved: 0 },
    fanza: { crawled: 0, saved: 0 },
    expired: 0,
  };

  // 期限切れセールを非アクティブに
  stats.expired = await deactivateExpiredSales();
  crawlerLog.info(`Deactivated ${stats.expired} expired sales\n`);

  // MGS
  if (targetAsp === 'ALL' || targetAsp === 'MGS') {
    crawlerLog.info('Crawling MGS sales...');
    const mgsItems = await crawlMgsSales(limit);
    stats.mgs.crawled = mgsItems.length;
    stats.mgs.saved = await saveSaleItems('MGS', mgsItems);
    crawlerLog.success(`MGS: Saved ${stats.mgs.saved}/${stats.mgs.crawled}\n`);
  }

  // DUGA
  if (targetAsp === 'ALL' || targetAsp === 'DUGA') {
    crawlerLog.info('Crawling DUGA sales...');
    const dugaItems = await crawlDugaSales(limit);
    stats.duga.crawled = dugaItems.length;
    stats.duga.saved = await saveSaleItems('DUGA', dugaItems);
    crawlerLog.success(`DUGA: Saved ${stats.duga.saved}/${stats.duga.crawled}\n`);
  }

  // SOKMIL（デバッグ用に有効化）
  if (targetAsp === 'ALL' || targetAsp === 'SOKMIL') {
    crawlerLog.info('Crawling SOKMIL sales...');
    const sokmilItems = await crawlSokmilSalesScrape(limit);
    stats.sokmil.crawled = sokmilItems.length;
    stats.sokmil.saved = await saveSaleItems('SOKMIL', sokmilItems);
    crawlerLog.success(`SOKMIL: Saved ${stats.sokmil.saved}/${stats.sokmil.crawled}\n`);
  }

  // FANZA（スクロール付きスクレイピング - 商品クローラーと同じロジック）
  if (targetAsp === 'ALL' || targetAsp === 'FANZA') {
    crawlerLog.info('Crawling FANZA sales...');
    const fanzaItems = await crawlFanzaSales(limit);
    stats.fanza.crawled = fanzaItems.length;
    stats.fanza.saved = await saveSaleItems('FANZA', fanzaItems);
    crawlerLog.success(`FANZA: Saved ${stats.fanza.saved}/${stats.fanza.crawled}\n`);
  }

  // サマリー
  console.log('========================================');
  console.log('📊 Summary');
  console.log('========================================');
  console.log(`MGS: ${stats.mgs.saved}/${stats.mgs.crawled} saved`);
  console.log(`DUGA: ${stats.duga.saved}/${stats.duga.crawled} saved`);
  console.log(`SOKMIL: ${stats.sokmil.saved}/${stats.sokmil.crawled} saved`);
  console.log(`FANZA: ${stats.fanza.saved}/${stats.fanza.crawled} saved`);
  console.log(`Expired: ${stats.expired} deactivated`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
