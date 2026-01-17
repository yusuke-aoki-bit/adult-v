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

      // ========== データ品質指標 ==========

      // 演者データの補充率
      const performerQuality = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(profile_image_url) as with_image,
          COUNT(height) as with_height,
          COUNT(birthday) as with_birthday,
          COUNT(debut_year) as with_debut_year,
          COUNT(ai_review) as with_ai_review,
          COUNT(name_kana) as with_name_kana,
          ROUND(100.0 * COUNT(profile_image_url) / NULLIF(COUNT(*), 0), 1) as image_rate,
          ROUND(100.0 * COUNT(height) / NULLIF(COUNT(*), 0), 1) as height_rate,
          ROUND(100.0 * COUNT(birthday) / NULLIF(COUNT(*), 0), 1) as birthday_rate,
          ROUND(100.0 * COUNT(debut_year) / NULLIF(COUNT(*), 0), 1) as debut_year_rate,
          ROUND(100.0 * COUNT(ai_review) / NULLIF(COUNT(*), 0), 1) as ai_review_rate,
          ROUND(100.0 * COUNT(name_kana) / NULLIF(COUNT(*), 0), 1) as name_kana_rate
        FROM performers
      `);

      // 商品データの補充率
      const productQuality = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(default_thumbnail_url) as with_thumbnail,
          COUNT(description) as with_description,
          COUNT(ai_review) as with_ai_review,
          COUNT(title_en) as with_title_en,
          COUNT(release_date) as with_release_date,
          COUNT(duration) as with_duration,
          ROUND(100.0 * COUNT(default_thumbnail_url) / NULLIF(COUNT(*), 0), 1) as thumbnail_rate,
          ROUND(100.0 * COUNT(description) / NULLIF(COUNT(*), 0), 1) as description_rate,
          ROUND(100.0 * COUNT(ai_review) / NULLIF(COUNT(*), 0), 1) as ai_review_rate,
          ROUND(100.0 * COUNT(title_en) / NULLIF(COUNT(*), 0), 1) as translation_rate,
          ROUND(100.0 * COUNT(release_date) / NULLIF(COUNT(*), 0), 1) as release_date_rate,
          ROUND(100.0 * COUNT(duration) / NULLIF(COUNT(*), 0), 1) as duration_rate
        FROM products
      `);

      // 商品-演者紐づけ率
      const linkingQuality = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM products) as total_products,
          (SELECT COUNT(DISTINCT product_id) FROM product_performers) as linked_products,
          ROUND(100.0 * (SELECT COUNT(DISTINCT product_id) FROM product_performers) / NULLIF((SELECT COUNT(*) FROM products), 0), 1) as linking_rate
      `);

      // デビュー年データが欠損している作品数が多い演者TOP10（補完候補）
      const debutYearMissingCandidates = await db.execute(sql`
        SELECT
          pf.id,
          pf.name,
          COUNT(DISTINCT pp.product_id) as product_count,
          MIN(EXTRACT(YEAR FROM p.release_date))::int as earliest_year
        FROM performers pf
        INNER JOIN product_performers pp ON pf.id = pp.performer_id
        INNER JOIN products p ON pp.product_id = p.id
        WHERE pf.debut_year IS NULL
          AND p.release_date IS NOT NULL
        GROUP BY pf.id, pf.name
        HAVING COUNT(DISTINCT pp.product_id) >= 5
        ORDER BY COUNT(DISTINCT pp.product_id) DESC
        LIMIT 10
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
          dataQuality: {
            performers: performerQuality.rows[0],
            products: productQuality.rows[0],
            linking: linkingQuality.rows[0],
            debutYearMissingCandidates: debutYearMissingCandidates.rows,
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
