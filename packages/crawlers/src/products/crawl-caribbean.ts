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

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages } from '../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData } from '../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
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
    listPageUrl: 'https://www.1pondo.tv/listpages/all{page}.html', // Note: 1pondo is SPA
    detailPagePattern: '/movies/{id}/',
    encoding: 'utf-8',
    aspName: '1PONDO',
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
  },
  pacopacomama: {
    name: 'パコパコママ',
    baseUrl: 'https://www.pacopacomama.com',
    listPageUrl: 'https://www.pacopacomama.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'euc-jp',
    aspName: 'PACOPACOMAMA',
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
  },
  h0930: {
    name: '人妻斬り',
    baseUrl: 'https://www.h0930.com',
    listPageUrl: 'https://www.h0930.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'H0930',
  },
  c0930: {
    name: '人妻斬り（熟女）',
    baseUrl: 'https://www.c0930.com',
    listPageUrl: 'https://www.c0930.com/listpages/all{page}.html',
    detailPagePattern: '/moviepages/{id}/index.html',
    encoding: 'utf-8',
    aspName: 'C0930',
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
      console.error(`Failed to fetch ${url}: ${response.status}`);
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
    const match = href.match(/moviepages\/([0-9-]+)\/index\.html/);
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
      if (!performers.includes(normalized)) {
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
    if (dateMatch) {
      releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
  }

  // 再生時間
  const durationEl = $('[itemprop="duration"]');
  if (durationEl.length > 0) {
    const content = durationEl.attr('content') || durationEl.text();
    // T00H30M35S または 30:35 形式
    const isoMatch = content.match(/T(\d+)H(\d+)M(\d+)S/);
    if (isoMatch) {
      duration = parseInt(isoMatch[1]) * 60 + parseInt(isoMatch[2]);
    } else {
      const timeMatch = content.match(/(\d+):(\d+)/);
      if (timeMatch) {
        duration = parseInt(timeMatch[1]);
      }
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
  };
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(
  siteConfig: DtiSiteConfig,
  product: CaribbeanProduct
): Promise<boolean> {
  try {
    const normalizedProductId = `${siteConfig.aspName}-${product.productId}`;

    // 既存チェック（products テーブルで確認）
    const existingProduct = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    if (existingProduct.length > 0) {
      console.log(`  ⏭️ Already exists: ${product.productId}`);
      return false;
    }

    // 新規作成
    const [newProduct] = await db
      .insert(products)
      .values({
        normalizedProductId,
        title: product.title,
        description: product.description || null,
        defaultThumbnailUrl: product.thumbnailUrl || null,
        releaseDate: product.releaseDate || null,
        duration: product.duration || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: products.id });

    // ProductSource
    await db.insert(productSources).values({
      productId: newProduct.id,
      aspName: siteConfig.aspName,
      originalProductId: product.productId,
      affiliateUrl: `${siteConfig.baseUrl}/moviepages/${product.productId}/index.html`,
      dataSource: 'SCRAPE',
      isSubscription: true, // DTI系は月額制
    });

    // 出演者
    for (const performerName of product.performers) {
      if (!isValidPerformerForProduct(performerName, product.title)) {
        continue;
      }

      let [existingPerformer] = await db
        .select()
        .from(performers)
        .where(eq(performers.name, performerName))
        .limit(1);

      if (!existingPerformer) {
        [existingPerformer] = await db
          .insert(performers)
          .values({
            name: performerName,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
      }

      await db
        .insert(productPerformers)
        .values({
          productId: newProduct.id,
          performerId: existingPerformer.id,
        })
        .onConflictDoNothing();
    }

    // サンプル画像
    for (let i = 0; i < product.sampleImages.length; i++) {
      await db
        .insert(productImages)
        .values({
          productId: newProduct.id,
          imageUrl: product.sampleImages[i],
          imageType: 'sample',
          displayOrder: i,
          aspName: siteConfig.aspName,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    console.log(`  ✅ Saved: ${product.title}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error saving ${product.productId}:`, error);
    return false;
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

  const pages = pagesArg ? parseInt(pagesArg) : 5;
  const startPage = startPageArg ? parseInt(startPageArg) : 1;

  const siteConfig = DTI_SITES[siteArg];
  if (!siteConfig) {
    console.error(`Unknown site: ${siteArg}`);
    console.log('Available sites:', Object.keys(DTI_SITES).join(', '));
    process.exit(1);
  }

  console.log(`📍 Site: ${siteConfig.name}`);
  console.log(`📄 Pages: ${startPage} to ${startPage + pages - 1}\n`);

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
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

      const saved = await saveProduct(siteConfig, product);
      if (saved) {
        totalSaved++;
      } else {
        totalSkipped++;
      }
    }

    await rateLimit();
  }

  console.log('\n========================================');
  console.log('クロール完了');
  console.log(`  保存: ${totalSaved}`);
  console.log(`  スキップ: ${totalSkipped}`);
  console.log(`  エラー: ${totalErrors}`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
