/**
 * FANZA クローラー
 *
 * 機能:
 * - FANZA (dmm.co.jp) からHTMLをクロールして商品データを取得
 * - 新作リストページから商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - robots.txt遵守: /digital/videoa/-/list/ と /detail/ は許可
 * - レート制限: 3秒以上の間隔
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fanza.ts [--pages 10] [--start-page 1] [--no-ai] [--force]
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fanza.ts --full-scan [--sort=old] [--max-pages=1000]
 */

// ソートオプション（新しい順、古い順、人気順）
type SortOrder = 'date' | 'ranking' | 'review';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { generateProductDescription, extractProductTags } from '../lib/google-apis';
import { translateProductLingva } from '../lib/translate';
import {
  upsertRawHtmlDataWithGcs,
  markRawDataAsProcessed,
} from '../lib/crawler/dedup-helper';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';

// Stealth pluginを使用してbot検知を回避
puppeteer.use(StealthPlugin());

const db = getDb();

// FANZAアフィリエイトID（環境変数から取得、未設定の場合はダミー）
const AFFILIATE_ID = process.env.FANZA_AFFILIATE_ID || 'minpri-001';

// レート制限: 3秒 + ジッター
const RATE_LIMIT_MS = 3000;
const JITTER_MS = 1500;

// グローバルブラウザインスタンス
let browser: Browser | null = null;
let sessionInitialized = false;

interface FanzaProduct {
  cid: string;
  title: string;
  description: string;
  performers: string[];
  releaseDate: string | null;
  duration: number | null;
  thumbnailUrl: string;
  sampleImages: string[];
  sampleVideos: string[];
  maker: string | null;
  label: string | null;
  series: string | null;
  genres: string[];
  price: number | null;
}

/**
 * レート制限付き待機
 */
async function rateLimit(): Promise<void> {
  const jitter = Math.random() * JITTER_MS;
  const delay = RATE_LIMIT_MS + jitter;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * ブラウザを初期化
 */
async function initBrowser(): Promise<Browser> {
  if (browser) return browser;

  console.log('🌐 Puppeteerブラウザを起動中...');

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  if (executablePath) {
    console.log(`  Chromium path: ${executablePath}`);
  }

  browser = await puppeteer.launch({
    headless: true,
    executablePath,
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

  if (!sessionInitialized) {
    await initializeSession(browser);
  }

  return browser;
}

/**
 * セッションを初期化（年齢認証を通過）
 */
async function initializeSession(browserInstance: Browser): Promise<void> {
  console.log('🍪 セッション初期化中（年齢確認を通過）...');

  const page = await browserInstance.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 年齢確認ページにアクセス
    await page.goto('https://www.dmm.co.jp/age_check/=/declared=yes/?rurl=https://www.dmm.co.jp/digital/videoa/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // 追加のCookieを設定
    await page.setCookie(
      { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
      { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' },
      { name: 'i3_ab', value: 'affi_id:minpri-001', domain: '.dmm.co.jp' }
    );

    sessionInitialized = true;
    console.log('✅ セッション初期化完了');
  } catch (error) {
    console.error('セッション初期化エラー:', error);
  } finally {
    await page.close();
  }
}

/**
 * ブラウザをクローズ
 */
async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    sessionInitialized = false;
    console.log('🔒 ブラウザを終了しました');
  }
}

/**
 * ページを取得（Puppeteer使用）
 */
async function fetchPage(url: string): Promise<{ html: string; status: number } | null> {
  const browserInstance = await initBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 年齢認証Cookie設定
    await page.setCookie(
      { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
      { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' }
    );

    // リクエストインターセプト（画像は取得して構造解析用に使用）
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': 'https://www.dmm.co.jp/',
    });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // 年齢確認ページにリダイレクトされた場合は再度確認を通過
    const currentUrl = page.url();
    if (currentUrl.includes('age_check') || currentUrl.includes('年齢確認')) {
      console.log('    ⚠️ 年齢確認ページを検出、通過中...');
      await page.goto('https://www.dmm.co.jp/age_check/=/declared=yes/?rurl=' + encodeURIComponent(url), {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });
    }

    const html = await page.content();
    const status = response?.status() || 200;

    return { html, status };
  } catch (error) {
    console.error(`  ❌ ページ取得エラー: ${error}`);

    // タイムアウトでも部分的なコンテンツを取得
    try {
      const html = await page.content();
      if (html && html.length > 1000) {
        console.log('  ⚠️ タイムアウトしましたが、部分的なコンテンツを使用');
        return { html, status: 200 };
      }
    } catch {
      // ignore
    }

    return null;
  } finally {
    await page.close();
  }
}

/**
 * リストページから商品CIDを取得（新FANZA: video.dmm.co.jp対応）
 * @param pageNum ページ番号
 * @param sort ソート順（date=新しい順, ranking=人気順, review=レビュー順）
 */
async function getCidsFromListPage(pageNum: number, sort: SortOrder = 'date'): Promise<string[]> {
  // 新FANZAはページネーションパラメータが異なる
  const url = `https://video.dmm.co.jp/av/list/?sort=${sort}&page=${pageNum}`;
  console.log(`📋 リストページ取得中: ${url}`);

  await rateLimit();

  const browserInstance = await initBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // 年齢認証Cookie設定
    await page.setCookie(
      { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
      { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' }
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // 商品リストがロードされるのを待つ
    await new Promise(resolve => setTimeout(resolve, 3000));

    // スクロールして商品をロード
    await page.evaluate(async () => {
      window.scrollTo(0, 500);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, 1000);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, 1500);
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 商品画像URLからCIDを抽出
    const cids = await page.evaluate(() => {
      const cidSet = new Set<string>();

      // 画像URLからCIDを抽出（/video/XXXXX/ パターン）
      document.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src') || '';
        // https://awsimgsrc.dmm.co.jp/pics_dig/digital/video/pxvr00352/pxvr00352ps.jpg
        const match = src.match(/\/video\/([a-z0-9]+)\//i);
        if (match && match[1]) {
          cidSet.add(match[1]);
        }
      });

      // aタグのhrefからもCIDを探す
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        // /av/detail/cid/ パターン
        const detailMatch = href.match(/\/av\/detail\/([a-z0-9]+)/i);
        if (detailMatch && detailMatch[1]) {
          cidSet.add(detailMatch[1]);
        }
        // cid=xxx パターン
        const cidMatch = href.match(/cid=([a-z0-9]+)/i);
        if (cidMatch && cidMatch[1]) {
          cidSet.add(cidMatch[1]);
        }
      });

      return Array.from(cidSet);
    });

    console.log(`  ✓ ${cids.length}件の商品CIDを取得`);
    return cids;

  } catch (error) {
    console.error(`  ❌ リストページ取得エラー: ${error}`);
    return [];
  } finally {
    await page.close();
  }
}

/**
 * 商品詳細ページをパース
 */
async function parseDetailPage(cid: string, forceReprocess: boolean): Promise<{
  product: FanzaProduct | null;
  rawDataId: number | null;
  shouldSkip: boolean;
}> {
  // 新FANZA URL形式: /av/content/?id=xxx
  const url = `https://video.dmm.co.jp/av/content/?id=${cid}`;
  console.log(`  🔍 詳細ページ取得中: ${url}`);

  // 既存チェック
  if (!forceReprocess) {
    const existing = await db
      .select()
      .from(productSources)
      .where(
        and(
          eq(productSources.aspName, 'FANZA'),
          eq(productSources.originalProductId, cid)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`    ⏭️ スキップ(処理済み): ${cid}`);
      return { product: null, rawDataId: null, shouldSkip: true };
    }
  }

  await rateLimit();

  const result = await fetchPage(url);
  if (!result) {
    return { product: null, rawDataId: null, shouldSkip: false };
  }

  const { html } = result;

  if (!html) {
    console.log(`    ⚠️ HTMLが空です`);
    return { product: null, rawDataId: null, shouldSkip: false };
  }

  // Raw HTMLを保存（エラーは無視して続行）
  let rawDataId: number | null = null;
  try {
    rawDataId = await upsertRawHtmlDataWithGcs({
      url,
      html,
      contentType: 'product_detail',
      providerId: `fanza-${cid}`,
      aspName: 'FANZA',
    });
  } catch (gcsError) {
    console.log(`    ⚠️ Raw HTML保存スキップ: ${gcsError instanceof Error ? gcsError.message : gcsError}`);
  }

  // HTMLからデータを抽出
  const product = parseProductHtml(html, cid);

  return { product, rawDataId, shouldSkip: false };
}

/**
 * 商品HTMLをパース（新FANZA: video.dmm.co.jp対応）
 */
function parseProductHtml(html: string, cid: string): FanzaProduct | null {
  try {
    // JSON-LD構造化データから情報を抽出（最も信頼性が高い）
    let jsonLdData: any = null;
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        jsonLdData = JSON.parse(jsonLdMatch[1]);
      } catch {
        // JSON parse error, fallback to HTML parsing
      }
    }

    // タイトル抽出
    let title = '';
    if (jsonLdData?.name) {
      title = jsonLdData.name;
    } else {
      const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
        || html.match(/<title>([^<]+?)(?:\s*[｜|]\s*[^<]*)?<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : `FANZA-${cid}`;
    }
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // 広告タグを除去（【ブランドストア30％OFF！】など）
    title = title.replace(/【[^】]*(?:OFF|セール|キャンペーン|新作|独占|最新)[^】]*】/g, '').trim();

    // 出演者抽出（JSON-LD actor配列から）
    const performers: string[] = [];
    if (jsonLdData?.actor && Array.isArray(jsonLdData.actor)) {
      for (const actor of jsonLdData.actor) {
        if (actor.name && !performers.includes(actor.name)) {
          performers.push(actor.name);
        }
      }
    }
    // フォールバック: HTMLから抽出
    if (performers.length === 0) {
      const actressMatches = html.matchAll(/href="[^"]*\/av\/list\/\?actress=\d+"[^>]*>([^<]+)</gi);
      for (const match of actressMatches) {
        const name = match[1].trim();
        if (name && name.length < 30 && !name.includes('一覧') && !performers.includes(name)) {
          performers.push(name);
        }
      }
    }

    // ジャンル抽出（JSON-LDから）
    const genres: string[] = [];
    if (jsonLdData?.genre && Array.isArray(jsonLdData.genre)) {
      for (const g of jsonLdData.genre) {
        if (g && !genres.includes(g)) {
          genres.push(g);
        }
      }
    }

    // サムネイル画像
    let thumbnailUrl = '';
    if (jsonLdData?.image) {
      thumbnailUrl = Array.isArray(jsonLdData.image) ? jsonLdData.image[0] : jsonLdData.image;
    }
    if (!thumbnailUrl) {
      const thumbnailMatch = html.match(/src="(https:\/\/awsimgsrc\.dmm\.co\.jp\/[^"]*pl\.jpg[^"]*)"/i)
        || html.match(/src="(https:\/\/[^"]*pics[^"]*\/[^"]+pl\.jpg[^"]*)"/i);
      thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : '';
    }

    // サンプル画像（awsimgsrc.dmm.co.jpから）
    const sampleImages: string[] = [];
    const imgMatches = html.matchAll(/src="(https:\/\/awsimgsrc\.dmm\.co\.jp\/[^"]*-\d+\.jpg[^"]*)"/gi);
    for (const match of imgMatches) {
      const imgUrl = match[1].split('?')[0]; // クエリパラメータを除去
      if (imgUrl && !sampleImages.includes(imgUrl)) {
        sampleImages.push(imgUrl);
      }
    }

    // サンプル動画（複数パターンで抽出）
    const sampleVideos: string[] = [];
    const videoUrlSet = new Set<string>();

    // パターン1: litevideo MP4
    const liteVideoMatches = html.matchAll(/src="(https:\/\/[^"]*litevideo[^"]*\.mp4[^"]*)"/gi);
    for (const match of liteVideoMatches) {
      const url = match[1].split('?')[0];
      if (!videoUrlSet.has(url)) {
        videoUrlSet.add(url);
        sampleVideos.push(url);
      }
    }

    // パターン2: data-src属性のサンプル動画
    const dataSrcMatches = html.matchAll(/data-src="(https:\/\/[^"]*(?:sample|preview)[^"]*\.mp4[^"]*)"/gi);
    for (const match of dataSrcMatches) {
      const url = match[1].split('?')[0];
      if (!videoUrlSet.has(url)) {
        videoUrlSet.add(url);
        sampleVideos.push(url);
      }
    }

    // パターン3: cc3001.dmm.co.jp からのサンプル動画
    const cc3001Matches = html.matchAll(/["'](https:\/\/cc3001\.dmm\.co\.jp\/[^"']*\.mp4[^"']*)["']/gi);
    for (const match of cc3001Matches) {
      const url = match[1].split('?')[0];
      if (!videoUrlSet.has(url)) {
        videoUrlSet.add(url);
        sampleVideos.push(url);
      }
    }

    // パターン4: sample.mp4 や _sm_w.mp4 などのパターン
    const sampleMp4Matches = html.matchAll(/["'](https:\/\/[^"']*(?:_sm_|sample|_sample_)[^"']*\.mp4[^"']*)["']/gi);
    for (const match of sampleMp4Matches) {
      const url = match[1].split('?')[0];
      if (!videoUrlSet.has(url)) {
        videoUrlSet.add(url);
        sampleVideos.push(url);
      }
    }

    // パターン5: JSON-LDからの動画URL
    if (jsonLdData?.video) {
      const videos = Array.isArray(jsonLdData.video) ? jsonLdData.video : [jsonLdData.video];
      for (const video of videos) {
        const contentUrl = video.contentUrl || video.embedUrl;
        if (contentUrl && contentUrl.includes('.mp4') && !videoUrlSet.has(contentUrl)) {
          videoUrlSet.add(contentUrl);
          sampleVideos.push(contentUrl);
        }
      }
    }

    // 発売日（JSON-LDまたはHTML）
    let releaseDate: string | null = null;
    if (jsonLdData?.datePublished) {
      releaseDate = jsonLdData.datePublished;
    } else {
      // 日付パターン: 2025/12/10 または 2025年12月10日
      const dateMatch = html.match(/(\d{4})\/(\d{2})\/(\d{2})/);
      if (dateMatch) {
        releaseDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      }
    }

    // 収録時間（分単位）
    let duration: number | null = null;
    const durationMatch = html.match(/(\d+)分/);
    if (durationMatch) {
      duration = parseInt(durationMatch[1]) * 60; // 秒に変換
    }

    // メーカー・レーベル・シリーズ（HTMLから）
    const makerMatch = html.match(/href="[^"]*\/av\/list\/\?maker=\d+"[^>]*>([^<]+)</i);
    const maker = makerMatch ? makerMatch[1].trim() : null;

    const labelMatch = html.match(/href="[^"]*\/av\/list\/\?label=\d+"[^>]*>([^<]+)</i);
    const label = labelMatch ? labelMatch[1].trim() : null;

    const seriesMatch = html.match(/href="[^"]*\/av\/list\/\?series=\d+"[^>]*>([^<]+)</i);
    const series = seriesMatch ? seriesMatch[1].trim() : null;

    // 価格（セール価格優先）
    let price: number | null = null;
    // セール価格パターン: 取り消し線価格の後のお手頃価格
    const priceMatches = [...html.matchAll(/(\d{1,3}(?:,\d{3})*)円/g)];
    if (priceMatches.length > 0) {
      // 最も低い価格を選択（セール価格）
      const prices = priceMatches.map(m => parseInt(m[1].replace(/,/g, '')));
      price = Math.min(...prices.filter(p => p > 0));
    }

    // 説明文（☆マーク付きテキスト）
    let description = '';
    const descMatch = html.match(/☆[★☆]*([^<]{50,500})/);
    if (descMatch) {
      description = descMatch[0].replace(/\s+/g, ' ').trim();
    }

    return {
      cid,
      title,
      description,
      performers,
      releaseDate,
      duration,
      thumbnailUrl,
      sampleImages: sampleImages.slice(0, 20),
      sampleVideos,
      maker,
      label,
      series,
      genres,
      price,
    };
  } catch (error) {
    console.error(`  ❌ HTMLパースエラー: ${error}`);
    return null;
  }
}

/**
 * アフィリエイトURLを生成
 */
function generateAffiliateUrl(cid: string): string {
  // 新FANZA URL形式（lurlパラメータはURLエンコードが必要）
  const targetUrl = `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${cid}/`;
  return `https://al.dmm.co.jp/?lurl=${encodeURIComponent(targetUrl)}&af_id=${AFFILIATE_ID}`;
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(product: FanzaProduct): Promise<number | null> {
  const validation = validateProductData({
    title: product.title,
    description: product.description,
    aspName: 'FANZA',
    originalId: product.cid,
  });

  if (!validation.isValid) {
    console.log(`    ⚠️ スキップ: ${validation.reason}`);
    return null;
  }

  try {
    const normalizedProductId = `FANZA-${product.cid}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (existing.length > 0) {
      productId = existing[0].id;
      console.log(`    ⏭️ 既存商品 (ID: ${productId})`);
    } else {
      // 新規商品作成
      const [inserted] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: product.title,
          description: product.description || '',
          duration: product.duration,
          releaseDate: product.releaseDate ? new Date(product.releaseDate) : null,
          defaultThumbnailUrl: product.thumbnailUrl,
        })
        .returning({ id: products.id });

      productId = inserted.id;
      console.log(`    ✓ 新規商品作成 (ID: ${productId})`);

      // product_sources作成
      const affiliateUrl = generateAffiliateUrl(product.cid);
      await db.insert(productSources).values({
        productId,
        aspName: 'FANZA',
        originalProductId: product.cid,
        affiliateUrl,
        price: product.price,
        dataSource: 'CRAWL',
      });

      // 出演者登録
      for (const performerName of product.performers) {
        if (!isValidPerformerName(performerName)) continue;
        if (!isValidPerformerForProduct(performerName, product.title)) continue;

        const normalizedName = normalizePerformerName(performerName);

        const [performer] = await db
          .select()
          .from(performers)
          .where(eq(performers.name, normalizedName))
          .limit(1);

        let performerId: number;
        if (performer) {
          performerId = performer.id;
        } else {
          const [inserted] = await db
            .insert(performers)
            .values({ name: normalizedName })
            .returning({ id: performers.id });
          performerId = inserted.id;
        }

        // 商品-出演者リンク
        const existingLink = await db
          .select()
          .from(productPerformers)
          .where(
            and(
              eq(productPerformers.productId, productId),
              eq(productPerformers.performerId, performerId)
            )
          )
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(productPerformers).values({
            productId,
            performerId,
          });
        }
      }

      // サンプル画像保存
      if (product.thumbnailUrl) {
        await db.insert(productImages).values({
          productId,
          imageUrl: product.thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: 'FANZA',
        }).onConflictDoNothing();
      }

      for (let i = 0; i < product.sampleImages.length; i++) {
        await db.insert(productImages).values({
          productId,
          imageUrl: product.sampleImages[i],
          imageType: 'sample',
          displayOrder: i + 1,
          aspName: 'FANZA',
        }).onConflictDoNothing();
      }

      // サンプル動画保存
      for (let i = 0; i < product.sampleVideos.length; i++) {
        await db.insert(productVideos).values({
          productId,
          videoUrl: product.sampleVideos[i],
          videoType: 'sample',
          aspName: 'FANZA',
          displayOrder: i,
        }).onConflictDoNothing();
      }
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

/**
 * AI機能: 説明文生成とタグ抽出
 */
async function generateAIContent(product: FanzaProduct, enableAI: boolean): Promise<{
  aiDescription: { catchphrase: string; shortDescription: string } | null;
  aiTags: { genres: string[]; attributes: string[] } | null;
}> {
  if (!enableAI) {
    return { aiDescription: null, aiTags: null };
  }

  console.log(`    🤖 AI機能を実行中...`);

  let aiDescription = null;
  let aiTags = null;

  try {
    // 説明文生成
    const description = await generateProductDescription(
      product.title,
      product.performers,
      product.description
    );

    if (description) {
      aiDescription = {
        catchphrase: description.catchphrase || '',
        shortDescription: description.shortDescription || '',
      };
      console.log(`      ✅ AI説明文生成完了`);
      console.log(`         キャッチコピー: ${aiDescription.catchphrase.substring(0, 30)}...`);
    }

    // タグ抽出
    const tags = await extractProductTags(
      product.title,
      product.performers,
      product.description
    );

    if (tags) {
      aiTags = {
        genres: tags.genres || [],
        attributes: tags.attributes || [],
      };
      console.log(`      ✅ AIタグ抽出完了`);
    }
  } catch (error) {
    console.error(`      ⚠️ AI処理エラー: ${error}`);
  }

  return { aiDescription, aiTags };
}

/**
 * AI生成データを保存
 */
async function saveAIContent(
  productId: number,
  aiDescription: { catchphrase: string; shortDescription: string } | null,
  aiTags: { genres: string[]; attributes: string[] } | null
): Promise<void> {
  if (!aiDescription && !aiTags) return;

  try {
    const updates: Record<string, unknown> = {};

    if (aiDescription) {
      updates.aiCatchphrase = aiDescription.catchphrase;
      updates.aiShortDescription = aiDescription.shortDescription;
    }

    if (aiTags) {
      updates.aiTags = JSON.stringify({
        genres: aiTags.genres,
        attributes: aiTags.attributes,
      });
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(products)
        .set(updates)
        .where(eq(products.id, productId));
      console.log(`    💾 AI生成データを保存しました`);
    }
  } catch (error) {
    console.error(`    ⚠️ AI保存エラー: ${error}`);
  }
}

/**
 * 翻訳機能（Lingva版 - APIキー不要）
 */
async function saveTranslations(productId: number, product: FanzaProduct): Promise<void> {
  console.log(`    🌐 翻訳処理を実行中（Lingva）...`);

  try {
    const translations = await translateProductLingva(product.title, product.description);

    if (translations) {
      const updateData: Record<string, string | undefined> = {};

      if (translations.en) {
        updateData.titleEn = translations.en.title;
        if (translations.en.description) updateData.descriptionEn = translations.en.description;
      }
      if (translations.zh) {
        updateData.titleZh = translations.zh.title;
        if (translations.zh.description) updateData.descriptionZh = translations.zh.description;
      }
      if (translations.ko) {
        updateData.titleKo = translations.ko.title;
        if (translations.ko.description) updateData.descriptionKo = translations.ko.description;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, productId));

        console.log(`      EN: ${translations.en?.title?.substring(0, 50)}...`);
        console.log(`      ZH: ${translations.zh?.title?.substring(0, 50)}...`);
        console.log(`      KO: ${translations.ko?.title?.substring(0, 50)}...`);
        console.log(`    💾 翻訳データを保存しました`);
      }
    }
  } catch (error) {
    console.error(`    ⚠️ 翻訳エラー: ${error}`);
  }
}

/**
 * フルスキャンモード: 全ページをクロールして全商品を収集
 */
async function runFullScan(
  sort: SortOrder,
  maxPages: number,
  enableAI: boolean,
  forceReprocess: boolean,
): Promise<void> {
  console.log('=== FANZA フルスキャンモード ===');
  console.log(`ソート順: ${sort}`);
  console.log(`最大ページ数: ${maxPages}`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`レート制限: ${RATE_LIMIT_MS}ms + ${JITTER_MS}msジッター\n`);

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let consecutiveEmptyPages = 0;
  const maxConsecutiveEmpty = 3; // 3回連続で空ページが続いたら終了

  const processedCids = new Set<string>();

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    console.log(`\n========================================`);
    console.log(`📋 ページ ${pageNum}/${maxPages} を処理中...`);
    console.log(`========================================`);

    try {
      const cids = await getCidsFromListPage(pageNum, sort);

      if (cids.length === 0) {
        consecutiveEmptyPages++;
        console.log(`  ⚠️ 商品が見つかりません（${consecutiveEmptyPages}/${maxConsecutiveEmpty}）`);

        if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
          console.log(`\n🏁 ${maxConsecutiveEmpty}回連続で空ページのため終了`);
          break;
        }
        continue;
      }

      consecutiveEmptyPages = 0;

      // 重複を除外
      const newCids = cids.filter(cid => !processedCids.has(cid));
      console.log(`  📦 新規CID: ${newCids.length}件 (重複除外: ${cids.length - newCids.length}件)`);

      for (let i = 0; i < newCids.length; i++) {
        const cid = newCids[i];
        processedCids.add(cid);

        console.log(`\n  [${i + 1}/${newCids.length}] 商品CID: ${cid}`);

        try {
          const { product, rawDataId, shouldSkip } = await parseDetailPage(cid, forceReprocess);

          if (shouldSkip) {
            totalSkipped++;
            continue;
          }

          if (product) {
            console.log(`      タイトル: ${product.title.substring(0, 50)}...`);
            console.log(`      出演者: ${product.performers.join(', ') || '不明'}`);
            console.log(`      📷 サンプル画像: ${product.sampleImages.length}件`);
            console.log(`      🎬 サンプル動画: ${product.sampleVideos.length}件`);

            const savedId = await saveProduct(product);

            if (savedId) {
              if (enableAI) {
                const { aiDescription, aiTags } = await generateAIContent(product, enableAI);
                await saveAIContent(savedId, aiDescription, aiTags);
              }

              await saveTranslations(savedId, product);

              if (rawDataId) {
                await markRawDataAsProcessed(rawDataId, 'raw_html_data');
              }

              totalSaved++;
            } else {
              totalSkipped++;
            }
          }
        } catch (error) {
          console.error(`      ❌ エラー: ${error}`);
          totalErrors++;
        }
      }

      // ページ単位の進捗表示
      console.log(`\n  📊 ページ ${pageNum} 完了 - 累計: 保存=${totalSaved}, スキップ=${totalSkipped}, エラー=${totalErrors}`);

    } catch (error) {
      console.error(`  ❌ ページ ${pageNum} でエラー: ${error}`);
      totalErrors++;

      // エラーが続いても少し待って続行
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  await closeBrowser();

  console.log('\n========================================');
  console.log('=== フルスキャン完了 ===');
  console.log('========================================');
  console.log(`処理商品数: ${processedCids.size}件`);
  console.log(`新規保存: ${totalSaved}件`);
  console.log(`スキップ: ${totalSkipped}件`);
  console.log(`エラー: ${totalErrors}件`);
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  // 共通引数
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');
  const fullScan = args.includes('--full-scan');

  // ソートオプション
  let sort: SortOrder = 'date';
  const sortArg = args.find(arg => arg.startsWith('--sort='));
  if (sortArg) {
    const sortValue = sortArg.split('=')[1];
    if (sortValue === 'ranking' || sortValue === 'review' || sortValue === 'date') {
      sort = sortValue;
    }
  }

  // フルスキャンモード
  if (fullScan) {
    let maxPages = 10000; // デフォルト最大ページ数
    const maxPagesArg = args.find(arg => arg.startsWith('--max-pages='));
    if (maxPagesArg) {
      maxPages = parseInt(maxPagesArg.split('=')[1], 10);
    }

    await runFullScan(sort, maxPages, enableAI, forceReprocess);
    process.exit(0);
    return;
  }

  // 通常モード: 引数パース
  let pages = 5;
  let startPage = 1;
  let limit = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--pages=')) {
      pages = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--pages' && args[i + 1]) {
      pages = parseInt(args[i + 1], 10);
      i++;
    }

    if (arg.startsWith('--start-page=')) {
      startPage = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--start-page' && args[i + 1]) {
      startPage = parseInt(args[i + 1], 10);
      i++;
    }

    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  console.log('=== FANZA クローラー ===');
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`ソート順: ${sort}`);
  console.log(`設定: pages=${pages}, start-page=${startPage}, limit=${limit}`);
  console.log(`レート制限: ${RATE_LIMIT_MS}ms + ${JITTER_MS}msジッター\n`);

  // 1. リストページから商品CIDを収集
  const allCids: string[] = [];
  const endPage = startPage + pages - 1;

  for (let pageNum = startPage; pageNum <= endPage && allCids.length < limit; pageNum++) {
    const cids = await getCidsFromListPage(pageNum, sort);
    for (const cid of cids) {
      if (!allCids.includes(cid) && allCids.length < limit) {
        allCids.push(cid);
      }
    }
  }

  console.log(`\n📦 合計 ${allCids.length} 件の商品CIDを収集\n`);

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // 2. 各商品の詳細ページをクロール
  for (let i = 0; i < allCids.length; i++) {
    const cid = allCids[i];
    console.log(`\n[${i + 1}/${allCids.length}] 商品CID: ${cid}`);

    try {
      const { product, rawDataId, shouldSkip } = await parseDetailPage(cid, forceReprocess);

      if (shouldSkip) {
        totalSkipped++;
        continue;
      }

      if (product) {
        console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
        console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);
        console.log(`    📷 サンプル画像: ${product.sampleImages.length}件`);
        console.log(`    🎬 サンプル動画: ${product.sampleVideos.length}件`);

        const savedId = await saveProduct(product);

        if (savedId) {
          if (enableAI) {
            const { aiDescription, aiTags } = await generateAIContent(product, enableAI);
            await saveAIContent(savedId, aiDescription, aiTags);
          }

          await saveTranslations(savedId, product);

          if (rawDataId) {
            await markRawDataAsProcessed(rawDataId, 'raw_html_data');
          }

          totalSaved++;
        } else {
          totalSkipped++;
        }
      }
    } catch (error) {
      console.error(`    ❌ エラー: ${error}`);
      totalErrors++;
    }
  }

  await closeBrowser();

  console.log('\n=== クロール完了 ===');
  console.log(`新規保存: ${totalSaved}件`);
  console.log(`スキップ: ${totalSkipped}件`);
  console.log(`エラー: ${totalErrors}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  closeBrowser().finally(() => process.exit(1));
});
