/**
 * Raw Data 処理 API エンドポイント
 *
 * Cloud Schedulerから定期的に呼び出される
 * raw_html_dataテーブルの未処理データを処理
 * GET /api/cron/process-raw-data
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

interface ProcessStats {
  totalProcessed: number;
  newProducts: number;
  updatedProducts: number;
  errors: number;
  videosAdded: number;
}

interface RawHtmlRow {
  id: number;
  source: string;
  product_id: string;
  html_content: string;
  url?: string;
}

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
  const startTime = Date.now();

  const stats: ProcessStats = {
    totalProcessed: 0,
    newProducts: 0,
    updatedProducts: 0,
    errors: 0,
    videosAdded: 0,
  };

  try {
    // クエリパラメータ
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '500');
    const source = url.searchParams.get('source') || null; // 特定ソースのみ処理

    // 未処理のraw_html_dataを取得
    let query;
    if (source) {
      query = sql`
        SELECT id, source, product_id, html_content, url
        FROM raw_html_data
        WHERE processed_at IS NULL
          AND source = ${source}
        ORDER BY crawled_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT id, source, product_id, html_content, url
        FROM raw_html_data
        WHERE processed_at IS NULL
        ORDER BY crawled_at DESC
        LIMIT ${limit}
      `;
    }

    const rawDataResult = await db.execute(query);
    const rawDataRows = rawDataResult.rows as unknown as RawHtmlRow[];

    for (const row of rawDataRows) {
      try {
        stats.totalProcessed++;

        const $ = cheerio.load(row.html_content);
        let title = '';
        let description = '';
        let releaseDate: string | null = null;
        let duration: number | null = null;
        let thumbnailUrl: string | null = null;
        let sampleVideoUrl: string | null = null;
        let performerNames: string[] = [];
        let price: number | null = null;

        // ソースに応じてパース
        if (row.source.includes('1pondo') || row.source.includes('caribbeancom')) {
          // DTI sites parsing
          title = $('h1').first().text().trim() || $('title').text().trim();
          description = $('meta[name="description"]').attr('content') || '';

          // サンプル動画URL生成
          if (row.product_id.match(/^\d{6}_\d{3}$/)) {
            if (row.source.includes('1pondo')) {
              sampleVideoUrl = `https://smovie.1pondo.tv/sample/movies/${row.product_id}/1080p.mp4`;
            } else if (row.source.includes('caribbeancom')) {
              sampleVideoUrl = `https://www.caribbeancom.com/moviepages/${row.product_id}/sample/sample.mp4`;
            }
          }
        } else if (row.source === 'MGS' || row.source.includes('mgstage')) {
          // MGS parsing
          title = $('h1.tag').text().trim() || $('title').text().trim();
          const releaseDateText = $('th:contains("配信開始日")').next('td').text().trim();
          if (releaseDateText) {
            releaseDate = releaseDateText.replace(/\//g, '-');
          }

          // 出演者
          $('th:contains("出演")').next('td').find('a').each((_, elem) => {
            const name = $(elem).text().trim();
            if (name) performerNames.push(name);
          });

          // MGSサンプル動画URL生成
          const productIdLower = row.product_id.toLowerCase();
          const parts = row.product_id.split('-');
          if (parts.length >= 2) {
            const prefix = parts[0].toLowerCase();
            let category = 'amateur';
            if (/^(abw|stars|sdjs|sdab)$/i.test(prefix)) {
              category = 'sod';
            }
            sampleVideoUrl = `https://sample.mgstage.com/sample/${category}/${prefix}/${productIdLower}/${productIdLower}_sample.mp4`;
          }
        } else if (row.source === 'FC2' || row.source.includes('fc2')) {
          // FC2 parsing
          title = $('title').text().trim();
          description = $('meta[name="description"]').attr('content') || '';
        } else if (row.source.includes('japanska')) {
          // Japanska parsing
          title = $('h1').first().text().trim() || $('title').text().trim();
          description = $('meta[name="description"]').attr('content') || '';
        }

        // 最低限のタイトルがある場合のみ保存
        if (!title) {
          title = row.product_id;
        }

        // normalized_product_id生成
        const sourcePrefix = row.source.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedProductId = `${sourcePrefix}-${row.product_id}`;

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
            ${title},
            ${description || null},
            ${releaseDate ? new Date(releaseDate) : null},
            ${duration},
            ${thumbnailUrl},
            NOW()
          )
          ON CONFLICT (normalized_product_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = COALESCE(EXCLUDED.description, products.description),
            release_date = COALESCE(EXCLUDED.release_date, products.release_date),
            duration = COALESCE(EXCLUDED.duration, products.duration),
            default_thumbnail_url = COALESCE(EXCLUDED.default_thumbnail_url, products.default_thumbnail_url),
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

        // ASP名を決定
        let aspName = 'DTI';
        if (row.source.includes('MGS') || row.source.includes('mgstage')) {
          aspName = 'MGS';
        } else if (row.source.includes('FC2') || row.source.includes('fc2')) {
          aspName = 'FC2';
        } else if (row.source.includes('japanska')) {
          aspName = 'Japanska';
        } else if (row.source.includes('1pondo')) {
          aspName = 'DTI';
        } else if (row.source.includes('caribbeancom')) {
          aspName = 'DTI';
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
            ${aspName},
            ${row.product_id},
            ${row.url || ''},
            ${price},
            'HTML',
            NOW()
          )
          ON CONFLICT (product_id, asp_name)
          DO UPDATE SET
            affiliate_url = COALESCE(EXCLUDED.affiliate_url, product_sources.affiliate_url),
            price = COALESCE(EXCLUDED.price, product_sources.price),
            last_updated = NOW()
        `);

        // サンプル動画を保存
        if (sampleVideoUrl) {
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
              ${aspName},
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

        // 出演者情報を保存
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

        // raw_html_dataを処理済みにマーク
        await db.execute(sql`
          UPDATE raw_html_data
          SET processed_at = NOW()
          WHERE id = ${row.id}
        `);

      } catch (error) {
        stats.errors++;
        console.error(`Error processing raw_html_data id=${row.id}:`, error);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    return NextResponse.json({
      success: true,
      message: 'Raw data processing completed',
      stats,
      duration: `${duration}s`,
    });

  } catch (error) {
    console.error('Process raw data error:', error);
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
