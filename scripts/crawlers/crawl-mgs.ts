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
import { rawHtmlData, productSources, products, performers, productPerformers, tags, productTags, productImages, productVideos } from '../../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { validateProductData } from '../../lib/crawler-utils';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ'; // MGSアフィリエイトコード
const SOURCE_NAME = 'MGS';

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

    // 価格を抽出
    let price: number | undefined;
    const priceText = $('th:contains("価格")').next('td').text().trim();
    const priceMatch = priceText.match(/(\d+(?:,\d+)*)/);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/,/g, ''));
    }

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
    };
  } catch (error) {
    console.error('Error crawling MGS product:', error);
    return null;
  }
}

/**
 * 生HTMLデータをデータベースに保存
 */
async function saveRawHtmlData(
  productId: string,
  url: string,
  htmlContent: string,
): Promise<void> {
  const db = getDb();
  const hash = crypto.createHash('sha256').update(htmlContent).digest('hex');

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

      // 更新
      await db
        .update(rawHtmlData)
        .set({
          htmlContent,
          hash,
          crawledAt: new Date(),
          processedAt: null, // 再処理が必要
        })
        .where(eq(rawHtmlData.id, existing[0].id));

      console.log(`Product ${productId} - Updated raw HTML`);
    } else {
      // 新規挿入
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId,
        url,
        htmlContent,
        hash,
      });

      console.log(`Product ${productId} - Saved raw HTML`);
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
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/crawl-mgs.ts <product-url> [<product-url> ...]');
    console.log('Example: npx tsx scripts/crawl-mgs.ts https://www.mgstage.com/product/product_detail/857OMG-018/');
    process.exit(1);
  }

  console.log(`Starting MGS affiliate crawler for ${args.length} product(s)...`);

  for (const url of args) {
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

        // product_imagesにサムネイルとサンプル画像を保存
        await saveProductImages(productId, mgsProduct.thumbnailUrl, mgsProduct.sampleImages);

        // product_videosにサンプル動画を保存
        await saveProductVideo(productId, mgsProduct.sampleVideoUrl);

        // products.defaultThumbnailUrlを更新
        if (mgsProduct.thumbnailUrl) {
          await db
            .update(products)
            .set({ defaultThumbnailUrl: mgsProduct.thumbnailUrl })
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
