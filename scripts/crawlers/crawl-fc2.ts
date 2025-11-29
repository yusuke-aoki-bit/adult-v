/**
 * FC2コンテンツマーケット クローラー
 *
 * 機能:
 * - FC2コンテンツマーケット (adult.contents.fc2.com) からHTMLをクロールして商品データを取得
 * - 商品詳細ページからメタデータを取得
 * - アフィリエイトURL: https://adult.contents.fc2.com/article/{商品ID}/?aid={アフィリエイトID}
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-fc2.ts [--limit 100] [--start 1]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos, rawHtmlData } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { validateProductData } from '../../lib/crawler-utils';

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
  category?: string;
  tags: string[];
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
async function parseDetailPage(articleId: string): Promise<FC2Product | null> {
  const url = `https://adult.contents.fc2.com/article/${articleId}/`;

  try {
    // キャッシュ確認
    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, 'FC2'),
          eq(rawHtmlData.productId, articleId)
        )
      )
      .limit(1);

    let html: string;

    if (existingRaw.length > 0) {
      html = existingRaw[0].htmlContent;
      console.log(`  ⚡ キャッシュ使用: ${articleId}`);
    } else {
      console.log(`  🔍 詳細ページ取得中: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        console.log(`    ⚠️ 商品 ${articleId} が見つかりません (${response.status})`);
        return null;
      }

      html = await response.text();

      // 生HTMLを保存
      const hash = createHash('sha256').update(html).digest('hex');
      await db.insert(rawHtmlData).values({
        source: 'FC2',
        productId: articleId,
        url,
        htmlContent: html,
        hash,
      });

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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

    // 出演者抽出
    const performers: string[] = [];

    // パターン1: 出演者リンク
    const performerMatches = html.matchAll(/<a[^>]*href="[^"]*(?:actress|performer|cast)[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of performerMatches) {
      const name = match[1].trim();
      if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    }

    // パターン2: 出演ラベル後のテキスト
    if (performers.length === 0) {
      const actorLabelMatch = html.match(/出演[者：:]\s*([^<\n]+)/i);
      if (actorLabelMatch) {
        const names = actorLabelMatch[1].split(/[,、\/]/).map(n => n.trim()).filter(n => n && n.length > 1);
        performers.push(...names.slice(0, 10));
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
    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:円|pt|ポイント)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined;

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
      articleId,
      title,
      description,
      performers,
      thumbnailUrl,
      sampleImages,
      sampleVideoUrl,
      duration,
      price,
      category,
      tags,
    };
  } catch (error) {
    console.error(`  ❌ エラー (${articleId}): ${error}`);
    return null;
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
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let startPage = 1;
  let endPage = 10;
  let limit = 100;
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

  console.log('=== FC2コンテンツマーケット クローラー ===\n');

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

      const articleIds = await fetchArticleIds(page);

      if (articleIds.length === 0) {
        console.log('商品が見つかりません。終了します。');
        break;
      }

      for (const articleId of articleIds) {
        if (totalFound >= limit) break;

        console.log(`\n[${totalFound + 1}] 商品ID: ${articleId}`);

        const product = await parseDetailPage(articleId);

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
    WHERE asp_name = 'FC2'
  `);
  console.log(`\nFC2総商品数: ${stats.rows[0].count}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
