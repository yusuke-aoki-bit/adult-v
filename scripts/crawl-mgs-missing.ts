/**
 * MGS欠落商品補完クローラー
 *
 * シリーズごとに商品ID（001, 002, ...）を直接アクセスして
 * 欠落している商品を取得する
 */

import * as cheerio from 'cheerio';
import { getDb } from '../packages/crawlers/src/lib/db';
import { rawHtmlData, productSources, products, performers, productPerformers, productImages, productVideos, tags, productTags } from '../packages/crawlers/src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { saveRawHtml, calculateHash } from '../packages/crawlers/src/lib/gcs-crawler-helper';
import crypto from 'crypto';

const AFFILIATE_CODE = '6CS5PGEBQDUYPZLHYEM33TBZFJ';
const BASE_URL = 'https://www.mgstage.com';
const SOURCE_NAME = 'MGS';

// 補完対象のシリーズと番号範囲
const SERIES_TO_FILL = [
  { prefix: 'EDD', start: 1, end: 200 },
  { prefix: 'MAN', start: 1, end: 100 },
  { prefix: 'ABP', start: 1, end: 50 },
  { prefix: 'ABS', start: 1, end: 50 },
  { prefix: 'CHN', start: 1, end: 50 },
];

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
  description?: string;
  genres?: string[];
}

async function checkProductExists(productId: string): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .select()
    .from(productSources)
    .where(and(eq(productSources.aspName, SOURCE_NAME), eq(productSources.originalProductId, productId)))
    .limit(1);
  return existing.length > 0;
}

async function fetchAndParseProduct(productId: string): Promise<{ product: MgsProduct | null; html: string | null }> {
  const url = `${BASE_URL}/product/product_detail/${productId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });

    if (!response.ok) {
      return { product: null, html: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 商品ページかどうか確認
    const title = $('h1.tag').text().trim();
    if (!title ||
        html.includes('お探しのページは見つかりませんでした') ||
        html.includes('ページが見つかりません') ||
        title.includes('MGS動画＜プレステージ グループ＞')) {
      return { product: null, html: null };
    }

    // リリース日
    const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
    const releaseDate = releaseDateText ? releaseDateText.replace(/\//g, '-') : undefined;

    // 出演者
    const performerNames: string[] = [];
    $('th:contains("出演")').next('td').find('a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name) performerNames.push(name);
    });

    // サムネイル
    const ogImage = $('meta[property="og:image"]').attr('content');
    const thumbnailUrl = ogImage ? (ogImage.startsWith('http') ? ogImage : `${BASE_URL}${ogImage}`) : undefined;

    // サンプル画像
    const sampleImages: string[] = [];
    $('#sample-photo a').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !href.includes('sample_button')) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        if (!sampleImages.includes(fullUrl)) sampleImages.push(fullUrl);
      }
    });

    // サンプル動画
    let sampleVideoUrl: string | undefined;
    const samplePlayerLink = $('a.button_sample[href*="sampleplayer"]').attr('href');
    if (samplePlayerLink) {
      sampleVideoUrl = samplePlayerLink.startsWith('http') ? samplePlayerLink : `${BASE_URL}${samplePlayerLink}`;
    }
    if (!sampleVideoUrl) {
      const sampleMovieBtnLink = $('p.sample_movie_btn a[href*="sampleplayer"]').attr('href');
      if (sampleMovieBtnLink) {
        sampleVideoUrl = sampleMovieBtnLink.startsWith('http') ? sampleMovieBtnLink : `${BASE_URL}${sampleMovieBtnLink}`;
      }
    }

    // 価格
    let price: number | undefined;
    const downloadHdPriceText = $('#download_hd_price').text().trim();
    if (downloadHdPriceText) {
      const priceMatch = downloadHdPriceText.match(/(\d+(?:,\d+)*)/);
      if (priceMatch) price = parseInt(priceMatch[1].replace(/,/g, ''));
    }

    // 説明
    const description = $('#introduction .introduction').text().trim() || undefined;

    // ジャンル
    const genres: string[] = [];
    $('th:contains("ジャンル")').next('td').find('a').each((_, elem) => {
      const genre = $(elem).text().trim();
      if (genre) genres.push(genre);
    });

    return {
      product: {
        productId,
        url,
        title,
        releaseDate,
        performerNames: performerNames.length > 0 ? performerNames : undefined,
        thumbnailUrl,
        sampleImages: sampleImages.length > 0 ? sampleImages : undefined,
        sampleVideoUrl,
        price,
        description,
        genres: genres.length > 0 ? genres : undefined,
      },
      html,
    };
  } catch (error) {
    return { product: null, html: null };
  }
}

async function saveProduct(mgsProduct: MgsProduct, html: string): Promise<void> {
  const db = getDb();
  const normalizedProductId = mgsProduct.productId.toLowerCase();

  try {
    const hash = calculateHash(html);

    // raw_html_data保存（GCSに保存し、DBにはHTMLを保存しない場合はgcsUrlのみ）
    let gcsUrl: string | undefined;
    try {
      const result = await saveRawHtml('mgs', mgsProduct.productId, html);
      gcsUrl = result.gcsUrl;
    } catch (e) {
      // GCS保存失敗時はDBにHTMLを保存
    }

    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(and(eq(rawHtmlData.source, SOURCE_NAME), eq(rawHtmlData.productId, mgsProduct.productId)))
      .limit(1);

    if (existingRaw.length > 0) {
      await db
        .update(rawHtmlData)
        .set({ htmlContent: html, gcsUrl, hash, crawledAt: new Date() })
        .where(eq(rawHtmlData.id, existingRaw[0].id));
    } else {
      await db.insert(rawHtmlData).values({
        source: SOURCE_NAME,
        productId: mgsProduct.productId,
        url: mgsProduct.url,
        htmlContent: html,
        gcsUrl,
        hash,
      });
    }

    // products保存
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
    } else {
      productId = productRecord[0].id;
    }

    // product_sources保存
    const affiliateWidget = `<div class="${crypto.randomBytes(4).toString('hex')}"></div><script id="mgs_Widget_affiliate" type="text/javascript" charset="utf-8" src="https://static.mgstage.com/mgs/script/common/mgs_Widget_affiliate.js?c=${AFFILIATE_CODE}&t=text&o=t&b=t&s=MOMO&p=${mgsProduct.productId}&from=ppv&class=mgs"></script>`;

    const existingSource = await db
      .select()
      .from(productSources)
      .where(and(eq(productSources.productId, productId), eq(productSources.aspName, SOURCE_NAME)))
      .limit(1);

    if (existingSource.length === 0) {
      await db.insert(productSources).values({
        productId,
        aspName: SOURCE_NAME,
        originalProductId: mgsProduct.productId,
        affiliateUrl: affiliateWidget,
        price: mgsProduct.price,
        productType: 'haishin',
        dataSource: 'HTML',
      });
    }

    // 出演者保存
    if (mgsProduct.performerNames) {
      for (const name of mgsProduct.performerNames) {
        const performerRecord = await db.select().from(performers).where(eq(performers.name, name)).limit(1);
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
      await db.insert(productImages).values({
        productId,
        imageUrl: mgsProduct.thumbnailUrl,
        imageType: 'thumbnail',
        displayOrder: 0,
        aspName: SOURCE_NAME,
      }).onConflictDoNothing();
    }

    if (mgsProduct.sampleImages) {
      for (let i = 0; i < mgsProduct.sampleImages.length; i++) {
        await db.insert(productImages).values({
          productId,
          imageUrl: mgsProduct.sampleImages[i],
          imageType: 'sample',
          displayOrder: i + 1,
          aspName: SOURCE_NAME,
        }).onConflictDoNothing();
      }
    }

    // 動画保存
    if (mgsProduct.sampleVideoUrl) {
      await db.insert(productVideos).values({
        productId,
        videoUrl: mgsProduct.sampleVideoUrl,
        videoType: 'sample',
        displayOrder: 0,
        aspName: SOURCE_NAME,
      }).onConflictDoNothing();
    }

  } catch (error) {
    console.error(`    ❌ Error saving ${mgsProduct.productId}:`, error);
  }
}

async function main() {
  console.log('=== MGS欠落商品補完クローラー ===\n');

  let totalChecked = 0;
  let totalNew = 0;
  let totalSkipped = 0;
  let totalNotFound = 0;

  for (const series of SERIES_TO_FILL) {
    console.log(`\n📂 シリーズ: ${series.prefix} (${series.start}〜${series.end})`);

    for (let num = series.start; num <= series.end; num++) {
      const productId = `${series.prefix}-${String(num).padStart(3, '0')}`;
      totalChecked++;

      // 既存チェック
      const exists = await checkProductExists(productId);
      if (exists) {
        totalSkipped++;
        continue;
      }

      process.stdout.write(`  ${productId}... `);

      // 取得
      const { product, html } = await fetchAndParseProduct(productId);

      if (!product || !html) {
        console.log('❌ Not found');
        totalNotFound++;
      } else {
        await saveProduct(product, html);
        console.log(`✅ ${product.title.slice(0, 30)}...`);
        totalNew++;
      }

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`チェック数: ${totalChecked}`);
  console.log(`新規追加: ${totalNew}`);
  console.log(`既存スキップ: ${totalSkipped}`);
  console.log(`存在しない: ${totalNotFound}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
