/**
 * 画像バックフィル ハンドラー
 *
 * サムネイル画像がない商品に対して、各ASPサイトから画像を取得
 * 並列処理（5並列）で高速化
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import type { DbExecutor } from '../db-queries/types';

// 並列処理の同時実行数
const CONCURRENCY = 5;

const FETCH_TIMEOUT = 15_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

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
    const response = await fetchWithTimeout(url, {
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
    const response = await fetchWithTimeout(url, {
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
    const response = await fetchWithTimeout(url, {
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
    const response = await fetchWithTimeout(url, {
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

async function fetchImageFromFc2(productId: string): Promise<string | null> {
  try {
    const url = `https://adult.contents.fc2.com/article/${productId}/`;
    const response = await fetchWithTimeout(url, {
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

async function fetchImageFromDti(productId: string, provider: string): Promise<string | null> {
  try {
    // DTI系サイトのURL形式
    const baseUrls: Record<string, string> = {
      'CARIBBEAN': 'https://www.caribbeancom.com/moviepages/',
      'CARIBBEANCOMPR': 'https://www.caribbeancompr.com/moviepages/',
      '1PONDO': 'https://www.1pondo.tv/movies/',
      'HEYZO': 'https://www.heyzo.com/moviepages/',
      '10MUSUME': 'https://www.10musume.com/moviepages/',
      'PACOPACOMAMA': 'https://www.pacopacomama.com/moviepages/',
    };

    const baseUrl = baseUrls[provider.toUpperCase()];
    if (!baseUrl) return null;

    const url = `${baseUrl}${productId}/`;
    const response = await fetchWithTimeout(url, {
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

async function fetchImageFromB10f(productId: string): Promise<string | null> {
  try {
    // B10Fは商品IDからサムネイルURLを推測
    // 例: aff_movie_12345.jpg
    const idMatch = productId.match(/(\d+)/);
    if (idMatch && idMatch[1]) {
      return `https://image.b10f.jp/aff_movie_${idMatch[1]}.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchImageForProduct(asp: string, productId: string): Promise<string | null> {
  const aspUpper = asp.toUpperCase();

  switch (aspUpper) {
    case 'MGS':
      return fetchImageFromMgs(productId);
    case 'DUGA':
      return fetchImageFromDuga(productId);
    case 'SOKMIL':
      return fetchImageFromSokmil(productId);
    case 'FANZA':
    case 'DMM':
      return fetchImageFromFanza(productId);
    case 'FC2':
      return fetchImageFromFc2(productId);
    case 'B10F':
      return fetchImageFromB10f(productId);
    case 'CARIBBEAN':
    case 'CARIBBEANCOMPR':
    case '1PONDO':
    case 'HEYZO':
    case '10MUSUME':
    case 'PACOPACOMAMA':
      return fetchImageFromDti(productId, aspUpper);
    default:
      return null;
  }
}

/**
 * 複数ASPを試してフォールバック取得
 * 各リクエスト間にレート制限を挿入
 */
async function fetchImageWithFallback(
  primaryAsp: string,
  productId: string,
  normalizedProductId: string
): Promise<string | null> {
  // まずプライマリASPで試行
  const primaryResult = await fetchImageForProduct(primaryAsp, productId);
  if (primaryResult) return primaryResult;

  // 商品コードからASPを推測してフォールバック
  const normalizedUpper = normalizedProductId.toUpperCase();

  // FANZA系商品コードパターン
  if (/^[A-Z]{2,5}-?\d{3,5}$/.test(normalizedUpper.replace(/^FANZA-/, '').replace(/^MGS-/, ''))) {
    const possibleId = normalizedUpper.replace(/^(FANZA|MGS)-/, '').replace(/-/g, '').toLowerCase();

    if (primaryAsp !== 'FANZA') {
      await new Promise(r => setTimeout(r, 200)); // フォールバック間レート制限
      const fanzaResult = await fetchImageFromFanza(possibleId);
      if (fanzaResult) return fanzaResult;
    }

    if (primaryAsp !== 'MGS') {
      await new Promise(r => setTimeout(r, 200)); // フォールバック間レート制限
      const mgsResult = await fetchImageFromMgs(possibleId);
      if (mgsResult) return mgsResult;
    }
  }

  return null;
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
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

    const stats: BackfillStats = {
      checked: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      const url = new URL(request['url']);
      const queryLimit = parseInt(url.searchParams.get('limit') || '50');
      const aspFilter = url.searchParams.get('asp')?.toUpperCase();

      console.log(`[backfill-images] Starting: limit=${queryLimit}, asp=${aspFilter || 'all'}`);

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
          LIMIT ${queryLimit}
        `;
      } else {
        query = sql`
          SELECT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
          FROM products p
          JOIN product_sources ps ON p.id = ps.product_id
          WHERE p.default_thumbnail_url IS NULL
          ORDER BY p.created_at DESC
          LIMIT ${queryLimit}
        `;
      }

      const result = await db.execute(query);
      const products = result.rows as unknown as ProductToBackfill[];

      console.log(`[backfill-images] Found ${products.length} products without thumbnails`);

      // 並列処理で高速化（レート制限付き）
      const concurrencyLimit = pLimit(CONCURRENCY);
      const pendingUpdates: { id: number; url: string }[] = [];

      const processProduct = async (product: ProductToBackfill) => {
        if (Date.now() - startTime > TIME_LIMIT) return;
        stats.checked++;

        try {
          // フォールバック機能付きで画像取得
          const imageUrl = await fetchImageWithFallback(
            product.asp_name,
            product.original_product_id,
            product.normalized_product_id
          );

          if (imageUrl) {
            pendingUpdates.push({ id: product['id'], url: imageUrl });
            stats.updated++;
            console.log(`[backfill-images] Updated: ${product.normalized_product_id}`);
          } else {
            stats.skipped++;
          }

          // レート制限（各リクエスト後に200ms待機）
          await new Promise(r => setTimeout(r, 200));

        } catch (error) {
          stats.failed++;
          console.error(`[backfill-images] Error for ${product.normalized_product_id}:`, error);
        }
      };

      // 並列実行
      await Promise.all(products.map(product => concurrencyLimit(() => processProduct(product))));

      // バッチUPDATE（N+1回のUPDATEを1回にまとめる）
      if (pendingUpdates.length > 0) {
        const caseClauses = pendingUpdates.map(u => sql`WHEN id = ${u.id} THEN ${u.url}`);
        const caseJoined = sql.join(caseClauses, sql` `);
        const ids = sql.join(pendingUpdates.map(u => sql`${u.id}`), sql`, `);
        await db.execute(sql`
          UPDATE products
          SET default_thumbnail_url = CASE ${caseJoined} END,
              updated_at = NOW()
          WHERE id IN (${ids})
        `);
        console.log(`[backfill-images] Batch updated ${pendingUpdates.length} products`);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'Image backfill completed',
        params: { limit: queryLimit, asp: aspFilter || 'all' },
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
