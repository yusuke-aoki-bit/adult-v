/**
 * Tokyo-Hot（JSKY系）クローラー
 *
 * 機能:
 * - Tokyo-Hot (my.tokyo-hot.com) からPuppeteerを使用して商品データを取得
 * - 動的にロードされる商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - レート制限: 3秒以上の間隔
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/products/crawl-tokyohot.ts [--pages 10] [--start-page 1]
 */

if (!process.env['DATABASE_URL']) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { parseDuration, extractPrice } from '../lib/crawler/parse-helpers';
import { upsertRawHtmlDataWithGcs, markRawDataAsProcessed } from '../lib/crawler/dedup-helper';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';

// Stealth pluginを使用してbot検知を回避
puppeteer.use(StealthPlugin());

const db = getDb();

// JSKY系サイト設定
interface JskySiteConfig {
  name: string;
  baseUrl: string;
  listPageUrl: string;
  productIdPattern: RegExp;
  aspName: string;
  enterUrl?: string; // 年齢認証後のエントリーURL
}

const JSKY_SITES: Record<string, JskySiteConfig> = {
  'tokyo-hot': {
    name: 'Tokyo-Hot',
    baseUrl: 'https://my.tokyo-hot.com',
    listPageUrl: 'https://my.tokyo-hot.com/product/?lang=ja&page={page}',
    productIdPattern: /\/product\/(n\d+)\/?/,
    aspName: 'TOKYOHOT',
  },
  tvdeav: {
    name: 'TVdeAV',
    baseUrl: 'https://tvdeav.com',
    listPageUrl: 'https://tvdeav.com/product/latest/?lang=jp&page={page}',
    productIdPattern: /\/product\/(n\d+)\/?/,
    aspName: 'TVDEAV',
    enterUrl: 'https://tvdeav.com/index?lang=jp',
  },
};

// レート制限: 3秒 + ジッター
const RATE_LIMIT_MS = 3000;
const JITTER_MS = 1500;

// グローバルブラウザインスタンス
let browser: Browser | null = null;

interface TokyoHotProduct {
  productId: string;
  title: string;
  description: string;
  performers: string[];
  releaseDate: string | null;
  duration: number | null;
  thumbnailUrl: string;
  sampleImages: string[];
  genres: string[];
  price: number | null; // 月額料金
  rawHtml: string; // ハッシュ計算用
}

/**
 * レート制限付き待機
 */
async function rateLimit(): Promise<void> {
  const jitter = Math.random() * JITTER_MS;
  const delay = RATE_LIMIT_MS + jitter;
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * ブラウザを初期化
 */
async function initBrowser(): Promise<Browser> {
  if (browser) return browser;

  console.log('🌐 Puppeteerブラウザを起動中...');

  const executablePath = process.env['PUPPETEER_EXECUTABLE_PATH'];
  if (executablePath) {
    console.log(`  Chromium path: ${executablePath}`);
  }

  browser = await puppeteer.launch({
    headless: true,
    ...(executablePath && { executablePath }),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  console.log('✅ ブラウザ起動完了');

  return browser;
}

/**
 * ブラウザをクローズ
 */
async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('🔒 ブラウザを終了しました');
  }
}

/**
 * 年齢認証を通過
 */
async function passAgeVerification(page: Page, siteConfig: JskySiteConfig): Promise<void> {
  console.log('🍪 年齢認証を通過中...');

  // enterUrlが設定されている場合は直接そのURLにアクセス
  if (siteConfig.enterUrl) {
    await page.goto(siteConfig.enterUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    console.log('✅ 年齢認証通過完了');
    return;
  }

  // 年齢認証ページにアクセス
  await page.goto(siteConfig.baseUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  // 「はい」または「入場する」ボタンをクリック
  const enterSelectors = [
    'a[href*="index?lang=ja"]',
    'a[href*="index2"]',
    'a:contains("入場")',
    'a:contains("はい")',
    '.enter-button',
  ];

  for (const selector of enterSelectors) {
    try {
      const button = await page.$(selector);
      if (button) {
        const text = await button.evaluate((el: Element) => el.textContent?.trim());
        console.log(`  Found enter button: "${text}"`);
        await button.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        break;
      }
    } catch {
      // 次のセレクタを試す
    }
  }

  console.log('✅ 年齢認証通過完了');
}

/**
 * リストページから商品IDを抽出
 */
async function extractProductIdsFromList(page: Page, siteConfig: JskySiteConfig, pageNum: number): Promise<string[]> {
  const url = siteConfig.listPageUrl.replace('{page}', pageNum.toString());
  console.log(`📄 Fetching list page: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // ページがロードされるまで待機
  await new Promise((r) => setTimeout(r, 3000));

  // スクロールして動的コンテンツをロード（より多くスクロール）
  await page.evaluate(async () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    let currentPosition = 0;

    while (currentPosition < scrollHeight) {
      currentPosition += viewportHeight;
      window.scrollTo(0, currentPosition);
      await new Promise((r) => setTimeout(r, 800));
    }

    // 最後までスクロールした後、少し上に戻って再度下にスクロール
    window.scrollTo(0, scrollHeight / 2);
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, scrollHeight);
  });

  await new Promise((r) => setTimeout(r, 3000));

  // HTMLを取得
  const html = await page.content();
  const $ = cheerio.load(html);

  const productIds: string[] = [];

  // 商品リンクを抽出
  $('a[href*="/product/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(siteConfig.productIdPattern);
    if (match && match[1]) {
      const productId = match[1];
      if (!productIds.includes(productId)) {
        productIds.push(productId);
      }
    }
  });

  console.log(`  Found ${productIds.length} products on page ${pageNum}`);
  return productIds;
}

/**
 * 商品詳細ページから情報を抽出
 */
async function extractProductDetails(
  page: Page,
  siteConfig: JskySiteConfig,
  productId: string,
): Promise<TokyoHotProduct | null> {
  const url = `${siteConfig.baseUrl}/product/${productId}/?lang=ja`;
  console.log(`  📦 Fetching detail: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    // タイトル抽出
    let title = $('title').text().trim();
    // " | Tokyo-Hot" などのサフィックスを除去
    title = title.replace(/\s*\|.*$/, '').trim();

    if (!title || title.includes('404') || title.includes('ページが見つかりません')) {
      console.log(`  ⚠️ Product not found: ${productId}`);
      return null;
    }

    // 説明文
    const description = $('meta[name="description"]').attr('content') || '';

    // 出演者（キーワードから抽出）
    const performers: string[] = [];
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    const keywordList = keywords.split(',').map((k) => k.trim());

    for (const keyword of keywordList) {
      // 商品IDは除外
      if (/^n?\d+$/.test(keyword)) continue;
      // 英語の一般的なキーワードは除外
      if (/^[a-z]+$/i.test(keyword) && keyword.length < 4) continue;

      if (isValidPerformerName(keyword)) {
        const normalized = normalizePerformerName(keyword);
        if (normalized && !performers.includes(normalized)) {
          performers.push(normalized);
        }
      }
    }

    // 詳細情報テーブルから抽出
    let releaseDate: string | null = null;
    let duration: number | null = null;
    const genres: string[] = [];

    // 公開日を探す
    $('dt, th').each((_, el) => {
      const label = $(el).text().trim();
      const value = $(el).next('dd, td').text().trim();

      if (label.includes('配信開始日') || label.includes('公開日') || label.includes('Release')) {
        const dateMatch = value.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
        if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
          releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        }
      }

      if (label.includes('収録時間') || label.includes('再生時間') || label.includes('Duration')) {
        // parse-helpersを使用
        duration = parseDuration(value);
      }

      if (label.includes('カテゴリ') || label.includes('タグ') || label.includes('ジャンル')) {
        $(el)
          .next('dd, td')
          .find('a')
          .each((_, a) => {
            const genre = $(a).text().trim();
            if (genre && !genres.includes(genre)) {
              genres.push(genre);
            }
          });
      }
    });

    // サムネイル画像
    let thumbnailUrl = '';
    const mainImg = $('img[src*="jacket"], img.main-image, .product-image img').first();
    if (mainImg.length > 0) {
      thumbnailUrl = mainImg.attr('src') || '';
      if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
        thumbnailUrl = siteConfig.baseUrl + thumbnailUrl;
      }
    }

    // OGイメージをフォールバック
    if (!thumbnailUrl) {
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        thumbnailUrl = ogImage;
      }
    }

    // サンプル画像
    const sampleImages: string[] = [];
    $('img[src*="cap"], img[src*="sample"], .gallery img, .screenshots img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (src) {
        if (!src.startsWith('http')) {
          src = siteConfig.baseUrl + src;
        }
        if (!sampleImages.includes(src)) {
          sampleImages.push(src);
        }
      }
    });

    // 価格情報（月額制サイトの料金）
    let price: number | null = null;
    // Tokyo-Hotの価格パターンを検索
    const pricePatterns = [
      /\$(\d+(?:\.\d{2})?)\s*(?:\/month|月)/i,
      /[¥￥](\d{1,3}(?:,\d{3})*)/,
      /(\d{1,3}(?:,\d{3})*)\s*円/,
    ];
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        price = extractPrice(match[0]);
        if (price) break;
      }
    }

    return {
      productId,
      title,
      description,
      performers,
      releaseDate,
      duration,
      thumbnailUrl,
      sampleImages,
      genres,
      price,
      rawHtml: html, // ハッシュ計算用
    };
  } catch (error) {
    console.error(`  ❌ Error fetching ${productId}:`, error);
    return null;
  }
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(
  siteConfig: JskySiteConfig,
  product: TokyoHotProduct,
  forceReprocess: boolean = false,
): Promise<{ saved: boolean; isNew: boolean; skippedUnchanged: boolean }> {
  try {
    const normalizedProductId = `${siteConfig.aspName}-${product['productId']}`;

    // ハッシュベースの重複検出（GCS優先）
    const upsertResult = await upsertRawHtmlDataWithGcs(
      siteConfig.aspName,
      product['productId'],
      `${siteConfig.baseUrl}/product/${product['productId']}/`,
      product.rawHtml,
    );

    // ハッシュ変更なし、かつ処理済みならスキップ
    if (upsertResult.shouldSkip && !forceReprocess) {
      console.log(`  ⏭️ スキップ(変更なし): ${product['productId']}`);
      return { saved: false, isNew: false, skippedUnchanged: true };
    }

    // 既存チェック
    const existingProduct = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    const isNew = existingProduct.length === 0;

    // 新規作成または更新
    let productId: number;
    if (isNew) {
      const [newProduct] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: product['title'],
          description: product['description'] || null,
          defaultThumbnailUrl: product['thumbnailUrl'] || null,
          releaseDate: product['releaseDate'] || null,
          duration: product['duration'] || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: products['id'] });
      productId = newProduct!.id;
      console.log(`  ✓ 新規商品作成 (product_id: ${productId})`);
    } else {
      productId = existingProduct[0]!['id'];
      await db
        .update(products)
        .set({
          title: product['title'],
          description: product['description'] || null,
          defaultThumbnailUrl: product['thumbnailUrl'] || null,
          releaseDate: product['releaseDate'] || null,
          duration: product['duration'] || null,
          updatedAt: new Date(),
        })
        .where(eq(products['id'], productId));
      console.log(`  ✓ 商品更新 (product_id: ${productId})`);
    }

    // ProductSource（価格情報含む）
    await db['insert'](productSources)
      .values({
        productId: productId,
        aspName: siteConfig.aspName,
        originalProductId: product['productId'],
        affiliateUrl: `${siteConfig.baseUrl}/product/${product['productId']}/`,
        price: product['price'], // 月額料金
        dataSource: 'SCRAPE',
        isSubscription: true, // JSKY系は月額制
      })
      .onConflictDoUpdate({
        target: [productSources.productId, productSources.aspName],
        set: {
          affiliateUrl: `${siteConfig.baseUrl}/product/${product['productId']}/`,
          price: product['price'],
          lastUpdated: new Date(),
        },
      });

    // 出演者
    for (const performerName of product.performers) {
      if (!isValidPerformerForProduct(performerName, product['title'])) {
        continue;
      }

      let [existingPerformer] = await db
        .select()
        .from(performers)
        .where(eq(performers['name'], performerName))
        .limit(1);

      if (!existingPerformer) {
        [existingPerformer] = await db
          .insert(performers)
          .values({
            name: performerName,
          })
          .returning();
      }

      await db
        .insert(productPerformers)
        .values({
          productId: productId,
          performerId: existingPerformer!.id,
        })
        .onConflictDoNothing();
    }

    // サンプル画像
    for (let i = 0; i < product.sampleImages.length; i++) {
      const imageUrl = product.sampleImages[i];
      if (!imageUrl) continue;
      await db
        .insert(productImages)
        .values({
          productId: productId,
          imageUrl,
          imageType: 'sample',
          displayOrder: i,
          aspName: siteConfig.aspName,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 処理済みマーク
    await markRawDataAsProcessed('tokyohot', upsertResult.id);

    console.log(`  ✅ ${isNew ? '新規保存' : '更新'}: ${product['title']}`);
    if (product['price']) {
      console.log(`  💰 月額料金: ¥${product['price'].toLocaleString()}`);
    }
    return { saved: true, isNew, skippedUnchanged: false };
  } catch (error) {
    console.error(`  ❌ Error saving ${product['productId']}:`, error);
    return { saved: false, isNew: false, skippedUnchanged: false };
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('🚀 Tokyo-Hot（JSKY系）クローラーを開始します...\n');

  // コマンドライン引数
  const args = process.argv.slice(2);
  const siteArg = args.find((a) => a.startsWith('--site='))?.split('=')[1] || 'tokyo-hot';
  const pagesArg = args.find((a) => a.startsWith('--pages='))?.split('=')[1];
  const startPageArg = args.find((a) => a.startsWith('--start-page='))?.split('=')[1];
  const forceReprocess = args.includes('--force');

  const pages = pagesArg ? parseInt(pagesArg) : 5;
  const startPage = startPageArg ? parseInt(startPageArg) : 1;

  const siteConfig = JSKY_SITES[siteArg];
  if (!siteConfig) {
    console.error(`Unknown site: ${siteArg}`);
    console.log('Available sites:', Object.keys(JSKY_SITES).join(', '));
    process.exit(1);
  }

  console.log(`📍 Site: ${siteConfig.name}`);
  console.log(`📄 Pages: ${startPage} to ${startPage + pages - 1}`);
  console.log(`🔄 強制再処理: ${forceReprocess ? '有効' : '無効'}\n`);

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkippedUnchanged = 0;
  let totalErrors = 0;
  let consecutiveEmptyPages = 0;
  const MAX_CONSECUTIVE_EMPTY_PAGES = 200;

  try {
    const browserInstance = await initBrowser();
    const page = await browserInstance.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // 年齢認証を通過
    await passAgeVerification(page, siteConfig);

    for (let pageNum = startPage; pageNum < startPage + pages; pageNum++) {
      console.log(`\n📖 Processing page ${pageNum}...`);

      const productIds = await extractProductIdsFromList(page, siteConfig, pageNum);

      if (productIds.length === 0) {
        consecutiveEmptyPages++;
        console.log(`  空ページ検出 (${consecutiveEmptyPages}/${MAX_CONSECUTIVE_EMPTY_PAGES})`);
        if (consecutiveEmptyPages >= MAX_CONSECUTIVE_EMPTY_PAGES) {
          console.log('  連続空ページ上限到達、終了します');
          break;
        }
        await rateLimit();
        continue;
      }
      consecutiveEmptyPages = 0; // リセット

      for (const productId of productIds) {
        await rateLimit();

        const product = await extractProductDetails(page, siteConfig, productId);
        if (!product) {
          totalErrors++;
          continue;
        }

        const result = await saveProduct(siteConfig, product, forceReprocess);
        if (result.saved) {
          if (result.isNew) {
            totalNew++;
          } else {
            totalUpdated++;
          }
        } else if (result.skippedUnchanged) {
          totalSkippedUnchanged++;
        } else {
          totalErrors++;
        }
      }

      await rateLimit();
    }

    await page.close();
  } finally {
    await closeBrowser();
  }

  console.log('\n========================================');
  console.log('クロール完了');
  console.log(`  新規: ${totalNew}`);
  console.log(`  更新: ${totalUpdated}`);
  console.log(`  スキップ(変更なし): ${totalSkippedUnchanged}`);
  console.log(`  エラー: ${totalErrors}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
