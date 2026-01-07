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
import { getDb } from '../lib/db';
import { rawHtmlData, productSources, products, performers, productPerformers, tags, productTags, productImages, productVideos, productReviews, productRatingSummary } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../lib/performer-validation';
import { validateProductData, isTopPageHtml, savePerformersWithWikiPriority } from '../lib/crawler-utils';
import { getAIHelper, type AIProcessingResult } from '../lib/crawler';
import type { GeneratedDescription } from '../lib/google-apis';
import { translateProductLingva, ProductTranslation } from '../lib/translate';
import { saveRawHtml, calculateHash } from '../lib/gcs-crawler-helper';
import { saveSaleInfo, SaleInfo } from '../lib/sale-helper';
import { buildPriceInfoList, saveProductPricesBySourceId } from '../lib/price-helper';
import { getMgsPath, getMakerByProductCode } from '../lib/maker-mapping';
import { mgsFetch, getProxyInfo } from '../lib/proxy-fetch';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ'; // MGSアフィリエイトコード
const SOURCE_NAME = 'MGS';

/**
 * MGS商品IDをパース
 */
function parseMgsProductId(originalProductId: string): { series: string; num: string } | null {
  // パターン1: STARS-865 or STARS865
  let match = originalProductId.match(/^([A-Z]+)-?(\d+)$/);
  if (match && match[1] && match[2]) {
    return { series: match[1], num: match[2] };
  }

  // パターン2: 300MIUM1359 (数字プレフィックス付き)
  match = originalProductId.match(/^(\d+[A-Z]+)(\d+)$/);
  if (match && match[1] && match[2]) {
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
  const makerPath = getMgsPath(series);

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
  price?: number; // 代表価格
  downloadPrice?: number; // ダウンロード版価格
  streamingPrice?: number; // ストリーミング版価格
  hdPrice?: number; // HD版価格
  saleInfo?: SaleInfo; // セール情報
  reviews?: MgsReview[]; // レビュー情報
  ratingSummary?: MgsRatingSummary; // 評価サマリー
  description?: string; // 元の説明文
  genres?: string[]; // ジャンル
  duration?: number; // 再生時間（分）
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
 * MGSアフィリエイトリンクURLを生成
 * MGSの商品ページURLにアフィリエイトパラメータを付加
 */
function generateAffiliateUrl(productId: string): string {
  // MGS商品ページへの直接リンク（アフィリエイトパラメータ付き）
  return `https://www.mgstage.com/product/product_detail/${productId}/?af_id=${AFFILIATE_CODE}`;
}

/**
 * MGS商品ページをクロール
 */
async function crawlMgsProduct(productUrl: string): Promise<MgsProduct | null> {
  try {
    console.log(`Crawling: ${productUrl}`);

    // Proxy対応のmgsFetchを使用（年齢確認Cookie自動付与）
    const response = await mgsFetch(productUrl);

    if (!response.ok) {
      console.error(`HTTP error! status: ${response['status']}`);
      return null;
    }

    const html = await response['text']();
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

    // パターン1: #sample-photo 内のaタグのhrefから拡大画像URLを取得
    // MGSでは <a class="sample_image" href="拡大画像URL"><img src="サムネイルURL"></a> の形式
    // IDセレクタを使用（.sample-photoではなく#sample-photo）
    $('#sample-photo a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !shouldExcludeImage(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン2: a.sample_image からも取得（クラスセレクタ）
    $('a.sample_image').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !shouldExcludeImage(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン3: pics/やsampleを含むリンクのhrefから拡大画像URLを取得
    $('a[href*="pics/"], a[href*="/sample/"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && href.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const fullUrl = href.startsWith('http') ? href : `https://www.mgstage.com${href}`;
        if (!sampleImages.includes(fullUrl) && fullUrl !== thumbnailUrl && !shouldExcludeImage(fullUrl)) {
          sampleImages.push(fullUrl);
        }
      }
    });

    // パターン4: フォールバック - imgタグのsrcを使用（拡大版がない場合のみ）
    if (sampleImages.length === 0) {
      $('.sample-photo img, .sample-box img, .sample-image img, .product-sample img').each((_, elem) => {
        const imgSrc = $(elem).attr('src') || $(elem).attr('data-src');
        if (imgSrc && !shouldExcludeImage(imgSrc)) {
          const fullUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.mgstage.com${imgSrc}`;
          if (!sampleImages.includes(fullUrl)) {
            sampleImages.push(fullUrl);
          }
        }
      });
    }

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
        if (sampleUrlMatch && sampleUrlMatch[1]) {
          sampleVideoUrl = sampleUrlMatch[1].startsWith('http')
            ? sampleUrlMatch[1]
            : `https://www.mgstage.com${sampleUrlMatch[1]}`;
        }
      }
    }

    // パターン5: a.button_sample サンプルプレイヤーへのリンク
    if (!sampleVideoUrl) {
      const samplePlayerLink = $('a.button_sample[href*="sampleplayer"]').attr('href');
      if (samplePlayerLink) {
        sampleVideoUrl = samplePlayerLink.startsWith('http')
          ? samplePlayerLink
          : `https://www.mgstage.com${samplePlayerLink}`;
      }
    }

    // パターン6: p.sample_movie_btn 内のリンク
    if (!sampleVideoUrl) {
      const sampleMovieBtnLink = $('p.sample_movie_btn a[href*="sampleplayer"]').attr('href');
      if (sampleMovieBtnLink) {
        sampleVideoUrl = sampleMovieBtnLink.startsWith('http')
          ? sampleMovieBtnLink
          : `https://www.mgstage.com${sampleMovieBtnLink}`;
      }
    }

    if (sampleVideoUrl) {
      console.log(`  Found sample video: ${sampleVideoUrl}`);
    }

    // 価格を抽出（通常価格とセール価格）
    // MGS uses div.price_list with radio buttons containing price info
    // Pattern: <input type="radio" name="price" value="download_hd,0,...,SIRO-5561,1480">
    // Also: <span id="download_hd_price">1,480円(税込)</span>
    let price: number | undefined;
    let downloadPrice: number | undefined;
    let streamingPrice: number | undefined;
    let hdPrice: number | undefined;
    let saleInfo: SaleInfo | undefined;

    // HD版ダウンロード価格
    const downloadHdPriceText = $('#download_hd_price').text().trim();
    if (downloadHdPriceText) {
      const priceMatch = downloadHdPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch && priceMatch[1]) {
        hdPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        console.log(`  💰 HD download price: ¥${hdPrice.toLocaleString()}`);
      }
    }

    // radio buttonからHD価格を抽出（フォールバック）
    if (!hdPrice) {
      const priceInput = $('input[name="price"][id="download_hd_btn"]');
      const priceValue = priceInput.attr('value');
      if (priceValue) {
        // Format: download_hd,0,uuid,PRODUCT-ID,1480
        const parts = priceValue.split(',');
        if (parts.length >= 5 && parts[4]) {
          const extractedPrice = parseInt(parts[4], 10);
          if (!isNaN(extractedPrice) && extractedPrice > 0) {
            hdPrice = extractedPrice;
            console.log(`  💰 HD price from radio: ¥${hdPrice.toLocaleString()}`);
          }
        }
      }
    }

    // 通常ダウンロード価格（SD版）
    const downloadSdPriceText = $('#download_sd_price').text().trim();
    if (downloadSdPriceText) {
      const priceMatch = downloadSdPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch && priceMatch[1]) {
        downloadPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        console.log(`  💰 SD download price: ¥${downloadPrice.toLocaleString()}`);
      }
    }

    // radio buttonからSD価格を抽出（フォールバック）
    if (!downloadPrice) {
      const priceInput = $('input[name="price"][id="download_sd_btn"]');
      const priceValue = priceInput.attr('value');
      if (priceValue) {
        const parts = priceValue.split(',');
        if (parts.length >= 5 && parts[4]) {
          const extractedPrice = parseInt(parts[4], 10);
          if (!isNaN(extractedPrice) && extractedPrice > 0) {
            downloadPrice = extractedPrice;
          }
        }
      }
    }

    // ストリーミング価格
    const streamingPriceText = $('#streaming_price').text().trim();
    if (streamingPriceText) {
      const priceMatch = streamingPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch && priceMatch[1]) {
        streamingPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        console.log(`  💰 Streaming price: ¥${streamingPrice.toLocaleString()}`);
      }
    }

    // 代表価格を決定: HD > SD > Streaming
    price = hdPrice || downloadPrice || streamingPrice;

    // 価格ログ出力（デバッグ用）
    if (downloadPrice || streamingPrice || hdPrice) {
      console.log(`  💴 価格: DL=${downloadPrice || '-'}, Stream=${streamingPrice || '-'}, HD=${hdPrice || '-'}円`);
    }

    // Check for sale prices (del/strike elements with original price)
    const priceListDiv = $('div.price_list');
    const delPrice = priceListDiv.find('del, .price_del, s, strike').text().trim();
    const delPriceMatch = delPrice.match(/(\d+(?:,\d+)*)/);

    if (delPriceMatch && delPriceMatch[1] && price) {
      const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''), 10);
      if (price < regularPrice) {
        // This is a sale
        const discountPercent = Math.round((1 - price / regularPrice) * 100);

        // セール終了日時を抽出
        let saleEndAt: Date | undefined;

        // パターン1: "○月○日まで" または "M/D まで"
        const endDatePattern1 = html.match(/(\d{1,2})[月\/](\d{1,2})日?\s*(まで|迄)/);
        if (endDatePattern1 && endDatePattern1[1] && endDatePattern1[2]) {
          const month = parseInt(endDatePattern1[1], 10);
          const day = parseInt(endDatePattern1[2], 10);
          const now = new Date();
          let year = now.getFullYear();
          // 過去の日付なら来年
          const candidateDate = new Date(year, month - 1, day, 23, 59, 59);
          if (candidateDate < now) {
            year += 1;
          }
          saleEndAt = new Date(year, month - 1, day, 23, 59, 59);
        }

        // パターン2: "YYYY/MM/DD" または "YYYY-MM-DD"
        if (!saleEndAt) {
          const endDatePattern2 = html.match(/(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2}).*?(まで|迄|終了)/);
          if (endDatePattern2 && endDatePattern2[1] && endDatePattern2[2] && endDatePattern2[3]) {
            const year = parseInt(endDatePattern2[1], 10);
            const month = parseInt(endDatePattern2[2], 10);
            const day = parseInt(endDatePattern2[3], 10);
            saleEndAt = new Date(year, month - 1, day, 23, 59, 59);
          }
        }

        // パターン3: "○日○時間" の残り時間表示
        if (!saleEndAt) {
          const remainingPattern = html.match(/残り\s*(\d+)\s*日\s*(\d+)?\s*時間?/);
          if (remainingPattern && remainingPattern[1]) {
            const days = parseInt(remainingPattern[1], 10);
            const hours = remainingPattern[2] ? parseInt(remainingPattern[2], 10) : 0;
            saleEndAt = new Date(Date.now() + (days * 24 + hours) * 60 * 60 * 1000);
          }
        }

        // パターン4: セールバナー/アイコン内のテキスト
        if (!saleEndAt) {
          const saleBannerText = $('.sale_end, .campaign_end, .timesale_end, .sale_period').text();
          const bannerMatch = saleBannerText.match(/(\d{1,2})[月\/](\d{1,2})/);
          if (bannerMatch && bannerMatch[1] && bannerMatch[2]) {
            const month = parseInt(bannerMatch[1], 10);
            const day = parseInt(bannerMatch[2], 10);
            const now = new Date();
            let year = now.getFullYear();
            const candidateDate = new Date(year, month - 1, day, 23, 59, 59);
            if (candidateDate < now) {
              year += 1;
            }
            saleEndAt = new Date(year, month - 1, day, 23, 59, 59);
          }
        }

        saleInfo = {
          regularPrice,
          salePrice: price,
          discountPercent,
          saleType: 'timesale',
          ...(saleEndAt && { endAt: saleEndAt }),
        };

        const endAtStr = saleEndAt ? ` (〜${saleEndAt.toLocaleDateString('ja-JP')})` : '';
        console.log(`  💰 Sale detected: ¥${regularPrice.toLocaleString()} → ¥${price.toLocaleString()} (${discountPercent}% OFF)${endAtStr}`);
      }
    }

    // Legacy fallback: old method using th:contains("価格")
    if (!price) {
      const priceTd = $('th:contains("価格")').next('td');
      const priceText = priceTd.text().trim();
      const priceMatch = priceText.match(/(\d+(?:,\d+)*)/g);
      if (priceMatch && priceMatch[0]) {
        price = parseInt(priceMatch[0].replace(/,/g, ''), 10);
        console.log(`  💰 Found legacy price: ¥${price.toLocaleString()}`);
      }
    }

    // レビュー情報を抽出
    let ratingSummary: MgsRatingSummary | undefined;
    const reviews: MgsReview[] = [];

    // 平均評価を抽出
    // パターン: (5点満点中 4.6点 / レビュー数 5 件)
    const reviewSummaryText = $('.user_review_head .detail').text();
    const summaryMatch = reviewSummaryText.match(/(\d+)点満点中\s*([\d.]+)点.*レビュー数\s*(\d+)\s*件/);
    if (summaryMatch && summaryMatch[1] && summaryMatch[2] && summaryMatch[3]) {
      ratingSummary = {
        maxRating: parseInt(summaryMatch[1], 10),
        averageRating: parseFloat(summaryMatch[2]),
        totalReviews: parseInt(summaryMatch[3], 10),
      };
      console.log(`  Found rating summary: ${ratingSummary.averageRating}/${ratingSummary.maxRating} (${ratingSummary.totalReviews} reviews)`);
    }

    // 個別レビューを抽出
    // MGSのHTML構造: <div class="user_date"><p class="name">...</p><p class="review"><span class="star_XX"></span></p></div><p class="text">...</p>
    // 通常レビュー + アコーディオン内レビューの両方を取得
    $('#user_review .user_date').each((_, elem) => {
      const $userDate = $(elem);

      // レビュアー名 (例: "カカシさんのレビュー" → "カカシ")
      const reviewerNameText = $userDate.find('.name').text().trim();
      const reviewerNameMatch = reviewerNameText.match(/^(.+?)さんのレビュー$/);
      const reviewerName = (reviewerNameMatch && reviewerNameMatch[1]) ? reviewerNameMatch[1] : reviewerNameText.replace(/さんのレビュー$/, '');

      // 評価（star_XX_XX または star_XX クラスから）
      // star_50 = 5.0, star_40_44 = 4.0-4.4 (実質4.0)
      const starClass = $userDate.find('p.review span[class^="star_"]').attr('class') || '';
      let rating = 0;
      const starMatch = starClass.match(/star_(\d+)(?:_(\d+))?/);
      if (starMatch && starMatch[1]) {
        // star_50 → 5.0, star_40_44 → 4.0
        rating = parseInt(starMatch[1], 10) / 10;
      }

      // レビュー内容（user_dateの次の兄弟要素p.text）
      const $textElem = $userDate.nextAll('p.text').first();
      const contentHtml = $textElem.html() || '';
      const content = contentHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

      if (reviewerName && content) {
        // 重複チェック（同じ投稿者・同じ内容の先頭50文字）
        const isDuplicate = reviews.some(
          r => r.reviewerName === reviewerName && r.content.substring(0, 50) === content.substring(0, 50)
        );
        if (!isDuplicate) {
          reviews.push({
            reviewerName,
            rating,
            content,
          });
        }
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

    // 再生時間を抽出
    let duration: number | undefined;
    // パターン1: th:contains("収録時間") から抽出
    const durationCell = $('th:contains("収録時間")').next('td').text().trim();
    if (durationCell) {
      const durationMatch = durationCell.match(/(\d+)\s*分/);
      if (durationMatch && durationMatch[1]) {
        duration = parseInt(durationMatch[1], 10);
      }
    }
    // パターン2: HTMLテキストから正規表現でフォールバック
    if (!duration) {
      const durationRegex = /収録時間[：:]\s*(\d+)\s*分/;
      const match = html.match(durationRegex);
      if (match && match[1]) {
        duration = parseInt(match[1], 10);
      }
    }
    // パターン3: "再生時間" 表記のフォールバック
    if (!duration) {
      const playTimeCell = $('th:contains("再生時間")').next('td').text().trim();
      if (playTimeCell) {
        const playTimeMatch = playTimeCell.match(/(\d+)\s*分/);
        if (playTimeMatch && playTimeMatch[1]) {
          duration = parseInt(playTimeMatch[1], 10);
        }
      }
    }

    if (duration) {
      console.log(`  Duration: ${duration} minutes`);
    }

    return {
      productId: productId!,
      url: productUrl, // Keep original product URL for reference
      title,
      ...(releaseDate && { releaseDate }),
      ...(performerNames.length > 0 && { performerNames }),
      ...(thumbnailUrl && { thumbnailUrl }),
      ...(sampleImages.length > 0 && { sampleImages }),
      ...(sampleVideoUrl && { sampleVideoUrl }),
      ...(price !== undefined && { price }),
      ...(downloadPrice !== undefined && { downloadPrice }),
      ...(streamingPrice !== undefined && { streamingPrice }),
      ...(hdPrice !== undefined && { hdPrice }),
      ...(saleInfo && { saleInfo }),
      ...(reviews.length > 0 && { reviews }),
      ...(ratingSummary && { ratingSummary }),
      ...(description && { description }),
      ...(genres.length > 0 && { genres }),
      ...(duration !== undefined && { duration }),
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

    if (existing.length > 0 && existing[0]) {
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
        .where(eq(rawHtmlData.id, existing[0]!['id']));

      console.log(`Product ${productId} - Updated raw HTML${gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      // GCS保存を試みる
      const { gcsUrl, htmlContent } = await saveRawHtml('mgs', productId, html);

      // 新規挿入
      await db['insert'](rawHtmlData).values({
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
          description: mgsProduct.description || undefined,
          releaseDate: mgsProduct.releaseDate || undefined,
          duration: mgsProduct.duration,
        })
        .returning();

      productId = newProduct!.id;
      console.log(`Created new product: ${normalizedProductId}${mgsProduct.duration ? ` (${mgsProduct.duration}分)` : ''}`);
    } else {
      productId = productRecord[0]!['id'];
      // 既存作品のduration・descriptionが未設定の場合は更新
      const updateData: { duration?: number; description?: string } = {};
      if (mgsProduct.duration && !productRecord[0]!['duration']) {
        updateData['duration'] = mgsProduct.duration;
      }
      if (mgsProduct.description && !productRecord[0]!['description']) {
        updateData['description'] = mgsProduct.description;
      }
      if (Object.keys(updateData).length > 0) {
        await db
          .update(products)
          .set(updateData)
          .where(eq(products['id'], productId));
        if (updateData['duration']) console.log(`  Updated duration: ${updateData['duration']}分`);
        if (updateData['description']) console.log(`  Updated description: ${updateData['description'].substring(0, 50)}...`);
      }
    }

    // Generate affiliate URL for MGS
    const affiliateUrl = generateAffiliateUrl(mgsProduct.productId);

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

    let sourceId: number;
    if (existing.length > 0 && existing[0]) {
      // 更新
      sourceId = existing[0]['id'];
      await db
        .update(productSources)
        .set({
          affiliateUrl: affiliateUrl,
          originalProductId: mgsProduct.productId,
          price: mgsProduct.price,
          lastUpdated: new Date(),
        })
        .where(eq(productSources.id, sourceId));

      console.log(`Updated affiliate link for product ${productId}${mgsProduct.price ? ` (¥${mgsProduct.price.toLocaleString()})` : ''}`);
    } else {
      // 新規挿入
      const [inserted] = await db['insert'](productSources).values({
        productId,
        aspName: SOURCE_NAME,
        originalProductId: mgsProduct.productId,
        affiliateUrl: affiliateUrl,
        price: mgsProduct.price,
        dataSource: 'HTML',
      }).returning({ id: productSources.id });
      sourceId = inserted!.id;

      console.log(`Saved affiliate link for product ${productId}${mgsProduct.price ? ` (¥${mgsProduct.price.toLocaleString()})` : ''}`);
    }

    // product_prices に価格タイプ別の価格を保存
    const priceList = buildPriceInfoList({
      ...(mgsProduct.downloadPrice !== undefined && { downloadPrice: mgsProduct.downloadPrice }),
      ...(mgsProduct.streamingPrice !== undefined && { streamingPrice: mgsProduct.streamingPrice }),
      ...(mgsProduct.hdPrice !== undefined && { hdPrice: mgsProduct.hdPrice }),
    });
    if (priceList.length > 0) {
      const priceResult = await saveProductPricesBySourceId(sourceId, priceList);
      console.log(`  ✓ 価格 ${priceResult.success}件を保存`);
    }
  } catch (error) {
    console.error('Error saving affiliate link:', error);
    throw error;
  }
}

/**
 * 女優データを保存して、作品と紐付け
 * wiki_crawl_dataから品番で演者名を検索し、見つかった場合はそれを優先使用
 */
async function savePerformers(
  productId: number,
  productCode: string,
  performerNames: string[],
): Promise<void> {
  const db = getDb();

  try {
    // wiki_crawl_data優先で演者を保存
    const savedCount = await savePerformersWithWikiPriority(
      db,
      productId,
      productCode,
      performerNames || [],
      'MGS'
    );

    if (savedCount > 0) {
      console.log(`  Saved ${savedCount} performer(s) to product ${productId}`);
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

      tagId = newTag!.id;
      console.log(`Created MGS tag with ID: ${tagId}`);
    } else {
      tagId = mgsTag[0]!['id'];
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
      await db['insert'](productTags).values({
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
        await db['insert'](productImages).values({
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
        const imageUrl = sampleImages[i]!;

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
          await db['insert'](productImages).values({
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
      await db['insert'](productVideos).values({
        productId,
        videoUrl: sampleVideoUrl,
        videoType: 'sample',
        displayOrder: 0,
        aspName: SOURCE_NAME,
      }).onConflictDoNothing();
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

      if (existing.length > 0 && existing[0]) {
        // 更新
        await db
          .update(productRatingSummary)
          .set({
            averageRating: String(ratingSummary.averageRating),
            maxRating: String(ratingSummary.maxRating),
            totalReviews: ratingSummary.totalReviews,
            lastUpdated: new Date(),
          })
          .where(eq(productRatingSummary.id, existing[0]['id']));
      } else {
        // 新規挿入
        await db['insert'](productRatingSummary).values({
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
          await db['insert'](productReviews).values({
            productId,
            aspName: SOURCE_NAME,
            reviewerName: review.reviewerName,
            rating: String(review['rating']),
            maxRating: '5',
            title: review['title'] || null,
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
 * AI機能を使って説明文とタグを生成（CrawlerAIHelper使用）
 */
async function generateAIContent(
  mgsProduct: MgsProduct,
  enableAI: boolean = true,
): Promise<{ aiDescription?: GeneratedDescription; aiTags?: MgsProduct['aiTags'] }> {
  if (!enableAI) {
    return {};
  }

  console.log('  🤖 AI機能を実行中...');

  const aiHelper = getAIHelper();
  const result = await aiHelper.processProduct(
    {
      title: mgsProduct.title,
      ...(mgsProduct.description && { description: mgsProduct.description }),
      ...(mgsProduct.performerNames && { performers: mgsProduct.performerNames }),
      ...(mgsProduct.genres && { genres: mgsProduct.genres }),
    },
    {
      extractTags: true,
      translate: false, // MGSはLingva翻訳を使うため
      generateDescription: true,
    }
  );

  // エラーがあれば警告
  if (result.errors.length > 0) {
    console.log(`    ⚠️ AI処理で一部エラー: ${result.errors.join(', ')}`);
  }

  let aiDescription: GeneratedDescription | undefined;
  let aiTags: MgsProduct['aiTags'];

  // AI説明文
  if (result['description']) {
    aiDescription = result['description'];
    console.log(`    ✅ AI説明文生成完了`);
    console.log(`       キャッチコピー: ${result['description'].catchphrase}`);
  }

  // AIタグ
  if (result.tags && (result.tags.genres.length > 0 || result.tags.attributes.length > 0 || result.tags.plays.length > 0 || result.tags.situations.length > 0)) {
    aiTags = result.tags;
    console.log(`    ✅ AIタグ抽出完了`);
    console.log(`       ジャンル: ${result.tags.genres.join(', ') || 'なし'}`);
    console.log(`       属性: ${result.tags.attributes.join(', ') || 'なし'}`);
  }

  return {
    ...(aiDescription && { aiDescription }),
    ...(aiTags && { aiTags }),
  };
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
      updateData['aiDescription'] = JSON.stringify(aiDescription);
      updateData['aiCatchphrase'] = aiDescription.catchphrase;
      updateData['aiShortDescription'] = aiDescription.shortDescription;
    }

    if (aiTags) {
      updateData['aiTags'] = JSON.stringify(aiTags);
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(products)
        .set(updateData)
        .where(eq(products['id'], productId));
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

  console.log('  🌐 翻訳処理を実行中（Lingva）...');

  try {
    const translation = await translateProductLingva(title, description);
    if (!translation) {
      console.log('    ⚠️ 翻訳結果が取得できませんでした');
      return;
    }

    const db = getDb();
    const updateData: Record<string, any> = {};

    if (translation.en) {
      updateData['titleEn'] = translation.en.title;
      if (translation.en.description) {
        updateData['descriptionEn'] = translation.en.description;
      }
      console.log(`    EN: ${translation.en.title.slice(0, 50)}...`);
    }

    if (translation.zh) {
      updateData['titleZh'] = translation.zh.title;
      if (translation.zh.description) {
        updateData['descriptionZh'] = translation.zh.description;
      }
      console.log(`    ZH: ${translation.zh.title.slice(0, 50)}...`);
    }

    if (translation.ko) {
      updateData['titleKo'] = translation.ko.title;
      if (translation.ko.description) {
        updateData['descriptionKo'] = translation.ko.description;
      }
      console.log(`    KO: ${translation.ko.title.slice(0, 50)}...`);
    }

    if (Object.keys(updateData).length > 0) {
      updateData['updatedAt'] = new Date();
      await db
        .update(products)
        .set(updateData)
        .where(eq(products['id'], productId));
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

      // HTMLを保存（将来的な再解析のため）- Proxy対応
      const response = await mgsFetch(url);
      const html = await response['text']();
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

      if (productRecord.length > 0 && productRecord[0]) {
        const productId = productRecord[0]['id'];

        // 女優データを保存（wiki_crawl_data優先）
        await savePerformers(productId, mgsProduct.productId, mgsProduct.performerNames || []);

        // 画像URLを決定（HTMLから取得できなかった場合はパターンベースで生成）
        const thumbnailUrl = mgsProduct.thumbnailUrl || generateMgsImageUrlFallback(mgsProduct.productId) || undefined;

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

        // products['defaultThumbnailUrl']を更新
        if (thumbnailUrl) {
          await db
            .update(products)
            .set({ defaultThumbnailUrl: thumbnailUrl })
            .where(eq(products['id'], productId));
          console.log(`  Updated products['defaultThumbnailUrl']`);
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
