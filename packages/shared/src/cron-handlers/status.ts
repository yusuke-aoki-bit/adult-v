/**
 * クローラーステータス確認 API ハンドラー
 *
 * 各クローラーの状態やデータ統計を返す
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import type { SQL } from 'drizzle-orm';

export interface StatusHandlerDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[] }>;
  };
  sql: typeof import('drizzle-orm').sql;
}

export function createStatusHandler(deps: StatusHandlerDeps) {
  const { getDb, sql } = deps;

  return async function GET(request: NextRequest) {
    // 認証チェック
    if (!verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    const db = getDb();

    try {
      // 商品数（ASP別）
      const productsByAsp = await db.execute(sql`
        SELECT asp_name, COUNT(DISTINCT product_id) as count
        FROM product_sources
        GROUP BY asp_name
        ORDER BY count DESC
      `);

      // 総商品数
      const totalProducts = await db.execute(sql`
        SELECT COUNT(*) as total FROM products
      `);

      // サンプル動画数（ASP別）
      const videosByAsp = await db.execute(sql`
        SELECT asp_name, COUNT(*) as count
        FROM product_videos
        GROUP BY asp_name
        ORDER BY count DESC
      `);

      // 総動画数
      const totalVideos = await db.execute(sql`
        SELECT COUNT(*) as total FROM product_videos
      `);

      // サンプル動画カバー率
      const videoCoverage = await db.execute(sql`
        SELECT
          ps.asp_name,
          COUNT(DISTINCT ps.product_id) as total_products,
          COUNT(DISTINCT pv.product_id) as products_with_video,
          ROUND(100.0 * COUNT(DISTINCT pv.product_id) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as coverage_pct
        FROM product_sources ps
        LEFT JOIN product_videos pv ON ps.product_id = pv.product_id AND ps.asp_name = pv.asp_name
        GROUP BY ps.asp_name
        ORDER BY coverage_pct DESC NULLS LAST
      `);

      // 未処理のraw_html_data
      const pendingRawData = await db.execute(sql`
        SELECT source, COUNT(*) as count
        FROM raw_html_data
        WHERE processed_at IS NULL
        GROUP BY source
        ORDER BY count DESC
      `);

      // 最近のクロール履歴（b10f_raw_csv）
      const recentB10fCrawls = await db.execute(sql`
        SELECT id, fetched_at, LENGTH(csv_data) as data_size
        FROM b10f_raw_csv
        ORDER BY fetched_at DESC
        LIMIT 5
      `);

      // 最近のDUGAクロール
      const recentDugaCrawls = await db.execute(sql`
        SELECT COUNT(*) as count, MAX(fetched_at) as last_crawl
        FROM duga_raw_responses
        WHERE fetched_at > NOW() - INTERVAL '24 hours'
      `);

      // 最近のSokmilクロール
      const recentSokmilCrawls = await db.execute(sql`
        SELECT COUNT(*) as count, MAX(fetched_at) as last_crawl
        FROM sokmil_raw_responses
        WHERE fetched_at > NOW() - INTERVAL '24 hours'
      `);

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          products: {
            total: (totalProducts.rows[0] as { total: string }).total,
            byAsp: productsByAsp.rows,
          },
          videos: {
            total: (totalVideos.rows[0] as { total: string }).total,
            byAsp: videosByAsp.rows,
            coverage: videoCoverage.rows,
          },
          rawData: {
            pending: pendingRawData.rows,
          },
          recentActivity: {
            b10f: recentB10fCrawls.rows,
            duga: recentDugaCrawls.rows[0],
            sokmil: recentSokmilCrawls.rows[0],
          },
        },
      });

    } catch (error) {
      console.error('Status check error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  };
}
