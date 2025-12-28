/**
 * DUGA クローラー ハンドラー
 *
 * DUGA APIから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import type { DugaClient } from '../providers/duga-client';
import type { DbExecutor } from '../db-queries/types';

interface CrawlStats {
  totalFetched: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  rawDataSaved: number;
  videosAdded: number;
}

interface CrawlDugaHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
  getDugaClient: () => DugaClient;
}

export function createCrawlDugaHandler(deps: CrawlDugaHandlerDeps) {
  return async function GET(request: NextRequest) {
    // 認証チェック
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
      const dugaClient = deps.getDugaClient();

      // クエリパラメータからlimitを取得（デフォルト100）
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // 新着作品を取得
      const response = await dugaClient.getNewReleases(limit, offset);
      stats.totalFetched = response.items.length;

      for (const item of response.items) {
        try {
          // 1. 生JSONレスポンスを保存
          const rawResponseResult = await db.execute(sql`
            INSERT INTO duga_raw_responses (product_id, api_version, raw_json, fetched_at)
            VALUES (${item.productId}, '1.2', ${JSON.stringify(item)}::jsonb, NOW())
            ON CONFLICT (product_id)
            DO UPDATE SET
              raw_json = EXCLUDED.raw_json,
              fetched_at = EXCLUDED.fetched_at,
              updated_at = NOW()
            RETURNING id
          `);

          const rawDataId = (rawResponseResult.rows[0] as { id: number }).id;
          stats.rawDataSaved++;

          // 2. 正規化されたデータを保存
          const normalizedProductId = `duga-${item.productId}`;

          const productResult = await db.execute(sql`
            INSERT INTO products (
              normalized_product_id,
              title,
              description,
              release_date,
              duration,
              default_thumbnail_url,
              updated_at
            )
            VALUES (
              ${normalizedProductId},
              ${item.title || ''},
              ${item.description || null},
              ${item.releaseDate || null},
              ${item.duration || null},
              ${item.thumbnailUrl || null},
              NOW()
            )
            ON CONFLICT (normalized_product_id)
            DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              release_date = EXCLUDED.release_date,
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
              'DUGA',
              ${item.productId},
              ${item.affiliateUrl || ''},
              ${item.price || null},
              'API',
              NOW()
            )
            ON CONFLICT (product_id, asp_name)
            DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url,
              price = EXCLUDED.price,
              last_updated = NOW()
          `);

          // product_raw_data_links
          await db.execute(sql`
            INSERT INTO product_raw_data_links (
              product_id,
              source_type,
              raw_data_id
            )
            VALUES (
              ${productId},
              'duga_api',
              ${rawDataId}
            )
            ON CONFLICT (product_id, source_type, raw_data_id)
            DO NOTHING
          `);

          // サンプル動画URL（DUGAはAPIレスポンスに含まれる場合）
          if (item.sampleVideos && item.sampleVideos.length > 0) {
            for (let i = 0; i < item.sampleVideos.length; i++) {
              const videoUrl = item.sampleVideos[i];
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
                  'DUGA',
                  ${videoUrl},
                  'sample',
                  ${i}
                )
                ON CONFLICT DO NOTHING
                RETURNING id
              `);

              if (videoResult.rowCount && videoResult.rowCount > 0) {
                stats.videosAdded++;
              }
            }
          }

          // 出演者情報
          if (item.performers && item.performers.length > 0) {
            for (const performer of item.performers) {
              const performerResult = await db.execute(sql`
                INSERT INTO performers (name)
                VALUES (${performer.name})
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
          }

        } catch (error) {
          stats.errors++;
          console.error(`Error processing DUGA product ${item.productId}:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'DUGA crawl completed',
        stats,
        duration: `${duration}s`,
      });

    } catch (error) {
      console.error('DUGA crawl error:', error);
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
