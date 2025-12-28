/**
 * FANZA クローラー
 *
 * 機能:
 * - FANZA (dmm.co.jp) からHTMLをクロールして商品データを取得
 * - 新作リストページから商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - 双方向クロール: 新着順と古い順の両方でスキャンして全商品を確保（MGSと同様）
 * - robots.txt遵守: /digital/videoa/-/list/ と /detail/ は許可
 * - レート制限: 3秒以上の間隔
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fanza.ts [--pages 10] [--start-page 1] [--no-ai] [--force]
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fanza.ts --full-scan [--max-pages=1000] [--no-bidirectional]
 */

// ソートオプション（新しい順、古い順、人気順）
type SortOrder = 'date' | 'ranking' | 'review';
// 日付ソートの方向（新着順、古い順）- MGSと同様の双方向クロール用
type DateSortDirection = 'new' | 'old';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos, productReviews, productRatingSummary } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { getAIHelper } from '../lib/crawler';
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

interface FanzaReview {
  reviewerId: string;
  reviewerName: string;
  rating: number;
  title?: string;
  content: string;
  reviewDate?: string;
  helpful?: number;
}

interface FanzaRatingSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution?: Record<number, number>;
}

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
  reviews?: FanzaReview[];
  ratingSummary?: FanzaRatingSummary;
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
 * @param direction ソート方向（new=新しい順, old=古い順）- dateソート時のみ有効
 */
async function getCidsFromListPage(pageNum: number, sort: SortOrder = 'date', direction: DateSortDirection = 'new'): Promise<string[]> {
  // 新FANZAはページネーションパラメータが異なる
  // direction=oldの場合はリリース日昇順（古い順）
  const sortParam = sort === 'date' && direction === 'old' ? 'release_date' : sort;
  const url = `https://video.dmm.co.jp/av/list/?sort=${sortParam}&page=${pageNum}`;
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
    const result = await upsertRawHtmlDataWithGcs('FANZA', cid, url, html);
    rawDataId = result.id;
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

    // 収録時間（分単位）- FANZAの商品情報テーブルから抽出
    let duration: number | null = null;

    // パターン1: 「収録時間：」の近くにある分表記を取得（新FANZAデザイン対応）
    // 構造: <span>収録時間：</span></th><td>...<span>XXX分</span>...</td>
    const durationContextMatch = html.match(/収録時間[：:]?\s*<\/[^>]+>[\s\S]{0,200}?>(\d{1,3})分</i);
    if (durationContextMatch) {
      const mins = parseInt(durationContextMatch[1], 10);
      if (mins >= 1 && mins <= 600) {
        duration = mins;
      }
    }

    // パターン2: より広い範囲で「収録時間」と分を探す
    if (!duration) {
      const durationRowMatch = html.match(/収録時間[\s\S]{0,100}?(\d{1,3})分/i);
      if (durationRowMatch) {
        const mins = parseInt(durationRowMatch[1], 10);
        if (mins >= 1 && mins <= 600) {
          duration = mins;
        }
      }
    }

    // パターン3: span内の分表記（「収録時間」が見つからない場合のフォールバック）
    // 20分以上の値のみ（誤検知を減らすため）
    if (!duration) {
      const durationSpanMatch = html.match(/<span[^>]*>(\d{2,3})分<\/span>/i);
      if (durationSpanMatch) {
        const mins = parseInt(durationSpanMatch[1], 10);
        if (mins >= 20 && mins <= 600) {
          duration = mins;
        }
      }
    }

    // パターン4: JSON-LDのduration（ISO 8601形式）
    // 対応形式: PT120M (分), PT7200S (秒), PT2H (時間), PT2H30M (時間+分)
    if (!duration && jsonLdData?.duration) {
      const durationStr = String(jsonLdData.duration);
      let mins = 0;

      // 時間 (H)
      const hoursMatch = durationStr.match(/PT(\d+)H/i);
      if (hoursMatch) {
        mins += parseInt(hoursMatch[1], 10) * 60;
      }

      // 分 (M)
      const minsMatch = durationStr.match(/(\d+)M/i);
      if (minsMatch) {
        mins += parseInt(minsMatch[1], 10);
      }

      // 秒 (S) - 秒単位の場合は分に変換
      const secsMatch = durationStr.match(/(\d+)S/i);
      if (secsMatch && mins === 0) {
        // 秒のみの場合（PT7200Sなど）
        mins = Math.round(parseInt(secsMatch[1], 10) / 60);
      }

      if (mins >= 1 && mins <= 600) {
        duration = mins;
      }
    }

    // メーカー・レーベル・シリーズ（HTMLから）
    const makerMatch = html.match(/href="[^"]*\/av\/list\/\?maker=\d+"[^>]*>([^<]+)</i);
    const maker = makerMatch ? makerMatch[1].trim() : null;

    const labelMatch = html.match(/href="[^"]*\/av\/list\/\?label=\d+"[^>]*>([^<]+)</i);
    const label = labelMatch ? labelMatch[1].trim() : null;

    const seriesMatch = html.match(/href="[^"]*\/av\/list\/\?series=\d+"[^>]*>([^<]+)</i);
    const series = seriesMatch ? seriesMatch[1].trim() : null;

    // 価格（HTMLから取得）- FANZAの価格表示構造に基づく
    // 注意: JSON-LDのoffers.priceは月額見放題の最安価格（300円など）のため使用しない
    let price: number | null = null;

    // HTMLから価格を取得（購入価格・配信価格を優先）
    // 複数の販売形態があるため、「円」表記からすべて抽出し、適切なものを選択
    const priceMatches = [...html.matchAll(/(\d{1,3}(?:,\d{3})*)円/g)];
    if (priceMatches.length > 0) {
      // 500円〜10000円の範囲の価格を抽出（月額300円や高額セット除外）
      const validPrices = priceMatches
        .map(m => parseInt(m[1].replace(/,/g, ''), 10))
        .filter(p => p >= 500 && p <= 10000);

      if (validPrices.length > 0) {
        // 一般的なFANZA価格帯（980〜3000円）に近いものを優先
        // 980, 1480, 1980, 2480, 2980円などが一般的
        const typicalPrices = validPrices.filter(p => p >= 800 && p <= 3500);
        if (typicalPrices.length > 0) {
          // 複数ある場合は最も高い価格（HD版など）を選択
          price = Math.max(...typicalPrices);
        } else {
          // 範囲外でも有効な価格があれば最大値を使用
          price = Math.max(...validPrices);
        }
      }
    }

    // フォールバック: data-price属性（一部のページで使用）
    if (!price) {
      const dataPriceMatch = html.match(/data-price="(\d+)"/i);
      if (dataPriceMatch) {
        const p = parseInt(dataPriceMatch[1], 10);
        if (p >= 500 && p <= 10000) {
          price = p;
        }
      }
    }

    // 説明文（☆マーク付きテキスト）
    let description = '';
    const descMatch = html.match(/☆[★☆]*([^<]{50,500})/);
    if (descMatch) {
      description = descMatch[0].replace(/\s+/g, ' ').trim();
    }

    // レビュー・評価サマリーの抽出
    let ratingSummary: FanzaRatingSummary | undefined;
    const reviews: FanzaReview[] = [];

    // JSON-LDから評価情報を取得
    if (jsonLdData?.aggregateRating) {
      const ar = jsonLdData.aggregateRating;
      ratingSummary = {
        averageRating: parseFloat(ar.ratingValue) || 0,
        totalReviews: parseInt(ar.reviewCount) || parseInt(ar.ratingCount) || 0,
      };
    }

    // HTMLから平均評価を取得（JSON-LDがない場合のフォールバック）
    if (!ratingSummary) {
      // パターン1: 「平均評価：」の近くにある数値
      const avgRatingMatch = html.match(/平均評価[：:]\s*<[^>]*>?\s*([0-9.]+)/i);
      // パターン2: 星評価のdata属性やclass（FANZAの新デザイン対応）
      const starRatingMatch = html.match(/data-rating="([0-9.]+)"/i) ||
        html.match(/rating[^>]*>([0-9.]+)</i) ||
        html.match(/評価[：:]?\s*([0-9.]+)\s*(?:点|\/)/i);
      // レビュー件数
      const reviewCountMatch = html.match(/(\d+)\s*件のレビュー/i) ||
        html.match(/レビュー[：:]?\s*(\d+)\s*件/i) ||
        html.match(/(\d+)\s*(?:件|reviews)/i);

      const avgRating = avgRatingMatch?.[1] || starRatingMatch?.[1];
      if (avgRating) {
        ratingSummary = {
          averageRating: parseFloat(avgRating) || 0,
          totalReviews: reviewCountMatch ? parseInt(reviewCountMatch[1]) : 0,
        };
      }
    }

    // レビュー評価分布の取得（★1〜5の件数）
    if (ratingSummary) {
      const distribution: Record<number, number> = {};
      for (let star = 1; star <= 5; star++) {
        // パターン: 「★5」「5.00」の近くにある件数
        const starPattern = new RegExp(`${star}(?:\\.0*)?\\s*(?:<[^>]*>\\s*)*(?:[(（])?\\s*(\\d+)\\s*(?:[件）)])?`, 'i');
        const match = html.match(starPattern);
        if (match) {
          distribution[star] = parseInt(match[1]) || 0;
        }
      }
      if (Object.keys(distribution).length > 0) {
        ratingSummary.ratingDistribution = distribution;
      }
    }

    // 個別レビューの抽出（レビューリストセクションから）
    // FANZAのレビュー構造: <div class="d-review">内の各レビュー項目
    const reviewBlocks = html.match(/<div[^>]*class="[^"]*review[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi) || [];
    for (const block of reviewBlocks.slice(0, 10)) { // 最大10件
      // レビュワー名
      const reviewerMatch = block.match(/(?:投稿者|ニックネーム)[：:]\s*([^<\n]+)/i);
      // 評価（★の数）
      const starsMatch = block.match(/★+/);
      const ratingMatch = block.match(/([0-9.]+)\s*(?:点|\/5)/i);
      // レビュー本文
      const contentMatch = block.match(/<p[^>]*class="[^"]*(?:comment|text|content)[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      // 投稿日
      const dateMatch = block.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);

      if (contentMatch || starsMatch || ratingMatch) {
        const rating = ratingMatch
          ? parseFloat(ratingMatch[1])
          : starsMatch
            ? starsMatch[0].length
            : 0;

        reviews.push({
          reviewerId: `fanza-${Date.now()}-${reviews.length}`,
          reviewerName: reviewerMatch ? reviewerMatch[1].trim() : '匿名',
          rating,
          content: contentMatch ? contentMatch[1].replace(/<[^>]+>/g, '').trim() : '',
          reviewDate: dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : undefined,
        });
      }
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
      reviews: reviews.length > 0 ? reviews : undefined,
      ratingSummary,
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

    // レビュー・評価サマリーの保存（新規・既存商品共通）
    if (product.ratingSummary) {
      await db
        .insert(productRatingSummary)
        .values({
          productId,
          aspName: 'FANZA',
          averageRating: String(product.ratingSummary.averageRating),
          totalReviews: product.ratingSummary.totalReviews,
          ratingDistribution: product.ratingSummary.ratingDistribution || null,
        })
        .onConflictDoUpdate({
          target: [productRatingSummary.productId, productRatingSummary.aspName],
          set: {
            averageRating: String(product.ratingSummary.averageRating),
            totalReviews: product.ratingSummary.totalReviews,
            ratingDistribution: product.ratingSummary.ratingDistribution || null,
            lastUpdated: sql`NOW()`,
          },
        });
      console.log(`    ⭐ 評価サマリー保存: ${product.ratingSummary.averageRating}点 (${product.ratingSummary.totalReviews}件)`);
    }

    // 個別レビューの保存
    if (product.reviews && product.reviews.length > 0) {
      let savedReviews = 0;
      for (const review of product.reviews) {
        try {
          await db
            .insert(productReviews)
            .values({
              productId,
              aspName: 'FANZA',
              reviewerName: review.reviewerName,
              rating: String(review.rating),
              title: review.title || null,
              content: review.content,
              reviewDate: review.reviewDate ? new Date(review.reviewDate) : null,
              helpful: review.helpful || 0,
              sourceReviewId: review.reviewerId,
            })
            .onConflictDoNothing();
          savedReviews++;
        } catch {
          // 重複エラーなどは無視
        }
      }
      if (savedReviews > 0) {
        console.log(`    📝 レビュー保存: ${savedReviews}件`);
      }
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

/**
 * AI機能: 説明文生成とタグ抽出（CrawlerAIHelper使用）
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
    const aiHelper = getAIHelper();
    const result = await aiHelper.processProduct(
      {
        title: product.title,
        description: product.description,
        performers: product.performers,
      },
      {
        extractTags: true,
        translate: false, // FANZAはLingvaで翻訳するため
        generateDescription: true,
      }
    );

    // エラーがあれば警告
    if (result.errors.length > 0) {
      console.log(`      ⚠️ AI処理で一部エラー: ${result.errors.join(', ')}`);
    }

    if (result.description) {
      aiDescription = {
        catchphrase: result.description.catchphrase || '',
        shortDescription: result.description.shortDescription || '',
      };
      console.log(`      ✅ AI説明文生成完了`);
      console.log(`         キャッチコピー: ${aiDescription.catchphrase.substring(0, 30)}...`);
    }

    if (result.tags) {
      aiTags = {
        genres: result.tags.genres || [],
        attributes: result.tags.attributes || [],
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
 * MGSと同様に新着順と古い順の両方でクロールして全商品を確保
 */
async function runFullScan(
  sort: SortOrder,
  maxPages: number,
  enableAI: boolean,
  forceReprocess: boolean,
  bidirectional: boolean = true, // デフォルトで双方向
): Promise<void> {
  console.log('=== FANZA フルスキャンモード ===');
  console.log(`ソート順: ${sort}`);
  console.log(`双方向クロール: ${bidirectional ? '有効（新着順＋古い順）' : '無効'}`);
  console.log(`最大ページ数: ${maxPages}`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`レート制限: ${RATE_LIMIT_MS}ms + ${JITTER_MS}msジッター\n`);

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const processedCids = new Set<string>();

  // 双方向クロール: 新着順と古い順の両方でスキャン（MGSと同様）
  const directions: DateSortDirection[] = bidirectional && sort === 'date'
    ? ['new', 'old']
    : ['new'];

  for (const direction of directions) {
    console.log(`\n========================================`);
    console.log(`📋 ソート方向: ${direction === 'new' ? '新着順' : '古い順'}`);
    console.log(`========================================`);

    let consecutiveEmptyPages = 0;
    let consecutiveNoNew = 0;
    const maxConsecutiveEmpty = 200; // 連続空ページ上限
    const maxConsecutiveNoNew = 5; // 連続新規なし上限

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      console.log(`\n--- ${direction === 'new' ? '新着' : '古い'}順 ページ ${pageNum}/${maxPages} ---`);

      try {
        const cids = await getCidsFromListPage(pageNum, sort, direction);

        if (cids.length === 0) {
          consecutiveEmptyPages++;
          console.log(`  空ページ検出 (${consecutiveEmptyPages}/${maxConsecutiveEmpty})`);

          if (consecutiveEmptyPages >= maxConsecutiveEmpty) {
            console.log('  連続空ページ上限到達、次の方向へ');
            break;
          }
          await rateLimit();
          continue;
        }

        consecutiveEmptyPages = 0;

        // 重複を除外（全方向で共有）
        const newCids = cids.filter(cid => !processedCids.has(cid));
        console.log(`  📦 新規CID: ${newCids.length}件 (重複除外: ${cids.length - newCids.length}件)`);

        // 連続して新規がない場合はこの方向を終了
        if (newCids.length === 0) {
          consecutiveNoNew++;
          console.log(`  連続新規なし: ${consecutiveNoNew}/${maxConsecutiveNoNew}`);
          if (consecutiveNoNew >= maxConsecutiveNoNew) {
            console.log('  連続新規なし上限到達、次の方向へ');
            break;
          }
          continue;
        } else {
          consecutiveNoNew = 0;
        }

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
                  await markRawDataAsProcessed('raw_html_data', rawDataId);
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

    console.log(`\n📊 ${direction === 'new' ? '新着順' : '古い順'}完了 - 累計: 処理=${processedCids.size}, 保存=${totalSaved}`);
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

    // 双方向クロール: デフォルトで有効、--no-bidirectionalで無効化
    const bidirectional = !args.includes('--no-bidirectional');

    await runFullScan(sort, maxPages, enableAI, forceReprocess, bidirectional);
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

  // 双方向クロール: デフォルトで有効
  const bidirectional = !args.includes('--no-bidirectional');

  console.log('=== FANZA クローラー ===');
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}`);
  console.log(`ソート順: ${sort}`);
  console.log(`双方向クロール: ${bidirectional ? '有効（新着順＋古い順）' : '無効'}`);
  console.log(`設定: pages=${pages}, start-page=${startPage}, limit=${limit}`);
  console.log(`レート制限: ${RATE_LIMIT_MS}ms + ${JITTER_MS}msジッター\n`);

  // 1. リストページから商品CIDを収集
  const allCids: string[] = [];
  const seenCids = new Set<string>();
  const endPage = startPage + pages - 1;

  // 新着順でリストページからCIDを収集
  console.log('=== 新着順でクロール ===');
  for (let pageNum = startPage; pageNum <= endPage && allCids.length < limit; pageNum++) {
    const cids = await getCidsFromListPage(pageNum, sort, 'new');
    for (const cid of cids) {
      if (!seenCids.has(cid) && allCids.length < limit) {
        seenCids.add(cid);
        allCids.push(cid);
      }
    }
  }

  console.log(`\n📦 新着順から ${allCids.length} 件の商品CIDを収集`);

  // 双方向クロール: 古い順でも収集
  if (bidirectional && allCids.length < limit) {
    console.log('\n=== 古い順でクロール ===');
    for (let pageNum = startPage; pageNum <= endPage && allCids.length < limit; pageNum++) {
      const cids = await getCidsFromListPage(pageNum, sort, 'old');
      let newCount = 0;
      for (const cid of cids) {
        if (!seenCids.has(cid) && allCids.length < limit) {
          seenCids.add(cid);
          allCids.push(cid);
          newCount++;
        }
      }
      if (newCount === 0) {
        console.log(`  ページ ${pageNum}: 新規なし、終了`);
        break;
      }
    }
    console.log(`\n📦 古い順から追加 ${allCids.length - seenCids.size + 1} 件`);
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
            await markRawDataAsProcessed('raw_html_data', rawDataId);
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
