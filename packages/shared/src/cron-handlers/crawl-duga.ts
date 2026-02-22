/**
 * DUGA クローラー ハンドラー
 *
 * DUGA APIから新着作品を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import type { DugaClient } from '../providers/duga-client';
import type { DbExecutor } from '../db-queries/types';
import {
  batchUpsertPerformers,
  batchInsertProductPerformers,
} from '../utils/batch-db';

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
      const dugaClient = deps.getDugaClient();

      const url = new URL(request['url']);
      const perPage = 100; // APIの最大値

      // auto-resume: offsetパラメータ省略時、DB件数から自動計算
      let currentOffset: number;
      if (url.searchParams.has('offset')) {
        currentOffset = parseInt(url.searchParams.get('offset')!);
      } else {
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM duga_raw_responses
        `);
        currentOffset = parseInt(String((countResult.rows[0] as { cnt: string }).cnt)) || 0;
        console.log(`[crawl-duga] Auto-resume from offset=${currentOffset}`);
      }

      const initialOffset = currentOffset;

      // バッチ用: 演者データ収集（ページごとにフラッシュ）
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      async function flushPerformerBatch() {
        if (allPerformerNames.size === 0) return;
        const performerData = [...allPerformerNames].map(name => ({ name }));
        const upsertedPerformers = await batchUpsertPerformers(db, performerData);
        const nameToId = new Map(upsertedPerformers.map(p => [p.name, p.id]));
        const links: { productId: number; performerId: number }[] = [];
        for (const { productId, performerNames } of pendingPerformerLinks) {
          for (const name of performerNames) {
            const performerId = nameToId.get(name);
            if (performerId) links.push({ productId, performerId });
          }
        }
        await batchInsertProductPerformers(db, links);
        allPerformerNames.clear();
        pendingPerformerLinks.length = 0;
      }

      // ページネーションループ: 時間制限内で複数ページを取得
      while (Date.now() - startTime < TIME_LIMIT) {
        const response = await dugaClient.getNewReleases(perPage, currentOffset);

        if (response.items.length === 0) {
          console.log(`[crawl-duga] No more items at offset=${currentOffset}`);
          break;
        }

        for (const item of response.items) {
          try {
            // 1. 生JSONレスポンスを保存
            const rawResponseResult = await db.execute(sql`
              INSERT INTO duga_raw_responses (product_id, api_version, raw_json, fetched_at)
              VALUES (${item['productId']}, '1.2', ${JSON.stringify(item)}::jsonb, NOW())
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
            const normalizedProductId = `duga-${item['productId']}`;

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
                ${item['title'] || ''},
                ${item['description'] || null},
                ${item['releaseDate'] || null},
                ${item['duration'] || null},
                ${item['thumbnailUrl'] || null},
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
              RETURNING id, (xmax = 0) AS is_new
            `);

            const row = productResult.rows[0] as { id: number; is_new: boolean };
            const productId = row.id;

            if (row.is_new) {
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
                product_type,
                data_source,
                last_updated
              )
              VALUES (
                ${productId},
                'DUGA',
                ${item['productId']},
                ${item['affiliateUrl'] || ''},
                ${item['price'] || null},
                'haishin',
                'API',
                NOW()
              )
              ON CONFLICT (product_id, asp_name)
              DO UPDATE SET
                affiliate_url = EXCLUDED.affiliate_url,
                price = EXCLUDED.price,
                product_type = EXCLUDED.product_type,
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
              const videoValuesClauses = item.sampleVideos.map((videoUrl: string, i: number) =>
                sql`(${productId}, 'DUGA', ${videoUrl}, 'sample', ${i})`
              );
              const videoResult = await db.execute(sql`
                INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
                VALUES ${sql.join(videoValuesClauses, sql`, `)}
                ON CONFLICT DO NOTHING
              `);
              stats.videosAdded += videoResult.rowCount ?? 0;
            }

            // 出演者をバッチ用に収集
            if (item.performers && item.performers.length > 0) {
              const names = item.performers.map((p: { name: string }) => p['name']);
              for (const name of names) {
                allPerformerNames.add(name);
              }
              pendingPerformerLinks.push({ productId, performerNames: names });
            }

            stats.totalFetched++;

          } catch (error) {
            stats.errors++;
            console.error(`Error processing DUGA product ${item['productId']}:`, error);
          }
        }

        currentOffset += response.items.length;

        // ページ終了時に演者バッチをフラッシュ（タイムアウトによるデータロス防止）
        await flushPerformerBatch();

        // 時間チェック（次のAPIコールに十分な時間があるか）
        if (Date.now() - startTime > TIME_LIMIT) break;
      }

      // 最終フラッシュ（ループ途中で抜けた場合の残りデータ）
      await flushPerformerBatch();

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'DUGA crawl completed',
        stats,
        resumeInfo: {
          initialOffset,
          nextOffset: currentOffset,
          pagesProcessed: Math.ceil((currentOffset - initialOffset) / perPage),
        },
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
