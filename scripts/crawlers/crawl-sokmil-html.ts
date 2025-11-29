/**
 * ソクミル HTMLクローラー
 *
 * API版がダウンしている場合の代替として、HTMLをスクレイピングして商品データを取得
 *
 * 機能:
 * - ソクミル (www.sokmil.com) の一覧ページ・詳細ページをHTMLクロール
 * - 商品詳細ページからメタデータを取得
 * - アフィリエイトURL対応
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-sokmil-html.ts [--limit 100] [--page 1]
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos, rawHtmlData } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

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
  series?: string;
  genres: string[];
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
async function fetchProductListPage(page: number = 1, category: string = 'newrelease'): Promise<string[]> {
  const url = `${BASE_URL}/page/${category}/?page=${page}`;

  console.log(`📋 一覧ページ取得中: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`  ⚠️ 一覧ページ取得失敗 (${response.status})`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const productIds: string[] = [];

    // 商品リンクから商品IDを抽出
    // パターン: /page/v/?id={productId}
    $('a[href*="/page/v/?id="], a[href*="/page/v/"]').each((_, elem) => {
      const href = $(elem).attr('href') || '';
      const match = href.match(/[?&]id=([^&]+)/) || href.match(/\/page\/v\/([^/?]+)/);
      if (match) {
        const id = match[1];
        if (id && !productIds.includes(id)) {
          productIds.push(id);
        }
      }
    });

    // パターン2: data-id属性
    $('[data-id], [data-product-id]').each((_, elem) => {
      const id = $(elem).attr('data-id') || $(elem).attr('data-product-id');
      if (id && !productIds.includes(id)) {
        productIds.push(id);
      }
    });

    console.log(`  ✓ ${productIds.length}件の商品ID取得`);
    return productIds;
  } catch (error) {
    console.error(`  ❌ 一覧取得エラー: ${error}`);
    return [];
  }
}

/**
 * 商品詳細ページをパース
 */
async function parseDetailPage(productId: string): Promise<SokmilProduct | null> {
  const url = `${BASE_URL}/page/v/?id=${productId}`;

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
      console.log(`  🔍 詳細ページ取得中: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        console.log(`    ⚠️ 商品 ${productId} が見つかりません (${response.status})`);
        return null;
      }

      html = await response.text();

      // 生HTMLを保存
      const hash = createHash('sha256').update(html).digest('hex');
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId,
        url,
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

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const $ = cheerio.load(html);

    // タイトル抽出
    let title = '';

    // パターン1: og:title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      title = ogTitle.trim();
    }

    // パターン2: h1タグ
    if (!title) {
      title = $('h1').first().text().trim();
    }

    // パターン3: titleタグ
    if (!title) {
      const titleTag = $('title').text();
      const parts = titleTag.split(/[|\-]/);
      title = parts[0].trim();
    }

    // フォールバック
    if (!title || title.length > 200) {
      title = `ソクミル-${productId}`;
    }

    // 説明抽出
    const description = $('meta[name="description"]').attr('content') ||
                        $('.description, .product-description, .detail-text').text().trim().substring(0, 1000);

    // 出演者抽出
    const performerList: string[] = [];

    // パターン1: 出演者リンク
    $('a[href*="actress"], a[href*="performer"], a[href*="/av/"]').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && !performerList.includes(name) && name.length > 1 && name.length < 30 && !name.includes('一覧')) {
        performerList.push(name);
      }
    });

    // パターン2: 出演者テーブル行
    $('th:contains("出演者"), th:contains("女優"), td:contains("出演:")').each((_, elem) => {
      const $row = $(elem).closest('tr');
      const text = $row.find('td').last().text().trim();
      const names = text.split(/[,、\/]/).map(n => n.trim()).filter(n => n && n.length > 1 && n.length < 30);
      performerList.push(...names.filter(n => !performerList.includes(n)));
    });

    // パターン3: dl/dt/dd形式
    $('dt:contains("出演"), dt:contains("女優")').each((_, elem) => {
      const text = $(elem).next('dd').text().trim();
      const names = text.split(/[,、\/]/).map(n => n.trim()).filter(n => n && n.length > 1);
      performerList.push(...names.filter(n => !performerList.includes(n)));
    });

    // サムネイル抽出
    const thumbnailUrl = $('meta[property="og:image"]').attr('content') ||
                         $('img.main-image, img.package, img.jacket').first().attr('src') ||
                         $('.product-image img, .detail-image img').first().attr('src');

    // サンプル画像抽出
    const sampleImages: string[] = [];
    $('img[src*="sample"], img[src*="capture"], .gallery img, .sample-images img').each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src && src.startsWith('http') && !sampleImages.includes(src)) {
        sampleImages.push(src);
      }
    });

    // サンプル動画抽出
    let sampleVideoUrl: string | undefined;

    // パターン1: video source
    const videoSrc = $('video source').attr('src') || $('video').attr('src');
    if (videoSrc && videoSrc.includes('.mp4')) {
      sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `${BASE_URL}${videoSrc}`;
    }

    // パターン2: data属性
    if (!sampleVideoUrl) {
      const dataSrc = $('[data-video-url], [data-sample-url]').attr('data-video-url') ||
                      $('[data-video-url], [data-sample-url]').attr('data-sample-url');
      if (dataSrc) {
        sampleVideoUrl = dataSrc;
      }
    }

    // パターン3: JavaScript変数から
    if (!sampleVideoUrl) {
      const scriptMatch = html.match(/(?:sample_?url|video_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i);
      if (scriptMatch) {
        sampleVideoUrl = scriptMatch[1];
      }
    }

    // 再生時間抽出
    let duration: number | undefined;
    const durationMatch = html.match(/(\d+)\s*分/) || html.match(/(\d{1,3}):(\d{2})/);
    if (durationMatch) {
      if (durationMatch[2]) {
        duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
      } else {
        duration = parseInt(durationMatch[1]);
      }
    }

    // 価格抽出
    let price: number | undefined;
    const priceMatch = html.match(/(?:￥|¥)?\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)?/);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/,/g, ''));
    }

    // 発売日抽出
    let releaseDate: string | undefined;
    const dateMatch = html.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/) ||
                      html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (dateMatch) {
      releaseDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }

    // メーカー抽出
    let maker: string | undefined;
    $('th:contains("メーカー"), dt:contains("メーカー")').each((_, elem) => {
      const $next = $(elem).is('th') ? $(elem).closest('tr').find('td').last() : $(elem).next('dd');
      maker = $next.text().trim().substring(0, 100);
    });

    // レーベル抽出
    let label: string | undefined;
    $('th:contains("レーベル"), dt:contains("レーベル")').each((_, elem) => {
      const $next = $(elem).is('th') ? $(elem).closest('tr').find('td').last() : $(elem).next('dd');
      label = $next.text().trim().substring(0, 100);
    });

    // ジャンル抽出
    const genres: string[] = [];
    $('a[href*="genre"], a[href*="category"], .tag-link, .genre-link').each((_, elem) => {
      const genre = $(elem).text().trim();
      if (genre && !genres.includes(genre) && genre.length < 30) {
        genres.push(genre);
      }
    });

    return {
      productId,
      title,
      description,
      performers: performerList.slice(0, 20),
      thumbnailUrl,
      sampleImages: sampleImages.slice(0, 20),
      sampleVideoUrl,
      releaseDate,
      duration,
      price,
      maker,
      label,
      genres: genres.slice(0, 10),
    };
  } catch (error) {
    console.error(`  ❌ エラー (${productId}): ${error}`);
    return null;
  }
}

/**
 * 商品をデータベースに保存
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

    if (existing.length > 0) {
      productDbId = existing[0].id;
      console.log(`    ⏭️ 既存商品 (ID: ${productDbId})`);

      // 更新
      await db.update(products).set({
        title: product.title,
        description: product.description || '',
        defaultThumbnailUrl: product.thumbnailUrl,
        duration: product.duration,
        releaseDate: product.releaseDate,
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
          duration: product.duration,
          defaultThumbnailUrl: product.thumbnailUrl,
          releaseDate: product.releaseDate,
        })
        .returning({ id: products.id });

      productDbId = inserted.id;
      console.log(`    ✓ 新規商品作成 (ID: ${productDbId})`);
    }

    // product_sources upsert
    const affiliateUrl = generateAffiliateUrl(product.productId);
    await db.insert(productSources).values({
      productId: productDbId,
      aspName: SOURCE_NAME,
      originalProductId: product.productId,
      affiliateUrl,
      price: product.price,
      dataSource: 'CRAWL',
    }).onConflictDoUpdate({
      target: [productSources.productId, productSources.aspName],
      set: {
        affiliateUrl,
        price: product.price,
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

      // 商品-出演者リンク
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

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  let startPage = 1;
  let endPage = 50;
  let limit = 500;
  let singleId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      startPage = parseInt(args[i + 1]);
    }
    if (args[i] === '--end' && args[i + 1]) {
      endPage = parseInt(args[i + 1]);
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--id' && args[i + 1]) {
      singleId = args[i + 1];
    }
  }

  console.log('=== ソクミル HTMLクローラー ===\n');

  let totalFound = 0;
  let totalSaved = 0;

  if (singleId) {
    // 単一商品のクロール
    console.log(`単一商品クロール: ${singleId}\n`);

    const product = await parseDetailPage(singleId);
    if (product) {
      console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
      console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);

      const savedId = await saveProduct(product);
      if (savedId) {
        totalSaved++;
      }
      totalFound++;
    }
  } else {
    // 一覧ページからクロール
    console.log(`設定: startPage=${startPage}, endPage=${endPage}, limit=${limit}\n`);

    for (let page = startPage; page <= endPage && totalFound < limit; page++) {
      console.log(`\n--- ページ ${page} ---`);

      const productIds = await fetchProductListPage(page);

      if (productIds.length === 0) {
        console.log('商品が見つかりません。次のページへ...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      for (const productId of productIds) {
        if (totalFound >= limit) break;

        console.log(`\n[${totalFound + 1}] 商品ID: ${productId}`);

        const product = await parseDetailPage(productId);

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

      // ページ間の待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n=== クロール完了 ===');
  console.log(`取得件数: ${totalFound}`);
  console.log(`保存件数: ${totalSaved}`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = ${SOURCE_NAME}
  `);
  console.log(`\nソクミル総商品数: ${stats.rows[0].count}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
