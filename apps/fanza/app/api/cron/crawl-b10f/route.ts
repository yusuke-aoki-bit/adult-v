/**
 * b10f.jp クローラー API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * GET /api/cron/crawl-b10f
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';

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
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

function parseCsv(csv: string): B10fProduct[] {
  const lines = csv.split('\n');
  const products: B10fProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split(',');
    if (fields.length < 13) continue;

    products.push({
      productId: fields[0],
      releaseDate: fields[1],
      title: fields[2],
      captureCount: fields[3],
      imageType: fields[4],
      imageUrl: fields[5],
      productUrl: fields[6],
      description: fields[7],
      price: fields[8],
      duration: fields[9],
      brand: fields[10],
      category: fields[11],
      performers: fields[12],
    });
  }

  return products;
}

export async function GET(request: NextRequest) {
  // 認証チェック
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
    // クエリパラメータからlimitを取得（デフォルト500）
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '500');

    // 1. CSVダウンロード
    const csvData = await downloadCsv();

    // 2. 生CSVデータを保存
    const rawCsvResult = await db.execute(sql`
      INSERT INTO b10f_raw_csv (csv_data, fetched_at)
      VALUES (${csvData}, NOW())
      RETURNING id
    `);
    const rawCsvId = (rawCsvResult.rows[0] as { id: number }).id;
    stats.rawDataSaved++;

    // 3. CSVパース
    const products = parseCsv(csvData);
    const productsToProcess = products.slice(0, limit);
    stats.totalFetched = productsToProcess.length;

    // 4. 各商品を処理
    for (const item of productsToProcess) {
      try {
        const normalizedProductId = `b10f-${item.productId}`;
        const releaseDateParsed = item.releaseDate ? new Date(item.releaseDate) : null;
        const durationMinutes = item.duration ? parseInt(item.duration) : null;
        const priceYen = item.price ? parseInt(item.price) : null;

        // productsテーブルにupsert
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
            ${releaseDateParsed},
            ${durationMinutes},
            ${item.imageUrl || null},
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
            'b10f',
            ${item.productId},
            ${item.productUrl || ''},
            ${priceYen},
            'CSV',
            NOW()
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = EXCLUDED.affiliate_url,
            price = EXCLUDED.price,
            last_updated = NOW()
        `);

        // product_raw_data_linksにリレーション作成
        await db.execute(sql`
          INSERT INTO product_raw_data_links (
            product_id,
            source_type,
            raw_data_id
          )
          VALUES (
            ${productId},
            'b10f_csv',
            ${rawCsvId}
          )
          ON CONFLICT (product_id, source_type, raw_data_id)
          DO NOTHING
        `);

        // サンプル動画URL生成（b10fのパターン）
        if (item.imageUrl) {
          const baseImageUrl = item.imageUrl.replace(/\/1s\.jpg$/, '');
          const sampleVideoUrl = `${baseImageUrl}/s.mp4`;

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
              'b10f',
              ${sampleVideoUrl},
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

        // カテゴリ保存
        if (item.category && item.category !== '全ての作品') {
          const categoryResult = await db.execute(sql`
            INSERT INTO categories (name)
            VALUES (${item.category})
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `);
          const categoryId = (categoryResult.rows[0] as { id: number }).id;

          await db.execute(sql`
            INSERT INTO product_categories (product_id, category_id)
            VALUES (${productId}, ${categoryId})
            ON CONFLICT DO NOTHING
          `);
        }

        // 出演者情報保存
        if (item.performers && item.performers.trim()) {
          const performerNames = item.performers.split(',').map(n => n.trim()).filter(n => n);

          for (const performerName of performerNames) {
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
        }

      } catch (error) {
        stats.errors++;
        console.error(`Error processing product ${item.productId}:`, error);
      }
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
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    );
  }
}
