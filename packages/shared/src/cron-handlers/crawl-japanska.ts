/**
 * Japanska クローラー ハンドラー
 *
 * Japanskaから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DbExecutor } from '../db-queries/types';
import { batchUpsertPerformers, batchInsertProductPerformers } from '../utils/batch-db';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface JapanskaProduct {
  movieId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  duration?: number;
}

const AFFILIATE_ID = '9512-1-001';
const LIST_PAGE_URL = 'https://www.japanska-xxx.com/category/list_0.html';

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
};

function generateAffiliateUrl(movieId: string): string {
  const hexId = parseInt(movieId).toString(16);
  return `https://wlink.golden-gateway.com/id/${AFFILIATE_ID}-${hexId}/`;
}

function isHomePage(html: string): boolean {
  return html.includes('<!--home.html-->') || (html.includes('幅広いジャンル') && html.includes('30日'));
}

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

/** リストページにアクセスしてtermid cookieを取得 */
async function acquireSessionCookie(): Promise<string | null> {
  // 戦略1: redirect: 'manual' でSet-Cookieを直接取得
  try {
    const response = await fetchWithTimeout(LIST_PAGE_URL, {
      headers: COMMON_HEADERS,
      redirect: 'manual',
    });
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(/termid=([^;]+)/);
    if (match?.[1]) {
      console.log('[crawl-japanska] Cookie acquired via manual redirect');
      return `termid=${match[1]}`;
    }
    const body = await response.text();
    void body;
    console.warn(
      `[crawl-japanska] Strategy 1 failed: status=${response.status}, set-cookie=${setCookie ? 'present' : 'empty'}`,
    );
  } catch (error) {
    console.warn(`[crawl-japanska] Strategy 1 error: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // 戦略2: redirect: 'follow' でリダイレクト後のcookieを取得
  try {
    const response = await fetchWithTimeout(LIST_PAGE_URL, {
      headers: COMMON_HEADERS,
      redirect: 'follow',
    });
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(/termid=([^;]+)/);
    if (match?.[1]) {
      console.log('[crawl-japanska] Cookie acquired via follow redirect');
      return `termid=${match[1]}`;
    }
    const body = await response.text();
    void body;
    console.warn(`[crawl-japanska] Strategy 2 failed: status=${response.status}, url=${response.url}`);
  } catch (error) {
    console.warn(`[crawl-japanska] Strategy 2 error: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // 戦略3: トップページから取得を試行
  try {
    const response = await fetchWithTimeout('https://www.japanska-xxx.com/', {
      headers: COMMON_HEADERS,
      redirect: 'manual',
    });
    const setCookie = response.headers.get('set-cookie') || '';
    const match = setCookie.match(/termid=([^;]+)/);
    if (match?.[1]) {
      console.log('[crawl-japanska] Cookie acquired via top page');
      return `termid=${match[1]}`;
    }
    console.warn(`[crawl-japanska] Strategy 3 failed: status=${response.status}`);
  } catch (error) {
    console.warn(`[crawl-japanska] Strategy 3 error: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  console.error('[crawl-japanska] All cookie acquisition strategies failed');
  return null;
}

async function parseDetailPage(movieId: string, cookie?: string): Promise<JapanskaProduct | null> {
  const url = `https://www.japanska-xxx.com/movie/detail_${movieId}.html`;

  try {
    const headers: Record<string, string> = {
      ...COMMON_HEADERS,
      Referer: LIST_PAGE_URL,
    };
    if (cookie) headers['Cookie'] = cookie;

    const response = await fetchWithTimeout(url, {
      headers,
      redirect: 'manual',
    });

    // 302 → home.htmlリダイレクトはcookie切れ
    if (response.status === 302) return null;
    if (!response.ok) return null;

    const html = await response['text']();

    if (isHomePage(html)) return null;

    let title = '';
    const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    if (movieTtlMatch?.[1]) {
      title = movieTtlMatch[1].trim();
    }
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch?.[1] && !ogTitleMatch[1].includes('JAPANSKA')) {
        title = ogTitleMatch[1].trim();
      }
    }
    if (!title || title.length > 100 || title.includes('幅広いジャンル')) {
      title = `Japanska-${movieId}`;
    }

    const descMatch =
      html.match(/<div[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch?.[1]
      ? descMatch[1]
          .replace(/<[^>]+>/g, '')
          .trim()
          .substring(0, 1000)
      : undefined;

    const performers: string[] = [];
    const actressLinkMatches = html.matchAll(/<a[^>]*href="[^"]*actress[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of actressLinkMatches) {
      const name = match[1]?.trim();
      if (name && !performers.includes(name) && !name.includes('女優一覧') && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    }

    let thumbnailUrl: string | undefined;
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      thumbnailUrl = ogImageMatch[1];
    }

    const durationMatch = html.match(/(\d+)分(\d+)?秒?/);
    const duration = durationMatch?.[1]
      ? parseInt(durationMatch[1]) + (durationMatch[2] ? Math.round(parseInt(durationMatch[2]) / 60) : 0)
      : undefined;

    let sampleVideoUrl: string | undefined;
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch?.[1]) {
      sampleVideoUrl = videoSrcMatch[1].startsWith('http')
        ? videoSrcMatch[1]
        : `https://www.japanska-xxx.com/${videoSrcMatch[1]}`;
    }

    const result: JapanskaProduct = {
      movieId,
      title,
      performers,
    };
    if (description !== undefined) result.description = description;
    if (thumbnailUrl !== undefined) result.thumbnailUrl = thumbnailUrl;
    if (sampleVideoUrl !== undefined) result.sampleVideoUrl = sampleVideoUrl;
    if (duration !== undefined) result.duration = duration;

    return result;
  } catch {
    return null;
  }
}

interface CrawlJapanskaHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlJapanskaHandler(deps: CrawlJapanskaHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

    const stats: CrawlStats = {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      rawDataSaved: 0,
      videosAdded: 0,
    };

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '50');

      // auto-resume: startパラメータ省略時、DBの最大IDから再開
      let startId: number;
      if (url.searchParams.has('start')) {
        startId = parseInt(url.searchParams.get('start')!);
      } else {
        const maxResult = await db.execute(sql`
          SELECT MAX(CAST(original_product_id AS INTEGER)) as max_id
          FROM product_sources WHERE asp_name = 'Japanska'
        `);
        const maxId = (maxResult.rows[0] as { max_id: number | null }).max_id;
        startId = maxId ? maxId + 1 : 35650;
        console.log(`[crawl-japanska] Auto-resume from id=${startId}`);
      }

      // セッションcookieを取得（termid必須）
      const cookie = await acquireSessionCookie();
      if (!cookie) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to acquire Japanska session cookie',
            stats,
          },
          { status: 502 },
        );
      }
      console.log(`[crawl-japanska] Session cookie acquired`);

      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 20;

      // バッチ用: 演者データ収集
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      for (let movieId = startId; movieId <= startId + 1000 && stats.totalFetched < limit; movieId++) {
        if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) break;
        if (Date.now() - startTime > TIME_LIMIT) {
          console.log(`[crawl-japanska] Time limit reached, processed ${stats.totalFetched}/${limit}`);
          break;
        }

        const product = await parseDetailPage(String(movieId), cookie);

        if (!product) {
          consecutiveNotFound++;
          continue;
        }

        consecutiveNotFound = 0;
        stats.totalFetched++;

        try {
          const normalizedProductId = `Japanska-${product.movieId}`;

          const detailUrl = `https://www.japanska-xxx.com/movie/detail_${product.movieId}.html`;
          const htmlResponse = await fetchWithTimeout(detailUrl, {
            headers: {
              ...COMMON_HEADERS,
              Referer: LIST_PAGE_URL,
              Cookie: cookie,
            },
          });
          const html = await htmlResponse.text();
          const hash = createHash('sha256').update(html).digest('hex');

          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES ('Japanska', ${product.movieId}, ${detailUrl}, ${html}, ${hash})
            ON CONFLICT (source, product_id) DO UPDATE SET
              html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, crawled_at = NOW()
          `);
          stats.rawDataSaved++;

          const productResult = await db.execute(sql`
            INSERT INTO products (normalized_product_id, title, description, duration, default_thumbnail_url, updated_at)
            VALUES (${normalizedProductId}, ${product['title']}, ${product['description'] || null}, ${product['duration'] || null}, ${product['thumbnailUrl'] || null}, NOW())
            ON CONFLICT (normalized_product_id) DO UPDATE SET
              title = EXCLUDED.title, description = EXCLUDED.description, duration = EXCLUDED.duration,
              default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
            RETURNING id, (xmax = 0) AS is_new
          `);

          const row = productResult.rows[0] as { id: number; is_new: boolean };
          const productId = row.id;
          if (row.is_new) stats.newProducts++;
          else stats.updatedProducts++;

          const affiliateUrl = generateAffiliateUrl(product.movieId);
          await db.execute(sql`
            INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, product_type, data_source, last_updated)
            VALUES (${productId}, 'Japanska', ${product.movieId}, ${affiliateUrl}, 'haishin', 'CRAWL', NOW())
            ON CONFLICT (product_id, asp_name) DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url, product_type = EXCLUDED.product_type, last_updated = NOW()
          `);

          // 出演者をバッチ用に収集
          if (product.performers.length > 0) {
            for (const name of product.performers) {
              allPerformerNames.add(name);
            }
            pendingPerformerLinks.push({ productId, performerNames: product.performers });
          }

          if (product['sampleVideoUrl']) {
            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${productId}, 'Japanska', ${product['sampleVideoUrl']}, 'sample', 0)
              ON CONFLICT DO NOTHING RETURNING id
            `);

            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          stats.errors++;
          console.error(`Error processing Japanska product ${product.movieId}:`, error);
        }
      }

      // バッチ: 演者UPSERT + 紐付けINSERT
      if (allPerformerNames.size > 0) {
        try {
          const performerData = [...allPerformerNames].map((name) => ({ name }));
          const upsertedPerformers = await batchUpsertPerformers(db, performerData);
          const nameToId = new Map(upsertedPerformers.map((p) => [p.name, p.id]));

          const links: { productId: number; performerId: number }[] = [];
          for (const { productId, performerNames } of pendingPerformerLinks) {
            for (const name of performerNames) {
              const performerId = nameToId.get(name);
              if (performerId) {
                links.push({ productId, performerId });
              }
            }
          }

          await batchInsertProductPerformers(db, links);
          console.log(`[crawl-japanska] Batch: ${allPerformerNames.size} performers, ${links.length} links`);
        } catch (error) {
          console.error('[crawl-japanska] Batch performer operation failed:', error);
          stats.errors++;
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'Japanska crawl completed',
        stats,
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('Japanska crawl error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 },
      );
    }
  };
}
