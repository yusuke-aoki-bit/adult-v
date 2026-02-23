/**
 * FC2動画アダルト クローラー (Puppeteer + Stealth)
 *
 * 対象URL:
 * - https://video.fc2.com/a/?_tct=&d=2 (アダルト動画一覧)
 * - https://adult.contents.fc2.com/ (コンテンツマーケット)
 *
 * 機能:
 * - 双方向クロール: 新着順リストと古いIDの両方をスキャン
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fc2-video.ts [--limit 100] [--source video|contents] [--no-bidirectional]
 */

if (!process.env['DATABASE_URL']) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productVideos, rawHtmlData } from '../lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { createHash } from 'crypto';
import { saveRawHtml as saveRawHtmlToGcs, calculateHash } from '../lib/gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../lib/sale-helper';

// Stealthプラグインを適用
puppeteer.use(StealthPlugin());

const db = getDb();

// FC2アフィリエイト設定
const FC2_AFFUID = process.env['FC2_AFFUID'] || 'TVRFNU5USTJOVEE9';

interface FC2VideoProduct {
  videoId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  duration?: number;
  price?: number;
  saleInfo?: SaleInfo;
  source: 'video' | 'contents';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

/**
 * video.fc2.com/a/ からアダルト動画一覧を取得
 * 注意: video.fc2.comのIDは「20231002yP66Dapk」のような日付+コード形式
 */
async function fetchVideoFC2ListPage(page: any, pageNum: number): Promise<string[]> {
  // ユーザー指定URL: https://video.fc2.com/a/?_tct=&d=2
  const url =
    pageNum === 1 ? `https://video.fc2.com/a/?_tct=&d=2` : `https://video.fc2.com/a/?_tct=&d=2&page=${pageNum}`;
  console.log(`📋 一覧ページ取得中: ${url}`);

  try {
    // 年齢認証クッキーを事前に設定
    await page.setCookie({
      name: 'age_check',
      value: '1',
      domain: 'video.fc2.com',
    });

    await randomDelay(1500, 3000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // ページ読み込み後、JSレンダリング待機
    await sleep(3000);

    // 動画IDを抽出 - video.fc2.comの特殊形式（日付+コード）
    const videoIds = await page.evaluate(() => {
      const ids: string[] = [];

      // data-id 属性から取得（形式: 20231002yP66Dapk）
      document.querySelectorAll('[data-id]').forEach((elem) => {
        const dataId = elem.getAttribute('data-id');
        // video.fc2.comのID形式: 日付(8桁) + 英数字コード
        if (dataId && /^\d{8,}[a-zA-Z0-9]+$/.test(dataId) && !ids.includes(dataId)) {
          ids.push(dataId);
        }
      });

      return ids;
    });

    console.log(`  ✓ ${videoIds.length}件の動画ID取得`);
    if (videoIds.length > 0) {
      console.log(`  サンプルID:`, videoIds.slice(0, 5));
    }
    return videoIds;
  } catch (error) {
    console.error(`  ❌ 一覧取得エラー: ${error}`);
    return [];
  }
}

/**
 * adult.contents.fc2.com からコンテンツマーケット一覧を取得
 * IDは純粋な数字形式（例: 4801047）
 */
async function fetchContentsFC2ListPage(page: any, pageNum: number): Promise<string[]> {
  // ユーザー指定のURL（新着一覧）
  const url = pageNum === 1 ? `https://adult.contents.fc2.com/` : `https://adult.contents.fc2.com/?page=${pageNum}`;
  console.log(`📋 一覧ページ取得中: ${url}`);

  try {
    // 年齢認証クッキーを事前に設定
    await page.setCookie({
      name: 'contents_adult',
      value: '1',
      domain: 'adult.contents.fc2.com',
    });

    await randomDelay(1500, 3000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // JSレンダリング待機
    await sleep(3000);

    // 商品IDを抽出 - /article/数字/ パターンとdata-id
    const articleIds = await page.evaluate(() => {
      const ids: string[] = [];

      // 方法1: リンクから /article/数字/ パターンを抽出
      document.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/article\/(\d+)/);
        if (match && match[1] && !ids.includes(match[1])) {
          ids.push(match[1]);
        }
      });

      // 方法2: data-id属性（純粋な数字のみ）
      document.querySelectorAll('[data-id]').forEach((elem) => {
        const id = elem.getAttribute('data-id');
        // 純粋な数字かつ適切な長さ（FC2 contents IDは7桁程度）
        if (id && /^\d{6,8}$/.test(id) && !ids.includes(id)) {
          ids.push(id);
        }
      });

      return ids;
    });

    console.log(`  ✓ ${articleIds.length}件の商品ID取得`);
    if (articleIds.length > 0) {
      console.log(`  サンプルID:`, articleIds.slice(0, 5));
    }
    return articleIds;
  } catch (error) {
    console.error(`  ❌ 一覧取得エラー: ${error}`);
    return [];
  }
}

/**
 * video.fc2.com の詳細ページから情報を取得
 * videoIdは「20231002yP66Dapk」のような日付+コード形式
 */
async function fetchVideoDetailPage(page: any, videoId: string): Promise<FC2VideoProduct | null> {
  // video.fc2.comのURLは /a/content/日付+コード 形式
  const url = `https://video.fc2.com/a/content/${videoId}`;
  console.log(`  🔍 詳細ページ取得中: ${videoId}`);

  try {
    await randomDelay(1500, 3000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();

    // 生HTMLを保存（GCS優先、hash比較で重複回避）
    const hash = calculateHash(html);

    // 既存データをチェック
    const existingRaw = await db
      .select({ id: rawHtmlData.id, hash: rawHtmlData.hash })
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, 'FC2-video'), eq(rawHtmlData.productId, videoId)))
      .limit(1);

    if (existingRaw.length > 0 && existingRaw[0]?.hash === hash) {
      console.log(`    ⏭️ 変更なし: ${videoId} (hash match)`);
    } else {
      const { gcsUrl, htmlContent } = await saveRawHtmlToGcs('fc2-video', videoId, html);

      if (existingRaw.length > 0 && existingRaw[0]) {
        await db
          .update(rawHtmlData)
          .set({ htmlContent, gcsUrl, hash, crawledAt: new Date(), processedAt: null })
          .where(eq(rawHtmlData.id, existingRaw[0]['id']));
        console.log(`    🔄 更新完了${gcsUrl ? ' (GCS)' : ' (DB)'}`);
      } else {
        await db['insert'](rawHtmlData).values({
          source: 'FC2-video',
          productId: videoId,
          url,
          htmlContent,
          gcsUrl,
          hash,
        });
        console.log(`    💾 保存完了${gcsUrl ? ' (GCS)' : ' (DB)'}`);
      }
    }

    // 情報を抽出
    const info = await page.evaluate(() => {
      // タイトル
      const titleEl = document.querySelector('h2.video_title, h1, .title_area h2, meta[property="og:title"]');
      let title = '';
      if (titleEl) {
        title = titleEl.textContent?.trim() || (titleEl as HTMLMetaElement).content || '';
      }

      // サムネイル
      const thumbEl = document.querySelector('meta[property="og:image"], .video_main img, #video_player img') as
        | HTMLMetaElement
        | HTMLImageElement
        | null;
      const thumbnailUrl = (thumbEl as HTMLMetaElement)?.content || (thumbEl as HTMLImageElement)?.src || null;

      // 再生時間（分単位で保存）
      const durationEl = document.querySelector('.video_info .duration, .time');
      let duration: number | null = null;
      if (durationEl) {
        const match = durationEl.textContent?.match(/(\d+):(\d+)/);
        if (match && match[1]) {
          // 分:秒 形式なので、分部分のみ取得（products['duration']は分単位）
          duration = parseInt(match[1]);
        }
      }

      // 価格とセール情報
      let price: number | null = null;
      let regularPrice: number | null = null;
      let discountPercent: number | null = null;

      // パターン1: 取り消し線の価格（元値）
      const delPriceEl = document.querySelector('.price del, .price s, .price strike, .original_price');
      if (delPriceEl) {
        const match = delPriceEl.textContent?.match(/(\d{1,3}(?:,\d{3})*)/);
        if (match && match[1]) {
          regularPrice = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // パターン2: 現在価格
      const priceEl = document.querySelector('.price, .video_price, .sale_price, .current_price');
      if (priceEl) {
        const priceText = priceEl.textContent || '';
        // 取り消し線でない価格を取得
        const match = priceText.replace(/<del>.*?<\/del>/g, '').match(/(\d{1,3}(?:,\d{3})*)/);
        if (match && match[1]) {
          price = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // パターン3: %OFF表記
      const offMatch = document.body.innerText.match(/(\d+)\s*%\s*(?:OFF|オフ|off)/);
      if (offMatch && offMatch[1]) {
        discountPercent = parseInt(offMatch[1]);
      }

      // 説明
      const descEl = document.querySelector('.video_description, .description, meta[name="description"]');
      const description = descEl?.textContent?.trim() || (descEl as HTMLMetaElement)?.content || undefined;

      return { title, thumbnailUrl, duration, price, regularPrice, discountPercent, description };
    });

    if (!info['title']) {
      console.log(`    ⚠️ タイトル取得失敗`);
      return null;
    }

    // セール情報を構築
    let saleInfo: SaleInfo | undefined;
    if (info.regularPrice && info['price'] && info.regularPrice > info['price']) {
      saleInfo = {
        regularPrice: info.regularPrice,
        salePrice: info['price'],
        discountPercent: info.discountPercent || Math.round((1 - info['price'] / info.regularPrice) * 100),
        saleType: 'sale',
      };
      console.log(`    💰 Sale detected: ¥${info.regularPrice.toLocaleString()} → ¥${info['price'].toLocaleString()}`);
    }

    const thumbnailUrl = info['thumbnailUrl'] || undefined;
    const duration = info['duration'] || undefined;
    const price = info['price'] || undefined;
    return {
      videoId,
      title: info['title'],
      description: info['description'],
      performers: [],
      ...(thumbnailUrl && { thumbnailUrl }),
      ...(duration && { duration }),
      ...(price && { price }),
      ...(saleInfo && { saleInfo }),
      source: 'video',
    };
  } catch (error) {
    console.error(`    ❌ 詳細取得エラー: ${error}`);
    return null;
  }
}

/**
 * adult.contents.fc2.com の詳細ページから情報を取得
 */
async function fetchContentsDetailPage(page: any, articleId: string): Promise<FC2VideoProduct | null> {
  const url = `https://adult.contents.fc2.com/article/${articleId}/`;
  console.log(`  🔍 詳細ページ取得中: ${articleId}`);

  try {
    await randomDelay(1500, 3000);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();

    // 生HTMLを保存（GCS優先、hash比較で重複回避）
    const hash = calculateHash(html);

    // 既存データをチェック
    const existingRaw = await db
      .select({ id: rawHtmlData.id, hash: rawHtmlData.hash })
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, 'FC2-contents'), eq(rawHtmlData.productId, articleId)))
      .limit(1);

    if (existingRaw.length > 0 && existingRaw[0]?.hash === hash) {
      console.log(`    ⏭️ 変更なし: ${articleId} (hash match)`);
    } else {
      const { gcsUrl, htmlContent } = await saveRawHtmlToGcs('fc2-contents', articleId, html);

      if (existingRaw.length > 0 && existingRaw[0]) {
        await db
          .update(rawHtmlData)
          .set({ htmlContent, gcsUrl, hash, crawledAt: new Date(), processedAt: null })
          .where(eq(rawHtmlData.id, existingRaw[0]['id']));
        console.log(`    🔄 更新完了${gcsUrl ? ' (GCS)' : ' (DB)'}`);
      } else {
        await db['insert'](rawHtmlData).values({
          source: 'FC2-contents',
          productId: articleId,
          url,
          htmlContent,
          gcsUrl,
          hash,
        });
        console.log(`    💾 保存完了${gcsUrl ? ' (GCS)' : ' (DB)'}`);
      }
    }

    // 情報を抽出
    const info = await page.evaluate(() => {
      // タイトル
      let title = '';
      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
      const h1 = document.querySelector('h1, h2.title');
      if (ogTitle?.content) {
        title = ogTitle.content.trim();
      } else if (h1?.textContent) {
        title = h1.textContent.trim();
      }

      // サムネイル
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
      const thumbnailUrl = ogImage?.content || null;

      // 出演者
      const performers: string[] = [];
      document.querySelectorAll('a[href*="seller"], .seller_name, .author').forEach((el) => {
        const name = el.textContent?.trim();
        if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
          performers.push(name);
        }
      });

      // 価格とセール情報
      let price: number | null = null;
      let regularPrice: number | null = null;
      let discountPercent: number | null = null;

      // パターン1: 取り消し線の価格（元値）
      const delPriceEl = document.querySelector('del, s, strike, .original_price, .regular_price');
      if (delPriceEl) {
        const match = delPriceEl.textContent?.match(/(\d{1,3}(?:,\d{3})*)/);
        if (match && match[1]) {
          regularPrice = parseInt(match[1].replace(/,/g, ''));
        }
      }

      // パターン2: 現在価格
      const priceText = document.body.innerText.match(/(\d{1,3}(?:,\d{3})*)\s*(?:円|pt|ポイント)/);
      if (priceText && priceText[1]) {
        price = parseInt(priceText[1].replace(/,/g, ''));
      }

      // パターン3: 定価/通常価格表記
      if (!regularPrice) {
        const regularMatch = document.body.innerText.match(/(?:定価|通常|元)[価値:]?\s*(\d{1,3}(?:,\d{3})*)/);
        if (regularMatch && regularMatch[1]) {
          regularPrice = parseInt(regularMatch[1].replace(/,/g, ''));
        }
      }

      // パターン4: %OFF表記
      const offMatch = document.body.innerText.match(/(\d+)\s*%\s*(?:OFF|オフ|off)/);
      if (offMatch && offMatch[1]) {
        discountPercent = parseInt(offMatch[1]);
      }

      // 再生時間
      let duration: number | null = null;
      const durationText = document.body.innerText.match(/(\d+)\s*分/);
      if (durationText && durationText[1]) {
        duration = parseInt(durationText[1]);
      }

      // 説明
      const descEl = document.querySelector('meta[name="description"], .description') as
        | HTMLMetaElement
        | HTMLElement
        | null;
      const description = (descEl as HTMLMetaElement)?.content || descEl?.textContent?.trim() || undefined;

      return { title, thumbnailUrl, performers, price, regularPrice, discountPercent, duration, description };
    });

    if (!info['title']) {
      console.log(`    ⚠️ タイトル取得失敗`);
      return null;
    }

    // セール情報を構築
    let saleInfo: SaleInfo | undefined;
    if (info.regularPrice && info['price'] && info.regularPrice > info['price']) {
      saleInfo = {
        regularPrice: info.regularPrice,
        salePrice: info['price'],
        discountPercent: info.discountPercent || Math.round((1 - info['price'] / info.regularPrice) * 100),
        saleType: 'sale',
      };
      console.log(`    💰 Sale detected: ¥${info.regularPrice.toLocaleString()} → ¥${info['price'].toLocaleString()}`);
    }

    const thumbnailUrl2 = info['thumbnailUrl'] || undefined;
    const duration2 = info['duration'] || undefined;
    const price2 = info['price'] || undefined;
    return {
      videoId: articleId,
      title: info['title'],
      description: info['description'],
      performers: info.performers,
      ...(saleInfo && { saleInfo }),
      ...(thumbnailUrl2 && { thumbnailUrl: thumbnailUrl2 }),
      ...(duration2 && { duration: duration2 }),
      ...(price2 && { price: price2 }),
      source: 'contents',
    };
  } catch (error) {
    console.error(`    ❌ 詳細取得エラー: ${error}`);
    return null;
  }
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(product: FC2VideoProduct): Promise<number | null> {
  try {
    const normalizedProductId = `FC2-${product['source']}-${product.videoId}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (existing.length > 0 && existing[0]) {
      productId = existing[0]['id'];
      console.log(`    ⏭️ 既存商品 (ID: ${productId})`);
    } else {
      // 新規商品作成
      const insertResult = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: product['title'],
          description: product['description'] || '',
          duration: product['duration'],
          defaultThumbnailUrl: product['thumbnailUrl'],
        })
        .returning({ id: products['id'] });

      const inserted = insertResult[0];
      if (!inserted) {
        throw new Error('Failed to insert product');
      }
      productId = inserted.id;
      console.log(`    ✅ 新規商品作成 (ID: ${productId})`);

      // product_sources作成
      let affiliateUrl: string;
      if (product['source'] === 'video') {
        affiliateUrl = `https://video.fc2.com/a/content/${product.videoId}?aff=${FC2_AFFUID}`;
      } else {
        affiliateUrl = `https://adult.contents.fc2.com/aff.php?aid=${product.videoId}&affuid=${FC2_AFFUID}`;
      }

      await db['insert'](productSources).values({
        productId,
        aspName: 'FC2',
        originalProductId: product.videoId,
        affiliateUrl,
        price: product['price'],
        dataSource: 'CRAWL',
      });

      // 出演者登録
      for (const performerName of product.performers) {
        const performerResult = await db
          .select()
          .from(performers)
          .where(eq(performers['name'], performerName))
          .limit(1);

        let performerId: number;
        const performer = performerResult[0];
        if (performer) {
          performerId = performer['id'];
        } else {
          const insertedPerformerResult = await db
            .insert(performers)
            .values({ name: performerName })
            .returning({ id: performers['id'] });
          const insertedPerformer = insertedPerformerResult[0];
          if (!insertedPerformer) {
            throw new Error('Failed to insert performer');
          }
          performerId = insertedPerformer.id;
        }

        await db['insert'](productPerformers)
          .values({
            productId,
            performerId,
          })
          .onConflictDoNothing();
      }
    }

    // セール情報保存（新規・既存両方で実行）
    if (product.saleInfo) {
      try {
        const saved = await saveSaleInfo('FC2', product.videoId, product.saleInfo);
        if (saved) {
          console.log(
            `    💰 セール情報保存: ¥${product.saleInfo.regularPrice.toLocaleString()} → ¥${product.saleInfo.salePrice.toLocaleString()} (${product.saleInfo.discountPercent}% OFF)`,
          );
        }
      } catch (saleError: unknown) {
        const errorMessage = saleError instanceof Error ? saleError.message : String(saleError);
        console.log(`    ⚠️ セール情報保存失敗: ${errorMessage}`);
      }
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let limit = 100;
  let source: 'video' | 'contents' | 'both' = 'both';
  let startPage = 1;
  const bidirectional = !args.includes('--no-bidirectional');

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === '--limit' && nextArg) {
      limit = parseInt(nextArg);
    }
    if (args[i] === '--source' && nextArg) {
      source = nextArg as 'video' | 'contents' | 'both';
    }
    if (args[i] === '--start' && nextArg) {
      startPage = parseInt(nextArg);
    }
  }

  console.log('=== FC2動画アダルト クローラー (Puppeteer + Stealth) ===\n');
  console.log(`設定: limit=${limit}, source=${source}, startPage=${startPage}`);
  console.log(`双方向クロール: ${bidirectional ? '有効' : '無効'}\n`);

  // Puppeteer起動
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

  // ユーザーエージェント設定
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  });

  let totalFound = 0;
  let totalSaved = 0;
  const maxPages = 50;
  const processedIds = new Set<string>();

  // video.fc2.com からクロール
  if (source === 'video' || source === 'both') {
    console.log('\n=== video.fc2.com/a/ からクロール ===\n');

    for (let pageNum = startPage; pageNum <= maxPages && totalFound < limit; pageNum++) {
      console.log(`\n--- ページ ${pageNum} ---`);

      const videoIds = await fetchVideoFC2ListPage(page, pageNum);

      if (videoIds.length === 0) {
        console.log('動画が見つかりません。次のソースへ進みます。');
        break;
      }

      for (const videoId of videoIds) {
        if (totalFound >= limit) break;
        if (processedIds.has(videoId)) continue;

        processedIds.add(videoId);
        console.log(`\n[${totalFound + 1}] 動画ID: ${videoId}`);

        const product = await fetchVideoDetailPage(page, videoId);

        if (product) {
          console.log(`    タイトル: ${product['title'].substring(0, 50)}...`);

          const savedId = await saveProduct(product);
          if (savedId) {
            totalSaved++;
          }
          totalFound++;
        }
      }
    }
  }

  // adult.contents.fc2.com からクロール
  if (source === 'contents' || source === 'both') {
    console.log('\n=== adult.contents.fc2.com からクロール ===\n');

    for (let pageNum = startPage; pageNum <= maxPages && totalFound < limit; pageNum++) {
      console.log(`\n--- ページ ${pageNum} ---`);

      const articleIds = await fetchContentsFC2ListPage(page, pageNum);

      if (articleIds.length === 0) {
        console.log('商品が見つかりません。終了します。');
        break;
      }

      for (const articleId of articleIds) {
        if (totalFound >= limit) break;
        if (processedIds.has(articleId)) continue;

        processedIds.add(articleId);
        console.log(`\n[${totalFound + 1}] 商品ID: ${articleId}`);

        const product = await fetchContentsDetailPage(page, articleId);

        if (product) {
          console.log(`    タイトル: ${product['title'].substring(0, 50)}...`);

          const savedId = await saveProduct(product);
          if (savedId) {
            totalSaved++;
          }
          totalFound++;
        }
      }
    }
  }

  // 双方向クロール: 古いIDをスキャン（contents.fc2のみ、数値IDなので範囲指定可能）
  if (bidirectional && (source === 'contents' || source === 'both') && totalFound < limit) {
    console.log('\n=== 古いIDのスキャン (contents.fc2.com) ===\n');

    // DBから既存の最小IDを取得
    const minIdResult = await db.execute(sql`
      SELECT MIN(CAST(original_product_id AS INTEGER)) as min_id
      FROM product_sources
      WHERE asp_name = 'FC2'
        AND original_product_id ~ '^[0-9]+$'
    `);
    const currentMinId = (minIdResult.rows[0]?.['min_id'] as number) || 4800000;

    console.log(`  現在の最小ID: ${currentMinId}`);

    // 最小IDより小さい範囲をサンプリング
    const sampleStart = Math.max(4000000, currentMinId - 1000); // FC2のIDは400万台から
    let consecutiveNotFound = 0;
    const maxConsecutiveNotFound = 20;

    for (let id = currentMinId - 1; id >= sampleStart && totalFound < limit; id--) {
      const idStr = id.toString();
      if (processedIds.has(idStr)) continue;

      processedIds.add(idStr);

      const product = await fetchContentsDetailPage(page, idStr);

      if (product) {
        console.log(`    タイトル: ${product['title'].substring(0, 50)}...`);
        consecutiveNotFound = 0;

        const savedId = await saveProduct(product);
        if (savedId) {
          totalSaved++;
        }
        totalFound++;
      } else {
        consecutiveNotFound++;
        if (consecutiveNotFound >= maxConsecutiveNotFound) {
          console.log(`  ${maxConsecutiveNotFound}連続で商品が見つからないため、スキップ`);
          // 100ずつジャンプ
          id = Math.max(sampleStart, id - 100);
          consecutiveNotFound = 0;
        }
      }
    }
  }

  await browser.close();

  console.log('\n=== クロール完了 ===');
  console.log(`取得件数: ${totalFound}`);
  console.log(`保存件数: ${totalSaved}`);

  // 最終統計
  const statsResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'FC2'
  `);
  const countRow = statsResult.rows[0] as { count: string | number } | undefined;
  console.log(`\nFC2総商品数: ${countRow?.count ?? 0}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
