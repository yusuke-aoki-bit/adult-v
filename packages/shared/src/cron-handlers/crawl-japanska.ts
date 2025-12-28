/**
 * Japanska クローラー ハンドラー
 *
 * Japanskaから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DbExecutor } from '../db-queries/types';

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

function generateAffiliateUrl(movieId: string): string {
  const hexId = parseInt(movieId).toString(16);
  return `https://wlink.golden-gateway.com/id/${AFFILIATE_ID}-${hexId}/`;
}

function isHomePage(html: string): boolean {
  return html.includes('<!--home.html-->') ||
         (html.includes('幅広いジャンル') && html.includes('30日'));
}

async function parseDetailPage(movieId: string): Promise<JapanskaProduct | null> {
  const url = `https://www.japanska-xxx.com/movie/detail_${movieId}.html`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': LIST_PAGE_URL,
      },
    });

    if (!response.ok) return null;

    const html = await response.text();

    if (isHomePage(html)) return null;

    let title = '';
    const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    if (movieTtlMatch) {
      title = movieTtlMatch[1].trim();
    }
    if (!title) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch && !ogTitleMatch[1].includes('JAPANSKA')) {
        title = ogTitleMatch[1].trim();
      }
    }
    if (!title || title.length > 100 || title.includes('幅広いジャンル')) {
      title = `Japanska-${movieId}`;
    }

    const descMatch = html.match(/<div[^>]*class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim().substring(0, 1000) : undefined;

    const performers: string[] = [];
    const actressLinkMatches = html.matchAll(/<a[^>]*href="[^"]*actress[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of actressLinkMatches) {
      const name = match[1].trim();
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
    const duration = durationMatch
      ? parseInt(durationMatch[1]) + (durationMatch[2] ? Math.round(parseInt(durationMatch[2]) / 60) : 0)
      : undefined;

    let sampleVideoUrl: string | undefined;
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch) {
      sampleVideoUrl = videoSrcMatch[1].startsWith('http')
        ? videoSrcMatch[1]
        : `https://www.japanska-xxx.com/${videoSrcMatch[1]}`;
    }

    return {
      movieId,
      title,
      description,
      performers,
      thumbnailUrl,
      sampleVideoUrl,
      duration,
    };
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

    const stats: CrawlStats = {
      totalFetched: 0,
      newProducts: 0,
      updatedProducts: 0,
      errors: 0,
      rawDataSaved: 0,
      videosAdded: 0,
    };

    try {
      const url = new URL(request.url);
      const startId = parseInt(url.searchParams.get('start') || '34000');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 20;

      for (let movieId = startId; movieId <= startId + 1000 && stats.totalFetched < limit; movieId++) {
        if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) break;

        const product = await parseDetailPage(String(movieId));

        if (!product) {
          consecutiveNotFound++;
          continue;
        }

        consecutiveNotFound = 0;
        stats.totalFetched++;

        try {
          const normalizedProductId = `Japanska-${product.movieId}`;

          const detailUrl = `https://www.japanska-xxx.com/movie/detail_${product.movieId}.html`;
          const htmlResponse = await fetch(detailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': LIST_PAGE_URL,
            },
          });
          const html = await htmlResponse.text();
          const hash = createHash('sha256').update(html).digest('hex');

          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES ('Japanska', ${product.movieId}, ${detailUrl}, ${html}, ${hash})
            ON CONFLICT (source, product_id) DO UPDATE SET
              html_content = EXCLUDED.html_content, hash = EXCLUDED.hash, fetched_at = NOW()
          `);
          stats.rawDataSaved++;

          const productResult = await db.execute(sql`
            INSERT INTO products (normalized_product_id, title, description, duration, default_thumbnail_url, updated_at)
            VALUES (${normalizedProductId}, ${product.title}, ${product.description || null}, ${product.duration || null}, ${product.thumbnailUrl || null}, NOW())
            ON CONFLICT (normalized_product_id) DO UPDATE SET
              title = EXCLUDED.title, description = EXCLUDED.description, duration = EXCLUDED.duration,
              default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
            RETURNING id
          `);

          const productId = (productResult.rows[0] as { id: number }).id;
          if (productResult.rowCount === 1) stats.newProducts++; else stats.updatedProducts++;

          const affiliateUrl = generateAffiliateUrl(product.movieId);
          await db.execute(sql`
            INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, data_source, last_updated)
            VALUES (${productId}, 'Japanska', ${product.movieId}, ${affiliateUrl}, 'CRAWL', NOW())
            ON CONFLICT (product_id, asp_name) DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url, last_updated = NOW()
          `);

          for (const performerName of product.performers) {
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name) VALUES (${performerName})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
            `);
            const performerId = (performerResult.rows[0] as { id: number }).id;

            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id) VALUES (${productId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
          }

          if (product.sampleVideoUrl) {
            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${productId}, 'Japanska', ${product.sampleVideoUrl}, 'sample', 0)
              ON CONFLICT DO NOTHING RETURNING id
            `);

            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          stats.errors++;
          console.error(`Error processing Japanska product ${product.movieId}:`, error);
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
        { status: 500 }
      );
    }
  };
}
