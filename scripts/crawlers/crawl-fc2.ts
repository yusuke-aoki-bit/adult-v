/**
 * FC2コンテンツマーケット クローラー
 *
 * 機能:
 * - FC2コンテンツマーケット (adult.contents.fc2.com) からHTMLをクロールして商品データを取得
 * - 商品詳細ページからメタデータを取得
 * - アフィリエイトURL: https://adult.contents.fc2.com/article/{商品ID}/?aid={アフィリエイトID}
 * - AI機能: Gemini APIによる説明文生成・タグ抽出（--no-aiオプションで無効化可能）
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fc2.ts [--limit 100] [--start 1] [--no-ai]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos, rawHtmlData } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData, isTopPageHtml } from '../../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { generateProductDescription, extractProductTags, GeneratedDescription, translateProduct } from '../../lib/google-apis';
import { saveSaleInfo, SaleInfo } from '../../lib/sale-helper';
import {
  upsertRawHtmlDataWithGcs,
  markRawDataAsProcessed,
} from '../../lib/crawler/dedup-helper';

const db = getDb();

// アフィリエイトID設定
// FC2 affiliate format: https://adult.contents.fc2.com/aff.php?aid={articleId}&affuid={base64_encoded_id}
const FC2_AFFUID = process.env.FC2_AFFUID || 'TVRFNU5USTJOVEE9';

interface FC2Product {
  articleId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleImages: string[];
  sampleVideoUrl?: string;
  releaseDate?: string;
  duration?: number;
  price?: number;
  saleInfo?: SaleInfo;
  category?: string;
  tags: string[];
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
 * アフィリエイトURLを生成
 * FC2 affiliate format: https://adult.contents.fc2.com/aff.php?aid={articleId}&affuid={base64_encoded_id}
 */
function generateAffiliateUrl(articleId: string): string {
  return `https://adult.contents.fc2.com/aff.php?aid=${articleId}&affuid=${FC2_AFFUID}`;
}

/**
 * 商品詳細ページをパース
 */
async function parseDetailPage(articleId: string, forceReprocess: boolean = false): Promise<{ product: FC2Product | null; rawDataId: number | null; shouldSkip: boolean }> {
  const url = `https://adult.contents.fc2.com/article/${articleId}/`;

  try {
    console.log(`  🔍 詳細ページ取得中: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`    ⚠️ 商品 ${articleId} が見つかりません (${response.status})`);
      return { product: null, rawDataId: null, shouldSkip: false };
    }

    const html = await response.text();

    // 生HTMLを保存（GCS優先 + 重複チェック）
    const upsertResult = await upsertRawHtmlDataWithGcs('FC2', articleId, url, html);

    // 重複チェック: 変更なし＆処理済みならスキップ
    if (upsertResult.shouldSkip && !forceReprocess) {
      console.log(`    ⏭️ スキップ(処理済み): ${articleId}`);
      return { product: null, rawDataId: upsertResult.id, shouldSkip: true };
    }

    if (upsertResult.isNew) {
      console.log(`    💾 保存完了${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      console.log(`    🔄 更新完了${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    }

    // レート制限
    await new Promise(resolve => setTimeout(resolve, 1000));

    // タイトル抽出
    let title = '';

    // パターン1: og:title meta tag
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].trim();
    }

    // パターン2: h1タグ
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }

    // パターン3: titleタグ
    if (!title) {
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTagMatch) {
        const parts = titleTagMatch[1].split(/[|\-]/);
        title = parts[0].trim();
      }
    }

    // フォールバック
    if (!title || title.length > 200) {
      title = `FC2-${articleId}`;
    }

    // 説明抽出
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) ||
                      html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 1000) : undefined;

    // 出演者抽出（共通バリデーション使用）
    const performersList: string[] = [];

    // パターン1: 出演者リンク
    const performerMatches = html.matchAll(/<a[^>]*href="[^"]*(?:actress|performer|cast)[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of performerMatches) {
      const rawName = match[1].trim();
      const normalizedName = normalizePerformerName(rawName);
      if (normalizedName &&
          !performersList.includes(normalizedName) &&
          isValidPerformerName(normalizedName) &&
          isValidPerformerForProduct(normalizedName, title)) {
        performersList.push(normalizedName);
      }
    }

    // パターン2: 出演ラベル後のテキスト
    if (performersList.length === 0) {
      const actorLabelMatch = html.match(/出演[者：:]\s*([^<\n]+)/i);
      if (actorLabelMatch) {
        const names = actorLabelMatch[1].split(/[,、\/]/).map(n => n.trim());
        for (const rawName of names.slice(0, 10)) {
          const normalizedName = normalizePerformerName(rawName);
          if (normalizedName &&
              !performersList.includes(normalizedName) &&
              isValidPerformerName(normalizedName) &&
              isValidPerformerForProduct(normalizedName, title)) {
            performersList.push(normalizedName);
          }
        }
      }
    }

    // サムネイル抽出
    const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
                       html.match(/<img[^>]*class="[^"]*(?:thumbnail|main)[^"]*"[^>]*src="([^"]+)"/i);
    const thumbnailUrl = thumbMatch ? thumbMatch[1] : undefined;

    // サンプル画像抽出
    const sampleImages: string[] = [];
    const sampleMatches = html.matchAll(/<img[^>]*src="([^"]*(?:sample|preview|capture)[^"]*)"/gi);
    for (const match of sampleMatches) {
      const imgUrl = match[1];
      if (!sampleImages.includes(imgUrl) && imgUrl.startsWith('http')) {
        sampleImages.push(imgUrl);
      }
    }

    // 再生時間抽出
    const durationMatch = html.match(/(\d+)\s*分/) || html.match(/(\d+)\s*min/i);
    const duration = durationMatch ? parseInt(durationMatch[1]) : undefined;

    // 価格抽出
    let price: number | undefined;
    let saleInfo: SaleInfo | undefined;

    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:円|pt|ポイント)/);
    price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined;

    // セール情報抽出 (FC2は通常価格と割引価格がある場合がある)
    // パターン1: 取り消し線の価格と新しい価格
    const delPriceMatch = html.match(/<(?:del|s|strike)[^>]*>\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)/i);
    if (delPriceMatch && price) {
      const regularPrice = parseInt(delPriceMatch[1].replace(/,/g, ''));
      if (regularPrice > price) {
        const discountMatch = html.match(/(\d+)\s*%\s*(?:OFF|オフ|off)/);
        saleInfo = {
          regularPrice,
          salePrice: price,
          discountPercent: discountMatch ? parseInt(discountMatch[1]) : Math.round((1 - price / regularPrice) * 100),
          saleType: 'sale',
        };
        console.log(`    💰 Sale detected: ¥${regularPrice.toLocaleString()} → ¥${price.toLocaleString()}`);
      }
    }

    // パターン2: 元の価格と割引価格
    if (!saleInfo) {
      const originalMatch = html.match(/(?:定価|通常|元)[価値:]?\s*(\d{1,3}(?:,\d{3})*)\s*(?:円|pt)/i);
      if (originalMatch && price) {
        const regularPrice = parseInt(originalMatch[1].replace(/,/g, ''));
        if (regularPrice > price) {
          saleInfo = {
            regularPrice,
            salePrice: price,
            discountPercent: Math.round((1 - price / regularPrice) * 100),
            saleType: 'sale',
          };
          console.log(`    💰 Sale detected: ¥${regularPrice.toLocaleString()} → ¥${price.toLocaleString()}`);
        }
      }
    }

    // タグ抽出
    const tags: string[] = [];
    const tagMatches = html.matchAll(/<a[^>]*href="[^"]*tag[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of tagMatches) {
      const tag = match[1].trim();
      if (tag && !tags.includes(tag) && tag.length < 30) {
        tags.push(tag);
      }
    }

    // カテゴリ抽出
    const categoryMatch = html.match(/カテゴリ[：:]\s*([^<\n]+)/i) ||
                          html.match(/<a[^>]*href="[^"]*category[^"]*"[^>]*>([^<]+)<\/a>/i);
    const category = categoryMatch ? categoryMatch[1].trim() : undefined;

    // サンプル動画URL抽出
    let sampleVideoUrl: string | undefined;

    // パターン1: video source タグ
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch) {
      sampleVideoUrl = videoSrcMatch[1];
    }

    // パターン2: data-src属性
    if (!sampleVideoUrl) {
      const dataSrcMatch = html.match(/data-src="([^"]+\.mp4)"/i);
      if (dataSrcMatch) {
        sampleVideoUrl = dataSrcMatch[1];
      }
    }

    // パターン3: FC2特有のサンプル動画パターン
    if (!sampleVideoUrl) {
      const fc2VideoMatch = html.match(/(?:sample|preview)[^"']*\.mp4|[^"']*(?:sample|preview)[^"']*\.mp4/i);
      if (fc2VideoMatch) {
        const fullMatch = html.match(/["']([^"']*(?:sample|preview)[^"']*\.mp4)["']/i);
        if (fullMatch) {
          sampleVideoUrl = fullMatch[1];
        }
      }
    }

    // パターン4: JavaScript変数
    if (!sampleVideoUrl) {
      const jsVideoMatch = html.match(/(?:sample_?url|video_?url|movie_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i);
      if (jsVideoMatch) {
        sampleVideoUrl = jsVideoMatch[1];
      }
    }

    return {
      product: {
        articleId,
        title,
        description,
        performers: performersList,
        thumbnailUrl,
        sampleImages,
        sampleVideoUrl,
        duration,
        price,
        saleInfo,
        category,
        tags,
      },
      rawDataId: upsertResult.id,
      shouldSkip: false,
    };
  } catch (error) {
    console.error(`  ❌ エラー (${articleId}): ${error}`);
    return { product: null, rawDataId: null, shouldSkip: false };
  }
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(product: FC2Product): Promise<number | null> {
  // 商品データの検証
  const validation = validateProductData({
    title: product.title,
    description: product.description,
    aspName: 'FC2',
    originalId: product.articleId,
  });

  if (!validation.isValid) {
    console.log(`    ⚠️ スキップ: ${validation.reason}`);
    return null;
  }

  try {
    const normalizedProductId = `FC2-${product.articleId}`;

    // 既存チェック
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.normalizedProductId, normalizedProductId))
      .limit(1);

    let productId: number;

    if (existing.length > 0) {
      productId = existing[0].id;
      console.log(`    ⏭️ 既存商品 (ID: ${productId})`);
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
        })
        .returning({ id: products.id });

      productId = inserted.id;
      console.log(`    ✓ 新規商品作成 (ID: ${productId})`);

      // product_sources作成
      const affiliateUrl = generateAffiliateUrl(product.articleId);
      await db.insert(productSources).values({
        productId,
        aspName: 'FC2',
        originalProductId: product.articleId,
        affiliateUrl,
        price: product.price,
        dataSource: 'CRAWL',
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
        const existingLink = await db
          .select()
          .from(productPerformers)
          .where(
            and(
              eq(productPerformers.productId, productId),
              eq(productPerformers.performerId, performerId)
            )
          )
          .limit(1);

        if (existingLink.length === 0) {
          await db.insert(productPerformers).values({
            productId,
            performerId,
          });
        }
      }

      // サンプル画像保存
      if (product.thumbnailUrl) {
        await db.insert(productImages).values({
          productId,
          imageUrl: product.thumbnailUrl,
          imageType: 'thumbnail',
          displayOrder: 0,
          aspName: 'FC2',
        }).onConflictDoNothing();
      }

      for (let i = 0; i < product.sampleImages.length; i++) {
        await db.insert(productImages).values({
          productId,
          imageUrl: product.sampleImages[i],
          imageType: 'sample',
          displayOrder: i + 1,
          aspName: 'FC2',
        }).onConflictDoNothing();
      }

      // サンプル動画保存
      if (product.sampleVideoUrl) {
        await db.insert(productVideos).values({
          productId,
          videoUrl: product.sampleVideoUrl,
          videoType: 'sample',
          aspName: 'FC2',
          displayOrder: 0,
        }).onConflictDoNothing();
        console.log(`    🎬 サンプル動画保存完了`);
      }

      // セール情報保存
      if (product.saleInfo) {
        try {
          const saved = await saveSaleInfo('FC2', product.articleId, product.saleInfo);
          if (saved) {
            console.log(`    💰 セール情報保存完了`);
          }
        } catch (saleError: any) {
          console.log(`    ⚠️ セール情報保存失敗: ${saleError.message}`);
        }
      }
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

/**
 * 一覧ページから商品IDを取得
 */
async function fetchArticleIds(page: number = 1): Promise<string[]> {
  const url = `https://adult.contents.fc2.com/newrelease.php?page=${page}`;

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

    // 商品IDを抽出: /article/{ID}/
    const articleIds: string[] = [];
    const matches = html.matchAll(/\/article\/(\d+)\//g);
    for (const match of matches) {
      const id = match[1];
      if (!articleIds.includes(id)) {
        articleIds.push(id);
      }
    }

    console.log(`  ✓ ${articleIds.length}件の商品ID取得`);
    return articleIds;
  } catch (error) {
    console.error(`  ❌ 一覧取得エラー: ${error}`);
    return [];
  }
}

/**
 * AI機能を使って説明文とタグを生成
 */
async function generateAIContent(
  product: FC2Product,
  enableAI: boolean = true,
): Promise<{ aiDescription?: GeneratedDescription; aiTags?: FC2Product['aiTags'] }> {
  if (!enableAI) {
    return {};
  }

  console.log('    🤖 AI機能を実行中...');

  // AI説明文生成
  let aiDescription: GeneratedDescription | undefined;
  try {
    const result = await generateProductDescription({
      title: product.title,
      originalDescription: product.description,
      performers: product.performers,
      genres: product.tags,
    });

    if (result) {
      aiDescription = result;
      console.log(`      ✅ AI説明文生成完了`);
      console.log(`         キャッチコピー: ${result.catchphrase}`);
    }
  } catch (error) {
    console.error('      ❌ AI説明文生成エラー:', error);
  }

  // AIタグ抽出
  let aiTags: FC2Product['aiTags'];
  try {
    const tags = await extractProductTags(product.title, product.description);
    if (tags.genres.length > 0 || tags.attributes.length > 0 || tags.plays.length > 0 || tags.situations.length > 0) {
      aiTags = tags;
      console.log(`      ✅ AIタグ抽出完了`);
      console.log(`         ジャンル: ${tags.genres.join(', ') || 'なし'}`);
      console.log(`         属性: ${tags.attributes.join(', ') || 'なし'}`);
    }
  } catch (error) {
    console.error('      ❌ AIタグ抽出エラー:', error);
  }

  return { aiDescription, aiTags };
}

/**
 * AI生成データをDBに保存
 */
async function saveAIContent(
  productId: number,
  aiDescription?: GeneratedDescription,
  aiTags?: FC2Product['aiTags'],
): Promise<void> {
  if (!aiDescription && !aiTags) {
    return;
  }

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
      console.log(`    💾 AI生成データを保存しました`);
    }
  } catch (error) {
    // カラムがない場合はスキップ（マイグレーション前）
    console.warn('    ⚠️ AI生成データの保存をスキップ（カラム未作成の可能性）');
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

  console.log('    🌐 翻訳処理を実行中...');

  try {
    const translation = await translateProduct(title, description);
    if (!translation) {
      console.log('      ⚠️ 翻訳結果が取得できませんでした');
      return;
    }

    const updateData: Record<string, any> = {};

    if (translation.en) {
      updateData.titleEn = translation.en.title;
      if (translation.en.description) {
        updateData.descriptionEn = translation.en.description;
      }
      console.log(`      EN: ${translation.en.title.slice(0, 50)}...`);
    }

    if (translation.zh) {
      updateData.titleZh = translation.zh.title;
      if (translation.zh.description) {
        updateData.descriptionZh = translation.zh.description;
      }
      console.log(`      ZH: ${translation.zh.title.slice(0, 50)}...`);
    }

    if (translation.ko) {
      updateData.titleKo = translation.ko.title;
      if (translation.ko.description) {
        updateData.descriptionKo = translation.ko.description;
      }
      console.log(`      KO: ${translation.ko.title.slice(0, 50)}...`);
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId));
      console.log(`    💾 翻訳データを保存しました`);
    }
  } catch (error) {
    console.error('    ❌ 翻訳エラー:', error);
  }
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let startPage = 1;
  let endPage = 10;
  let limit = 100;
  let singleId: string | null = null;
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');

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

  console.log('=== FC2コンテンツマーケット クローラー ===');
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}\n`);

  let totalFound = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  if (singleId) {
    // 単一商品のクロール
    console.log(`単一商品クロール: ${singleId}\n`);

    const { product, rawDataId, shouldSkip } = await parseDetailPage(singleId, forceReprocess);

    if (shouldSkip) {
      totalSkipped++;
    } else if (product) {
      console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
      console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);

      const savedId = await saveProduct(product);
      if (savedId) {
        // AI機能: 説明文生成とタグ抽出
        if (enableAI) {
          const { aiDescription, aiTags } = await generateAIContent(product, enableAI);
          await saveAIContent(savedId, aiDescription, aiTags);
        }
        // 翻訳機能: タイトルと説明を多言語翻訳
        if (enableAI) {
          await translateAndSave(savedId, product.title, product.description, enableAI);
        }

        // 処理済みマーク
        if (rawDataId) {
          await markRawDataAsProcessed('fc2', rawDataId);
        }

        totalSaved++;
      }
      totalFound++;
    }
  } else {
    // 一覧ページからクロール
    console.log(`設定: startPage=${startPage}, endPage=${endPage}, limit=${limit}\n`);

    for (let page = startPage; page <= endPage && totalFound < limit; page++) {
      console.log(`\n--- ページ ${page} ---`);

      const articleIds = await fetchArticleIds(page);

      if (articleIds.length === 0) {
        console.log('商品が見つかりません。終了します。');
        break;
      }

      for (const articleId of articleIds) {
        if (totalFound >= limit) break;

        console.log(`\n[${totalFound + 1}] 商品ID: ${articleId}`);

        const { product, rawDataId, shouldSkip } = await parseDetailPage(articleId, forceReprocess);

        if (shouldSkip) {
          totalSkipped++;
          continue;
        }

        if (product) {
          console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
          console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);

          const savedId = await saveProduct(product);
          if (savedId) {
            // AI機能: 説明文生成とタグ抽出
            if (enableAI) {
              const { aiDescription, aiTags } = await generateAIContent(product, enableAI);
              await saveAIContent(savedId, aiDescription, aiTags);
            }
            // 翻訳機能: タイトルと説明を多言語翻訳
            if (enableAI) {
              await translateAndSave(savedId, product.title, product.description, enableAI);
            }

            // 処理済みマーク
            if (rawDataId) {
              await markRawDataAsProcessed('fc2', rawDataId);
            }

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
  console.log(`スキップ件数(処理済み): ${totalSkipped}`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'FC2'
  `);
  console.log(`\nFC2総商品数: ${stats.rows[0].count}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
