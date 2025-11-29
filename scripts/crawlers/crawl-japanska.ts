/**
 * Japanska クローラー
 *
 * 機能:
 * - Japanska (japanska-xxx.com) からHTMLをクロールして商品データを取得
 * - 商品一覧ページから商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - アフィリエイトURL: https://wlink.golden-gateway.com/id/9512-1-001-{詳細ID}/
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-japanska.ts [--limit 100] [--start 1]
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
const AFFILIATE_ID = '9512-1-001';

interface JapanskaProduct {
  movieId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleImages: string[];
  sampleVideoUrl?: string;
  releaseDate?: string;
  duration?: number;
}

/**
 * アフィリエイトURLを生成
 */
function generateAffiliateUrl(movieId: string): string {
  // movieId から16進数IDを生成（簡易版）
  const hexId = parseInt(movieId).toString(16);
  return `https://wlink.golden-gateway.com/id/${AFFILIATE_ID}-${hexId}/`;
}

// 一覧ページURL（Referer用）
const LIST_PAGE_URL = 'https://www.japanska-xxx.com/category/list_0.html';

/**
 * ホームページかどうかを判定
 */
function isHomePage(html: string): boolean {
  return html.includes('<!--home.html-->') ||
         (html.includes('幅広いジャンル') && html.includes('30日'));
}

/**
 * 商品詳細ページをパース
 */
async function parseDetailPage(movieId: string): Promise<JapanskaProduct | null> {
  const url = `https://www.japanska-xxx.com/movie/detail_${movieId}.html`;

  try {
    // キャッシュ確認
    const existingRaw = await db
      .select()
      .from(rawHtmlData)
      .where(
        and(
          eq(rawHtmlData.source, 'Japanska'),
          eq(rawHtmlData.productId, movieId)
        )
      )
      .limit(1);

    let html: string;
    let needsRefetch = false;

    if (existingRaw.length > 0) {
      html = existingRaw[0].htmlContent;
      // キャッシュがホームページの場合は再取得が必要
      if (isHomePage(html)) {
        console.log(`  ⚠️ キャッシュがホームページ、再取得必要: ${movieId}`);
        needsRefetch = true;
      } else {
        console.log(`  ⚡ キャッシュ使用: ${movieId}`);
      }
    } else {
      needsRefetch = true;
    }

    if (needsRefetch) {
      console.log(`  🔍 詳細ページ取得中（Referer付き）: ${url}`);

      // 一覧ページからのRefererを付けてアクセス
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Referer': LIST_PAGE_URL,
        },
      });

      if (!response.ok) {
        console.log(`    ⚠️ 商品 ${movieId} が見つかりません (${response.status})`);
        return null;
      }

      html = await response.text();

      // 取得したHTMLがホームページの場合はスキップ
      if (isHomePage(html)) {
        console.log(`    ⚠️ ホームページにリダイレクト、スキップ: ${movieId}`);
        return null;
      }

      // 生HTMLを保存（上書き）
      const hash = createHash('sha256').update(html).digest('hex');
      await db.insert(rawHtmlData).values({
        source: 'Japanska',
        productId: movieId,
        url,
        htmlContent: html,
        hash,
      }).onConflictDoUpdate({
        target: [rawHtmlData.source, rawHtmlData.productId],
        set: {
          htmlContent: html,
          hash,
          fetchedAt: new Date(),
        },
      });

      // レート制限
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // タイトル抽出（複数パターン試行）
    let title = '';

    // パターン1: <div class="movie_ttl"><p>タイトル</p></div> (Japanska固有)
    const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    if (movieTtlMatch) {
      title = movieTtlMatch[1].trim();
    }

    // パターン2: og:title meta tag
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch && !ogTitleMatch[1].includes('JAPANSKA')) {
        title = ogTitleMatch[1].trim();
      }
    }

    // パターン3: titleタグからサイト名を除去
    if (!title) {
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTagMatch) {
        const parts = titleTagMatch[1].split(/[\|｜]/);
        if (parts.length > 1 && !parts[0].includes('JAPANSKA')) {
          title = parts[0].trim();
        }
      }
    }

    // フォールバック
    if (!title || title.length > 100 || title.includes('幅広いジャンル') || title.includes('30日')) {
      title = `Japanska-${movieId}`;
    }

    // 説明抽出
    const descMatch = html.match(/<div[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                      html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 1000) : undefined;

    // 出演者抽出（より具体的なパターン）
    const performers: string[] = [];

    // パターン1: actress関連のリンク
    const actressLinkMatches = html.matchAll(/<a[^>]*href="[^"]*actress[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of actressLinkMatches) {
      const name = match[1].trim();
      // 不正なデータを除外
      if (name &&
          !performers.includes(name) &&
          !name.includes('女優一覧') &&
          !name.includes('ランキング') &&
          !name.includes('&') &&
          name.length > 1 &&
          name.length < 30) {
        performers.push(name);
      }
    }

    // パターン2: 出演者ラベル後のテキスト
    if (performers.length === 0) {
      const actorLabelMatch = html.match(/出演[者：:]\s*([^<\n]+)/i);
      if (actorLabelMatch) {
        const names = actorLabelMatch[1].split(/[,、\/]/).map(n => n.trim()).filter(n => n && n.length > 1);
        performers.push(...names.slice(0, 10)); // 最大10名まで
      }
    }

    // サムネイル抽出
    let thumbnailUrl: string | undefined;

    // パターン1: og:image meta tag (最優先)
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch && ogImageMatch[1]) {
      thumbnailUrl = ogImageMatch[1];
    }

    // パターン2: imgタグからsrc属性を抽出
    if (!thumbnailUrl) {
      const imgSrcMatch = html.match(/<img[^>]*src="(https?:\/\/[^"]*movie[^"]*\.jpg)"/i);
      if (imgSrcMatch && imgSrcMatch[1]) {
        thumbnailUrl = imgSrcMatch[1];
      }
    }

    // パターン3: 99.jpg (サムネイル) を探す
    if (!thumbnailUrl) {
      const thumb99Match = html.match(/img\/movie\/[^"'\s<>]+\/99\.jpg/i);
      if (thumb99Match) {
        thumbnailUrl = `https://www.japanska-xxx.com/${thumb99Match[0]}`;
      }
    }

    // パターン4: 00.jpg を探す
    if (!thumbnailUrl) {
      const thumb00Match = html.match(/(https?:\/\/[^"'\s<>]*img\d*\.japanska-xxx\.com\/img\/movie\/[^"'\s<>]+\/00\.jpg)/i);
      if (thumb00Match && thumb00Match[1]) {
        thumbnailUrl = thumb00Match[1];
      }
    }

    // サンプル画像抽出
    const sampleImages: string[] = [];
    const sampleMatches = html.matchAll(/img\/movie\/[^"']+\/\d+\.jpg/gi);
    for (const match of sampleMatches) {
      const imgUrl = match[0].startsWith('http') ? match[0] : `https://www.japanska-xxx.com/${match[0]}`;
      if (!sampleImages.includes(imgUrl) && !imgUrl.includes('99.jpg')) {
        sampleImages.push(imgUrl);
      }
    }

    // 再生時間抽出
    const durationMatch = html.match(/(\d+)分(\d+)?秒?/);
    const duration = durationMatch
      ? parseInt(durationMatch[1]) + (durationMatch[2] ? Math.round(parseInt(durationMatch[2]) / 60) : 0)
      : undefined;

    // サンプル動画URL抽出
    let sampleVideoUrl: string | undefined;

    // パターン1: video source タグ
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch) {
      sampleVideoUrl = videoSrcMatch[1].startsWith('http')
        ? videoSrcMatch[1]
        : `https://www.japanska-xxx.com/${videoSrcMatch[1]}`;
    }

    // パターン2: video/movie フォルダのmp4
    if (!sampleVideoUrl) {
      const videoMatch = html.match(/(?:video|movie)\/[^"']+\.mp4/i);
      if (videoMatch) {
        sampleVideoUrl = videoMatch[0].startsWith('http')
          ? videoMatch[0]
          : `https://www.japanska-xxx.com/${videoMatch[0]}`;
      }
    }

    // パターン3: JavaScriptの動画URL
    if (!sampleVideoUrl) {
      const jsVideoMatch = html.match(/(?:video_?url|sample_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i);
      if (jsVideoMatch) {
        sampleVideoUrl = jsVideoMatch[1].startsWith('http')
          ? jsVideoMatch[1]
          : `https://www.japanska-xxx.com/${jsVideoMatch[1]}`;
      }
    }

    return {
      movieId,
      title,
      description,
      performers,
      thumbnailUrl,
      sampleImages,
      sampleVideoUrl,
      duration,
    };
  } catch (error) {
    console.error(`  ❌ エラー (${movieId}): ${error}`);
    return null;
  }
}

/**
 * 商品をデータベースに保存
 */
async function saveProduct(product: JapanskaProduct): Promise<number | null> {
  // 商品データの検証
  const validation = validateProductData({
    title: product.title,
    description: product.description,
    aspName: 'Japanska',
    originalId: product.movieId,
  });

  if (!validation.isValid) {
    console.log(`    ⚠️ スキップ: ${validation.reason}`);
    return null;
  }

  try {
    const normalizedProductId = `Japanska-${product.movieId}`;

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
      const affiliateUrl = generateAffiliateUrl(product.movieId);
      await db.insert(productSources).values({
        productId,
        aspName: 'Japanska',
        originalProductId: product.movieId,
        affiliateUrl,
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
          aspName: 'Japanska',
        }).onConflictDoNothing();
      }

      for (let i = 0; i < product.sampleImages.length; i++) {
        await db.insert(productImages).values({
          productId,
          imageUrl: product.sampleImages[i],
          imageType: 'sample',
          displayOrder: i + 1,
          aspName: 'Japanska',
        }).onConflictDoNothing();
      }

      // サンプル動画保存
      if (product.sampleVideoUrl) {
        await db.insert(productVideos).values({
          productId,
          videoUrl: product.sampleVideoUrl,
          videoType: 'sample',
          aspName: 'Japanska',
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
 * メイン処理
 * ID範囲でクロール: --start 34000 --end 35000
 */
async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let startId = 34000;
  let endId = 35000;
  let limit = 100;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i + 1]) {
      startId = parseInt(args[i + 1]);
    }
    if (args[i] === '--end' && args[i + 1]) {
      endId = parseInt(args[i + 1]);
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
  }

  console.log('=== Japanska クローラー ===\n');
  console.log(`設定: startId=${startId}, endId=${endId}, limit=${limit}\n`);

  let totalFound = 0;
  let totalSaved = 0;
  let consecutiveNotFound = 0;
  const MAX_CONSECUTIVE_NOT_FOUND = 50;

  for (let movieId = startId; movieId <= endId && totalFound < limit; movieId++) {
    // 連続404が多すぎる場合は終了
    if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) {
      console.log(`\n${MAX_CONSECUTIVE_NOT_FOUND}件連続でNot Found - 終了`);
      break;
    }

    console.log(`\n[${totalFound + 1}] 商品ID: ${movieId}`);

    // 詳細ページをパース
    const product = await parseDetailPage(String(movieId));

    if (product) {
      consecutiveNotFound = 0;
      console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
      console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);

      // データベースに保存
      const savedId = await saveProduct(product);
      if (savedId) {
        totalSaved++;
      }
      totalFound++;
    } else {
      consecutiveNotFound++;
      if (consecutiveNotFound % 10 === 0) {
        console.log(`    (${consecutiveNotFound}件連続Not Found)`);
      }
    }
  }

  console.log('\n=== クロール完了 ===');
  console.log(`取得件数: ${totalFound}`);
  console.log(`保存件数: ${totalSaved}`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'Japanska'
  `);
  console.log(`\nJapanska総商品数: ${stats.rows[0].count}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
