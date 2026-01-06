/**
 * Wiki sites performer crawler
 * Crawls performer names from av-wiki.net, seesaawiki.jp/av_neme, shiroutoname.com
 *
 * 対応サイト:
 * - av-wiki.net (WordPress)
 * - seesaawiki.jp/av_neme (SeesaaWiki)
 * - shiroutoname.com (素人系特化)
 *
 * 使用方法:
 * npx tsx scripts/crawlers/crawl-wiki-performers.ts av-wiki 100
 * npx tsx scripts/crawlers/crawl-wiki-performers.ts shiroutoname 100
 * npx tsx scripts/crawlers/crawl-wiki-performers.ts --search 300MIUM-1000
 * npx tsx scripts/crawlers/crawl-wiki-performers.ts --process 1000  # wiki_crawl_dataを反映
 */

// Set DATABASE_URL if not already set
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db/index.js';
import { performers, performerAliases, products, productPerformers } from '../../lib/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import iconv from 'iconv-lite';
import { isValidPerformerName } from '../../lib/performer-validation.js';
import { getFirstRow, getRows, IdRow } from '../../lib/crawler/index.js';
import {
  upsertRawHtmlDataWithGcs,
  markRawDataAsProcessed,
} from '../../lib/crawler/dedup-helper.js';

interface PerformerData {
  name: string;
  productId: string;
  source: 'av-wiki' | 'seesaawiki';
}

interface ProductData {
  productId: string;
  title?: string;
  releaseDate?: string;
  studio?: string;
  series?: string;
  performers: string[];
  thumbnailUrl?: string;
  source: 'av-wiki' | 'seesaawiki';
}

/**
 * Detect encoding from HTML content
 */
function detectEncoding(buffer: Buffer, url: string): string {
  // seesaawiki uses EUC-JP
  if (url.includes('seesaawiki.jp')) {
    return 'euc-jp';
  }

  // av-wiki uses UTF-8 (WordPress default)
  if (url.includes('av-wiki.net')) {
    return 'utf-8';
  }

  // Try to detect from HTML meta tags
  const head = buffer.slice(0, 4096).toString('latin1');

  // Pattern 1: <meta charset="xxx">
  const charsetMatch1 = head.match(/<meta\s+charset=["']?([^"'\s>]+)/i);
  if (charsetMatch1?.[1]) {
    return charsetMatch1[1].toLowerCase();
  }

  // Pattern 2: <meta http-equiv="Content-Type" content="text/html; charset=xxx">
  const charsetMatch2 = head.match(/charset=([^"'\s>]+)/i);
  if (charsetMatch2?.[1]) {
    return charsetMatch2[1].toLowerCase();
  }

  return 'utf-8'; // default
}

/**
 * Fetch HTML content with proper encoding handling
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`  ✗ HTTP ${response['status']} for ${url}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const encoding = detectEncoding(buffer, url);
    console.log(`    🔤 Detected encoding: ${encoding} for ${url}`);

    const html = iconv.decode(buffer, encoding);

    // Rate limiting: 3000ms between requests
    await new Promise(resolve => setTimeout(resolve, 3000));

    return html;
  } catch (error) {
    console.error(`  ✗ Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Parse av-wiki.net article pages
 */
function parseAvWiki(html: string, url: string): { performers: PerformerData[], products: ProductData[] } {
  const performerResults: PerformerData[] = [];
  const productResults: ProductData[] = [];

  // Look for post content in WordPress
  const contentMatch = html.match(/<div class="entry-body">[\s\S]*?<\/div>/);
  if (!contentMatch) return { performers: performerResults, products: productResults };

  const content = contentMatch[0];

  // Extract product info from structured data
  const productMap = new Map<string, ProductData>();

  // Look for tables with product information
  const tableRows = content.match(/<tr[\s\S]*?<\/tr>/g) || [];

  let currentProductId: string | null = null;
  let currentPerformers: string[] = [];
  let currentTitle: string | null = null;
  let currentReleaseDate: string | null = null;

  for (const row of tableRows) {
    // Extract product ID
    const productIdMatch = row.match(/([A-Z]{2,10}-?\d{3,6})/i);
    if (productIdMatch?.[1]) {
      const productId = productIdMatch[1].toUpperCase();

      // Save previous product if exists
      if (currentProductId && currentPerformers.length > 0) {
        productMap.set(currentProductId, {
          productId: currentProductId,
          ...(currentTitle && { title: currentTitle }),
          ...(currentReleaseDate && { releaseDate: currentReleaseDate }),
          performers: currentPerformers,
          source: 'av-wiki'
        });

        // Add performer data
        for (const name of currentPerformers) {
          performerResults.push({
            name,
            productId: currentProductId,
            source: 'av-wiki'
          });
        }
      }

      // Start new product
      currentProductId = productId;
      currentPerformers = [];
      currentTitle = null;
      currentReleaseDate = null;
    }

    // Extract title
    if (row.includes('タイトル') || row.includes('作品名')) {
      const titleMatch = row.match(/>([^<>]{5,100})</);
      if (titleMatch?.[1]) {
        currentTitle = titleMatch[1].trim();
      }
    }

    // Extract performers
    if (row.includes('出演者') || row.includes('女優') || row.includes('AV女優')) {
      const nameMatches = row.match(/>([^<>]{2,30})</g) || [];
      for (const match of nameMatches) {
        const name = match.replace(/>/g, '').replace(/</g, '').trim();
        // Skip labels and IDs
        if (name &&
            !name.match(/出演|女優|AV/) &&
            !name.match(/^[A-Z0-9]+-\d+$/) &&
            name.length > 1 &&
            name.length < 30) {
          currentPerformers.push(name);
        }
      }
    }

    // Extract release date
    if (row.includes('発売日') || row.includes('配信日')) {
      const dateMatch = row.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (dateMatch?.[1]) {
        currentReleaseDate = dateMatch[1];
      }
    }
  }

  // Save last product
  if (currentProductId && currentPerformers.length > 0) {
    productMap.set(currentProductId, {
      productId: currentProductId,
      ...(currentTitle && { title: currentTitle }),
      ...(currentReleaseDate && { releaseDate: currentReleaseDate }),
      performers: currentPerformers,
      source: 'av-wiki'
    });

    for (const name of currentPerformers) {
      performerResults.push({
        name,
        productId: currentProductId,
        source: 'av-wiki'
      });
    }
  }

  productResults.push(...Array.from(productMap.values()));

  return { performers: performerResults, products: productResults };
}

/**
 * Parse seesaawiki.jp article pages
 */
function parseSeesaawiki(html: string, url: string): { performers: PerformerData[], products: ProductData[] } {
  const performerResults: PerformerData[] = [];
  const productResults: ProductData[] = [];

  // Look for wiki content
  const contentMatch = html.match(/<div id="wiki-content">[\s\S]*?<\/div>/);
  if (!contentMatch) return { performers: performerResults, products: productResults };

  const content = contentMatch[0];

  // Extract product info
  const productMap = new Map<string, ProductData>();

  const tableRows = content.match(/<tr[\s\S]*?<\/tr>/g) || [];

  let currentProductId: string | null = null;
  let currentPerformers: string[] = [];
  let currentTitle: string | null = null;
  let currentReleaseDate: string | null = null;

  for (const row of tableRows) {
    // Extract product ID
    const productIdMatch = row.match(/([A-Z]{2,10}-?\d{3,6})/i);
    if (productIdMatch?.[1]) {
      const productId = productIdMatch[1].toUpperCase();

      // Save previous product
      if (currentProductId && currentPerformers.length > 0) {
        productMap.set(currentProductId, {
          productId: currentProductId,
          ...(currentTitle && { title: currentTitle }),
          ...(currentReleaseDate && { releaseDate: currentReleaseDate }),
          performers: currentPerformers,
          source: 'seesaawiki'
        });

        for (const name of currentPerformers) {
          performerResults.push({
            name,
            productId: currentProductId,
            source: 'seesaawiki'
          });
        }
      }

      // Start new product
      currentProductId = productId;
      currentPerformers = [];
      currentTitle = null;
      currentReleaseDate = null;
    }

    // Extract title
    if (row.includes('タイトル') || row.includes('作品名')) {
      const titleMatch = row.match(/>([^<>]{5,100})</);
      if (titleMatch?.[1]) {
        currentTitle = titleMatch[1].trim();
      }
    }

    // Extract performers
    if (row.includes('出演') || row.includes('女優')) {
      const nameMatches = row.match(/>([^<>]{2,30})</g) || [];
      for (const match of nameMatches) {
        const name = match.replace(/>/g, '').replace(/</g, '').trim();
        if (name &&
            !name.match(/出演|女優/) &&
            !name.match(/^[A-Z0-9]+-\d+$/) &&
            name.length > 1 &&
            name.length < 30) {
          currentPerformers.push(name);
        }
      }
    }

    // Extract release date
    if (row.includes('発売') || row.includes('配信')) {
      const dateMatch = row.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
      if (dateMatch?.[1]) {
        currentReleaseDate = dateMatch[1];
      }
    }
  }

  // Save last product
  if (currentProductId && currentPerformers.length > 0) {
    productMap.set(currentProductId, {
      productId: currentProductId,
      ...(currentTitle && { title: currentTitle }),
      ...(currentReleaseDate && { releaseDate: currentReleaseDate }),
      performers: currentPerformers,
      source: 'seesaawiki'
    });

    for (const name of currentPerformers) {
      performerResults.push({
        name,
        productId: currentProductId,
        source: 'seesaawiki'
      });
    }
  }

  productResults.push(...Array.from(productMap.values()));

  return { performers: performerResults, products: productResults };
}

/**
 * Get or create performer
 */
async function getOrCreatePerformer(db: any, name: string): Promise<number> {
  // Normalize name
  const normalizedName = name.trim();

  // Check if performer exists
  const existing = await db['select']()
    .from(performers)
    .where(eq(performers['name'], normalizedName))
    .limit(1);

  if (existing.length > 0) {
    return existing[0]['id'];
  }

  // Create new performer
  const slug = normalizedName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '');

  const result = await db['insert'](performers)
    .values({
      name: normalizedName,
      slug: slug + '-' + Date.now(),
    })
    .returning({ id: performers['id'] });

  console.log(`  ✨ Created new performer: ${normalizedName}`);
  return result[0]['id'];
}

/**
 * Get or create product from wiki data
 */
async function getOrCreateProduct(db: any, productData: ProductData): Promise<number | null> {
  const normalizedId = productData.productId.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Check if product exists by normalizedProductId
  const existing = await db['select']()
    .from(products)
    .where(eq(products.normalizedProductId, normalizedId))
    .limit(1);

  if (existing.length > 0) {
    // Update product if we have new information
    if (productData.title || productData.releaseDate) {
      const updateData: any = {};
      if (productData.title) updateData['title'] = productData.title;
      if (productData.releaseDate) updateData['releaseDate'] = new Date(productData.releaseDate);

      if (Object.keys(updateData).length > 0) {
        await db['update'](products)
          .set(updateData)
          .where(eq(products['id'], existing[0]['id']));
        console.log(`  📝 Updated product: ${productData.productId}`);
      }
    }
    return existing[0]['id'];
  }

  // Create new product
  const newProduct = await db['insert'](products)
    .values({
      id: productData.productId,
      normalizedProductId: normalizedId,
      title: productData.title || productData.productId,
      releaseDate: productData.releaseDate ? new Date(productData.releaseDate) : null,
      thumbnailUrl: productData.thumbnailUrl,
    })
    .returning({ id: products['id'] });

  console.log(`  ✨ Created new product: ${productData.productId}`);
  return newProduct[0]['id'];
}

/**
 * Link performer to product
 */
async function linkPerformerToProduct(
  db: any,
  performerId: number,
  productId: number
): Promise<void> {
  // Check if link already exists
  const existingLink = await db['select']()
    .from(productPerformers)
    .where(and(
      eq(productPerformers.productId, productId),
      eq(productPerformers.performerId, performerId)
    ))
    .limit(1);

  if (existingLink.length > 0) {
    return; // Already linked
  }

  // Create link
  await db['insert'](productPerformers)
    .values({
      productId,
      performerId,
    });

  console.log(`  🔗 Linked performer ${performerId} to product ${productId}`);
}

/**
 * Save raw HTML data
 * @returns { rawDataId, shouldSkip }
 */
async function saveRawHtml(
  db: any,
  url: string,
  html: string,
  source: string,
  forceReprocess: boolean = false
): Promise<{ rawDataId: number | null; shouldSkip: boolean }> {
  // Extract product ID from URL or use hash as fallback
  const productIdMatch = url.match(/\/([^\/]+)\/?$/);
  const productId = productIdMatch ? productIdMatch[1] : '';

  if (!productId) {
    console.log(`  ⚠️ Could not extract product ID from URL`);
    return { rawDataId: null, shouldSkip: false };
  }

  try {
    // 統一されたdedup-helperを使用
    const upsertResult = await upsertRawHtmlDataWithGcs(
      `wiki-${source.toLowerCase()}`,
      productId,
      url,
      html
    );

    // 重複チェック: 変更なし＆処理済みならスキップ
    if (upsertResult.shouldSkip && !forceReprocess) {
      console.log(`  ⏭️ Skipping (already processed): ${productId}`);
      return { rawDataId: upsertResult.id, shouldSkip: true };
    }

    if (upsertResult.isNew) {
      console.log(`  💾 Saved raw HTML${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      console.log(`  🔄 Updated raw HTML${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    }

    return { rawDataId: upsertResult.id, shouldSkip: false };
  } catch (error) {
    console.log(`  ⚠️ Could not save raw HTML: ${error}`);
    return { rawDataId: null, shouldSkip: false };
  }
}

/**
 * Crawl av-wiki.net sitemap to find article pages
 */
async function crawlAvWikiSitemap(db: any, limit: number = 100, forceReprocess: boolean = false): Promise<void> {
  console.log('\n📚 Crawling av-wiki.net...');

  // Get recent posts from WordPress REST API
  const feedUrl = 'https://av-wiki.net/wp-json/wp/v2/posts?per_page=' + Math.min(limit, 100);

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      console.error('Failed to fetch av-wiki feed');
      return;
    }

    interface AvWikiPost {
      link: string;
      title: { rendered: string };
    }
    const posts = await response.json() as AvWikiPost[];
    console.log(`Found ${posts.length} posts`);

    let processed = 0;
    let skipped = 0;
    for (const post of posts) {
      const url = post.link;
      console.log(`\nProcessing: ${post.title.rendered}`);

      const html = await fetchHtml(url);
      if (!html) continue;

      const { rawDataId, shouldSkip } = await saveRawHtml(db, url, html, 'av-wiki', forceReprocess);

      if (shouldSkip) {
        skipped++;
        continue;
      }

      const { performers, products } = parseAvWiki(html, url);
      console.log(`  Found ${performers.length} performer-product pairs, ${products.length} products`);

      // Process products first
      for (const productData of products) {
        const productId = await getOrCreateProduct(db, productData);
        if (!productId) continue;

        // Link all performers to this product
        for (const performerName of productData.performers) {
          const performerId = await getOrCreatePerformer(db, performerName);
          await linkPerformerToProduct(db, performerId, productId);
        }
      }

      // Mark as processed
      if (rawDataId) {
        await markRawDataAsProcessed('wiki-av-wiki', rawDataId);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`Progress: ${processed}/${posts.length} articles processed`);
      }
    }

    console.log(`\n✅ av-wiki.net crawl complete: ${processed} articles processed, ${skipped} skipped`);
  } catch (error) {
    console.error('Error crawling av-wiki:', error);
  }
}

/**
 * Crawl seesaawiki.jp recent changes
 */
async function crawlSeesaawiki(db: any, limit: number = 100, forceReprocess: boolean = false): Promise<void> {
  console.log('\n📚 Crawling seesaawiki.jp...');

  // Get recent changes page
  const recentUrl = 'https://seesaawiki.jp/av_neme/bbs/recent';

  try {
    const html = await fetchHtml(recentUrl);
    if (!html) {
      console.error('Failed to fetch seesaawiki recent changes');
      return;
    }

    // Extract article links from recent changes
    const linkMatches = html.match(/href="(\/av_neme\/d\/[^"]+)"/g) || [];
    const uniqueLinks = Array.from(new Set(linkMatches.map((m: string) => m.match(/href="([^"]+)"/)?.[1])))
      .filter(Boolean)
      .slice(0, limit) as string[];

    console.log(`Found ${uniqueLinks.length} article links`);

    let processed = 0;
    let skipped = 0;
    for (const path of uniqueLinks) {
      const url = 'https://seesaawiki.jp' + path;
      console.log(`\nProcessing: ${url}`);

      const articleHtml = await fetchHtml(url);
      if (!articleHtml) continue;

      const { rawDataId, shouldSkip } = await saveRawHtml(db, url, articleHtml, 'seesaawiki', forceReprocess);

      if (shouldSkip) {
        skipped++;
        continue;
      }

      const { performers, products } = parseSeesaawiki(articleHtml, url);
      console.log(`  Found ${performers.length} performer-product pairs, ${products.length} products`);

      // Process products first
      for (const productData of products) {
        const productId = await getOrCreateProduct(db, productData);
        if (!productId) continue;

        // Link all performers to this product
        for (const performerName of productData.performers) {
          const performerId = await getOrCreatePerformer(db, performerName);
          await linkPerformerToProduct(db, performerId, productId);
        }
      }

      // Mark as processed
      if (rawDataId) {
        await markRawDataAsProcessed('wiki-seesaawiki', rawDataId);
      }

      processed++;
      if (processed % 10 === 0) {
        console.log(`Progress: ${processed}/${uniqueLinks.length} articles processed`);
      }
    }

    console.log(`\n✅ seesaawiki.jp crawl complete: ${processed} articles processed, ${skipped} skipped`);
  } catch (error) {
    console.error('Error crawling seesaawiki:', error);
  }
}

// 除外ワード（出演者名ではないもの）
const EXCLUDE_TERMS = new Set([
  '素人', '巨乳', '爆乳', '美乳', '貧乳', '巨尻', '美尻', '美脚',
  'NTR', 'NTRリバース', '寝取り', '寝取られ',
  '中出し', '生中出し', '顔射', 'フェラ', 'パイズリ', '手コキ',
  'MGS動画', 'FANZA', 'DMM', 'PRESTIGE', 'プレステージ',
  'シロウトTV', 'ナンパTV', 'ARA', 'SIRO',
  '女子大生', '人妻', '熟女', 'OL', 'ギャル', '清楚',
  '痴女', '淫乱', '変態', 'ロリ', '美少女',
  '続きを読む', 'more', '詳細', '作品詳細',
  'AV男優の電話帳', '電話帳', 'シリーズ',
  // サイト系
  'FANZA動画', 'Twitter', 'はてブ', 'Pocket', 'ホーム', 'お問い合わせ',
  '白昼夢', 'AV女優の名前が知りたい！', 'Facebook', 'LINE', 'Instagram',
  'Amazon', '楽天', 'Yahoo', 'Google', 'YouTube',
  // av-wiki.net特有のレーベル/メーカータグ
  'エスワン - SNIS', 'ティッシュ - IPZ', 'MOODYZ ACID', 'MOODYZ DIVA', 'MOODYZ Gati',
  'Hunter - HUNTA', 'JET映像 - NDRA', 'JET映像 - NGOD', 'Fitch - JUFD',
  'ディープス - DVDMS', 'アパッチ', 'ナチュラルハイ - NHDTA',
  'お夜食カンパニー - OYC', 'ゲッツ!! - GETS', '肛門訪問 - SOAN',
  '山と空 - SORA', 'INCEST', '女神', 'まんげつ', 'おっぱいん',
  '美女神 Queen', 'temptation', '雪月花', '只管', '口説き術',
  '素人専科', 'ジェントルマン', 'Real-file', 'ちちくりジョニー',
  'パコッター', 'NAMADORE本舗', '舞ワイフ', '未満 - MMND', 'S-Cute KIRAY',
  'S-CUTE', 'MADAM MANIAC', 'NITRO', 'e-kiss',
  // レーベル・メーカー関連
  'メーカー', 'レーベル', 'ジャンル',
  'メーカー：', 'レーベル：', 'AV女優名：',
  'ワンズファクトリー', 'ムーディーズ', 'アイデアポケット', 'クリスタル映像',
  'VENUS', 'unfinished', 'MEGAMI', 'Hunter', 'MUTEKI',
  // 一般的なナビゲーション
  'コメント', '関連記事', '人気記事', '新着記事', 'カテゴリ', 'タグ',
  'サイトマップ', 'プライバシーポリシー', '免責事項', '運営者情報',
  'メニュー', 'トップ', '検索', 'RSS', 'サイト内検索',
  // 動画サイト関連
  'DUGAで見る', 'FANZAで見る', 'MGSで見る', '公式サイト',
  'ダウンロード', 'ストリーミング', '無料動画', 'サンプル動画',
  // 属性系
  '美女', '美人', '可愛い', 'かわいい', '綺麗', 'きれい',
  '若い', '大人', '年上', '年下', '処女', '童貞',
  // 顔文字・記号
  '(≥o≤)', '(>_<)', '(^^)', '(*^^*)', '(´・ω・`)', '(;_;)',
  '（≥o≤）', '（>_<）', '(≧▽≦)', '(*´ω｀*)', '(^_^)', '(^^;)',
  '＊＊＊', '***', '？？？', '???',
  // 記号のみ
  '...', '>>>', '---', '___',
  // FC2ブログ特有
  '枚', '計', 'コメントを書く',
]);

/**
 * 品番検索: av-wiki.netから出演者を取得
 */
async function searchAvWiki(productCode: string): Promise<string[]> {
  const formattedCode = productCode.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
  const searchUrl = `https://av-wiki.net/?s=${encodeURIComponent(formattedCode)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) return [];

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = iconv.decode(buffer, 'utf-8');  // av-wiki.netはUTF-8（WordPress）
    const $ = cheerio.load(html);
    const performers: string[] = [];

    // 検索結果のリストから出演者を抽出
    $('article ul li, .entry-content ul li').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length >= 2 && text.length <= 15 && !EXCLUDE_TERMS.has(text) && !/\d/.test(text)) {
        if (isValidPerformerName(text) && !performers.includes(text)) {
          performers.push(text);
        }
      }
    });

    return performers;
  } catch (error: unknown) {
    // 外部サイトへのリクエスト失敗は静かに処理
    if (process.env['DEBUG']) {
      console.warn(`[seesaa-wiki] Error:`, error instanceof Error ? error.message : error);
    }
    return [];
  }
}

/**
 * 品番検索: shiroutoname.comから出演者を取得
 */
async function searchShiroutoname(productCode: string): Promise<string[]> {
  const formattedCode = productCode.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
  const searchUrl = `https://shiroutoname.com/?s=${encodeURIComponent(formattedCode)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });

    if (!response.ok) return [];

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = iconv.decode(buffer, 'utf-8');  // shiroutoname.comはUTF-8
    const $ = cheerio.load(html);
    const performers: string[] = [];

    // 詳細ページへのリンクを探す
    let detailUrl: string | null = null;
    $('a[href*="shiroutoname.com/"]').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      if (href.includes('/siro/') || href.includes('/ara/') || href.includes('/200/') || href.includes('/300/')) {
        if (!detailUrl) detailUrl = href;
      }
    });

    if (detailUrl) {
      await new Promise(r => setTimeout(r, 500));
      const detailResponse = await fetch(detailUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (detailResponse.ok) {
        const detailHtml = await detailResponse.text();
        const $d = cheerio.load(detailHtml);

        // 出演者リンクを探す
        $d('a[href*="/actress/"]').each((_, elem) => {
          const text = $d(elem).text().trim();
          if (text.length >= 2 && text.length <= 15 && !EXCLUDE_TERMS.has(text)) {
            if (isValidPerformerName(text) && !performers.includes(text)) {
              performers.push(text);
            }
          }
        });
      }
    }

    return performers;
  } catch (error: unknown) {
    if (process.env['DEBUG']) {
      console.warn(`[shiroutoname] Error:`, error instanceof Error ? error.message : error);
    }
    return [];
  }
}

/**
 * wiki_crawl_dataテーブルに保存
 * バリデーション済みの出演者名のみ保存
 */
async function saveToWikiCrawlData(
  db: any,
  source: string,
  productCode: string,
  performerNames: string[],
  sourceUrl: string
): Promise<number> {
  let saved = 0;
  for (const name of performerNames) {
    // 除外ワードチェック
    if (EXCLUDE_TERMS.has(name)) continue;
    // バリデーション
    if (!isValidPerformerName(name)) continue;
    // 品番パターンは除外
    if (/^[A-Z]{2,10}-?\d{3,6}$/i.test(name)) continue;

    try {
      await db.execute(sql`
        INSERT INTO wiki_crawl_data (source, product_code, performer_name, source_url)
        VALUES (${source}, ${productCode}, ${name}, ${sourceUrl})
        ON CONFLICT (source, product_code, performer_name) DO NOTHING
      `);
      saved++;
    } catch (error: unknown) {
      // DB制約違反は無視（重複データ）
      if (process.env['DEBUG']) {
        console.warn(`[saveToWikiCrawlData] Insert failed for ${name}:`, error instanceof Error ? error.message : error);
      }
    }
  }
  return saved;
}

/**
 * wiki_crawl_dataからproduct_performersへ反映
 */
async function processWikiCrawlData(db: any, limit: number): Promise<{ processed: number; linked: number }> {
  const unprocessed = await db.execute(sql`
    SELECT DISTINCT wcd.id, wcd.product_code, wcd.performer_name
    FROM wiki_crawl_data wcd
    WHERE wcd.processed_at IS NULL
    ORDER BY wcd.id
    LIMIT ${limit}
  `);

  let processed = 0;
  let linked = 0;

  interface WikiCrawlRow {
    id: number;
    product_code: string;
    performer_name: string;
  }

  const totalRows = unprocessed.rows.length;
  console.log(`Found ${totalRows} unprocessed records`);

  for (const row of unprocessed.rows as WikiCrawlRow[]) {
    const { id, product_code, performer_name } = row;
    // 小文字化のみ（ハイフンは残す）- 商品テーブルはabc-123形式
    const normalizedCode = product_code.toLowerCase();
    // ハイフン除去版も用意（一部の商品はハイフンなしで登録されている場合がある）
    const normalizedCodeNoHyphen = product_code.toLowerCase().replace(/-/g, '');

    // 商品を検索（小文字ハイフンあり形式を優先、なければハイフンなし形式で検索）
    const productResult = await db.execute(sql`
      SELECT id FROM products
      WHERE normalized_product_id = ${normalizedCode}
         OR normalized_product_id = ${normalizedCodeNoHyphen}
      LIMIT 1
    `);

    const productRow = getFirstRow<IdRow>(productResult);
    if (productRow) {
      const productId = productRow.id;

      // 出演者を検索または作成
      let performerId: number;
      const existingPerformer = await db.execute(sql`
        SELECT id FROM performers WHERE name = ${performer_name}
      `);

      const existingPerformerRow = getFirstRow<IdRow>(existingPerformer);
      if (existingPerformerRow) {
        performerId = existingPerformerRow.id;
      } else {
        const newPerformer = await db.execute(sql`
          INSERT INTO performers (name) VALUES (${performer_name})
          ON CONFLICT (name) DO NOTHING RETURNING id
        `);
        const newPerformerRow = getFirstRow<IdRow>(newPerformer);
        if (newPerformerRow) {
          performerId = newPerformerRow.id;
        } else {
          const retry = await db.execute(sql`SELECT id FROM performers WHERE name = ${performer_name}`);
          const retryRow = getFirstRow<IdRow>(retry);
          performerId = retryRow!.id;
        }
      }

      // 紐付け
      await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (${productId}, ${performerId})
        ON CONFLICT DO NOTHING
      `);
      linked++;
    }

    // 処理済みマーク
    await db.execute(sql`UPDATE wiki_crawl_data SET processed_at = NOW() WHERE id = ${id}`);
    processed++;

    // 進捗ログ（1000件ごと）
    if (processed % 1000 === 0) {
      console.log(`Progress: ${processed}/${totalRows}, Linked: ${linked}`);
    }
  }

  return { processed, linked };
}

/**
 * shiroutoname.com クローラー
 */
async function crawlShiroutoname(db: any, limit: number = 100): Promise<void> {
  console.log('\n📚 Crawling shiroutoname.com...');

  // 未紐付けの300系製品を取得
  const result = await db.execute(sql`
    SELECT DISTINCT normalized_product_id
    FROM products
    WHERE (
      normalized_product_id LIKE '300mium%'
      OR normalized_product_id LIKE '300maan%'
      OR normalized_product_id LIKE '300ntk%'
      OR normalized_product_id LIKE 'siro%'
      OR normalized_product_id LIKE 'ara%'
    )
    AND NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = products['id'])
    ORDER BY normalized_product_id DESC
    LIMIT ${limit}
  `);

  console.log(`Found ${result.rows.length} products to search`);

  interface ProductCodeRow {
    normalized_product_id: string;
  }

  let processed = 0;
  let found = 0;

  for (const row of result.rows as ProductCodeRow[]) {
    const code = row.normalized_product_id;
    console.log(`[${processed + 1}/${result.rows.length}] ${code}`);

    const performers = await searchShiroutoname(code);
    if (performers.length > 0) {
      console.log(`  ✅ Found: ${performers.join(', ')}`);
      await saveToWikiCrawlData(db, 'shiroutoname', code, performers, `https://shiroutoname.com/?s=${code}`);
      found++;
    }

    processed++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ shiroutoname.com crawl complete: ${found}/${processed} found`);
}

/**
 * av-wiki.net バッチ検索クローラー
 * 未紐付けの300系製品をav-wiki.netで検索し、wiki_crawl_dataに保存
 */
async function crawlAvWikiBatch(db: ReturnType<typeof getDb>, limit: number = 100): Promise<void> {
  console.log('\n📚 Batch searching av-wiki.net...');

  // 未紐付けの300系製品を取得（wiki_crawl_dataにも未登録のもの）
  const result = await db.execute(sql`
    SELECT DISTINCT p.normalized_product_id
    FROM products p
    WHERE (
      p.normalized_product_id LIKE '300mium%'
      OR p.normalized_product_id LIKE '300maan%'
      OR p.normalized_product_id LIKE '300ntk%'
      OR p.normalized_product_id LIKE 'siro%'
      OR p.normalized_product_id LIKE 'ara%'
    )
    AND NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM wiki_crawl_data wcd WHERE wcd.product_code = p.normalized_product_id AND wcd.source = 'av-wiki')
    ORDER BY p.normalized_product_id DESC
    LIMIT ${limit}
  `);

  console.log(`Found ${result.rows.length} products to search`);

  interface ProductCodeRow {
    normalized_product_id: string;
  }

  let processed = 0;
  let found = 0;

  for (const row of result.rows as unknown as ProductCodeRow[]) {
    const code = row.normalized_product_id;
    console.log(`[${processed + 1}/${result.rows.length}] ${code}`);

    const performers = await searchAvWiki(code);
    if (performers.length > 0) {
      console.log(`  ✅ Found: ${performers.join(', ')}`);
      await saveToWikiCrawlData(db, 'av-wiki', code, performers, `https://av-wiki.net/?s=${code}`);
      found++;
    } else {
      console.log(`  - not found`);
    }

    processed++;
    await new Promise(r => setTimeout(r, 800)); // Rate limiting
  }

  console.log(`\n✅ av-wiki.net batch search complete: ${found}/${processed} found`);
}

/**
 * av-wiki.net サイトマップから全ページ収集
 * 根こそぎ収集モード
 */
async function crawlAvWikiAllPages(db: any, limit: number = 10000): Promise<void> {
  console.log('\n🔥 Crawling ALL pages from av-wiki.net sitemap...');

  // WordPress XMLサイトマップを取得
  const sitemapUrls = [
    'https://av-wiki.net/post-sitemap.xml',
    'https://av-wiki.net/post-sitemap2.xml',
    'https://av-wiki.net/post-sitemap3.xml',
    'https://av-wiki.net/page-sitemap.xml',
    'https://av-wiki.net/sitemap_index.xml',
  ];

  const allUrls: string[] = [];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`  Fetching sitemap: ${sitemapUrl}`);
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (!response.ok) {
        console.log(`    - ${response['status']} ${response.statusText}`);
        continue;
      }

      const xml = await response['text']();

      // URLを抽出
      const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
      for (const match of urlMatches) {
        const url = match.replace(/<\/?loc>/g, '');
        if (url.includes('av-wiki.net/') && !url.endsWith('.xml')) {
          allUrls.push(url);
        }
      }

      // サイトマップインデックスの場合、子サイトマップも取得
      if (xml.includes('sitemapindex')) {
        const subSitemaps = xml.match(/<loc>([^<]+\.xml)<\/loc>/g) || [];
        for (const match of subSitemaps) {
          const subUrl = match.replace(/<\/?loc>/g, '');
          if (!sitemapUrls.includes(subUrl)) {
            console.log(`    Found sub-sitemap: ${subUrl}`);
            try {
              const subResponse = await fetch(subUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              });
              if (subResponse.ok) {
                const subXml = await subResponse.text();
                const subUrls = subXml.match(/<loc>([^<]+)<\/loc>/g) || [];
                for (const subMatch of subUrls) {
                  const url = subMatch.replace(/<\/?loc>/g, '');
                  if (url.includes('av-wiki.net/') && !url.endsWith('.xml')) {
                    allUrls.push(url);
                  }
                }
              }
            } catch (error: unknown) {
              // サブsitemap取得失敗は無視
              if (process.env['DEBUG']) {
                console.warn(`[sitemap] Sub-sitemap fetch failed:`, error instanceof Error ? error.message : error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Error fetching ${sitemapUrl}:`, error);
    }
  }

  // 重複削除
  const uniqueUrls = [...new Set(allUrls)].slice(0, limit);
  console.log(`\n📊 Found ${uniqueUrls.length} unique URLs to crawl`);

  let processed = 0;
  let totalPerformers = 0;
  let totalProducts = 0;

  for (const url of uniqueUrls) {
    console.log(`[${processed + 1}/${uniqueUrls.length}] ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      });

      if (!response.ok) {
        console.log(`  ✗ ${response['status']}`);
        processed++;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const html = iconv.decode(buffer, 'utf-8');  // av-wiki.netはUTF-8（WordPress）
      const $ = cheerio.load(html);

      // ページから品番と出演者を抽出
      const pageData = extractAvWikiPageData($, url);

      if (pageData.products.length > 0) {
        for (const product of pageData.products) {
          if (product.performers.length > 0) {
            await saveToWikiCrawlData(db, 'av-wiki', product.code, product.performers, url);
            console.log(`  ✅ ${product.code}: ${product.performers.join(', ')}`);
            totalPerformers += product.performers.length;
            totalProducts++;
          }
        }
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }

    processed++;

    // 進捗表示
    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${uniqueUrls.length} pages, ${totalProducts} products, ${totalPerformers} performers\n`);
    }

    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }

  console.log(`\n✅ av-wiki.net full crawl complete!`);
  console.log(`   Pages processed: ${processed}`);
  console.log(`   Products found: ${totalProducts}`);
  console.log(`   Performers found: ${totalPerformers}`);
}

/**
 * av-wiki.netのページから品番と出演者を抽出
 */
function extractAvWikiPageData($: cheerio.CheerioAPI, url: string): { products: Array<{ code: string; performers: string[] }> } {
  const products: Array<{ code: string; performers: string[] }> = [];

  // 品番パターン: 300MIUM-XXX, SIRO-XXX, etc.
  const productCodePattern = /\b([A-Z]{2,10}-?\d{3,6})\b/gi;

  // タイトルから品番を抽出（URLからも取得）
  const title = $('h1.entry-title, .entry-title, title').first().text();
  const titleCodes: string[] = title.match(productCodePattern) || [];

  // URLから品番を抽出
  const urlMatch = url.match(/\/([a-z]{2,10}-?\d{3,6})\/?$/i);
  if (urlMatch?.[1]) {
    titleCodes.push(urlMatch[1]);
  }

  const allCodes = [...new Set(titleCodes.map((c: string) => c.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2')))];

  // 出演者を抽出
  const performers: string[] = [];

  // 1. 優先: av-actress リンクから抽出（最も確実）
  $('a[href*="/av-actress/"]').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text.length >= 2 && text.length <= 20 && !EXCLUDE_TERMS.has(text) && !/^\d+$/.test(text)) {
      if (isValidPerformerName(text) && !performers.includes(text)) {
        performers.push(text);
      }
    }
  });

  // 2. テーブルの「AV女優名」行から抽出
  $('th, td').each((_, elem) => {
    const text = $(elem).text().trim();
    if (text.includes('AV女優名') || text === '出演者' || text === '女優名') {
      const nextTd = $(elem).next('td');
      if (nextTd.length) {
        // リンクがあればリンクテキストを取得
        const link = nextTd.find('a').first();
        if (link.length) {
          const name = link.text().trim();
          if (name.length >= 2 && name.length <= 20 && !EXCLUDE_TERMS.has(name) && !/^\d+$/.test(name)) {
            if (isValidPerformerName(name) && !performers.includes(name)) {
              performers.push(name);
            }
          }
        } else {
          // リンクがなければtdのテキストを取得
          const name = nextTd.text().trim();
          if (name.length >= 2 && name.length <= 20 && !EXCLUDE_TERMS.has(name) && !/^\d+$/.test(name)) {
            if (isValidPerformerName(name) && !performers.includes(name)) {
              performers.push(name);
            }
          }
        }
      }
    }
  });

  // 品番ごとに出演者を関連付け（出演者がいる場合のみ）
  for (const code of allCodes) {
    if (performers.length > 0) {
      products.push({ code, performers: [...performers] });
    }
  }

  return { products };
}

/**
 * seesaawiki.jp/av_neme 全ページクロール
 * 9,538件のエントリを100件ずつ取得
 */
async function crawlSeesaawikiAllPages(db: any, limit: number = 10000): Promise<void> {
  console.log('\n🔥 Crawling ALL pages from seesaawiki.jp/av_neme...');

  const allPageUrls: string[] = [];
  let page = 1;
  const maxPages = Math.ceil(limit / 100);

  // ページ一覧からすべてのエントリURLを収集
  while (page <= maxPages) {
    const listUrl = `https://seesaawiki.jp/av_neme/l/?p=${page}`;
    console.log(`  Fetching page list ${page}...`);

    try {
      const response = await fetch(listUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      });

      if (!response.ok) {
        console.log(`    - ${response['status']} ${response.statusText}`);
        break;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const html = iconv.decode(buffer, 'euc-jp');
      const $ = cheerio.load(html);

      // エントリリンクを抽出 /av_neme/d/XXXXX 形式
      const pageLinks: string[] = [];
      $('a[href*="/av_neme/d/"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && !href.includes('?') && !href.includes('#')) {
          const fullUrl = href.startsWith('http') ? href : `https://seesaawiki.jp${href}`;
          if (!allPageUrls.includes(fullUrl) && !pageLinks.includes(fullUrl)) {
            pageLinks.push(fullUrl);
          }
        }
      });

      if (pageLinks.length === 0) {
        console.log(`    - No more pages found`);
        break;
      }

      allPageUrls.push(...pageLinks);
      console.log(`    - Found ${pageLinks.length} entries (total: ${allPageUrls.length})`);

      // 次のページへのリンクがあるか確認
      const hasNext = $('a:contains("次の100件")').length > 0;
      if (!hasNext) break;

      page++;
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error);
      break;
    }
  }

  console.log(`\n📊 Found ${allPageUrls.length} unique pages to crawl`);

  let processed = 0;
  let totalPerformers = 0;
  let totalProducts = 0;

  for (const url of allPageUrls.slice(0, limit)) {
    console.log(`[${processed + 1}/${Math.min(allPageUrls.length, limit)}] ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      });

      if (!response.ok) {
        console.log(`  ✗ ${response['status']}`);
        processed++;
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const html = iconv.decode(buffer, 'euc-jp');
      const $ = cheerio.load(html);

      // ページから品番と出演者を抽出
      const pageData = extractSeesaawikiPageData($, url);

      if (pageData.products.length > 0) {
        for (const product of pageData.products) {
          if (product.performers.length > 0) {
            await saveToWikiCrawlData(db, 'seesaawiki', product.code, product.performers, url);
            console.log(`  ✅ ${product.code}: ${product.performers.join(', ')}`);
            totalPerformers += product.performers.length;
            totalProducts++;
          }
        }
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }

    processed++;

    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${Math.min(allPageUrls.length, limit)} pages, ${totalProducts} products, ${totalPerformers} performers\n`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ seesaawiki.jp crawl complete!`);
  console.log(`   Pages processed: ${processed}`);
  console.log(`   Products found: ${totalProducts}`);
  console.log(`   Performers found: ${totalPerformers}`);
}

/**
 * seesaawikiのページから品番と出演者を抽出
 * seesaawikiは「女優ページ→品番リスト」形式
 * ページタイトル = 女優名、見出しに品番が含まれる
 */
function extractSeesaawikiPageData($: cheerio.CheerioAPI, url: string): { products: Array<{ code: string; performers: string[] }> } {
  const products: Array<{ code: string; performers: string[] }> = [];

  // ページタイトルから女優名を抽出
  const pageTitle = $('h2').first().text().trim()
    .replace(/\s*編集する?\s*/g, '')
    .replace(/\s*<.*$/g, '')
    .trim();

  // titleタグからも取得（バックアップ）
  const titleTag = $('title').text();
  const titleMatch = titleTag.match(/^([^-]+)/);
  const performerFromTitle = titleMatch?.[1]?.trim() ?? '';

  // 有効な女優名を決定
  let performerName = '';
  if (pageTitle && pageTitle.length >= 2 && pageTitle.length <= 20 && isValidPerformerName(pageTitle)) {
    performerName = pageTitle;
  } else if (performerFromTitle && performerFromTitle.length >= 2 && performerFromTitle.length <= 20 && isValidPerformerName(performerFromTitle)) {
    performerName = performerFromTitle;
  }

  if (!performerName) {
    return { products };
  }

  // 品番を見出し（h4, h5）から抽出
  // パターン: "mgsod037| マルチーズ" や "300MIUM-123" など
  const productCodes: string[] = [];

  // h4, h5の見出しから品番を抽出
  $('h4, h5').each((_, elem) => {
    const text = $(elem).text().trim();
    // 品番パターン: 英字2-10文字 + 数字3-6桁
    const codeMatches = text.match(/\b([a-zA-Z]{2,10}[\-_]?\d{3,6})\b/gi);
    if (codeMatches) {
      for (const code of codeMatches) {
        // 品番を正規化（小文字→大文字、ハイフン追加）
        const normalized = code.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
        if (!productCodes.includes(normalized)) {
          productCodes.push(normalized);
        }
      }
    }
  });

  // wiki-section-body から品番を抽出（見出しにない場合のフォールバック）
  if (productCodes.length === 0) {
    const bodyText = $('.wiki-section-body-2, .wiki-section-body-3').text();
    const codeMatches = bodyText.match(/\b([a-zA-Z]{2,10}[\-_]?\d{3,6})\b/gi);
    if (codeMatches) {
      for (const code of codeMatches) {
        const normalized = code.toUpperCase().replace(/([A-Z]+)(\d+)$/, '$1-$2');
        if (!productCodes.includes(normalized)) {
          productCodes.push(normalized);
        }
      }
    }
  }

  // 品番ごとに女優名を関連付け
  for (const code of productCodes) {
    if (performerName) {
      products.push({ code, performers: [performerName] });
    }
  }

  return { products };
}

/**
 * shiroutoname.com サイトマップ全ページクロール
 * 63個のpost-sitemapファイルから記事URLを収集し、各ページから品番と出演者を抽出
 */
async function crawlShiroutonameAllPages(db: any, limit: number = 10000): Promise<void> {
  console.log('\n🔥 Crawling ALL pages from shiroutoname.com sitemap...');

  const allUrls: string[] = [];

  // 63個のpost-sitemapファイルを取得
  for (let i = 1; i <= 63; i++) {
    const sitemapUrl = `https://shiroutoname.com/wp-sitemap-posts-post-${i}.xml`;
    console.log(`  Fetching sitemap ${i}/63: ${sitemapUrl}`);

    try {
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (!response.ok) {
        console.log(`    - ${response['status']} ${response.statusText}`);
        continue;
      }

      const xml = await response['text']();
      const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/g) || [];
      for (const match of urlMatches) {
        const url = match.replace(/<\/?loc>/g, '');
        if (url.includes('shiroutoname.com/') && !url.endsWith('.xml')) {
          allUrls.push(url);
        }
      }

      console.log(`    - Found ${urlMatches.length} URLs (total: ${allUrls.length})`);
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`  Error fetching sitemap ${i}:`, error);
    }
  }

  console.log(`\n📊 Found ${allUrls.length} unique URLs to crawl`);

  let processed = 0;
  let totalPerformers = 0;
  let totalProducts = 0;

  for (const url of allUrls.slice(0, limit)) {
    console.log(`[${processed + 1}/${Math.min(allUrls.length, limit)}] ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      });

      if (!response.ok) {
        console.log(`  ✗ ${response['status']}`);
        processed++;
        continue;
      }

      const html = await response['text']();
      const $ = cheerio.load(html);

      // URLから品番を抽出: /siro/siro003/190500/ → SIRO-003
      const urlParts = url.replace(/\/$/, '').split('/');
      const makerSeries = urlParts[urlParts.length - 2] ?? ''; // e.g., "siro003"

      // 品番パターン抽出
      let productCode = '';
      const codeMatch = makerSeries.match(/([a-zA-Z]+)(\d+)/i);
      if (codeMatch?.[1] && codeMatch[2]) {
        productCode = `${codeMatch[1].toUpperCase()}-${codeMatch[2]}`;
      }

      if (!productCode) {
        processed++;
        continue;
      }

      // 出演者名を抽出
      const performers: string[] = [];

      // 1. AV女優名（プロ名義）を探す - 「AV女優【XXX】の」パターン
      const content = $('body').text();
      const actressMatch = content.match(/AV女優【([^】]+)】の/);
      if (actressMatch?.[1]) {
        const name = actressMatch[1].trim();
        if (name.length >= 2 && name.length <= 20 && isValidPerformerName(name)) {
          performers.push(name);
        }
      }

      // 2. タグリンクから抽出
      $('a[href*="/tag/"]').each((_, elem) => {
        const text = $(elem).text().trim();
        // 素人名（楓(20)など）は除外、AV女優名のみ
        if (text.length >= 2 && text.length <= 20 && !text.match(/\(\d+\)/) && !EXCLUDE_TERMS.has(text)) {
          if (isValidPerformerName(text) && !performers.includes(text)) {
            performers.push(text);
          }
        }
      });

      if (performers.length > 0) {
        await saveToWikiCrawlData(db, 'shiroutoname', productCode, performers, url);
        console.log(`  ✅ ${productCode}: ${performers.join(', ')}`);
        totalPerformers += performers.length;
        totalProducts++;
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }

    processed++;

    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${Math.min(allUrls.length, limit)} pages, ${totalProducts} products, ${totalPerformers} performers\n`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ shiroutoname.com full crawl complete!`);
  console.log(`   Pages processed: ${processed}`);
  console.log(`   Products found: ${totalProducts}`);
  console.log(`   Performers found: ${totalPerformers}`);
}

/**
 * FC2ブログ（mankowomiseruavzyoyu）クローラー
 * 「あ行」〜「わ行」のインデックスページから女優ページをクロール
 * 各女優ページから品番と出演者名を抽出
 */
async function crawlFc2BlogAllPages(db: any, limit: number = 10000): Promise<void> {
  console.log('\n🔥 Crawling FC2 blog (mankowomiseruavzyoyu)...');

  // インデックスページのURL（あ〜わ行）
  const indexUrls = [
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-578.html', // あ行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-2016.html', // い〜お行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-577.html', // か〜こ行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-576.html', // さ〜そ行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-2125.html', // た〜と行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-574.html', // な〜の行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-573.html', // は〜ほ行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-572.html', // ま〜も行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-571.html', // や〜よ行
    'https://mankowomiseruavzyoyu.blog.fc2.com/blog-entry-570.html', // ら〜わ行
  ];

  const allArticleUrls: string[] = [];

  // 各インデックスページから女優記事URLを収集
  for (const indexUrl of indexUrls) {
    console.log(`  Fetching index: ${indexUrl}`);
    try {
      const response = await fetch(indexUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (!response.ok) {
        console.log(`    - ${response['status']}`);
        continue;
      }

      const html = await response['text']();
      const $ = cheerio.load(html);

      // 女優ページへのリンクを抽出
      $('a[href*="blog-entry-"]').each((_, elem) => {
        const href = $(elem).attr('href') || '';
        // FC2ブログドメイン内のリンクのみ（はてなブックマーク等は除外）
        if (href.includes('mankowomiseruavzyoyu.blog.fc2.com/blog-entry-') &&
            !href.includes('hatena') &&
            !indexUrls.includes(href)) {
          const fullUrl = href.startsWith('http') ? href : `https://mankowomiseruavzyoyu.blog.fc2.com${href}`;
          if (!allArticleUrls.includes(fullUrl) && fullUrl.includes('mankowomiseruavzyoyu.blog.fc2.com')) {
            allArticleUrls.push(fullUrl);
          }
        }
      });

      console.log(`    - Collected ${allArticleUrls.length} article URLs`);
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  console.log(`\n📊 Found ${allArticleUrls.length} article URLs to crawl`);

  let processed = 0;
  let totalPerformers = 0;
  let totalProducts = 0;

  for (const url of allArticleUrls.slice(0, limit)) {
    console.log(`[${processed + 1}/${Math.min(allArticleUrls.length, limit)}] ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      });

      if (!response.ok) {
        console.log(`  ✗ ${response['status']}`);
        processed++;
        continue;
      }

      const html = await response['text']();
      const $ = cheerio.load(html);

      // タイトルから出演者名を抽出: 「川愛加奈（三ノ宮飛鳥）【＋エロ画像...」
      const title = $('h2.ently_title a, .ently_title').first().text().trim();
      const performers: string[] = [];

      // 主名義: タイトルの先頭
      const mainNameMatch = title.match(/^([^（【\s]+)/);
      if (mainNameMatch?.[1]) {
        const name = mainNameMatch[1].trim();
        if (name.length >= 2 && name.length <= 20 && isValidPerformerName(name)) {
          performers.push(name);
        }
      }

      // 別名: （）内
      const aliasMatch = title.match(/（([^）]+)）/);
      if (aliasMatch?.[1]) {
        const aliases = aliasMatch[1].split(/[・、]/);
        for (const alias of aliases) {
          const name = alias.trim();
          if (name.length >= 2 && name.length <= 20 && isValidPerformerName(name) && !performers.includes(name)) {
            performers.push(name);
          }
        }
      }

      if (performers.length === 0) {
        processed++;
        continue;
      }

      // 品番を抽出（カリビアンコム、一本道、HEYZO形式）
      // moviepages/041908-728/index.html → 041908-728
      // movies/123111_003/ → 123111_003
      const productCodes: string[] = [];
      const movieLinks = html.match(/moviepages\/([^\/]+)\/|movies\/([^\/]+)\//g) || [];
      for (const link of movieLinks) {
        const codeMatch = link.match(/moviepages\/([^\/]+)\/|movies\/([^\/]+)\//);
        if (codeMatch) {
          const rawCode = codeMatch[1] ?? codeMatch[2];
          if (rawCode) {
            const code = rawCode.toUpperCase().replace(/_/g, '-');
            if (!productCodes.includes(code) && code.match(/^\d{6}-\d{3}$|^\d{6}-\d{4}$/)) {
              productCodes.push(code);
            }
          }
        }
      }

      // 品番ごとに出演者を保存
      for (const code of productCodes) {
        await saveToWikiCrawlData(db, 'fc2-blog', code, performers, url);
        console.log(`  ✅ ${code}: ${performers.join(', ')}`);
        totalProducts++;
        totalPerformers += performers.length;
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error}`);
    }

    processed++;

    if (processed % 50 === 0) {
      console.log(`\n📊 Progress: ${processed}/${Math.min(allArticleUrls.length, limit)} pages, ${totalProducts} products, ${totalPerformers} performers\n`);
    }

    await new Promise(r => setTimeout(r, 1000)); // FC2ブログはレート制限が厳しいので長め
  }

  console.log(`\n✅ FC2 blog crawl complete!`);
  console.log(`   Pages processed: ${processed}`);
  console.log(`   Products found: ${totalProducts}`);
  console.log(`   Performers found: ${totalPerformers}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const forceReprocess = args.includes('--force');

  // 品番検索モード
  if (args[0] === '--search' && args[1]) {
    const productCode = args[1];
    const shouldSave = args.includes('--save'); // --saveオプションでDBに保存
    console.log(`🔍 Searching for: ${productCode}${shouldSave ? ' (will save to DB)' : ''}\n`);

    const avWikiResults = await searchAvWiki(productCode);
    console.log(`av-wiki.net: ${avWikiResults.length > 0 ? avWikiResults.join(', ') : '(not found)'}`);

    const shiroutoResults = await searchShiroutoname(productCode);
    console.log(`shiroutoname.com: ${shiroutoResults.length > 0 ? shiroutoResults.join(', ') : '(not found)'}`);

    // DBに保存
    if (shouldSave) {
      const db = getDb();
      let saved = 0;

      if (avWikiResults.length > 0) {
        const count = await saveToWikiCrawlData(db, 'av-wiki', productCode.toUpperCase(), avWikiResults, `https://av-wiki.net/?s=${productCode}`);
        saved += count;
        console.log(`\n💾 Saved ${count} performers from av-wiki.net`);
      }

      if (shiroutoResults.length > 0) {
        const count = await saveToWikiCrawlData(db, 'shiroutoname', productCode.toUpperCase(), shiroutoResults, `https://shiroutoname.com/?s=${productCode}`);
        saved += count;
        console.log(`💾 Saved ${count} performers from shiroutoname.com`);
      }

      console.log(`\n✅ Total saved: ${saved} performers`);
    }

    process.exit(0);
  }

  // wiki_crawl_data反映モード
  if (args[0] === '--process') {
    const limit = parseInt(args[1] ?? '1000') || 1000;
    console.log(`📥 Processing wiki_crawl_data (limit: ${limit})...\n`);

    const db = getDb();
    const result = await processWikiCrawlData(db, limit);
    console.log(`Processed: ${result.processed}, Linked: ${result.linked}`);
    process.exit(0);
  }

  // --forceを除いた引数を取得
  const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
  const site = nonFlagArgs[0] ?? 'both'; // av-wiki, seesaawiki, shiroutoname, av-wiki-batch, av-wiki-all, or both
  const limit = parseInt(nonFlagArgs[1] ?? '100') || 100;

  console.log('🚀 Starting wiki performer crawler...');
  console.log(`Site: ${site}, Limit: ${limit}`);
  console.log(`Force reprocess: ${forceReprocess ? 'enabled' : 'disabled'}`);

  const db = getDb();

  try {
    if (site === 'av-wiki' || site === 'both') {
      await crawlAvWikiSitemap(db, limit, forceReprocess);
    }

    if (site === 'seesaawiki' || site === 'both') {
      await crawlSeesaawiki(db, limit, forceReprocess);
    }

    if (site === 'shiroutoname') {
      await crawlShiroutoname(db, limit);
    }

    // av-wiki.net バッチ検索（未紐付け製品を検索）
    if (site === 'av-wiki-batch') {
      await crawlAvWikiBatch(db, limit);
    }

    // av-wiki.net 全ページ収集（根こそぎ収集）
    if (site === 'av-wiki-all') {
      await crawlAvWikiAllPages(db, limit);
    }

    // seesaawiki.jp 全ページ収集（9,538件）
    if (site === 'seesaawiki-all') {
      await crawlSeesaawikiAllPages(db, limit);
    }

    // shiroutoname.com 全ページ収集（サイトマップから）
    if (site === 'shiroutoname-all') {
      await crawlShiroutonameAllPages(db, limit);
    }

    // FC2ブログ クロール
    if (site === 'fc2-blog') {
      await crawlFc2BlogAllPages(db, limit);
    }

    console.log('\n✅ Wiki crawler completed successfully!');
  } catch (error) {
    console.error('❌ Crawler failed:', error);
    process.exit(1);
  }
}

main();
