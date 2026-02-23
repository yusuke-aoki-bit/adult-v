/**
 * b10f.jp クローラー ハンドラー
 *
 * b10f.jp APIから商品CSVを取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
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

interface B10fProduct {
  productId: string;
  releaseDate: string;
  title: string;
  captureCount: string;
  imageType: string;
  imageUrl: string;
  productUrl: string;
  description: string;
  price: string;
  duration: string;
  brand: string;
  category: string;
  performers: string;
}

async function downloadCsv(): Promise<string> {
  const AFFILIATE_ID = '12556';
  const url = `https://b10f.jp/csv_home.php?all=1&atype=${AFFILIATE_ID}&nosep=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response['status']}: ${response.statusText}`);
  }

  return await response['text']();
}

function parseCsv(csv: string): B10fProduct[] {
  const lines = csv.split('\n');
  const products: B10fProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const fields = line.split(',');
    if (fields.length < 13) continue;

    products.push({
      productId: fields[0] ?? '',
      releaseDate: fields[1] ?? '',
      title: fields[2] ?? '',
      captureCount: fields[3] ?? '',
      imageType: fields[4] ?? '',
      imageUrl: fields[5] ?? '',
      productUrl: fields[6] ?? '',
      description: fields[7] ?? '',
      price: fields[8] ?? '',
      duration: fields[9] ?? '',
      brand: fields[10] ?? '',
      category: fields[11] ?? '',
      performers: fields[12] ?? '',
    });
  }

  return products;
}

interface CrawlB10fHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createCrawlB10fHandler(deps: CrawlB10fHandlerDeps) {
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
      const limit = parseInt(url.searchParams.get('limit') || '500');

      const csvData = await downloadCsv();

      const rawCsvResult = await db.execute(sql`
        INSERT INTO b10f_raw_csv (csv_data, fetched_at)
        VALUES (${csvData}, NOW())
        RETURNING id
      `);
      const rawCsvId = (rawCsvResult.rows[0] as { id: number }).id;
      stats.rawDataSaved++;

      const products = parseCsv(csvData);
      const productsToProcess = products.slice(0, limit);
      stats.totalFetched = productsToProcess.length;

      // バッチ用: 演者データ収集
      const allPerformerNames = new Set<string>();
      const pendingPerformerLinks: { productId: number; performerNames: string[] }[] = [];

      for (const item of productsToProcess) {
        if (Date.now() - startTime > TIME_LIMIT) {
          console.log(
            `[crawl-b10f] Time limit reached, processed ${stats.newProducts + stats.updatedProducts}/${productsToProcess.length}`,
          );
          break;
        }
        try {
          const normalizedProductId = `b10f-${item['productId']}`;
          const releaseDateParsed = item['releaseDate'] ? new Date(item['releaseDate']) : null;
          const durationMinutes = item['duration'] ? parseInt(item['duration']) : null;
          const priceYen = item['price'] ? parseInt(item['price']) : null;

          const productResult = await db.execute(sql`
            INSERT INTO products (normalized_product_id, title, description, release_date, duration, default_thumbnail_url, updated_at)
            VALUES (${normalizedProductId}, ${item['title'] || ''}, ${item['description'] || null}, ${releaseDateParsed}, ${durationMinutes}, ${item.imageUrl || null}, NOW())
            ON CONFLICT (normalized_product_id) DO UPDATE SET
              title = EXCLUDED.title, description = EXCLUDED.description, release_date = EXCLUDED.release_date,
              duration = EXCLUDED.duration, default_thumbnail_url = EXCLUDED.default_thumbnail_url, updated_at = NOW()
            RETURNING id, (xmax = 0) AS is_new
          `);

          const row = productResult.rows[0] as { id: number; is_new: boolean };
          const productId = row.id;
          if (row.is_new) stats.newProducts++;
          else stats.updatedProducts++;

          await db.execute(sql`
            INSERT INTO product_sources (product_id, asp_name, original_product_id, affiliate_url, price, product_type, data_source, last_updated)
            VALUES (${productId}, 'b10f', ${item['productId']}, ${item.productUrl || ''}, ${priceYen}, 'haishin', 'CSV', NOW())
            ON CONFLICT (product_id, asp_name) DO UPDATE SET
              affiliate_url = EXCLUDED.affiliate_url, price = EXCLUDED.price, product_type = EXCLUDED.product_type, last_updated = NOW()
          `);

          await db.execute(sql`
            INSERT INTO product_raw_data_links (product_id, source_type, raw_data_id)
            VALUES (${productId}, 'b10f_csv', ${rawCsvId})
            ON CONFLICT (product_id, source_type, raw_data_id) DO NOTHING
          `);

          if (item.imageUrl) {
            const baseImageUrl = item.imageUrl.replace(/\/1s\.jpg$/, '');
            const sampleVideoUrl = `${baseImageUrl}/s.mp4`;

            const videoResult = await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${productId}, 'b10f', ${sampleVideoUrl}, 'sample', 0)
              ON CONFLICT DO NOTHING RETURNING id
            `);

            if (videoResult.rowCount && videoResult.rowCount > 0) {
              stats.videosAdded++;
            }
          }

          if (item.category && item.category !== '全ての作品') {
            const categoryResult = await db.execute(sql`
              INSERT INTO categories (name) VALUES (${item.category})
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
            `);
            const categoryId = (categoryResult.rows[0] as { id: number }).id;

            await db.execute(sql`
              INSERT INTO product_categories (product_id, category_id)
              VALUES (${productId}, ${categoryId}) ON CONFLICT DO NOTHING
            `);
          }

          // 出演者をバッチ用に収集
          if (item.performers && item.performers.trim()) {
            const performerNames = item.performers
              .split(',')
              .map((n) => n.trim())
              .filter((n) => n);
            for (const name of performerNames) {
              allPerformerNames.add(name);
            }
            pendingPerformerLinks.push({ productId, performerNames });
          }
        } catch (error) {
          stats.errors++;
          console.error(`Error processing product ${item['productId']}:`, error);
        }
      }

      // バッチ: 演者UPSERT + 紐付けINSERT
      if (allPerformerNames.size > 0) {
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
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: 'b10f crawl completed',
        stats,
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('b10f crawl error:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error', stats },
        { status: 500 },
      );
    }
  };
}
