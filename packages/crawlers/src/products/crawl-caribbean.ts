/**
 * カリビアンコム（DTI系）クローラー
 *
 * 機能:
 * - カリビアンコム (caribbeancom.com) からHTMLをクロールして商品データを取得
 * - 新作リストページから商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - レート制限: 3秒以上の間隔
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/products/crawl-caribbean.ts [--pages 10] [--start-page 1]
 */

if (!process.env['DATABASE_URL']) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { parseDuration, parseDate, extractPrice } from '../lib/crawler/parse-helpers';
import { upsertRawHtmlDataWithGcs, markRawDataAsProcessed } from '../lib/crawler/dedup-helper';
import * as cheerio from 'cheerio';
import * as iconv from 'iconv-lite';

const db = getDb();

// DTI系サイト設定
interface DtiSiteConfig {
  name: string;
  baseUrl: string;
  listPageUrl: string;
  detailPagePattern: string;
  encoding: string;
  aspName: string;
  isSpa?: boolean;  // SPAサイトはホームページから取得
}

const DTI_SITES: Record<string, DtiSiteConfig> = {
  caribbeancom: {
    name: 'カリビアンコム',
    baseUrl: 'https://www.caribbeancom.com',
    listPageUrl: 'https://www.caribbeancom.com/listpages/all{page}.htm',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: 'CARIBBEANCOM',
  },
  caribbeancompr: {
    name: 'カリビアンコムプレミアム',
    baseUrl: 'https://www.caribbeancompr.com',
    listPageUrl: 'https://www.caribbeancompr.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: 'CARIBBEANCOMPR',
  },
  '1pondo': {
    name: '一本道',
    baseUrl: 'https://www.1pondo.tv',
    listPageUrl: 'https://www.1pondo.tv/listpages/all{page}.html',
    detailPagePattern: '/movies/{id}/',
    encoding: 'utf-8',
    aspName: '1PONDO',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  heyzo: {
    name: 'HEYZO',
    baseUrl: 'https://www.heyzo.com',
    listPageUrl: 'https://www.heyzo.com/listpages/all_{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'HEYZO',
  },
  '10musume': {
    name: '天然むすめ',
    baseUrl: 'https://www.10musume.com',
    listPageUrl: 'https://www.10musume.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: '10MUSUME',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  pacopacomama: {
    name: 'パコパコママ',
    baseUrl: 'https://www.pacopacomama.com',
    listPageUrl: 'https://www.pacopacomama.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: 'PACOPACOMAMA',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  muramura: {
    name: 'むらむら',
    baseUrl: 'https://www.muramura.tv',
    listPageUrl: 'https://www.muramura.tv/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: 'MURAMURA',
  },
  h4610: {
    name: 'エッチな4610',
    baseUrl: 'https://www.h4610.com',
    listPageUrl: 'https://www.h4610.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'H4610',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  h0930: {
    name: '人妻斬り',
    baseUrl: 'https://www.h0930.com',
    listPageUrl: 'https://www.h0930.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'H0930',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  c0930: {
    name: '人妻斬り（熟女）',
    baseUrl: 'https://www.c0930.com',
    listPageUrl: 'https://www.c0930.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'C0930',
    isSpa: true,  // SPAサイト - ホームページから取得
  },
  kin8tengoku: {
    name: '金髪天國',
    baseUrl: 'https://www.kin8tengoku.com',
    listPageUrl: 'https://www.kin8tengoku.com/listpages/all_{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'KIN8TENGOKU',
  },
  nyoshin: {
    name: '女体のしんぴ',
    baseUrl: 'https://www.nyoshin.com',
    listPageUrl: 'https://www.nyoshin.com/listpages/all_{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'NYOSHIN',
  },
  h0230: {
    name: 'エッチな0230',
    baseUrl: 'https://www.h0230.com',
    listPageUrl: 'https://www.h0230.com/listpages/all_{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'H0230',
  },
};

// レート制限: 3秒 + ジッター
const RATE_LIMIT_MS = 3000;
const JITTER_MS = 1500;

interface CaribbeanProduct {
  productId: string;
  title: string;
  description: string;
  performers: string[];
  releaseDate: string | null;
  duration: number | null;
  thumbnailUrl: string;
  sampleImages: string[];
  genres: string[];
  price: number | null;  // 月額料金
  rawHtml: string;  // ハッシュ計算用
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
 * ページを取得（文字コード変換付き）
 */
async function fetchPage(url: string, encoding: string = 'utf-8'): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response['status']}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 文字コード変換
    if (encoding.toLowerCase() === 'euc-jp') {
      return iconv.decode(buffer, 'euc-jp');
    }
    return buffer.toString('utf-8');
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * リストページから商品IDを抽出
 */
async function extractProductIdsFromList(
  siteConfig: DtiSiteConfig,
  pageNum: number
): Promise<string[]> {
  const url = siteConfig.listPageUrl.replace('{page}', pageNum.toString());
  console.log(`📄 Fetching list page: ${url}`);

  const html = await fetchPage(url, siteConfig.encoding);
  if (!html) return [];

  const $ = cheerio.load(html);
  const productIds: string[] = [];

  // moviepages/XXXXX-XXX/index.html パターンを抽出
  $('a[href*="moviepages"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/moviepages\/([0-9a-zA-Z-]+)\/(?:index\.html)?/);
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
 * ホームページから商品IDを抽出（SPAサイト用）
 * SPAサイトはlistpagesが使えないため、ホームページに表示されている商品IDを取得
 */
async function extractProductIdsFromHomepage(
  siteConfig: DtiSiteConfig
): Promise<string[]> {
  const url = siteConfig.baseUrl + '/';
  console.log(`📄 Fetching homepage (SPA mode): ${url}`);

  const html = await fetchPage(url, siteConfig.encoding);
  if (!html) return [];

  const $ = cheerio.load(html);
  const productIds: string[] = [];

  // moviepages/XXXXX/index.html または moviepages/XXXXX/ パターンを抽出
  // c0930/h0930/h4610等のパターン: hitozuma1550, ki260106, ori1933, gol221 など
  $('a[href*="moviepages"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // 自サイトのリンクのみ抽出（他サイトへのリンクは除外）
    const isOwnSite = href.includes(siteConfig.baseUrl) ||
                      href.startsWith('/moviepages') ||
                      href.startsWith('//www.' + siteConfig.baseUrl.replace('https://www.', ''));

    if (!isOwnSite && href.includes('//')) {
      return; // 他サイトへのリンクはスキップ
    }

    const match = href.match(/moviepages\/([a-zA-Z0-9_-]+)(?:\/|\/index\.html)?/);
    if (match && match[1]) {
      const productId = match[1];
      // images などのパスは除外
      if (productId !== 'images' && !productIds.includes(productId)) {
        productIds.push(productId);
      }
    }
  });

  console.log(`  Found ${productIds.length} products from homepage`);
  return productIds;
}

/**
 * 商品詳細ページから情報を抽出
 */
async function extractProductDetails(
  siteConfig: DtiSiteConfig,
  productId: string
): Promise<CaribbeanProduct | null> {
  const detailPath = siteConfig.detailPagePattern.replace('{id}', productId);
  const url = `${siteConfig.baseUrl}${detailPath}`;
  console.log(`  📦 Fetching detail: ${url}`);

  const html = await fetchPage(url, siteConfig.encoding);
  if (!html) return null;

  const $ = cheerio.load(html);

  // タイトル抽出
  let title = $('title').text().trim();
  // " | カリビアンコム" などのサフィックスを除去
  title = title.replace(/\s*\|.*$/, '').trim();

  // 説明文
  const description = $('meta[name="description"]').attr('content') || '';

  // 出演者
  const performers: string[] = [];
  $('a[href*="/actress/"]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && isValidPerformerName(name)) {
      const normalized = normalizePerformerName(name);
      if (normalized && !performers.includes(normalized)) {
        performers.push(normalized);
      }
    }
  });

  // spec-content からの情報抽出
  let releaseDate: string | null = null;
  let duration: number | null = null;
  const genres: string[] = [];

  // 公開日
  const dateEl = $('[itemprop="uploadDate"], [itemprop="datePublished"]');
  if (dateEl.length > 0) {
    const dateText = dateEl.text().trim();
    const dateMatch = dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch && dateMatch[2] && dateMatch[3]) {
      releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
  }

  // 再生時間 - parse-helpersを使用
  const durationEl = $('[itemprop="duration"]');
  if (durationEl.length > 0) {
    const content = durationEl.attr('content') || durationEl.text();
    duration = parseDuration(content);
  }

  // 価格情報（月額制サイトの料金）
  let price: number | null = null;
  // DTI系サイトの価格パターンを検索
  const priceText = $('meta[name="keywords"]').attr('content') || '';
  const bodyText = $.html();
  // 一般的な価格パターン: $XX.XX/month or ¥XXXX
  const pricePatterns = [
    /\$(\d+(?:\.\d{2})?)\s*(?:\/month|月)/i,
    /[¥￥](\d{1,3}(?:,\d{3})*)/,
    /(\d{1,3}(?:,\d{3})*)\s*円/,
  ];
  for (const pattern of pricePatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      price = extractPrice(match[0]);
      if (price) break;
    }
  }

  // ジャンル/タグ
  $('a[href*="/listpages/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    // カテゴリページへのリンクはジャンルとして扱う
    if (href.includes('/listpages/') && text && !text.includes('すべて')) {
      if (!genres.includes(text)) {
        genres.push(text);
      }
    }
  });

  // サムネイル画像
  let thumbnailUrl = '';
  const mainImg = $('img[src*="images/l_"]').first();
  if (mainImg.length > 0) {
    thumbnailUrl = mainImg.attr('src') || '';
    if (!thumbnailUrl.startsWith('http')) {
      thumbnailUrl = siteConfig.baseUrl + thumbnailUrl;
    }
  }

  // サンプル画像
  const sampleImages: string[] = [];
  $('img[itemprop="thumbnail"], img.gallery-image').each((_, el) => {
    let src = $(el).attr('src') || '';
    if (src) {
      if (!src.startsWith('http')) {
        src = siteConfig.baseUrl + src;
      }
      // small画像をlarge画像に変換
      src = src.replace('/images/s/', '/images/l/');
      if (!sampleImages.includes(src)) {
        sampleImages.push(src);
      }
    }
  });

  if (!title) {
    console.log(`  ⚠️ Could not extract title for ${productId}`);
    return null;
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
    rawHtml: html,  // ハッシュ計算用に生HTML保存
  };
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(
  siteConfig: DtiSiteConfig,
  product: CaribbeanProduct,
  forceReprocess: boolean = false
): Promise<{ saved: boolean; isNew: boolean; skippedUnchanged: boolean }> {
  try {
    const normalizedProductId = `${siteConfig.aspName}-${product['productId']}`;

    // ハッシュベースの重複検出（GCS優先）
    const upsertResult = await upsertRawHtmlDataWithGcs(
      siteConfig.aspName,
      product['productId'],
      `${siteConfig.baseUrl}/moviepages/${product['productId']}/index.html`,
      product.rawHtml
    );

    // ハッシュ変更なし、かつ処理済みならスキップ
    if (upsertResult.shouldSkip && !forceReprocess) {
      console.log(`  ⏭️ スキップ(変更なし): ${product['productId']}`);
      return { saved: false, isNew: false, skippedUnchanged: true };
    }

    // 既存チェック（products テーブルで確認）
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
    await db['insert'](productSources).values({
      productId: productId,
      aspName: siteConfig.aspName,
      originalProductId: product['productId'],
      affiliateUrl: `${siteConfig.baseUrl}/moviepages/${product['productId']}/index.html`,
      price: product['price'],  // 月額料金
      dataSource: 'SCRAPE',
      isSubscription: true, // DTI系は月額制
    }).onConflictDoUpdate({
      target: [productSources.productId, productSources.aspName],
      set: {
        affiliateUrl: `${siteConfig.baseUrl}/moviepages/${product['productId']}/index.html`,
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
          imageUrl: imageUrl,
          imageType: 'sample',
          displayOrder: i,
          aspName: siteConfig.aspName,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 処理済みマーク
    await markRawDataAsProcessed('dti', upsertResult.id);

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
  console.log('🚀 カリビアンコム（DTI系）クローラーを開始します...\n');

  // コマンドライン引数
  const args = process.argv.slice(2);
  const siteArg = args.find(a => a.startsWith('--site='))?.split('=')[1] || 'caribbeancom';
  const pagesArg = args.find(a => a.startsWith('--pages='))?.split('=')[1];
  const startPageArg = args.find(a => a.startsWith('--start-page='))?.split('=')[1];
  const forceReprocess = args.includes('--force');

  const pages = pagesArg ? parseInt(pagesArg) : 5;
  const startPage = startPageArg ? parseInt(startPageArg) : 1;

  const siteConfig = DTI_SITES[siteArg];
  if (!siteConfig) {
    console.error(`Unknown site: ${siteArg}`);
    console.log('Available sites:', Object.keys(DTI_SITES).join(', '));
    process.exit(1);
  }

  console.log(`📍 Site: ${siteConfig.name}`);
  console.log(`📄 Mode: ${siteConfig.isSpa ? 'SPA (homepage only)' : `Pages ${startPage} to ${startPage + pages - 1}`}`);
  console.log(`🔄 強制再処理: ${forceReprocess ? '有効' : '無効'}\n`);

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkippedUnchanged = 0;
  let totalErrors = 0;

  // SPAサイトの場合はホームページからのみ取得
  if (siteConfig.isSpa) {
    console.log(`\n📖 Processing homepage (SPA mode)...`);

    const productIds = await extractProductIdsFromHomepage(siteConfig);

    if (productIds.length === 0) {
      console.log('  ホームページから商品が見つかりませんでした');
    } else {
      for (const productId of productIds) {
        await rateLimit();

        const product = await extractProductDetails(siteConfig, productId);
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
    }
  } else {
    // 通常のlistpagesベースのクロール
    let consecutiveEmptyPages = 0;
    const MAX_CONSECUTIVE_EMPTY_PAGES = 200;

    for (let pageNum = startPage; pageNum < startPage + pages; pageNum++) {
      console.log(`\n📖 Processing page ${pageNum}...`);

      const productIds = await extractProductIdsFromList(siteConfig, pageNum);

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

        const product = await extractProductDetails(siteConfig, productId);
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
