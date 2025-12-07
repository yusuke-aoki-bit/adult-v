/**
 * MGS動画一覧ページクローラー
 *
 * 機能:
 * - MGS動画の新着一覧ページから商品URLを取得
 * - 各商品ページをcrawl-mgs.tsと同じロジックでクロール
 * - 重複チェック付きでデータベースに保存
 *
 * 使い方:
 * npx tsx scripts/crawlers/crawl-mgs-list.ts [--limit 100] [--pages 10] [--no-ai]
 */

import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { getDb } from '../../lib/db';
import { rawHtmlData, productSources, products, performers, productPerformers, tags, productTags, productImages, productVideos, productReviews, productRatingSummary } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { validateProductData, isTopPageHtml } from '../../lib/crawler-utils';
import { generateProductDescription, extractProductTags, translateProduct, GeneratedDescription } from '../../lib/google-apis';
import { saveRawHtml, calculateHash } from '../../lib/gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../../lib/sale-helper';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ';
const SOURCE_NAME = 'MGS';
const BASE_URL = 'https://www.mgstage.com';
const ITEMS_PER_PAGE = 120;

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  skippedUnchanged: number;
  errors: number;
}

interface MgsProduct {
  productId: string;
  url: string;
  title: string;
  releaseDate?: string;
  performerNames?: string[];
  thumbnailUrl?: string;
  sampleImages?: string[];
  sampleVideoUrl?: string;
  price?: number;
  saleInfo?: SaleInfo;
  description?: string;
  genres?: string[];
  aiDescription?: GeneratedDescription;
  aiTags?: {
    genres: string[];
    attributes: string[];
    plays: string[];
    situations: string[];
  };
}

/**
 * 一覧ページから商品URLリストを取得
 */
async function fetchProductUrls(page: number): Promise<string[]> {
  const url = `${BASE_URL}/search/cSearch.php?search_word=&sort=new&list_cnt=${ITEMS_PER_PAGE}&page=${page}`;
  console.log(`  📄 Fetching page ${page}: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Cookie': 'adc=1',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const productUrls: string[] = [];
  const seen = new Set<string>();

  $('a[href*="/product/product_detail/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        productUrls.push(fullUrl);
      }
    }
  });

  console.log(`  ✅ Found ${productUrls.length} unique products on page ${page}`);
  return productUrls;
}

/**
 * HTMLをアフィリエイトウィジェット形式に変換
 */
function generateAffiliateWidget(productId: string): string {
  const className = crypto.randomBytes(4).toString('hex');
  return `<div class="${className}"></div><script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8" src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=${AFFILIATE_CODE}&t=text&o=t&b=t&s=MOMO&p=${productId}&from=ppv&class=${className}"></script>`;
}

/**
 * MGS商品ページをパース
 */
function parseMgsProductPage(html: string, productUrl: string): MgsProduct | null {
  const $ = cheerio.load(html);

  // 商品IDを抽出
  const productIdMatch = productUrl.match(/product_detail\/([^\/]+)/);
  if (!productIdMatch) return null;
  const productId = productIdMatch[1];

  // タイトル
  const title = $('h1.tag').text().trim() || $('title').text().trim();

  // トップページ検出
  if (isTopPageHtml(html, 'MGS') ||
      title.includes('エロ動画・アダルトビデオ -MGS動画') ||
      title.includes('MGS動画＜プレステージ グループ＞')) {
    return null;
  }

  // 商品詳細ページチェック
  const hasProductDetails = $('th:contains("配信開始日")').length > 0 ||
                            $('th:contains("出演")').length > 0;
  if (!hasProductDetails) return null;

  // リリース日
  const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
  const releaseDate = releaseDateText ? releaseDateText.replace(/\//g, '-') : undefined;

  // 出演者
  const rawPerformerNames: string[] = [];
  $('th:contains("出演")').next('td').find('a').each((_, elem) => {
    const name = $(elem).text().trim();
    if (name) rawPerformerNames.push(name);
  });

  if (rawPerformerNames.length === 0) {
    const performerText = $('th:contains("出演")').next('td').text().trim();
    if (performerText) {
      performerText.split(/[、,\n]/).forEach((name) => {
        const trimmed = name.trim();
        if (trimmed) rawPerformerNames.push(trimmed);
      });
    }
  }

  const performerNames = rawPerformerNames
    .map(name => normalizePerformerName(name))
    .filter((name): name is string => name !== null && isValidPerformerForProduct(name, title));

  // サムネイル
  let thumbnailUrl: string | undefined;
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    thumbnailUrl = ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`;
  }

  // サンプル画像
  const sampleImages: string[] = [];
  const shouldExcludeImage = (url: string): boolean => {
    return url.includes('sample_button') || url.includes('sample-button') ||
           url.includes('samplemovie') || url.includes('sample_movie') ||
           url.includes('btn_sample');
  };

  $('.sample-photo img, .sample-box img, .sample-image img').each((_, elem) => {
    const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
    if (imgSrc) {
      const fullUrl = imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`;
      if (!sampleImages.includes(fullUrl) && !shouldExcludeImage(fullUrl)) {
        sampleImages.push(fullUrl);
      }
    }
  });

  // サンプル動画
  let sampleVideoUrl: string | undefined;
  const videoSrc = $('video source').attr('src');
  if (videoSrc) {
    sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `${BASE_URL}${videoSrc}`;
  }

  // 価格とセール情報
  let price: number | undefined;
  let saleInfo: SaleInfo | undefined;
  const priceTd = $('th:contains("価格")').next('td');
  const priceText = priceTd.text().trim();
  const delPrice = priceTd.find('del, .price_del, s, strike').text().trim();
  const delPriceMatch = delPrice.match(/(\d+(?:,\d+)*)/);
  const priceMatch = priceText.match(/(\d+(?:,\d+)*)/g);

  if (delPriceMatch && priceMatch && priceMatch.length >= 1) {
    const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''));
    const salePriceStr = priceMatch.find(p => parseInt(p.replace(/,/g, '')) !== regularPrice) || priceMatch[priceMatch.length - 1];
    const salePrice = parseInt(salePriceStr.replace(/,/g, ''));

    if (salePrice < regularPrice) {
      price = salePrice;
      const discountMatch = priceText.match(/(\d+)\s*%\s*(OFF|オフ|off)/i);
      saleInfo = {
        regularPrice,
        salePrice,
        discountPercent: discountMatch ? parseInt(discountMatch[1]) : undefined,
        saleType: 'timesale',
      };
    }
  } else if (priceMatch) {
    price = parseInt(priceMatch[0].replace(/,/g, ''));
  }

  // 説明文
  const description = $('#introduction .introduction').text().trim() || undefined;

  // ジャンル
  const genres: string[] = [];
  $('th:contains("ジャンル")').next('td').find('a').each((_, elem) => {
    const genre = $(elem).text().trim();
    if (genre) genres.push(genre);
  });

  return {
    productId,
    url: productUrl,
    title,
    releaseDate,
    performerNames,
    thumbnailUrl,
    sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
    sampleVideoUrl,
    price,
    saleInfo,
    description,
    genres: genres.length > 0 ? genres : undefined,
  };
}

/**
 * 商品データをDBに保存
 */
async function saveProduct(
  mgsProduct: MgsProduct,
  html: string,
  enableAI: boolean,
  stats: CrawlStats,
): Promise<void> {
  const db = getDb();
  const normalizedProductId = mgsProduct.productId.toLowerCase();

  // 商品データの検証
  const validation = validateProductData({
    title: mgsProduct.title,
    aspName: 'MGS',
    originalId: mgsProduct.productId,
  });

  if (!validation.isValid) {
    console.log(`    ⚠️ Skip: ${validation.reason}`);
    return;
  }

  try {
    // HTMLハッシュ計算
    const hash = calculateHash(html);

    // 既存データチェック（raw_html_data）
    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, SOURCE_NAME), eq(rawHtmlData.productId, mgsProduct.productId)))
      .limit(1);

    if (existingRaw.length > 0 && existingRaw[0].hash === hash) {
      console.log(`    ⏭️ No changes, skipping`);
      stats.skippedUnchanged++;
      return;
    }

    // 生HTML保存
    const { gcsUrl, htmlContent } = await saveRawHtml('mgs', mgsProduct.productId, html);

    if (existingRaw.length > 0) {
      await db
        .update(rawHtmlData)
        .set({ htmlContent, gcsUrl, hash, crawledAt: new Date(), processedAt: null })
        .where(eq(rawHtmlData.id, existingRaw[0].id));
    } else {
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId: mgsProduct.productId,
        url: mgsProduct.url,
        htmlContent,
        gcsUrl,
        hash,
      });
    }

    // productsテーブルにupsert
    const productRecord = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (productRecord.length === 0) {
      const [newProduct] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: mgsProduct.title,
          releaseDate: mgsProduct.releaseDate ? new Date(mgsProduct.releaseDate) : undefined,
          defaultThumbnailUrl: mgsProduct.thumbnailUrl,
        })
        .returning();

      productId = newProduct.id;
      stats.newProducts++;
      console.log(`    ✓ New product (id: ${productId})`);
    } else {
      productId = productRecord[0].id;
      await db
        .update(products)
        .set({
          title: mgsProduct.title,
          releaseDate: mgsProduct.releaseDate ? new Date(mgsProduct.releaseDate) : undefined,
          defaultThumbnailUrl: mgsProduct.thumbnailUrl,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));
      stats.updatedProducts++;
      console.log(`    ✓ Updated (id: ${productId})`);
    }

    // product_sourcesに保存
    const affiliateWidget = generateAffiliateWidget(mgsProduct.productId);
    const existingSource = await db
      .select()
      .from(productSources)
      .where(and(eq(productSources.productId, productId), eq(productSources.aspName, SOURCE_NAME)))
      .limit(1);

    if (existingSource.length > 0) {
      await db
        .update(productSources)
        .set({
          affiliateUrl: affiliateWidget,
          originalProductId: mgsProduct.productId,
          price: mgsProduct.price,
          lastUpdated: new Date(),
        })
        .where(eq(productSources.id, existingSource[0].id));
    } else {
      await db.insert(productSources).values({
        productId,
        aspName: SOURCE_NAME,
        originalProductId: mgsProduct.productId,
        affiliateUrl: affiliateWidget,
        price: mgsProduct.price,
        dataSource: 'HTML',
      });
    }

    // 出演者保存
    if (mgsProduct.performerNames && mgsProduct.performerNames.length > 0) {
      for (const name of mgsProduct.performerNames) {
        const performerRecord = await db
          .select()
          .from(performers)
          .where(eq(performers.name, name))
          .limit(1);

        let performerId: number;
        if (performerRecord.length === 0) {
          const [newPerformer] = await db.insert(performers).values({ name }).returning();
          performerId = newPerformer.id;
        } else {
          performerId = performerRecord[0].id;
        }

        const existingLink = await db
          .select()
          .from(productPerformers)
          .where(and(eq(productPerformers.productId, productId), eq(productPerformers.performerId, performerId)))
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(productPerformers).values({ productId, performerId });
        }
      }
    }

    // 画像保存
    if (mgsProduct.thumbnailUrl) {
      const existing = await db
        .select()
        .from(productImages)
        .where(and(eq(productImages.productId, productId), eq(productImages.imageUrl, mgsProduct.thumbnailUrl)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productImages).values({
          productId,
          imageUrl: mgsProduct.thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        });
      }
    }

    if (mgsProduct.sampleImages) {
      for (let i = 0; i < mgsProduct.sampleImages.length; i++) {
        const imageUrl = mgsProduct.sampleImages[i];
        const existing = await db
          .select()
          .from(productImages)
          .where(and(eq(productImages.productId, productId), eq(productImages.imageUrl, imageUrl)))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(productImages).values({
            productId,
            imageUrl,
            imageType: 'sample',
            displayOrder: i + 1,
            aspName: SOURCE_NAME,
          });
        }
      }
    }

    // 動画保存
    if (mgsProduct.sampleVideoUrl) {
      const existing = await db
        .select()
        .from(productVideos)
        .where(and(eq(productVideos.productId, productId), eq(productVideos.videoUrl, mgsProduct.sampleVideoUrl)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productVideos).values({
          productId,
          videoUrl: mgsProduct.sampleVideoUrl,
          videoType: 'sample',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        });
      }
    }

    // セール情報保存
    if (mgsProduct.saleInfo) {
      await saveSaleInfo(SOURCE_NAME, mgsProduct.productId, mgsProduct.saleInfo);
    }

    // AI処理
    if (enableAI) {
      try {
        console.log('    🤖 AI processing...');
        const aiDescription = await generateProductDescription({
          title: mgsProduct.title,
          originalDescription: mgsProduct.description,
          performers: mgsProduct.performerNames,
          genres: mgsProduct.genres,
        });

        const aiTags = await extractProductTags(mgsProduct.title, mgsProduct.description);

        if (aiDescription || (aiTags.genres.length > 0)) {
          await db
            .update(products)
            .set({
              aiDescription: aiDescription ? JSON.stringify(aiDescription) : undefined,
              aiCatchphrase: aiDescription?.catchphrase,
              aiShortDescription: aiDescription?.shortDescription,
              aiTags: (aiTags.genres.length > 0 || aiTags.attributes.length > 0) ? JSON.stringify(aiTags) : undefined,
            })
            .where(eq(products.id, productId));
        }

        // 翻訳
        const translation = await translateProduct(mgsProduct.title, mgsProduct.description);
        if (translation) {
          await db
            .update(products)
            .set({
              titleEn: translation.en?.title,
              titleZh: translation.zh?.title,
              titleKo: translation.ko?.title,
              descriptionEn: translation.en?.description,
              descriptionZh: translation.zh?.description,
              descriptionKo: translation.ko?.description,
            })
            .where(eq(products.id, productId));
        }
      } catch (error) {
        console.error('    ⚠️ AI processing failed:', error);
      }
    }

    // MGSタグと紐付け
    const mgsTag = await db.select().from(tags).where(eq(tags.name, SOURCE_NAME)).limit(1);
    let providerTagId: number;

    if (mgsTag.length === 0) {
      const [newTag] = await db.insert(tags).values({ name: SOURCE_NAME, category: 'provider' }).returning();
      providerTagId = newTag.id;
    } else {
      providerTagId = mgsTag[0].id;
    }

    const existingTagLink = await db
      .select()
      .from(productTags)
      .where(and(eq(productTags.productId, productId), eq(productTags.tagId, providerTagId)))
      .limit(1);

    if (existingTagLink.length === 0) {
      await db.insert(productTags).values({ productId, tagId: providerTagId });
    }

    // ジャンルタグを保存
    if (mgsProduct.genres && mgsProduct.genres.length > 0) {
      for (const genreName of mgsProduct.genres) {
        // ジャンルタグを取得または作成
        const existingGenreTag = await db
          .select()
          .from(tags)
          .where(and(eq(tags.name, genreName), eq(tags.category, 'genre')))
          .limit(1);

        let genreTagId: number;
        if (existingGenreTag.length === 0) {
          const [newGenreTag] = await db
            .insert(tags)
            .values({ name: genreName, category: 'genre' })
            .returning();
          genreTagId = newGenreTag.id;
        } else {
          genreTagId = existingGenreTag[0].id;
        }

        // 商品とジャンルタグの紐付け
        const existingGenreLink = await db
          .select()
          .from(productTags)
          .where(and(eq(productTags.productId, productId), eq(productTags.tagId, genreTagId)))
          .limit(1);

        if (existingGenreLink.length === 0) {
          await db.insert(productTags).values({ productId, tagId: genreTagId });
        }
      }
    }

  } catch (error) {
    console.error(`    ❌ Error:`, error);
    stats.errors++;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const pagesArg = args.find(arg => arg.startsWith('--pages='));
  const enableAI = !args.includes('--no-ai');

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;
  const maxPages = pagesArg ? parseInt(pagesArg.split('=')[1]) : Math.ceil(limit / ITEMS_PER_PAGE);

  console.log('=== MGS一覧クローラー ===');
  console.log(`AI: ${enableAI ? 'enabled' : 'disabled'}`);
  console.log(`Limit: ${limit} products, Max pages: ${maxPages}\n`);

  const stats: CrawlStats = {
    totalFetched: 0,
    newProducts: 0,
    updatedProducts: 0,
    skippedUnchanged: 0,
    errors: 0,
  };

  const allProductUrls: string[] = [];

  // 一覧ページから商品URLを収集
  console.log('📋 Collecting product URLs from list pages...\n');
  for (let page = 1; page <= maxPages; page++) {
    try {
      const urls = await fetchProductUrls(page);
      allProductUrls.push(...urls);

      if (allProductUrls.length >= limit) {
        break;
      }

      // 次のページがあるかチェック
      if (urls.length < ITEMS_PER_PAGE) {
        console.log(`  ℹ️ Reached last page (page ${page})`);
        break;
      }

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error fetching page ${page}:`, error);
      break;
    }
  }

  const productUrls = allProductUrls.slice(0, limit);
  console.log(`\n📦 Total products to process: ${productUrls.length}\n`);

  // 各商品をクロール
  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i];
    const productIdMatch = url.match(/product_detail\/([^\/]+)/);
    const productId = productIdMatch ? productIdMatch[1] : 'unknown';

    console.log(`[${i + 1}/${productUrls.length}] ${productId}`);
    stats.totalFetched++;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'adc=1',
        },
      });

      if (!response.ok) {
        console.log(`    ⚠️ HTTP ${response.status}`);
        stats.errors++;
        continue;
      }

      const html = await response.text();
      const mgsProduct = parseMgsProductPage(html, url);

      if (!mgsProduct) {
        console.log(`    ⚠️ Failed to parse`);
        stats.errors++;
        continue;
      }

      await saveProduct(mgsProduct, html, enableAI, stats);

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`    ❌ Error:`, error);
      stats.errors++;
    }
  }

  console.log('\n=== Crawl Complete ===\n');
  console.log('Statistics:');
  console.table(stats);

  process.exit(0);
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { fetchProductUrls, parseMgsProductPage };
