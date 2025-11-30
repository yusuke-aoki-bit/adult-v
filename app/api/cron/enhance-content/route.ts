/**
 * コンテンツ強化 Cron API エンドポイント
 *
 * Google APIs を使用して商品情報を強化:
 * - Vision API: 画像分析（顔検出、ラベル付け）
 * - Translation API: 多言語翻訳（英語、中国語、韓国語）
 * - YouTube API: 関連動画検索
 *
 * GET /api/cron/enhance-content?type=vision|translate|youtube&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import {
  detectFaces,
  labelImage,
  translateText,
  searchYouTubeVideos,
  checkGoogleApiConfig,
} from '@/lib/google-apis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

interface Stats {
  totalProcessed: number;
  success: number;
  errors: number;
  skipped: number;
}

/**
 * 画像分析による商品メタデータ強化
 * Vision API で顔検出とラベル付けを実行
 */
async function enhanceWithVisionAPI(
  db: ReturnType<typeof getDb>,
  limit: number
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };
  const results: any[] = [];

  // 画像タグがまだ設定されていない商品を取得
  const productsResult = await db.execute(sql`
    SELECT p.id, p.title, p.default_thumbnail_url as image_url, p.normalized_product_id
    FROM products p
    LEFT JOIN product_image_metadata pim ON p.id = pim.product_id
    WHERE p.default_thumbnail_url IS NOT NULL
      AND p.default_thumbnail_url != ''
      AND pim.product_id IS NULL
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    title: string;
    image_url: string;
    normalized_product_id: string;
  }>;

  for (const product of products) {
    stats.totalProcessed++;

    try {
      // 顔検出
      const faces = await detectFaces(product.image_url);

      // ラベル付け
      const labels = await labelImage(product.image_url);

      if (faces.length > 0 || labels.length > 0) {
        // メタデータを保存
        await db.execute(sql`
          INSERT INTO product_image_metadata (
            product_id,
            face_count,
            labels,
            analyzed_at
          )
          VALUES (
            ${product.id},
            ${faces.length},
            ${labels.map(l => l.description)},
            NOW()
          )
          ON CONFLICT (product_id)
          DO UPDATE SET
            face_count = EXCLUDED.face_count,
            labels = EXCLUDED.labels,
            analyzed_at = NOW()
        `);

        stats.success++;
        results.push({
          productId: product.id,
          normalizedProductId: product.normalized_product_id,
          faceCount: faces.length,
          labels: labels.slice(0, 5).map(l => l.description),
        });
      } else {
        stats.skipped++;
      }

      // レート制限
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`[enhance-content] Vision error for ${product.id}:`, error);
      stats.errors++;
    }
  }

  return { stats, results };
}

/**
 * 多言語翻訳による商品情報強化
 * Translation API でタイトルと説明を英語・中国語・韓国語に翻訳
 */
async function enhanceWithTranslation(
  db: ReturnType<typeof getDb>,
  limit: number
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };
  const results: any[] = [];

  // 翻訳がまだ設定されていない商品を取得
  const productsResult = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id
    FROM products p
    LEFT JOIN product_translations pt ON p.id = pt.product_id
    WHERE p.title IS NOT NULL
      AND p.title != ''
      AND pt.product_id IS NULL
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    title: string;
    normalized_product_id: string;
  }>;

  const targetLanguages = ['en', 'zh', 'ko'];

  for (const product of products) {
    stats.totalProcessed++;

    try {
      const translations: Record<string, string> = {};

      for (const lang of targetLanguages) {
        const result = await translateText(product.title, lang, 'ja');
        if (result) {
          translations[lang] = result.translatedText;
        }
        // レート制限
        await new Promise(r => setTimeout(r, 200));
      }

      if (Object.keys(translations).length > 0) {
        await db.execute(sql`
          INSERT INTO product_translations (
            product_id,
            title_en,
            title_zh,
            title_ko,
            translated_at
          )
          VALUES (
            ${product.id},
            ${translations.en || null},
            ${translations.zh || null},
            ${translations.ko || null},
            NOW()
          )
          ON CONFLICT (product_id)
          DO UPDATE SET
            title_en = EXCLUDED.title_en,
            title_zh = EXCLUDED.title_zh,
            title_ko = EXCLUDED.title_ko,
            translated_at = NOW()
        `);

        stats.success++;
        results.push({
          productId: product.id,
          normalizedProductId: product.normalized_product_id,
          translations,
        });
      } else {
        stats.skipped++;
      }
    } catch (error) {
      console.error(`[enhance-content] Translation error for ${product.id}:`, error);
      stats.errors++;
    }
  }

  return { stats, results };
}

/**
 * YouTube動画連携
 * YouTube API で関連動画を検索して紐付け
 */
async function enhanceWithYouTube(
  db: ReturnType<typeof getDb>,
  limit: number
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };
  const results: any[] = [];

  // YouTube連携がまだ設定されていない商品を取得
  const productsResult = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id
    FROM products p
    LEFT JOIN product_youtube_videos pyv ON p.id = pyv.product_id
    WHERE pyv.product_id IS NULL
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    title: string;
    normalized_product_id: string;
  }>;

  for (const product of products) {
    stats.totalProcessed++;

    try {
      // 1. まず品番で検索
      let videos = await searchYouTubeVideos(product.normalized_product_id, 3);

      // 2. 見つからない場合はタイトルからキーワード抽出して検索
      if (videos.length === 0 && product.title) {
        // タイトルから出演者名っぽいキーワードを抽出（2-8文字の日本語）
        const nameMatch = product.title.match(/[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]{2,8}/g);
        if (nameMatch && nameMatch.length > 0) {
          // 最初の名前らしき文字列で検索（AV/動画などのワードを除く）
          const keywords = nameMatch.filter(w =>
            !['無料', '動画', '女優', '作品', '収録', '出演'].includes(w)
          );
          if (keywords.length > 0) {
            const searchQuery = `${keywords[0]} AV`;
            videos = await searchYouTubeVideos(searchQuery, 3);
          }
        }
      }

      if (videos.length > 0) {
        // 最初の動画を紐付け
        const video = videos[0];

        await db.execute(sql`
          INSERT INTO product_youtube_videos (
            product_id,
            video_id,
            video_title,
            thumbnail_url,
            channel_title,
            linked_at
          )
          VALUES (
            ${product.id},
            ${video.id},
            ${video.title},
            ${video.thumbnailUrl},
            ${video.channelTitle},
            NOW()
          )
          ON CONFLICT (product_id, video_id)
          DO UPDATE SET
            video_title = EXCLUDED.video_title,
            thumbnail_url = EXCLUDED.thumbnail_url,
            linked_at = NOW()
        `);

        stats.success++;
        results.push({
          productId: product.id,
          normalizedProductId: product.normalized_product_id,
          video: {
            id: video.id,
            title: video.title,
          },
        });
      } else {
        stats.skipped++;
      }

      // レート制限
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[enhance-content] YouTube error for ${product.id}:`, error);
      stats.errors++;
    }
  }

  return { stats, results };
}

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'vision';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

    // API設定チェック
    const apiConfig = checkGoogleApiConfig();
    console.log(`[enhance-content] API Config:`, apiConfig);

    let result: { stats: Stats; results: any[] };

    switch (type) {
      case 'vision':
        if (!apiConfig.vision) {
          return NextResponse.json({
            success: false,
            error: 'Vision API not configured',
            config: apiConfig,
          }, { status: 400 });
        }
        result = await enhanceWithVisionAPI(db, limit);
        break;

      case 'translate':
        if (!apiConfig.translation) {
          return NextResponse.json({
            success: false,
            error: 'Translation API not configured',
            config: apiConfig,
          }, { status: 400 });
        }
        result = await enhanceWithTranslation(db, limit);
        break;

      case 'youtube':
        if (!apiConfig.youtube) {
          return NextResponse.json({
            success: false,
            error: 'YouTube API not configured',
            config: apiConfig,
          }, { status: 400 });
        }
        result = await enhanceWithYouTube(db, limit);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown enhancement type: ${type}`,
          availableTypes: ['vision', 'translate', 'youtube'],
        }, { status: 400 });
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      message: `Content enhancement (${type}) completed`,
      type,
      limit,
      stats: result.stats,
      sampleResults: result.results.slice(0, 5),
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error('[enhance-content] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
