/**
 * 画像バックフィル ハンドラー
 *
 * サムネイル画像がない商品に対して、各ASPサイトから画像を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import type { DbExecutor } from '../db-queries/types';

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

async function fetchImageFromMgs(productId: string): Promise<string | null> {
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
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

async function fetchImageFromDuga(productId: string): Promise<string | null> {
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
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

async function fetchImageFromSokmil(productId: string): Promise<string | null> {
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
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

async function fetchImageFromFanza(productId: string): Promise<string | null> {
  try {
    const url = `https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=${productId}/`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response['text']();
    const $ = cheerio.load(html);
    return $('meta[property="og:image"]').attr('content') || null;
  } catch {
    return null;
  }
}

async function fetchImageForProduct(asp: string, productId: string): Promise<string | null> {
  switch (asp.toUpperCase()) {
    case 'MGS':
      return fetchImageFromMgs(productId);
    case 'DUGA':
      return fetchImageFromDuga(productId);
    case 'SOKMIL':
      return fetchImageFromSokmil(productId);
    case 'FANZA':
    case 'DMM':
      return fetchImageFromFanza(productId);
    default:
      return null;
  }
}

interface BackfillImagesHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createBackfillImagesHandler(deps: BackfillImagesHandlerDeps) {
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

      console.log(`[backfill-images] Starting: limit=${limit}, asp=${aspFilter || 'all'}`);

      // サムネイルがない商品を取得
      let query;
      if (aspFilter) {
        query = sql`
          SELECT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          WHERE p.default_thumbnail_url IS NULL
            AND ps.asp_name = ${aspFilter}
          ORDER BY p.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        query = sql`
          SELECT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          WHERE p.default_thumbnail_url IS NULL
          ORDER BY p.created_at DESC
          LIMIT ${limit}
        `;
      }

      const result = await db.execute(query);
      const products = result.rows as unknown as ProductToBackfill[];

      console.log(`[backfill-images] Found ${products.length} products without thumbnails`);

      for (const product of products) {
        stats.checked++;

        try {
          const imageUrl = await fetchImageForProduct(
            product.asp_name,
            product.original_product_id
          );

          if (imageUrl) {
            await db.execute(sql`
              UPDATE products
              SET default_thumbnail_url = ${imageUrl}, updated_at = NOW()
              WHERE id = ${product['id']}
            `);
            stats.updated++;
            console.log(`[backfill-images] Updated: ${product.normalized_product_id}`);
          } else {
            stats.skipped++;
          }

          // レート制限
          await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
          stats.failed++;
          console.error(`[backfill-images] Error for ${product.normalized_product_id}:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'Image backfill completed',
        params: { limit, asp: aspFilter || 'all' },
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('[backfill-images] Error:', error);
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
