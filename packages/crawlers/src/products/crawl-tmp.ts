/**
 * TMP系クローラー
 *
 * 機能:
 * - TMP系サイト（heydouga, x1x, enkou55, urekko等）から商品データを取得
 * - heydouga: /moviepages/{provider}/{id}/index.html パターン
 * - その他TMP系: /title/{id} パターン
 * - レート制限: 3秒以上の間隔
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx packages/crawlers/src/products/crawl-tmp.ts --site=heydouga [--pages 10] [--start-page 1]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../lib/db';
import { products, productSources, performers, productPerformers, productImages } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import * as cheerio from 'cheerio';

const db = getDb();

// TMP系サイト設定
interface TmpSiteConfig {
  name: string;
  baseUrl: string;
  listPageUrl: string;
  productIdPattern: RegExp;
  productUrlFormat: string;
  aspName: string;
  encoding?: string;
  usePagination?: boolean;  // ページネーションを使用するか
}

const TMP_SITES: Record<string, TmpSiteConfig> = {
  heydouga: {
    name: 'Hey動画',
    baseUrl: 'https://www.heydouga.com',
    // トップページから商品を取得（リストページはJSで動的ロード）
    listPageUrl: 'https://www.heydouga.com/',
    productIdPattern: /\/moviepages\/(\d+)\/(\d+)\/?/,
    productUrlFormat: '/moviepages/{providerId}/{movieId}/index.html',
    aspName: 'HEYDOUGA',
    usePagination: false,  // ページネーション不使用
  },
  x1x: {
    name: 'X1X',
    baseUrl: 'http://www.x1x.com',
    listPageUrl: 'http://www.x1x.com/list?page={page}',
    productIdPattern: /\/title\/(\d+)/,
    productUrlFormat: '/title/{id}',
    aspName: 'X1X',
  },
  enkou55: {
    name: '援交55',
    baseUrl: 'http://enkou55.com',
    listPageUrl: 'http://enkou55.com/list?page={page}',
    productIdPattern: /\/title\/(\d+)/,
    productUrlFormat: '/title/{id}',
    aspName: 'ENKOU55',
  },
  urekko: {
    name: '熟っ子倶楽部',
    baseUrl: 'http://urekko.com',
    listPageUrl: 'http://urekko.com/list?page={page}',
    productIdPattern: /\/title\/(\d+)/,
    productUrlFormat: '/title/{id}',
    aspName: 'UREKKO',
  },
  xxxurabi: {
    name: 'XXX裏美',
    baseUrl: 'http://ppv.xxxurabi.com',
    listPageUrl: 'http://ppv.xxxurabi.com/pp/list/page/{page}.htm',
    productIdPattern: /\/pp\/title\/(\d+)\.htm/,
    productUrlFormat: '/pp/title/{id}.htm',
    aspName: 'XXXURABI',
  },
};

// レート制限: 3秒 + ジッター
const RATE_LIMIT_MS = 3000;
const JITTER_MS = 1500;

interface TmpProduct {
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
 * ページを取得
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cookie': 'adc=1',  // 年齢認証Cookie
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * heydouga: リストページから商品IDを抽出
 */
async function extractHeydougaProductIds(
  siteConfig: TmpSiteConfig,
  pageNum: number
): Promise<string[]> {
  const url = siteConfig.listPageUrl.replace('{page}', pageNum.toString());
  console.log(`📄 Fetching list page: ${url}`);

  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const productIds: string[] = [];

  // moviepages/XXX/YYY/index.html パターンを抽出
  $('a[href*="moviepages"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(siteConfig.productIdPattern);
    if (match && match[1] && match[2]) {
      const productId = `${match[1]}-${match[2]}`;
      if (!productIds.includes(productId)) {
        productIds.push(productId);
      }
    }
  });

  console.log(`  Found ${productIds.length} products on page ${pageNum}`);
  return productIds;
}

/**
 * TMP系（x1x, enkou55等）: リストページから商品IDを抽出
 */
async function extractTmpProductIds(
  siteConfig: TmpSiteConfig,
  pageNum: number
): Promise<string[]> {
  const url = siteConfig.listPageUrl.replace('{page}', pageNum.toString());
  console.log(`📄 Fetching list page: ${url}`);

  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const productIds: string[] = [];

  // /title/XXXXX パターンを抽出
  $('a[href*="/title/"]').each((_, el) => {
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
 * heydouga: 商品詳細ページから情報を抽出
 */
async function extractHeydougaProductDetails(
  siteConfig: TmpSiteConfig,
  productId: string
): Promise<TmpProduct | null> {
  const [providerId, movieId] = productId.split('-');
  const detailPath = siteConfig.productUrlFormat
    .replace('{providerId}', providerId)
    .replace('{movieId}', movieId);
  const url = `${siteConfig.baseUrl}${detailPath}`;
  console.log(`  📦 Fetching detail: ${url}`);

  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // タイトル抽出
  let title = $('title').text().trim();
  title = title.replace(/\s*-\s*Hey動画.*$/, '').trim();

  if (!title) {
    console.log(`  ⚠️ Could not extract title for ${productId}`);
    return null;
  }

  // 説明文
  const description = $('meta[name="description"]').attr('content') || '';

  // 出演者 - HEYDOUGAはimg.nomovieのalt属性から演者名を抽出
  const performers: string[] = [];

  // 方法1: movie-playerセクションのimg.nomovieのalt属性
  $('section.movie-player img.nomovie, .movie-player img').each((_, el) => {
    const name = $(el).attr('alt')?.trim();
    if (name && isValidPerformerName(name)) {
      const normalized = normalizePerformerName(name);
      if (normalized && !performers.includes(normalized)) {
        performers.push(normalized);
      }
    }
  });

  // 方法2: /actress/リンク（フォールバック）
  if (performers.length === 0) {
    $('a[href*="/actress/"]').each((_, el) => {
      const name = $(el).text().trim();
      if (name && isValidPerformerName(name)) {
        const normalized = normalizePerformerName(name);
        if (normalized && !performers.includes(normalized)) {
          performers.push(normalized);
        }
      }
    });
  }

  // 詳細情報
  let releaseDate: string | null = null;
  let duration: number | null = null;
  const genres: string[] = [];

  // 配信日
  $('dt, th').each((_, el) => {
    const label = $(el).text().trim();
    const value = $(el).next('dd, td').text().trim();

    if (label.includes('配信日') || label.includes('公開日')) {
      const dateMatch = value.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (dateMatch) {
        releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    if (label.includes('再生時間') || label.includes('収録時間')) {
      const durationMatch = value.match(/(\d+)\s*(分|min)/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]);
      }
    }
  });

  // ジャンル
  $('a[href*="/listpages/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('/listpages/') && text && !text.includes('すべて')) {
      if (!genres.includes(text)) {
        genres.push(text);
      }
    }
  });

  // サムネイル - HEYDOUGAの場合は固定パターンで生成
  // providerId/movieId は関数冒頭で既に取得済み
  const thumbnailUrl = `${siteConfig.baseUrl}/contents/${providerId}/${movieId}/player_thumb.webp`;

  // サンプル画像
  const sampleImages: string[] = [];
  $('img[src*="cap"], img[src*="sample"], img.image-thumbnail').each((_, el) => {
    let src = $(el).attr('data-src') || $(el).attr('src') || '';
    if (src) {
      if (!src.startsWith('http')) {
        src = siteConfig.baseUrl + src;
      }
      if (!sampleImages.includes(src) && !src.includes('player_thumb')) {
        sampleImages.push(src);
      }
    }
  });

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
 * TMP系（x1x, enkou55等）: 商品詳細ページから情報を抽出
 */
async function extractTmpProductDetails(
  siteConfig: TmpSiteConfig,
  productId: string
): Promise<TmpProduct | null> {
  const detailPath = siteConfig.productUrlFormat.replace('{id}', productId);
  const url = `${siteConfig.baseUrl}${detailPath}`;
  console.log(`  📦 Fetching detail: ${url}`);

  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // タイトル抽出
  let title = $('h1, h2.title, .title h1').first().text().trim();
  if (!title) {
    title = $('title').text().trim();
    title = title.replace(/\s*\|.*$/, '').trim();
  }

  if (!title) {
    console.log(`  ⚠️ Could not extract title for ${productId}`);
    return null;
  }

  // 説明文
  const description = $('meta[name="description"]').attr('content') ||
                      $('.description, .synopsis').text().trim() || '';

  // 出演者
  const performers: string[] = [];
  $('a[href*="/actress"], a[href*="/search/actress"]').each((_, el) => {
    const name = $(el).text().trim();
    if (name && isValidPerformerName(name)) {
      const normalized = normalizePerformerName(name);
      if (normalized && !performers.includes(normalized)) {
        performers.push(normalized);
      }
    }
  });

  // 詳細情報
  let releaseDate: string | null = null;
  let duration: number | null = null;
  const genres: string[] = [];

  // 配信日・再生時間を探す
  $('dt, th, .label, .spec-label').each((_, el) => {
    const label = $(el).text().trim();
    const value = $(el).next('dd, td, .value, .spec-value').text().trim();

    if (label.includes('配信日') || label.includes('公開日') || label.includes('発売日')) {
      const dateMatch = value.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
      if (dateMatch) {
        releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    if (label.includes('再生時間') || label.includes('収録時間')) {
      const durationMatch = value.match(/(\d+)\s*(分|min)/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]);
      }
    }
  });

  // ジャンル
  $('a[href*="/genre"], a[href*="/search/genre"], a[href*="/search/play"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && !genres.includes(text)) {
      genres.push(text);
    }
  });

  // サムネイル - TMP系は固定パターンで生成
  let thumbnailUrl = '';

  // X1X/ENKOU55/UREKKO: http://static.{site}.com/images/title/{aa}/{bb}/{cc}/player.jpg
  // IDを6桁にパディングして2桁ずつ分割: 117274 -> 11/72/74
  if (siteConfig.aspName === 'X1X') {
    const paddedId = productId.padStart(6, '0');
    const aa = paddedId.slice(0, 2);
    const bb = paddedId.slice(2, 4);
    const cc = paddedId.slice(4, 6);
    thumbnailUrl = `http://static.x1x.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
  } else if (siteConfig.aspName === 'ENKOU55') {
    // ENKOU55: 6桁ID 118197 -> 11/81/97
    const paddedId = productId.padStart(6, '0');
    const aa = paddedId.slice(0, 2);
    const bb = paddedId.slice(2, 4);
    const cc = paddedId.slice(4, 6);
    thumbnailUrl = `http://static.enkou55.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
  } else if (siteConfig.aspName === 'UREKKO') {
    // UREKKO: 6桁ID 116275 -> 11/62/75
    const paddedId = productId.padStart(6, '0');
    const aa = paddedId.slice(0, 2);
    const bb = paddedId.slice(2, 4);
    const cc = paddedId.slice(4, 6);
    thumbnailUrl = `http://static.urekko.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
  } else {
    // その他: HTMLから取得を試みる
    const mainImg = $('img.main, img.jacket, .main-image img, .package img').first();
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
  }

  // サンプル画像
  const sampleImages: string[] = [];
  $('img[src*="cap"], img[src*="sample"], .gallery img, .screenshots img').each((_, el) => {
    let src = $(el).attr('src') || '';
    if (src) {
      if (!src.startsWith('http')) {
        src = siteConfig.baseUrl + src;
      }
      if (!sampleImages.includes(src)) {
        sampleImages.push(src);
      }
    }
  });

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
  siteConfig: TmpSiteConfig,
  product: TmpProduct
): Promise<boolean> {
  try {
    const normalizedProductId = `${siteConfig.aspName}-${product.productId}`;

    // 既存チェック
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
      affiliateUrl: `${siteConfig.baseUrl}${siteConfig.productUrlFormat.replace('{id}', product.productId).replace('{providerId}', product.productId.split('-')[0] || '').replace('{movieId}', product.productId.split('-')[1] || '')}`,
      dataSource: 'SCRAPE',
      isSubscription: true, // TMP系は月額制
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
  console.log('🚀 TMP系クローラーを開始します...\n');

  // コマンドライン引数
  const args = process.argv.slice(2);
  const siteArg = args.find(a => a.startsWith('--site='))?.split('=')[1] || 'heydouga';
  const pagesArg = args.find(a => a.startsWith('--pages='))?.split('=')[1];
  const startPageArg = args.find(a => a.startsWith('--start-page='))?.split('=')[1];

  const pages = pagesArg ? parseInt(pagesArg) : 5;
  const startPage = startPageArg ? parseInt(startPageArg) : 1;

  const siteConfig = TMP_SITES[siteArg];
  if (!siteConfig) {
    console.error(`Unknown site: ${siteArg}`);
    console.log('Available sites:', Object.keys(TMP_SITES).join(', '));
    process.exit(1);
  }

  console.log(`📍 Site: ${siteConfig.name}`);

  // ページネーション設定
  const usePagination = siteConfig.usePagination !== false;
  const effectivePages = usePagination ? pages : 1;

  if (usePagination) {
    console.log(`📄 Pages: ${startPage} to ${startPage + effectivePages - 1}\n`);
  } else {
    console.log(`📄 Single page crawl (no pagination)\n`);
  }

  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let consecutiveEmptyPages = 0;
  const MAX_CONSECUTIVE_EMPTY_PAGES = 200;

  // heydougaとその他で抽出関数を切り替え
  const isHeydouga = siteArg === 'heydouga';
  const extractProductIds = isHeydouga ? extractHeydougaProductIds : extractTmpProductIds;
  const extractProductDetails = isHeydouga ? extractHeydougaProductDetails : extractTmpProductDetails;

  for (let pageNum = startPage; pageNum < startPage + effectivePages; pageNum++) {
    console.log(`\n📖 Processing page ${pageNum}...`);

    const productIds = await extractProductIds(siteConfig, pageNum);

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
