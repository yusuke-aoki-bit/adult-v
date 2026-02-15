/**
 * 動画バックフィル ハンドラー
 *
 * サンプル動画がない商品に対して、各ASPサイトから動画URLを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import type { DbExecutor } from '../db-queries/types';

const CONCURRENCY = 5;
const RATE_LIMIT_MS = 300;

interface BackfillStats {
  checked: number;
  updated: number;
  failed: number;
  skipped: number;
}

interface ProductToBackfill {
  id: number;
  normalized_product_id: string;
  asp_name: string;
  original_product_id: string;
}

async function fetchVideoFromMgs(productId: string): Promise<string | null> {
  try {
    const url = `https://www.mgstage.com/product/product_detail/${productId}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'adc=1',
      },
    });
    if (!response.ok) return null;
    const html = await response['text']();
    const $ = cheerio.load(html);

    // video sourceタグから取得
    const videoUrl = $('video source').attr('src');
    if (videoUrl) {
      return videoUrl.startsWith('http') ? videoUrl : `https://www.mgstage.com${videoUrl}`;
    }

    // data-video-url属性から取得
    const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
    if (dataVideoUrl) {
      return dataVideoUrl.startsWith('http') ? dataVideoUrl : `https://www.mgstage.com${dataVideoUrl}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchVideoFromDuga(productId: string): Promise<string | null> {
  try {
    const url = `https://duga.jp/ppv/${productId}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response['text']();
    const $ = cheerio.load(html);

    // video sourceタグから取得
    const videoUrl = $('video source').attr('src');
    if (videoUrl) {
      return videoUrl.startsWith('http') ? videoUrl : `https://duga.jp${videoUrl}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchVideoFromSokmil(productId: string): Promise<string | null> {
  try {
    const url = `https://www.sokmil.com/av/_item/item${productId}.htm`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response['text']();
    const $ = cheerio.load(html);

    // video sourceタグから取得
    const videoUrl = $('video source').attr('src');
    if (videoUrl) {
      return videoUrl.startsWith('http') ? videoUrl : `https://www.sokmil.com${videoUrl}`;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchVideoForProduct(asp: string, productId: string): Promise<string | null> {
  switch (asp.toUpperCase()) {
    case 'MGS':
      return fetchVideoFromMgs(productId);
    case 'DUGA':
      return fetchVideoFromDuga(productId);
    case 'SOKMIL':
      return fetchVideoFromSokmil(productId);
    default:
      return null;
  }
}

interface BackfillVideosHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createBackfillVideosHandler(deps: BackfillVideosHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();

    const stats: BackfillStats = {
      checked: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const aspFilter = url.searchParams.get('asp')?.toUpperCase();

      console.log(`[backfill-videos] Starting: limit=${limit}, asp=${aspFilter || 'all'}`);

      // サンプル動画がない商品を取得
      let query;
      if (aspFilter) {
        query = sql`
          SELECT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          LEFT JOIN product_videos pv ON p.id = pv.product_id
          WHERE pv.id IS NULL
            AND ps.asp_name = ${aspFilter}
          ORDER BY p.id DESC
          LIMIT ${limit}
        `;
      } else {
        query = sql`
          SELECT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          LEFT JOIN product_videos pv ON p.id = pv.product_id
          WHERE pv.id IS NULL
          ORDER BY p.id DESC
          LIMIT ${limit}
        `;
      }

      const result = await db.execute(query);
      const products = result.rows as unknown as ProductToBackfill[];

      console.log(`[backfill-videos] Found ${products.length} products without videos`);

      // p-limit で並列処理（外部サイトへの負荷を制限）
      const concurrencyLimit = pLimit(CONCURRENCY);
      const videoInserts: { productId: number; aspName: string; videoUrl: string; normalizedId: string }[] = [];

      await Promise.all(products.map(product => concurrencyLimit(async () => {
        stats.checked++;

        try {
          const videoUrl = await fetchVideoForProduct(
            product.asp_name,
            product.original_product_id
          );

          if (videoUrl) {
            videoInserts.push({
              productId: product['id'] as number,
              aspName: product.asp_name,
              videoUrl,
              normalizedId: product.normalized_product_id,
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }

          // レート制限（並列スロット内で待機）
          await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

        } catch (error) {
          stats.failed++;
          console.error(`[backfill-videos] Error for ${product.normalized_product_id}:`, error);
        }
      })));

      // バッチINSERT（収集した動画URLを一括挿入）
      if (videoInserts.length > 0) {
        const valuesClauses = videoInserts.map(
          (v) => sql`(${v.productId}, ${v.aspName}, ${v.videoUrl}, 'sample', 0)`
        );
        const valuesJoined = sql.join(valuesClauses, sql`, `);

        await db.execute(sql`
          INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
          VALUES ${valuesJoined}
          ON CONFLICT DO NOTHING
        `);

        for (const v of videoInserts) {
          console.log(`[backfill-videos] Added video: ${v.normalizedId}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'Video backfill completed',
        params: { limit, asp: aspFilter || 'all' },
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[backfill-videos] Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
        },
        { status: 500 }
      );
    }
  };
}
