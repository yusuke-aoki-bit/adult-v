/**
 * Japanska クローラー
 *
 * 機能:
 * - Japanska (japanska-xxx.com) からHTMLをクロールして商品データを取得
 * - 商品一覧ページから商品リストを取得
 * - 商品詳細ページからメタデータを取得
 * - アフィリエイトURL: https://wlink.golden-gateway.com/id/9512-1-001-{詳細ID}/
 * - AI機能: Gemini APIによる説明文生成・タグ抽出（--no-aiオプションで無効化可能）
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/crawlers/crawl-japanska.ts [--limit 100] [--start 1] [--no-ai]
 */

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

import { getDb } from '../../lib/db';
import { products, productSources, performers, productPerformers, productImages, productVideos } from '../../lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { validateProductData } from '../../lib/crawler-utils';
import { isValidPerformerName, normalizePerformerName, isValidPerformerForProduct } from '../../lib/performer-validation';
import { generateProductDescription, extractProductTags, GeneratedDescription, translateProduct } from '../../lib/google-apis';
import {
  upsertRawHtmlDataWithGcs,
  markRawDataAsProcessed,
} from '../../lib/crawler/dedup-helper';

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
  sampleVideos: string[];  // 複数のサンプル動画URL
  releaseDate?: string;
  duration?: number;
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
 * 注意: "幅広いジャンル" と "30日" はヘッダー/フッターに常に存在するため
 * 商品詳細ページの特徴的な要素がない場合のみホームページと判定
 */
function isHomePage(html: string): boolean {
  // 明示的なホームページマーカー
  if (html.includes('<!--home.html-->')) {
    return true;
  }

  // 商品詳細ページの特徴的な要素があればホームページではない
  const hasMovieDetail = html.includes('class="movie_ttl"') ||
                         html.includes('/actress/detail_') ||
                         html.includes('class="act_name"') ||
                         html.includes('女優名');

  if (hasMovieDetail) {
    return false;
  }

  // 商品詳細要素がなく、ホームページ的な要素がある場合はホームページ
  return html.includes('幅広いジャンル') && html.includes('30日');
}

/**
 * 商品詳細ページをパース
 */
async function parseDetailPage(movieId: string, forceReprocess: boolean = false): Promise<{ product: JapanskaProduct | null; rawDataId: number | null; shouldSkip: boolean }> {
  const url = `https://www.japanska-xxx.com/movie/detail_${movieId}.html`;

  try {
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
      return { product: null, rawDataId: null, shouldSkip: false };
    }

    const html = await response.text();

    // 取得したHTMLがホームページの場合はスキップ
    if (isHomePage(html)) {
      console.log(`    ⚠️ ホームページにリダイレクト、スキップ: ${movieId}`);
      return { product: null, rawDataId: null, shouldSkip: false };
    }

    // 生HTMLを保存（GCS優先 + 重複チェック）
    const upsertResult = await upsertRawHtmlDataWithGcs('Japanska', movieId, url, html);

    // 重複チェック: 変更なし＆処理済みならスキップ
    if (upsertResult.shouldSkip && !forceReprocess) {
      console.log(`    ⏭️ スキップ(処理済み): ${movieId}`);
      return { product: null, rawDataId: upsertResult.id, shouldSkip: true };
    }

    if (upsertResult.isNew) {
      console.log(`    💾 保存完了${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    } else {
      console.log(`    🔄 更新完了${upsertResult.gcsUrl ? ' (GCS)' : ' (DB)'}`);
    }

    // レート制限
    await new Promise(resolve => setTimeout(resolve, 500));

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

    // 出演者抽出（より具体的なパターン + 共通バリデーション）
    const performersList: string[] = [];

    // ヘルパー関数: 名前を追加（重複・バリデーションチェック付き）
    const addPerformer = (rawName: string) => {
      // 括弧内の別名も展開して処理
      // 例: "青木桃(朝日芹奈・堤セリナ・新セリナ)" → ["青木桃", "朝日芹奈", "堤セリナ", "新セリナ"]
      const mainName = rawName.replace(/[（(].*[）)]/g, '').trim();
      const aliasMatch = rawName.match(/[（(]([^）)]+)[）)]/);
      const aliases = aliasMatch ? aliasMatch[1].split(/[・、,\/]/).map(n => n.trim()) : [];

      const allNames = [mainName, ...aliases].filter(n => n.length > 0);

      for (const name of allNames) {
        const normalizedName = normalizePerformerName(name);
        if (normalizedName &&
            !performersList.includes(normalizedName) &&
            !name.includes('女優一覧') &&
            !name.includes('ランキング') &&
            isValidPerformerName(normalizedName) &&
            isValidPerformerForProduct(normalizedName, title)) {
          performersList.push(normalizedName);
        }
      }
    };

    // パターン1: act_name クラス内のリンク（Japanska固有の女優名表示）
    const actNameMatch = html.match(/<p[^>]*class="act_name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    if (actNameMatch) {
      addPerformer(actNameMatch[1].trim());
    }

    // パターン2: 女優名ラベル内のリンク
    const jooyuuNameMatch = html.match(/女優名[\s\S]*?<dd>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    if (jooyuuNameMatch && performersList.length === 0) {
      addPerformer(jooyuuNameMatch[1].trim());
    }

    // パターン3: actress関連のリンク全般
    if (performersList.length === 0) {
      const actressLinkMatches = html.matchAll(/<a[^>]*href="[^"]*actress[^"]*"[^>]*>([^<]+)<\/a>/gi);
      for (const match of actressLinkMatches) {
        addPerformer(match[1].trim());
      }
    }

    // パターン4: 出演者ラベル後のテキスト
    if (performersList.length === 0) {
      const actorLabelMatch = html.match(/出演[者：:]\s*([^<\n]+)/i);
      if (actorLabelMatch) {
        const names = actorLabelMatch[1].split(/[,、\/]/).map(n => n.trim());
        for (const rawName of names.slice(0, 10)) {
          addPerformer(rawName);
        }
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

    // サンプル画像抽出（複数パターン対応）
    const sampleImages: string[] = [];

    // パターン1: img01.japanska-xxx.com からの画像 (メインパターン)
    // 例: https://img01.japanska-xxx.com/img/movie/k5868/01.jpg
    const imgDomainMatches = html.matchAll(/https?:\/\/img\d*\.japanska-xxx\.com\/img\/movie\/[^"'\s<>]+\/(\d+|big\d+)\.jpg/gi);
    for (const match of imgDomainMatches) {
      const imgUrl = match[0];
      if (!sampleImages.includes(imgUrl) && !imgUrl.includes('99.jpg') && !imgUrl.includes('00.jpg')) {
        sampleImages.push(imgUrl);
      }
    }

    // パターン2: 相対パス形式 (フォールバック)
    if (sampleImages.length === 0) {
      const sampleMatches = html.matchAll(/img\/movie\/[^"']+\/(\d+|big\d+)\.jpg/gi);
      for (const match of sampleMatches) {
        const imgUrl = match[0].startsWith('http') ? match[0] : `https://img01.japanska-xxx.com/${match[0]}`;
        if (!sampleImages.includes(imgUrl) && !imgUrl.includes('99.jpg') && !imgUrl.includes('00.jpg')) {
          sampleImages.push(imgUrl);
        }
      }
    }

    // 画像を番号順にソート（01.jpg, 02.jpg... big1.jpg, big2.jpg...）
    sampleImages.sort((a, b) => {
      const numA = a.match(/(\d+)\.jpg$/i)?.[1] || '0';
      const numB = b.match(/(\d+)\.jpg$/i)?.[1] || '0';
      const isBigA = a.includes('big');
      const isBigB = b.includes('big');
      // big画像を後ろに
      if (isBigA !== isBigB) return isBigA ? 1 : -1;
      return parseInt(numA) - parseInt(numB);
    });

    // 再生時間抽出
    const durationMatch = html.match(/(\d+)分(\d+)?秒?/);
    const duration = durationMatch
      ? parseInt(durationMatch[1]) + (durationMatch[2] ? Math.round(parseInt(durationMatch[2]) / 60) : 0)
      : undefined;

    // サンプル動画URL抽出（複数パターン対応）
    const sampleVideos: string[] = [];

    // パターン1: _movie_ フォルダのmp4 (Japanska固有パターン)
    // 例: https://img01.japanska-xxx.com/_movie_/k5868/k5868_00.mp4
    const movieFolderMatches = html.matchAll(/https?:\/\/img\d*\.japanska-xxx\.com\/_movie_\/[^"'\s<>]+\.mp4/gi);
    for (const match of movieFolderMatches) {
      if (!sampleVideos.includes(match[0])) {
        sampleVideos.push(match[0]);
      }
    }

    // パターン2: PHP配列/JavaScript内のファイル名からURLを構築
    // HTMLには以下の形式で出力されている:
    // [0] => /var/www/html/_scripts/../_movie_/k5868
    // [33] => k5868_00.mp4
    const movieIdMatch = html.match(/img\/movie\/([^\/]+)\//);
    const internalMovieId = movieIdMatch ? movieIdMatch[1] : null;
    if (internalMovieId && sampleVideos.length === 0) {
      // mp4ファイル名を抽出 (例: k5868_00.mp4)
      const mp4FileMatches = html.matchAll(/([a-z]\d+_\d+\.mp4)/gi);
      for (const match of mp4FileMatches) {
        const fileName = match[1];
        const videoUrl = `https://img01.japanska-xxx.com/_movie_/${internalMovieId}/${fileName}`;
        if (!sampleVideos.includes(videoUrl)) {
          sampleVideos.push(videoUrl);
        }
      }
    }

    // パターン3: video source タグ
    if (sampleVideos.length === 0) {
      const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
      if (videoSrcMatch) {
        const videoUrl = videoSrcMatch[1].startsWith('http')
          ? videoSrcMatch[1]
          : `https://img01.japanska-xxx.com/${videoSrcMatch[1]}`;
        sampleVideos.push(videoUrl);
      }
    }

    // パターン4: video/movie フォルダのmp4
    if (sampleVideos.length === 0) {
      const videoMatch = html.match(/(?:video|movie)\/[^"']+\.mp4/i);
      if (videoMatch) {
        const videoUrl = videoMatch[0].startsWith('http')
          ? videoMatch[0]
          : `https://img01.japanska-xxx.com/${videoMatch[0]}`;
        sampleVideos.push(videoUrl);
      }
    }

    // 動画を番号順にソート
    sampleVideos.sort((a, b) => {
      const numA = a.match(/_(\d+)\.mp4$/i)?.[1] || '0';
      const numB = b.match(/_(\d+)\.mp4$/i)?.[1] || '0';
      return parseInt(numA) - parseInt(numB);
    });

    // 後方互換のため最初の動画をsampleVideoUrlに
    const sampleVideoUrl = sampleVideos.length > 0 ? sampleVideos[0] : undefined;

    return {
      product: {
        movieId,
        title,
        description,
        performers: performersList,
        thumbnailUrl,
        sampleImages,
        sampleVideoUrl,
        sampleVideos,
        duration,
      },
      rawDataId: upsertResult.id,
      shouldSkip: false,
    };
  } catch (error) {
    console.error(`  ❌ エラー (${movieId}): ${error}`);
    return { product: null, rawDataId: null, shouldSkip: false };
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

      // サンプル動画保存（複数対応）
      if (product.sampleVideos && product.sampleVideos.length > 0) {
        for (let i = 0; i < product.sampleVideos.length; i++) {
          await db.insert(productVideos).values({
            productId,
            videoUrl: product.sampleVideos[i],
            videoType: 'sample',
            aspName: 'Japanska',
            displayOrder: i,
          }).onConflictDoNothing();
        }
        console.log(`    🎬 サンプル動画保存完了 (${product.sampleVideos.length}件)`);
      }
    }

    return productId;
  } catch (error) {
    console.error(`    ❌ 保存エラー: ${error}`);
    return null;
  }
}

/**
 * AI機能を使って説明文とタグを生成
 */
async function generateAIContent(
  product: JapanskaProduct,
  enableAI: boolean = true,
): Promise<{ aiDescription?: GeneratedDescription; aiTags?: JapanskaProduct['aiTags'] }> {
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
  let aiTags: JapanskaProduct['aiTags'];
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
  aiTags?: JapanskaProduct['aiTags'],
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
 * ID範囲でクロール: --start 34000 --end 35000
 */
async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let startId = 34000;
  let endId = 35000;
  let limit = 100;
  const enableAI = !args.includes('--no-ai');
  const forceReprocess = args.includes('--force');

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

  console.log('=== Japanska クローラー ===');
  console.log(`AI機能: ${enableAI ? '有効' : '無効'}`);
  console.log(`強制再処理: ${forceReprocess ? '有効' : '無効'}\n`);
  console.log(`設定: startId=${startId}, endId=${endId}, limit=${limit}\n`);

  let totalFound = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
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
    const { product, rawDataId, shouldSkip } = await parseDetailPage(String(movieId), forceReprocess);

    if (shouldSkip) {
      totalSkipped++;
      continue;
    }

    if (product) {
      consecutiveNotFound = 0;
      console.log(`    タイトル: ${product.title.substring(0, 50)}...`);
      console.log(`    出演者: ${product.performers.join(', ') || '不明'}`);
      console.log(`    📷 サンプル画像: ${product.sampleImages.length}件`);
      console.log(`    🎬 サンプル動画: ${product.sampleVideos.length}件`);

      // データベースに保存
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
          await markRawDataAsProcessed('japanska', rawDataId);
        }

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
  console.log(`スキップ件数(処理済み): ${totalSkipped}`);

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
