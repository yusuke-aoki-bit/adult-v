/**
 * MGS動画のアフィリエイトリンクをクロールするスクリプト
 *
 * MGSのアフィリエイトウィジェット形式:
 * <div class="gpyivn8"></div>
 * <script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8"
 *   src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=6CS5PGEBQDUYPZLHYEM33TBZFJ&t=text&o=t&b=t&s=MOMO&p=230OREMO-435&from=ppv&class=gpyivn8">
 * </script>
 */

import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { getDb } from '../../lib/db';
import { rawHtmlData, productSources, products, performers, productPerformers, tags, productTags, productImages, productVideos, productReviews, productRatingSummary } from '../../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { validateProductData, isTopPageHtml } from '../../lib/crawler-utils';
import { generateProductDescription, analyzeReviews, extractProductTags, analyzeImage, GeneratedDescription, translateProduct, ProductTranslation } from '../../lib/google-apis';
import { saveRawHtml, calculateHash } from '../../lib/gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../../lib/sale-helper';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ'; // MGSアフィリエイトコード
const SOURCE_NAME = 'MGS';

// MGS メーカーマッピング (シリーズプレフィックスからメーカーIDを推測)
// バックフィルで発見したパターンに基づく
const makerMap: Record<string, string> = {
  // SODクリエイト
  STARS: 'sodcreate/107stars',
  SDAB: 'sodcreate/1sdab',
  SDJS: 'sodcreate/1sdjs',
  SDDE: 'sodcreate/1sdde',
  SDAM: 'sodcreate/1sdam',
  SDMU: 'sodcreate/1sdmu',
  SDNT: 'sodcreate/1sdnt',
  SDNM: 'sodcreate/1sdnm',
  CAWD: 'kawaii/112cawd',
  // プレステージ
  SABA: 'prestige/118saba',
  ABW: 'prestige/118abw',
  ABP: 'prestige/118abp',
  ABS: 'prestige/118abs',
  ABF: 'prestige/118abf',
  CHN: 'prestige/118chn',
  TEM: 'prestige/118tem',
  SGA: 'prestige/118sga',
  // 素人TV系 (数字プレフィックス付き)
  '261SIRO': 'shiroutotv/261siro',
  '261ARA': 'shiroutotv/261ara',
  '259LUXU': 'shiroutotv/259luxu',
  '300MIUM': 'shiroutotv/300mium',
  '300MAAN': 'shiroutotv/300maan',
  '300NTK': 'shiroutotv/300ntk',
  '300ORETD': 'shiroutotv/300oretd',
  // その他
  MFCS: 'faleno/h_1530mfcs',
};

/**
 * MGS商品IDをパース
 */
function parseMgsProductId(originalProductId: string): { series: string; num: string } | null {
  // パターン1: STARS-865 or STARS865
  let match = originalProductId.match(/^([A-Z]+)-?(\d+)$/);
  if (match) {
    return { series: match[1], num: match[2] };
  }

  // パターン2: 300MIUM1359 (数字プレフィックス付き)
  match = originalProductId.match(/^(\d+[A-Z]+)(\d+)$/);
  if (match) {
    return { series: match[1], num: match[2] };
  }

  return null;
}

/**
 * MGS商品IDから画像URLを生成（フォールバック用）
 * パターン: https://image.mgstage.com/images/{maker}/{series}/{num}/pb_e_{series}-{num}.jpg
 */
function generateMgsImageUrlFallback(originalProductId: string): string | null {
  const parsed = parseMgsProductId(originalProductId);
  if (!parsed) return null;

  const { series, num } = parsed;
  const makerPath = makerMap[series];

  if (!makerPath) {
    return null;
  }

  const seriesId = makerPath.split('/')[1];
  return `https://image.mgstage.com/images/${makerPath}/${num}/pb_e_${seriesId}-${num}.jpg`;
}

interface MgsReview {
  reviewerName: string;
  rating: number;
  title?: string;
  content: string;
}

interface MgsRatingSummary {
  averageRating: number;
  totalReviews: number;
  maxRating: number;
}

interface MgsProduct {
  productId: string;
  url: string;
  title: string;
  releaseDate?: string;
  performerNames?: string[]; // 出演者名のリスト
  thumbnailUrl?: string; // サムネイル画像URL
  sampleImages?: string[]; // サンプル画像URL配列
  sampleVideoUrl?: string; // サンプル動画URL
  price?: number; // 価格
  saleInfo?: SaleInfo; // セール情報
  reviews?: MgsReview[]; // レビュー情報
  ratingSummary?: MgsRatingSummary; // 評価サマリー
  description?: string; // 元の説明文
  genres?: string[]; // ジャンル
  // AI生成データ
  aiDescription?: GeneratedDescription;
  aiTags?: {
    genres: string[];
    attributes: string[];
    plays: string[];
    situations: string[];
  };
}

/**
 * HTMLからMGSアフィリエイトウィジェットコードを生成
 */
function generateAffiliateWidget(productId: string): string {
  const className = crypto.randomBytes(4).toString('hex');
  return `<div class="${className}"></div><script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8" src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=${AFFILIATE_CODE}&t=text&o=t&b=t&s=MOMO&p=${productId}&from=ppv&class=${className}"></script>`;
}

/**
 * MGS商品ページをクロール
 */
async function crawlMgsProduct(productUrl: string): Promise<MgsProduct | null> {
  try {
    console.log(`Crawling: ${productUrl}`);

    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',  // Age verification cookie
      },
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 商品IDを抽出（URLから: https://www.mgstage.com/product/product_detail/857OMG-018/）
    const productIdMatch = productUrl.match(/product_detail\/([^\/]+)/);
    if (!productIdMatch) {
      console.error('Could not extract product ID from URL');
      return null;
    }
    const productId = productIdMatch[1];

    // タイトルを抽出
    const title = $('h1.tag').text().trim() || $('title').text().trim();

    // トップページ検出（商品が存在しない場合、MGSはトップページを返す）
    if (isTopPageHtml(html, 'MGS')) {
      console.error(`  ⚠️ トップページが返されました（商品が存在しない可能性）: ${productId}`);
      return null;
    }

    // タイトルがトップページのタイトルかチェック
    if (title.includes('エロ動画・アダルトビデオ -MGS動画') ||
        title.includes('MGS動画＜プレステージ グループ＞') ||
        title === 'エロ動画・アダルトビデオ -MGS動画＜プレステージ グループ＞') {
      console.error(`  ⚠️ トップページのタイトルが検出されました（商品が存在しない）: ${productId}`);
      return null;
    }

    // 商品詳細ページの特徴がないかチェック
    const hasProductDetails = $('th:contains("配信開始日")').length > 0 ||
                              $('th:contains("出演")').length > 0 ||
                              $('th:contains("価格")').length > 0;
    if (!hasProductDetails) {
      console.error(`  ⚠️ 商品詳細情報がありません（商品が存在しない）: ${productId}`);
      return null;
    }

    // リリース日を抽出
    const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
    const releaseDate = releaseDateText ? releaseDateText.replace(/\//g, '-') : undefined;

    // 出演者を抽出（バリデーション付き）
    const rawPerformerNames: string[] = [];
    $('th:contains("出演")').next('td').find('a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name) {
        rawPerformerNames.push(name);
      }
    });

    // 出演者がリンクでない場合もある
    if (rawPerformerNames.length === 0) {
      const performerText = $('th:contains("出演")').next('td').text().trim();
      if (performerText) {
        // カンマや改行で区切られている場合
        performerText.split(/[、,\n]/).forEach((name) => {
          const trimmed = name.trim();
          if (trimmed) {
            rawPerformerNames.push(trimmed);
          }
        });
      }
    }

    // バリデーションを適用して有効な名前のみフィルタリング
    const performerNames = rawPerformerNames
      .map(name => normalizePerformerName(name))
      .filter((name): name is string => name !== null && isValidPerformerForProduct(name, title));

    console.log(`  Found ${performerNames.length} valid performer(s): ${performerNames.join(', ')} (raw: ${rawPerformerNames.length})`);

    // サムネイル画像を抽出
    let thumbnailUrl: string | undefined;
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      thumbnailUrl = ogImage.startsWith('http') ? ogImage : `https://www.mgstage.com${ogImage}`;
    }

    // サンプル画像を抽出（複数）
    const sampleImages: string[] = [];

    // Helper function to check if URL should be excluded
    const shouldExcludeImage = (url: string): boolean => {
      // Exclude sample movie banners
      if (url.includes('sample_button') || url.includes('sample-button')) return true;
      if (url.includes('samplemovie') || url.includes('sample_movie')) return true;
      if (url.includes('btn_sample')) return true;
      return false;
    };

    // パターン1: sample-photo クラスの画像
    $('.sample-photo img').each((_, elem) => {
      const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
      if (imgSrc) {
        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.mgstage.com${imgSrc}`;
        if (!shouldExcludeImage(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン2: サンプル画像リンク (.sample-box, .sample-image, etc.)
    $('.sample-box img, .sample-image img, .product-sample img').each((_, elem) => {
      const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
      if (imgSrc && !sampleImages.includes(imgSrc)) {
        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.mgstage.com${imgSrc}`;
        if (!sampleImages.includes(fullUrl) && !shouldExcludeImage(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン3: サムネイル画像ギャラリー
    $('a[href*="pics/"] img, a[href*="sample"] img').each((_, elem) => {
      const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
      if (imgSrc) {
        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.mgstage.com${imgSrc}`;
        if (!sampleImages.includes(fullUrl) && fullUrl !== thumbnailUrl && !shouldExcludeImage(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    console.log(`  Found ${sampleImages.length} sample image(s)`);

    // サンプル動画URLを抽出
    let sampleVideoUrl: string | undefined;

    // パターン1: video source タグから
    const videoSrc = $('video source').attr('src');
    if (videoSrc) {
      sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `https://www.mgstage.com${videoSrc}`;
    }

    // パターン2: data-video-url 属性
    if (!sampleVideoUrl) {
      const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
      if (dataVideoUrl) {
        sampleVideoUrl = dataVideoUrl.startsWith('http') ? dataVideoUrl : `https://www.mgstage.com${dataVideoUrl}`;
      }
    }

    // パターン3: sample_movie リンク
    if (!sampleVideoUrl) {
      const sampleMovieLink = $('a[href*="sample_movie"]').attr('href');
      if (sampleMovieLink) {
        sampleVideoUrl = sampleMovieLink.startsWith('http') ? sampleMovieLink : `https://www.mgstage.com${sampleMovieLink}`;
      }
    }

    // パターン4: JavaScriptから sample_url を抽出
    if (!sampleVideoUrl) {
      const scriptContent = $('script:contains("sample_url")').html();
      if (scriptContent) {
        const sampleUrlMatch = scriptContent.match(/sample_url['":\s]+['"]([^'"]+)['"]/);
        if (sampleUrlMatch) {
          sampleVideoUrl = sampleUrlMatch[1].startsWith('http')
            ? sampleUrlMatch[1]
            : `https://www.mgstage.com${sampleUrlMatch[1]}`;
        }
      }
    }

    if (sampleVideoUrl) {
      console.log(`  Found sample video: ${sampleVideoUrl}`);
    }

    // 価格を抽出（通常価格とセール価格）
    let price: number | undefined;
    let saleInfo: SaleInfo | undefined;

    const priceTd = $('th:contains("価格")').next('td');
    const priceHtml = priceTd.html() || '';

    // セール価格があるかチェック（取り消し線の価格と新しい価格がある場合）
    // パターン1: <del>¥1,980</del> → ¥980 (50%OFF)
    // パターン2: <span class="price_del">¥1,980</span> <span class="price">¥980</span>
    // パターン3: 通常価格¥1,980 セール価格¥980
    const delPrice = priceTd.find('del, .price_del, s, strike').text().trim();
    const delPriceMatch = delPrice.match(/(\d+(?:,\d+)*)/);

    // メインの価格テキスト
    const priceText = priceTd.text().trim();
    const priceMatch = priceText.match(/(\d+(?:,\d+)*)/g);

    if (delPriceMatch && priceMatch && priceMatch.length >= 1) {
      // セール価格がある場合
      const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''));
      // 通常価格以外の最初の価格がセール価格
      const salePriceStr = priceMatch.find(p => parseInt(p.replace(/,/g, '')) !== regularPrice) || priceMatch[priceMatch.length - 1];
      const salePrice = parseInt(salePriceStr.replace(/,/g, ''));

      if (salePrice < regularPrice) {
        price = salePrice;

        // 割引率を抽出 (例: 50%OFF, 30%オフ)
        const discountMatch = priceText.match(/(\d+)\s*%\s*(OFF|オフ|off)/i);
        const discountPercent = discountMatch ? parseInt(discountMatch[1]) : undefined;

        // セール終了日時を抽出（あれば）
        // パターン: 〜12/31まで, セール終了: 2024/01/15, など
        let endAt: Date | undefined;
        const endDateMatch = priceText.match(/(?:〜|～|まで|終了[：:])?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
        if (endDateMatch) {
          const month = parseInt(endDateMatch[1]);
          const day = parseInt(endDateMatch[2]);
          const year = endDateMatch[3] ? parseInt(endDateMatch[3]) : new Date().getFullYear();
          endAt = new Date(year < 100 ? 2000 + year : year, month - 1, day, 23, 59, 59);
        }

        saleInfo = {
          regularPrice,
          salePrice,
          discountPercent,
          saleType: 'timesale',
          endAt,
        };

        console.log(`  💰 Sale detected: ¥${regularPrice.toLocaleString()} → ¥${salePrice.toLocaleString()} (${discountPercent || Math.round((1 - salePrice / regularPrice) * 100)}% OFF)`);
      }
    } else if (priceMatch) {
      price = parseInt(priceMatch[0].replace(/,/g, ''));
    }

    // レビュー情報を抽出
    let ratingSummary: MgsRatingSummary | undefined;
    const reviews: MgsReview[] = [];

    // 平均評価を抽出
    // パターン: (5点満点中 4.6点 / レビュー数 5 件)
    const reviewSummaryText = $('.user_review_head .detail').text();
    const summaryMatch = reviewSummaryText.match(/(\d+)点満点中\s*([\d.]+)点.*レビュー数\s*(\d+)\s*件/);
    if (summaryMatch) {
      ratingSummary = {
        maxRating: parseInt(summaryMatch[1]),
        averageRating: parseFloat(summaryMatch[2]),
        totalReviews: parseInt(summaryMatch[3]),
      };
      console.log(`  Found rating summary: ${ratingSummary.averageRating}/${ratingSummary.maxRating} (${ratingSummary.totalReviews} reviews)`);
    }

    // 個別レビューを抽出
    // user_review内のli要素から抽出
    $('#user_review li').each((_, elem) => {
      const $review = $(elem);

      // レビュータイトル（h4要素）
      const reviewTitle = $review.find('h4').text().trim() || undefined;

      // レビュアー名 (例: "カカシさんのレビュー" → "カカシ")
      const reviewerNameText = $review.find('.name').text().trim();
      const reviewerNameMatch = reviewerNameText.match(/^(.+?)さんのレビュー$/);
      const reviewerName = reviewerNameMatch ? reviewerNameMatch[1] : reviewerNameText.replace(/さんのレビュー$/, '');

      // 評価（star_XX_XX または star_XX クラスから）
      // star_50 = 5.0, star_45_49 = 4.5-4.9 (実質4.5)
      const starClass = $review.find('.review span[class^="star_"]').attr('class') || '';
      let rating = 0;
      const starMatch = starClass.match(/star_(\d+)(?:_(\d+))?/);
      if (starMatch) {
        // star_50 → 5.0, star_45_49 → 4.5
        rating = parseInt(starMatch[1]) / 10;
      }

      // レビュー内容（.text要素のHTML、<br>を改行に変換）
      const contentHtml = $review.find('.text').html() || '';
      const content = contentHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

      if (reviewerName && content) {
        reviews.push({
          reviewerName,
          rating,
          title: reviewTitle,
          content,
        });
      }
    });

    if (reviews.length > 0) {
      console.log(`  Found ${reviews.length} review(s)`);
    }

    // 説明文を抽出
    let description: string | undefined;
    const introText = $('#introduction .introduction').text().trim();
    if (introText) {
      description = introText;
    }

    // ジャンル/カテゴリを抽出
    const genres: string[] = [];
    $('th:contains("ジャンル")').next('td').find('a').each((_, elem) => {
      const genre = $(elem).text().trim();
      if (genre) {
        genres.push(genre);
      }
    });

    console.log(`  Found ${genres.length} genre(s): ${genres.join(', ')}`);

    return {
      productId,
      url: productUrl, // Keep original product URL for reference
      title,
      releaseDate,
      performerNames,
      thumbnailUrl,
      sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
      sampleVideoUrl,
      price,
      saleInfo,
      reviews: reviews.length > 0 ? reviews : undefined,
      ratingSummary,
      description,
      genres: genres.length > 0 ? genres : undefined,
    };
  } catch (error) {
    console.error('Error crawling MGS product:', error);
    return null;
  }
}

/**
 * 生HTMLデータをデータベースに保存（GCS優先）
 */
async function saveRawHtmlData(
  productId: string,
  url: string,
  html: string,
): Promise<void> {
  const db = getDb();
  const hash = calculateHash(html);

  try {
    // 既存データをチェック
    const existing = await db
      .select()
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, SOURCE_NAME), eq(rawHtmlData.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      // ハッシュが同じなら更新不要
      if (existing[0].hash === hash) {
        console.log(`Product ${productId} - No changes detected`);
        return;
      }

      // GCS保存を試みる
      const { gcsUrl, htmlContent } = await saveRawHtml('mgs', productId, html);

      // 更新
      await db
        .update(rawHtmlData)
        .set({
          htmlContent,
          gcsUrl,
          hash,
          crawledAt: new Date(),
          processedAt: null, // 再処理が必要
        })
        .where(eq(rawHtmlData.id, existing[0].id));

      console.log(`Product ${productId} - Updated raw HTML${gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      // GCS保存を試みる
      const { gcsUrl, htmlContent } = await saveRawHtml('mgs', productId, html);

      // 新規挿入
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId,
        url,
        htmlContent,
        gcsUrl,
        hash,
      });

      console.log(`Product ${productId} - Saved raw HTML${gcsUrl ? ' (GCS)' : ' (DB)'}`);
    }
  } catch (error) {
    console.error(`Error saving raw HTML for ${productId}:`, error);
    throw error;
  }
}

/**
 * アフィリエイトリンクをデータベースに保存
 */
async function saveAffiliateLink(mgsProduct: MgsProduct): Promise<void> {
  // 商品データの検証
  const validation = validateProductData({
    title: mgsProduct.title,
    aspName: 'MGS',
    originalId: mgsProduct.productId,
  });

  if (!validation.isValid) {
    console.log(`  ⚠️ スキップ: ${validation.reason}`);
    return;
  }

  const db = getDb();

  try {
    // 作品を検索または作成
    const normalizedProductId = mgsProduct.productId.toLowerCase();
    const productRecord = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (productRecord.length === 0) {
      // 新規作成
      const [newProduct] = await db
        .insert(products)
        .values({
          normalizedProductId,
          title: mgsProduct.title,
          releaseDate: mgsProduct.releaseDate ? new Date(mgsProduct.releaseDate) : undefined,
        })
        .returning();

      productId = newProduct.id;
      console.log(`Created new product: ${normalizedProductId}`);
    } else {
      productId = productRecord[0].id;
    }

    // Generate affiliate widget code for MGS
    const affiliateWidget = generateAffiliateWidget(mgsProduct.productId);

    // product_sourcesに保存
    const existing = await db
      .select()
      .from(productSources)
      .where(
        and(
          eq(productSources.productId, productId),
          eq(productSources.aspName, SOURCE_NAME),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新
      await db
        .update(productSources)
        .set({
          affiliateUrl: affiliateWidget,
          originalProductId: mgsProduct.productId,
          lastUpdated: new Date(),
        })
        .where(eq(productSources.id, existing[0].id));

      console.log(`Updated affiliate link for product ${productId}`);
    } else {
      // 新規挿入
      await db.insert(productSources).values({
        productId,
        aspName: SOURCE_NAME,
        originalProductId: mgsProduct.productId,
        affiliateUrl: affiliateWidget,
        dataSource: 'HTML',
      });

      console.log(`Saved affiliate link for product ${productId}`);
    }
  } catch (error) {
    console.error('Error saving affiliate link:', error);
    throw error;
  }
}

/**
 * 女優データを保存して、作品と紐付け
 */
async function savePerformers(
  productId: number,
  performerNames: string[],
): Promise<void> {
  if (!performerNames || performerNames.length === 0) {
    return;
  }

  const db = getDb();

  try {
    for (const name of performerNames) {
      // 女優を検索または作成
      const performerRecord = await db
        .select()
        .from(performers)
        .where(eq(performers.name, name))
        .limit(1);

      let performerId: number;

      if (performerRecord.length === 0) {
        // 新規作成
        const [newPerformer] = await db
          .insert(performers)
          .values({ name })
          .returning();

        performerId = newPerformer.id;
        console.log(`  Created performer: ${name}`);
      } else {
        performerId = performerRecord[0].id;
      }

      // product_performersに紐付け（重複チェック）
      const existing = await db
        .select()
        .from(productPerformers)
        .where(
          and(
            eq(productPerformers.productId, productId),
            eq(productPerformers.performerId, performerId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productPerformers).values({
          productId,
          performerId,
        });
        console.log(`  Linked performer ${name} to product ${productId}`);
      }
    }
  } catch (error) {
    console.error('Error saving performers:', error);
    throw error;
  }
}

// product_cache table has been removed - images are now stored in product_images table

/**
 * MGSタグと商品を紐付け
 */
async function linkMgsTag(productId: number): Promise<void> {
  const db = getDb();

  try {
    // MGSタグを検索または作成
    const mgsTag = await db
      .select()
      .from(tags)
      .where(eq(tags.name, SOURCE_NAME))
      .limit(1);

    let tagId: number;

    if (mgsTag.length === 0) {
      // MGSタグを作成
      const [newTag] = await db
        .insert(tags)
        .values({
          name: SOURCE_NAME,
          category: 'provider',
        })
        .returning();

      tagId = newTag.id;
      console.log(`Created MGS tag with ID: ${tagId}`);
    } else {
      tagId = mgsTag[0].id;
    }

    // 既存の紐付けをチェック
    const existingLink = await db
      .select()
      .from(productTags)
      .where(
        and(
          eq(productTags.productId, productId),
          eq(productTags.tagId, tagId),
        ),
      )
      .limit(1);

    if (existingLink.length === 0) {
      await db.insert(productTags).values({
        productId,
        tagId,
      });
      console.log(`Linked product ${productId} to MGS tag`);
    }
  } catch (error) {
    console.error('Error linking MGS tag:', error);
    throw error;
  }
}

/**
 * 作品画像を product_images テーブルに保存
 */
async function saveProductImages(
  productId: number,
  thumbnailUrl?: string,
  sampleImages?: string[],
): Promise<void> {
  if (!thumbnailUrl && (!sampleImages || sampleImages.length === 0)) {
    return;
  }

  const db = getDb();

  try {
    // Save thumbnail as first image
    if (thumbnailUrl) {
      const existing = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.productId, productId),
            eq(productImages.imageUrl, thumbnailUrl),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(productImages).values({
          productId,
          imageUrl: thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: SOURCE_NAME,
        });
        console.log(`  Saved thumbnail image to product_images`);
      }
    }

    // Save sample images
    if (sampleImages && sampleImages.length > 0) {
      for (let i = 0; i < sampleImages.length; i++) {
        const imageUrl = sampleImages[i];

        const existing = await db
          .select()
          .from(productImages)
          .where(
            and(
              eq(productImages.productId, productId),
              eq(productImages.imageUrl, imageUrl),
            ),
          )
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
      console.log(`  Saved ${sampleImages.length} sample image(s) to product_images`);
    }
  } catch (error) {
    console.error('Error saving product images:', error);
    throw error;
  }
}

/**
 * サンプル動画を product_videos テーブルに保存
 */
async function saveProductVideo(
  productId: number,
  sampleVideoUrl?: string,
): Promise<void> {
  if (!sampleVideoUrl) {
    return;
  }

  const db = getDb();

  try {
    // 既存チェック
    const existing = await db
      .select()
      .from(productVideos)
      .where(
        and(
          eq(productVideos.productId, productId),
          eq(productVideos.videoUrl, sampleVideoUrl),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(productVideos).values({
        productId,
        videoUrl: sampleVideoUrl,
        videoType: 'sample',
        displayOrder: 0,
        aspName: SOURCE_NAME,
      });
      console.log(`  🎬 Saved sample video to product_videos`);
    }
  } catch (error) {
    console.error('Error saving product video:', error);
    throw error;
  }
}

/**
 * レビュー情報をデータベースに保存
 */
async function saveProductReviews(
  productId: number,
  reviews?: MgsReview[],
  ratingSummary?: MgsRatingSummary,
): Promise<void> {
  const db = getDb();

  try {
    // レビューサマリーを保存
    if (ratingSummary) {
      const existing = await db
        .select()
        .from(productRatingSummary)
        .where(
          and(
            eq(productRatingSummary.productId, productId),
            eq(productRatingSummary.aspName, SOURCE_NAME),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // 更新
        await db
          .update(productRatingSummary)
          .set({
            averageRating: String(ratingSummary.averageRating),
            maxRating: String(ratingSummary.maxRating),
            totalReviews: ratingSummary.totalReviews,
            lastUpdated: new Date(),
          })
          .where(eq(productRatingSummary.id, existing[0].id));
      } else {
        // 新規挿入
        await db.insert(productRatingSummary).values({
          productId,
          aspName: SOURCE_NAME,
          averageRating: String(ratingSummary.averageRating),
          maxRating: String(ratingSummary.maxRating),
          totalReviews: ratingSummary.totalReviews,
        });
      }
      console.log(`  ⭐ Saved rating summary: ${ratingSummary.averageRating}/${ratingSummary.maxRating}`);
    }

    // 個別レビューを保存
    if (reviews && reviews.length > 0) {
      let savedCount = 0;
      for (const review of reviews) {
        // レビュアー名とコンテンツの組み合わせで重複チェック（source_review_idがないため）
        const sourceReviewId = crypto
          .createHash('md5')
          .update(`${review.reviewerName}:${review.content.substring(0, 100)}`)
          .digest('hex');

        const existing = await db
          .select()
          .from(productReviews)
          .where(
            and(
              eq(productReviews.productId, productId),
              eq(productReviews.aspName, SOURCE_NAME),
              eq(productReviews.sourceReviewId, sourceReviewId),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await db.insert(productReviews).values({
            productId,
            aspName: SOURCE_NAME,
            reviewerName: review.reviewerName,
            rating: String(review.rating),
            maxRating: '5',
            title: review.title || null,
            content: review.content,
            sourceReviewId,
          });
          savedCount++;
        }
      }
      if (savedCount > 0) {
        console.log(`  📝 Saved ${savedCount} new review(s)`);
      }
    }
  } catch (error) {
    console.error('Error saving product reviews:', error);
    throw error;
  }
}

/**
 * AI機能を使って説明文とタグを生成
 */
async function generateAIContent(
  mgsProduct: MgsProduct,
  enableAI: boolean = true,
): Promise<{ aiDescription?: GeneratedDescription; aiTags?: MgsProduct['aiTags'] }> {
  if (!enableAI) {
    return {};
  }

  console.log('  🤖 AI機能を実行中...');

  // AI説明文生成
  let aiDescription: GeneratedDescription | undefined;
  try {
    const result = await generateProductDescription({
      title: mgsProduct.title,
      originalDescription: mgsProduct.description,
      performers: mgsProduct.performerNames,
      genres: mgsProduct.genres,
      reviews: mgsProduct.reviews?.map(r => ({
        rating: r.rating,
        comment: r.content,
      })),
    });

    if (result) {
      aiDescription = result;
      console.log(`    ✅ AI説明文生成完了`);
      console.log(`       キャッチコピー: ${result.catchphrase}`);
    }
  } catch (error) {
    console.error('    ❌ AI説明文生成エラー:', error);
  }

  // AIタグ抽出
  let aiTags: MgsProduct['aiTags'];
  try {
    const tags = await extractProductTags(mgsProduct.title, mgsProduct.description);
    if (tags.genres.length > 0 || tags.attributes.length > 0 || tags.plays.length > 0 || tags.situations.length > 0) {
      aiTags = tags;
      console.log(`    ✅ AIタグ抽出完了`);
      console.log(`       ジャンル: ${tags.genres.join(', ') || 'なし'}`);
      console.log(`       属性: ${tags.attributes.join(', ') || 'なし'}`);
    }
  } catch (error) {
    console.error('    ❌ AIタグ抽出エラー:', error);
  }

  return { aiDescription, aiTags };
}

/**
 * AI生成データをDBに保存
 */
async function saveAIContent(
  productId: number,
  aiDescription?: GeneratedDescription,
  aiTags?: MgsProduct['aiTags'],
): Promise<void> {
  if (!aiDescription && !aiTags) {
    return;
  }

  const db = getDb();

  try {
    const updateData: Record<string, any> = {};

    if (aiDescription) {
      updateData.aiDescription = JSON.stringify(aiDescription);
      updateData.aiCatchphrase = aiDescription.catchphrase;
      updateData.aiShortDescription = aiDescription.shortDescription;
    }

    if (aiTags) {
      updateData.aiTags = JSON.stringify(aiTags);
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId));
      console.log(`  💾 AI生成データを保存しました`);
    }
  } catch (error) {
    // カラムがない場合はスキップ（マイグレーション前）
    console.warn('  ⚠️ AI生成データの保存をスキップ（カラム未作成の可能性）');
  }
}

/**
 * 翻訳機能を使ってタイトルと説明を多言語翻訳
 */
async function translateAndSave(
  productId: number,
  title: string,
  description?: string,
  enableAI: boolean = true,
): Promise<void> {
  if (!enableAI) {
    return;
  }

  console.log('  🌐 翻訳処理を実行中...');

  try {
    const translation = await translateProduct(title, description);
    if (!translation) {
      console.log('    ⚠️ 翻訳結果が取得できませんでした');
      return;
    }

    const db = getDb();
    const updateData: Record<string, any> = {};

    if (translation.en) {
      updateData.titleEn = translation.en.title;
      if (translation.en.description) {
        updateData.descriptionEn = translation.en.description;
      }
      console.log(`    EN: ${translation.en.title.slice(0, 50)}...`);
    }

    if (translation.zh) {
      updateData.titleZh = translation.zh.title;
      if (translation.zh.description) {
        updateData.descriptionZh = translation.zh.description;
      }
      console.log(`    ZH: ${translation.zh.title.slice(0, 50)}...`);
    }

    if (translation.ko) {
      updateData.titleKo = translation.ko.title;
      if (translation.ko.description) {
        updateData.descriptionKo = translation.ko.description;
      }
      console.log(`    KO: ${translation.ko.title.slice(0, 50)}...`);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId));
      console.log(`  💾 翻訳データを保存しました`);
    }
  } catch (error) {
    console.error('  ❌ 翻訳エラー:', error);
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  // オプション解析
  const enableAI = !args.includes('--no-ai');
  const urls = args.filter(arg => !arg.startsWith('--'));

  if (urls.length === 0) {
    console.log('Usage: npx tsx scripts/crawlers/crawl-mgs.ts [options] <product-url> [<product-url> ...]');
    console.log('');
    console.log('Options:');
    console.log('  --no-ai  AI説明文生成をスキップ');
    console.log('');
    console.log('Example: npx tsx scripts/crawlers/crawl-mgs.ts https://www.mgstage.com/product/product_detail/857OMG-018/');
    process.exit(1);
  }

  console.log(`Starting MGS affiliate crawler for ${urls.length} product(s)...`);
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);

  for (const url of urls) {
    try {
      console.log(`\n--- Processing: ${url} ---`);

      // 商品ページをクロール
      const mgsProduct = await crawlMgsProduct(url);
      if (!mgsProduct) {
        console.error(`Failed to crawl product: ${url}`);
        continue;
      }

      // HTMLを保存（将来的な再解析のため）
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'adc=1',  // Age verification cookie
        },
      });
      const html = await response.text();
      await saveRawHtmlData(mgsProduct.productId, url, html);

      // アフィリエイトリンクを保存してproductIdを取得
      const db = getDb();
      const normalizedProductId = mgsProduct.productId.toLowerCase();
      let productRecord = await db
        .select()
        .from(products)
        .where(eq(products.normalizedProductId, normalizedProductId))
        .limit(1);

      // アフィリエイトリンクを保存
      await saveAffiliateLink(mgsProduct);

      // 再度productRecordを取得（新規作成された場合のため）
      productRecord = await db
        .select()
        .from(products)
        .where(eq(products.normalizedProductId, normalizedProductId))
        .limit(1);

      if (productRecord.length > 0) {
        const productId = productRecord[0].id;

        // 女優データを保存
        if (mgsProduct.performerNames && mgsProduct.performerNames.length > 0) {
          await savePerformers(productId, mgsProduct.performerNames);
        }

        // 画像URLを決定（HTMLから取得できなかった場合はパターンベースで生成）
        const thumbnailUrl = mgsProduct.thumbnailUrl || generateMgsImageUrlFallback(mgsProduct.productId);

        // product_imagesにサムネイルとサンプル画像を保存
        await saveProductImages(productId, thumbnailUrl, mgsProduct.sampleImages);

        // product_videosにサンプル動画を保存
        await saveProductVideo(productId, mgsProduct.sampleVideoUrl);

        // レビュー情報を保存
        await saveProductReviews(productId, mgsProduct.reviews, mgsProduct.ratingSummary);

        // セール情報を保存
        if (mgsProduct.saleInfo) {
          const saved = await saveSaleInfo(SOURCE_NAME, mgsProduct.productId, mgsProduct.saleInfo);
          if (saved) {
            console.log(`  💰 Saved sale info to database`);
          }
        }

        // AI機能: 説明文生成とタグ抽出
        if (enableAI) {
          const { aiDescription, aiTags } = await generateAIContent(mgsProduct, enableAI);
          await saveAIContent(productId, aiDescription, aiTags);
        }

        // 翻訳機能: タイトルと説明を多言語翻訳
        if (enableAI) {
          await translateAndSave(productId, mgsProduct.title, mgsProduct.description, enableAI);
        }

        // products.defaultThumbnailUrlを更新
        if (thumbnailUrl) {
          await db
            .update(products)
            .set({ defaultThumbnailUrl: thumbnailUrl })
            .where(eq(products.id, productId));
          console.log(`  Updated products.defaultThumbnailUrl`);
        }

        // MGSタグと紐付け
        await linkMgsTag(productId);
      }

      console.log(`✓ Successfully processed: ${mgsProduct.productId}`);

      // レート制限対策（1秒待機）
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
