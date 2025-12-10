/**
 * FC2 クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-fc2
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface FC2Product {
  articleId: string;
  title: string;
  description?: string;
  performers: string[];
  thumbnailUrl?: string;
  sampleVideoUrl?: string;
  duration?: number;
  price?: number;
}

const FC2_AFFUID = process.env.FC2_AFFUID || 'TVRFNU5USTJOVEE9';

function generateAffiliateUrl(articleId: string): string {
  return `https://adult.contents.fc2.com/aff.php?aid=${articleId}&affuid=${FC2_AFFUID}`;
}

async function fetchArticleIds(page: number = 1): Promise<string[]> {
  const url = `https://adult.contents.fc2.com/newrelease.php?page=${page}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();

    const articleIds: string[] = [];
    const matches = html.matchAll(/\/article\/(\d+)\//g);
    for (const match of matches) {
      const id = match[1];
      if (!articleIds.includes(id)) {
        articleIds.push(id);
      }
    }

    return articleIds;
  } catch {
    return [];
  }
}

async function parseDetailPage(articleId: string): Promise<FC2Product | null> {
  const url = `https://adult.contents.fc2.com/article/${articleId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // タイトル抽出
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].trim();
    }
    if (!title) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].trim();
      }
    }
    if (!title || title.length > 200) {
      title = `FC2-${articleId}`;
    }

    // 説明抽出
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const description = descMatch ? descMatch[1].trim().substring(0, 1000) : undefined;

    // 出演者抽出
    const performers: string[] = [];
    const performerMatches = html.matchAll(/<a[^>]*href="[^"]*(?:actress|performer|cast)[^"]*"[^>]*>([^<]+)<\/a>/gi);
    for (const match of performerMatches) {
      const name = match[1].trim();
      if (name && !performers.includes(name) && name.length > 1 && name.length < 30) {
        performers.push(name);
      }
    }

    // サムネイル抽出
    const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    const thumbnailUrl = thumbMatch ? thumbMatch[1] : undefined;

    // 再生時間抽出
    const durationMatch = html.match(/(\d+)\s*分/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : undefined;

    // 価格抽出
    const priceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*(?:円|pt|ポイント)/);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : undefined;

    // サンプル動画URL抽出
    let sampleVideoUrl: string | undefined;
    const videoSrcMatch = html.match(/<source[^>]*src="([^"]+\.mp4)"/i);
    if (videoSrcMatch) {
      sampleVideoUrl = videoSrcMatch[1];
    }

    return {
      articleId,
      title,
      description,
      performers,
      thumbnailUrl,
      sampleVideoUrl,
      duration,
      price,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
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
    const startPage = parseInt(url.searchParams.get('page') || '1');
    const endPage = parseInt(url.searchParams.get('endPage') || '5');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    for (let page = startPage; page <= endPage && stats.totalFetched < limit; page++) {
      const articleIds = await fetchArticleIds(page);

      if (articleIds.length === 0) {
        break;
      }

      for (const articleId of articleIds) {
        if (stats.totalFetched >= limit) break;

        const product = await parseDetailPage(articleId);

        if (!product) {
          continue;
        }

        stats.totalFetched++;

        try {
          const normalizedProductId = `FC2-${product.articleId}`;

          // 生HTMLデータを保存
          const detailUrl = `https://adult.contents.fc2.com/article/${product.articleId}/`;
          const htmlResponse = await fetch(detailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          const html = await htmlResponse.text();
          const hash = createHash('sha256').update(html).digest('hex');

          await db.execute(sql`
            INSERT INTO raw_html_data (source, product_id, url, html_content, hash)
            VALUES ('FC2', ${product.articleId}, ${detailUrl}, ${html}, ${hash})
            ON CONFLICT (source, product_id)
            DO UPDATE SET
              html_content = EXCLUDED.html_content,
              hash = EXCLUDED.hash,
              fetched_at = NOW()
          `);
          stats.rawDataSaved++;

          // 商品データを保存
          const productResult = await db.execute(sql`
            INSERT INTO products (
              normalized_product_id,
              title,
              description,
              duration,
              default_thumbnail_url,
              updated_at
            )
            VALUES (
              ${normalizedProductId},
              ${product.title},
              ${product.description || null},
              ${product.duration || null},
              ${product.thumbnailUrl || null},
              NOW()
            )
            ON CONFLICT (normalized_product_id)
            DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              duration = EXCLUDED.duration,
              default_thumbnail_url = EXCLUDED.default_thumbnail_url,
              updated_at = NOW()
            RETURNING id
          `);

          const productId = (productResult.rows[0] as { id: number }).id;
          const isNew = productResult.rowCount === 1;

          if (isNew) {
            stats.newProducts++;
          } else {
            stats.updatedProducts++;
          }

          // product_sourcesにupsert
          const affiliateUrl = generateAffiliateUrl(product.articleId);
          await db.execute(sql`
            INSERT INTO product_sources (
              product_id,
              asp_name,
              original_product_id,
              affiliate_url,
              price,
              data_source,
              last_updated
            )
            VALUES (
              ${productId},
              'FC2',
              ${product.articleId},
              ${affiliateUrl},
              ${product.price || null},
              'CRAWL',
              NOW()
            )
            ON CONFLICT (product_id, asp_name)
            DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url,
              price = EXCLUDED.price,
              last_updated = NOW()
          `);

          // 出演者情報
          for (const performerName of product.performers) {
            const performerResult = await db.execute(sql`
              INSERT INTO performers (name)
              VALUES (${performerName})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `);
            const performerId = (performerResult.rows[0] as { id: number }).id;

            await db.execute(sql`
              INSERT INTO product_performers (product_id, performer_id)
              VALUES (${productId}, ${performerId})
              ON CONFLICT DO NOTHING
            `);
          }

          // サンプル動画
          if (product.sampleVideoUrl) {
            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (
                product_id,
                asp_name,
                video_url,
                video_type,
                display_order
              )
              VALUES (
                ${productId},
                'FC2',
                ${product.sampleVideoUrl},
                'sample',
                0
              )
              ON CONFLICT DO NOTHING
              RETURNING id
            `);

            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

          // レート制限
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          stats.errors++;
          console.error(`Error processing FC2 product ${product.articleId}:`, error);
        }
      }

      // ページ間の待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      message: 'FC2 crawl completed',
      stats,
      duration: `${duration}s`,
    });

  } catch (error) {
    console.error('FC2 crawl error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    );
  }
}
