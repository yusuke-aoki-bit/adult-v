/**
 * ソクミル Puppeteerクローラー (puppeteer-extra + stealth)
 *
 * APIが500エラーを返すため、HTML スクレイピングで商品を取得
 * curlは403を返すため、Puppeteer + stealthで回避
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos, rawHtmlData } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

// Stealthプラグインを適用
puppeteer.use(StealthPlugin());

const db = getDb();

const SOURCE_NAME = 'ソクミル';
const BASE_URL = 'https://www.sokmil.com';
const AFFILIATE_ID = process.env.SOKMIL_AFFILIATE_ID || '';

interface SokmilProduct {
  productId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleImages: string[];
  sampleVideoUrl?: string;
  releaseDate?: string;
  duration?: number;
  price?: number;
  maker?: string;
  label?: string;
  genres: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

/**
 * アフィリエイトURLを生成
 */
function generateAffiliateUrl(productId: string): string {
  const baseUrl = `${BASE_URL}/page/v/?id=${productId}`;
  if (AFFILIATE_ID) {
    return `${baseUrl}&affiliate=${AFFILIATE_ID}`;
  }
  return baseUrl;
}

/**
 * 一覧ページから商品IDを取得
 */
async function fetchProductListPage(page: any, pageNum: number): Promise<string[]> {
  // さまざまなURLパターンを試す
  const urls = [
    `${BASE_URL}/av/newrelease/?page=${pageNum}`,
    `${BASE_URL}/top/newrelease/?page=${pageNum}`,
  ];

  const url = urls[0];
  console.log(`📋 一覧ページ取得中: ${url}`);

  try {
    await randomDelay(1500, 3000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 現在のURL確認
    const currentUrl = page.url();
    console.log(`  現在URL: ${currentUrl}`);

    // ページ構造をデバッグ
    const debugInfo = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a')).slice(0, 50);
      return allLinks.map(a => ({
        href: a.getAttribute('href'),
        text: a.textContent?.trim().substring(0, 30),
      }));
    });
    console.log(`  リンクサンプル:`, debugInfo.slice(0, 10));

    // 商品IDを抽出（複数パターン）
    const productIds = await page.evaluate(() => {
      const ids: string[] = [];

      // すべてのリンクをチェック
      document.querySelectorAll('a').forEach(elem => {
        const href = (elem as HTMLAnchorElement).href || elem.getAttribute('href') || '';

        // パターン1: /page/v/?id= 形式
        let match = href.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
          return;
        }

        // パターン2: /page/v/ID 形式
        match = href.match(/\/page\/v\/([a-zA-Z0-9_-]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
          return;
        }

        // パターン3: /av/detail/ID 形式
        match = href.match(/\/av\/detail\/([a-zA-Z0-9_-]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
          return;
        }

        // パターン4: /detail/ID 形式
        match = href.match(/\/detail\/([a-zA-Z0-9_-]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
          return;
        }

        // パターン5: ?pid=ID 形式
        match = href.match(/[?&]pid=([a-zA-Z0-9_-]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
          return;
        }
      });

      // data-id属性からも抽出
      document.querySelectorAll('[data-id], [data-product-id], [data-pid]').forEach(elem => {
        const id = elem.getAttribute('data-id') || elem.getAttribute('data-product-id') || elem.getAttribute('data-pid');
        if (id && !ids.includes(id)) {
          ids.push(id);
        }
      });

      return ids;
    });

    console.log(`  ✓ ${productIds.length}件の商品ID取得`);
    if (productIds.length > 0) {
      console.log(`  サンプルID:`, productIds.slice(0, 5));
    }
    return productIds;
  } catch (error) {
    console.error(`  ❌ 一覧取得エラー: ${error}`);
    return [];
  }
}

/**
 * 詳細ページから商品情報を抽出
 */
async function parseDetailPage(page: any, productId: string): Promise<SokmilProduct | null> {
  // 様々なURL形式を試す
  const urlPatterns = [
    `${BASE_URL}/page/v/?id=${productId}`,
    `${BASE_URL}/av/detail/${productId}/`,
  ];

  try {
    // キャッシュ確認
    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, SOURCE_NAME),
          eq(rawHtmlData.productId, productId)
        )
      )
      .limit(1);

    let html: string;

    if (existingRaw.length > 0) {
      html = existingRaw[0].htmlContent;
      console.log(`  ⚡ キャッシュ使用: ${productId}`);
    } else {
      console.log(`  🔍 詳細ページ取得中: ${productId}`);

      await randomDelay(2000, 4000);
      await page.goto(urlPatterns[0], { waitUntil: 'networkidle2', timeout: 30000 });

      html = await page.content();

      // 生HTMLを保存
      const hash = createHash('sha256').update(html).digest('hex');
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId,
        url: page.url(),
        htmlContent: html,
        hash,
      }).onConflictDoUpdate({
        target: [rawHtmlData.source, rawHtmlData.productId],
        set: {
          htmlContent: html,
          hash,
          crawledAt: new Date(),
        },
      });
    }

    // ページ内で情報を抽出
    const productInfo = await page.evaluate(() => {
      // タイトル
      let title = '';
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        title = ogTitle.getAttribute('content')?.trim() || '';
      }
      if (!title) {
        const h1 = document.querySelector('h1');
        if (h1) {
          title = h1.textContent?.trim() || '';
        }
      }

      // 説明
      const descMeta = document.querySelector('meta[name="description"]');
      const description = descMeta?.getAttribute('content')?.trim() || '';

      // サムネイル
      const ogImage = document.querySelector('meta[property="og:image"]');
      let thumbnailUrl = ogImage?.getAttribute('content') || '';
      if (!thumbnailUrl) {
        const mainImg = document.querySelector('img.main-image, img.package, img.jacket, .product-image img') as HTMLImageElement;
        if (mainImg) {
          thumbnailUrl = mainImg.src || '';
        }
      }

      // 出演者
      const performerList: string[] = [];
      document.querySelectorAll('a[href*="actress"], a[href*="performer"], a[href*="/av/"]').forEach(elem => {
        const name = elem.textContent?.trim();
        if (name && name.length > 1 && name.length < 30 && !name.includes('一覧') && !performerList.includes(name)) {
          performerList.push(name);
        }
      });

      // サンプル画像
      const sampleImages: string[] = [];
      document.querySelectorAll('img[src*="sample"], img[src*="capture"], .gallery img, .sample-images img').forEach(elem => {
        const src = (elem as HTMLImageElement).src || elem.getAttribute('data-src');
        if (src && src.startsWith('http') && !sampleImages.includes(src)) {
          sampleImages.push(src);
        }
      });

      // サンプル動画
      let sampleVideoUrl = '';
      const videoSource = document.querySelector('video source, video') as HTMLVideoElement;
      if (videoSource) {
        sampleVideoUrl = videoSource.src || videoSource.querySelector('source')?.src || '';
      }

      // ジャンル
      const genres: string[] = [];
      document.querySelectorAll('a[href*="genre"], a[href*="category"], .tag-link, .genre-link').forEach(elem => {
        const genre = elem.textContent?.trim();
        if (genre && genre.length < 30 && !genres.includes(genre)) {
          genres.push(genre);
        }
      });

      return {
        title,
        description,
        thumbnailUrl,
        performers: performerList.slice(0, 20),
        sampleImages: sampleImages.slice(0, 20),
        sampleVideoUrl,
        genres: genres.slice(0, 10),
      };
    });

    // フォールバック
    if (!productInfo.title || productInfo.title.length > 200) {
      productInfo.title = `ソクミル-${productId}`;
    }

    return {
      productId,
      title: productInfo.title,
      description: productInfo.description,
      performers: productInfo.performers,
      thumbnailUrl: productInfo.thumbnailUrl,
      sampleImages: productInfo.sampleImages,
      sampleVideoUrl: productInfo.sampleVideoUrl,
      genres: productInfo.genres,
    };
  } catch (error) {
    console.error(`  ❌ 詳細取得エラー (${productId}): ${error}`);
    return null;
  }
}

/**
 * 商品をDBに保存
 */
async function saveProduct(product: SokmilProduct): Promise<number | null> {
  try {
    const normalizedProductId = `sokmil-${product.productId}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productDbId: number;
    let isNew = false;

    if (existing.length > 0) {
      productDbId = existing[0].id;
      console.log(`    ⏭️ 既存商品 (ID: ${productDbId})`);

      // 更新
      await db.update(products).set({
        title: product.title,
        description: product.description || '',
        defaultThumbnailUrl: product.thumbnailUrl,
        updatedAt: new Date(),
      }).where(eq(products.id, productDbId));

    } else {
      // 新規商品作成
      const [inserted] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: product.title,
          description: product.description || '',
          defaultThumbnailUrl: product.thumbnailUrl,
        })
        .returning({ id: products.id });

      productDbId = inserted.id;
      isNew = true;
      console.log(`    ✅ 新規商品作成 (ID: ${productDbId})`);
    }

    // product_sources upsert
    const affiliateUrl = generateAffiliateUrl(product.productId);
    await db.insert(productSources).values({
      productId: productDbId,
      aspName: SOURCE_NAME,
      originalProductId: product.productId,
      affiliateUrl,
      dataSource: 'CRAWL',
    }).onConflictDoUpdate({
      target: [productSources.productId, productSources.aspName],
      set: {
        affiliateUrl,
        lastUpdated: new Date(),
      },
    });

    // 出演者登録
    for (const performerName of product.performers) {
      const [performer] = await db
        .select()
        .from(performers)
        .where(eq(performers.name, performerName))
        .limit(1);

      let performerId: number;
      if (performer) {
        performerId = performer.id;
      } else {
        const [inserted] = await db
          .insert(performers)
          .values({ name: performerName })
          .returning({ id: performers.id });
        performerId = inserted.id;
      }

      await db.insert(productPerformers).values({
        productId: productDbId,
        performerId,
      }).onConflictDoNothing();
    }

    // サンプル画像保存
    if (product.thumbnailUrl) {
      await db.insert(productImages).values({
        productId: productDbId,
        imageUrl: product.thumbnailUrl,
        imageType: 'thumbnail',
        displayOrder: 0,
        aspName: SOURCE_NAME,
      }).onConflictDoNothing();
    }

    for (let i = 0; i < product.sampleImages.length; i++) {
      await db.insert(productImages).values({
        productId: productDbId,
        imageUrl: product.sampleImages[i],
        imageType: 'sample',
        displayOrder: i + 1,
        aspName: SOURCE_NAME,
      }).onConflictDoNothing();
    }

    // サンプル動画保存
    if (product.sampleVideoUrl) {
      await db.insert(productVideos).values({
        productId: productDbId,
        videoUrl: product.sampleVideoUrl,
        videoType: 'sample',
        aspName: SOURCE_NAME,
        displayOrder: 0,
      }).onConflictDoNothing();
      console.log(`    🎬 サンプル動画保存完了`);
    }

    return productDbId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const startPageArg = args.find(arg => arg.startsWith('--start='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 100;
  const startPage = startPageArg ? parseInt(startPageArg.split('=')[1]) : 1;

  console.log('=== ソクミル Puppeteerクローラー (stealth mode) ===\n');
  console.log(`設定: limit=${limit}, startPage=${startPage}\n`);

  // Puppeteer (with stealth) を起動
  console.log('ブラウザを起動中 (stealth mode)...');
  const browser = await puppeteer.launch({
    headless: true,
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

  const page = await browser.newPage();

  // ユーザーエージェントを設定
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // ビューポートを設定
  await page.setViewport({ width: 1920, height: 1080 });

  // 言語設定
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  });

  let totalFound = 0;
  let totalSaved = 0;
  const maxPages = 100;
  const processedIds = new Set<string>();

  console.log('一覧ページを巡回します...\n');

  // まず年齢認証ページにアクセスして認証を通過
  console.log('年齢認証を通過します...');
  try {
    // 年齢認証ページにアクセス
    await page.goto(`${BASE_URL}/member/ageauth/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // ページのHTMLを取得して年齢認証ボタンを探す
    const pageContent = await page.content();
    console.log(`  ページ長: ${pageContent.length}文字`);

    // XPathやJSでボタンを探してクリック
    const clicked = await page.evaluate(() => {
      // すべてのリンクを取得
      const links = Array.from(document.querySelectorAll('a'));

      // 「はい」「18歳以上」「ENTER」などのテキストを含むリンクを探す
      for (const link of links) {
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';

        if (
          text.includes('はい') ||
          text.includes('18歳以上') ||
          text.includes('Enter') ||
          text.includes('ENTER') ||
          text.includes('Yes') ||
          text.includes('YES') ||
          href.includes('yes') ||
          href.includes('enter') ||
          href.includes('adult=1')
        ) {
          console.log('年齢認証リンクを発見:', text, href);
          link.click();
          return true;
        }
      }

      // ボタンも探す
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      for (const btn of buttons) {
        const text = (btn as HTMLElement).textContent?.trim() || (btn as HTMLInputElement).value || '';
        if (
          text.includes('はい') ||
          text.includes('18歳以上') ||
          text.includes('Enter') ||
          text.includes('Yes')
        ) {
          (btn as HTMLElement).click();
          return true;
        }
      }

      return false;
    });

    if (clicked) {
      console.log('  ✓ 年齢認証ボタンをクリック');
      await sleep(3000);
    } else {
      console.log('  ⚠️ 年齢認証ボタンが見つかりません');

      // フォームがあれば直接送信
      const hasForm = await page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        if (forms.length > 0) {
          forms[0].submit();
          return true;
        }
        return false;
      });

      if (hasForm) {
        console.log('  ✓ フォームを送信');
        await sleep(3000);
      }
    }

    // クッキーを設定
    await page.setCookie({
      name: 'adult',
      value: '1',
      domain: 'www.sokmil.com',
      path: '/',
    });
    await page.setCookie({
      name: 'age_confirmed',
      value: 'true',
      domain: 'www.sokmil.com',
      path: '/',
    });

    console.log('  ✓ クッキー設定完了');

    // 確認のためもう一度トップにアクセス
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    const currentUrl = page.url();
    console.log(`  現在URL: ${currentUrl}`);

    if (currentUrl.includes('ageauth')) {
      console.log('  ⚠️ まだ年齢認証ページ。別の方法を試します...');

      // 直接リンクからクリック
      await page.evaluate(() => {
        const allLinks = document.querySelectorAll('a');
        for (const link of allLinks) {
          if (!link.getAttribute('href')?.includes('ageauth')) {
            link.click();
            return;
          }
        }
      });
      await sleep(2000);
    }

  } catch (error) {
    console.log(`  ⚠️ 年齢認証処理中にエラー: ${error}`);
  }

  for (let pageNum = startPage; pageNum <= maxPages && totalFound < limit; pageNum++) {
    console.log(`\n--- ページ ${pageNum} ---`);

    const productIds = await fetchProductListPage(page, pageNum);

    if (productIds.length === 0) {
      console.log('商品が見つかりません。終了...');
      break;
    }

    for (const productId of productIds) {
      if (totalFound >= limit) break;
      if (processedIds.has(productId)) continue;

      processedIds.add(productId);
      console.log(`\n[${totalFound + 1}/${limit}] 商品ID: ${productId}`);

      const product = await parseDetailPage(page, productId);

      if (product) {
        console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
        console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);

        const savedId = await saveProduct(product);
        if (savedId) {
          totalSaved++;
        }
        totalFound++;
      }
    }
  }

  await browser.close();

  console.log('\n=== クロール完了 ===');
  console.log(`取得件数: ${totalFound}`);
  console.log(`保存件数: ${totalSaved}`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = ${SOURCE_NAME}
  `);
  console.log(`\nソクミル総商品数: ${(stats.rows[0] as any).count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
