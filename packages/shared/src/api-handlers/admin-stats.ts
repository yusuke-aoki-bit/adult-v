import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { logDbErrorAndReturn, logDbWarning } from '../lib/db-logger';
import { createApiErrorResponse } from '../lib/api-logger';

// Types
export interface ASPTotal {
  asp: string;
  apiTotal: number | null;
  source: string | null;
}

export interface AdminStatsHandlerDeps {
  getDb: () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (query: any) => Promise<{ rows: any[] }>;
  };
  getAllASPTotals: () => Promise<ASPTotal[]>;
  mapDBNameToASPName: (dbName: string) => string;
}

export interface AdminStatsHandlerOptions {
  /** SEO Indexing統計を含めるか（web版のみ） */
  includeSeoIndexing?: boolean;
}

// クエリを安全に実行するヘルパー関数
async function safeQuery<T>(
  db: ReturnType<AdminStatsHandlerDeps['getDb']>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: () => Promise<{ rows: any[] }>,
  defaultValue: T[] = []
): Promise<T[]> {
  try {
    const result = await queryFn();
    return result.rows as T[];
  } catch (error) {
    logDbWarning('Query failed in safeQuery', 'safeQuery', { error: error instanceof Error ? error.message : String(error) });
    return defaultValue;
  }
}

export function createAdminStatsHandler(
  deps: AdminStatsHandlerDeps,
  options: AdminStatsHandlerOptions = {}
) {
  const { includeSeoIndexing = false } = options;

  return async function GET() {
    try {
      const db = deps.getDb();

      // Run all independent queries in parallel for better performance
      const baseQueries = [
        // 1. ASP別 総合収集状況（DTIはサブサービスに分割）
        db.execute(sql`
          WITH asp_data AS (
            SELECT
              CASE
                WHEN ps.asp_name = 'DTI' THEN 'DTI: ' || SPLIT_PART(p.normalized_product_id, '-', 1)
                ELSE ps.asp_name
              END as asp_name,
              ps.product_id,
              p.default_thumbnail_url
            FROM product_sources ps
            JOIN products p ON ps.product_id = p.id
          )
          SELECT
            ad.asp_name,
            COUNT(DISTINCT ad.product_id) as total_products,
            COUNT(DISTINCT CASE WHEN ad.default_thumbnail_url IS NOT NULL AND ad.default_thumbnail_url != '' AND ad.default_thumbnail_url NOT LIKE '%placehold%' THEN ad.product_id END) as with_image,
            ROUND(COUNT(DISTINCT CASE WHEN ad.default_thumbnail_url IS NOT NULL AND ad.default_thumbnail_url != '' AND ad.default_thumbnail_url NOT LIKE '%placehold%' THEN ad.product_id END)::numeric / NULLIF(COUNT(DISTINCT ad.product_id), 0) * 100, 1) as image_pct,
            COUNT(DISTINCT pv.product_id) as with_video,
            ROUND(COUNT(DISTINCT pv.product_id)::numeric / NULLIF(COUNT(DISTINCT ad.product_id), 0) * 100, 1) as video_pct,
            COUNT(DISTINCT pp.product_id) as with_performer,
            ROUND(COUNT(DISTINCT pp.product_id)::numeric / NULLIF(COUNT(DISTINCT ad.product_id), 0) * 100, 1) as performer_pct
          FROM asp_data ad
          LEFT JOIN product_videos pv ON ad.product_id = pv.product_id
          LEFT JOIN product_performers pp ON ad.product_id = pp.product_id
          GROUP BY ad.asp_name
          ORDER BY COUNT(DISTINCT ad.product_id) DESC
        `),

        // 2. 動画数詳細
        db.execute(sql`
          SELECT
            asp_name,
            COUNT(*) as total_videos,
            COUNT(DISTINCT product_id) as products_with_video
          FROM product_videos
          GROUP BY asp_name
          ORDER BY total_videos DESC
        `),

        // 3. 演者統計
        db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM performers) as total_performers,
            (SELECT COUNT(*) FROM performers WHERE image_url IS NOT NULL AND image_url != '') as with_image,
            0 as with_wiki,
            (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as with_products,
            (SELECT COUNT(*) FROM product_performers) as total_links
        `),

        // 4. 全体統計
        db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM products) as total_products,
            (SELECT COUNT(*) FROM products WHERE default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' AND default_thumbnail_url NOT LIKE '%placehold%') as products_with_image,
            (SELECT COUNT(DISTINCT product_id) FROM product_videos) as products_with_video,
            (SELECT COUNT(*) FROM product_videos) as total_videos,
            (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performer
        `),

        // 5. 人気女優TOP10
        db.execute(sql`
          SELECT
            pe.id, pe.name,
            CASE WHEN pe.image_url IS NOT NULL AND pe.image_url != '' THEN true ELSE false END as has_image,
            false as has_wiki,
            COUNT(pp.product_id) as product_count
          FROM performers pe
          JOIN product_performers pp ON pe.id = pp.performer_id
          GROUP BY pe.id, pe.name, pe.image_url
          ORDER BY product_count DESC
          LIMIT 10
        `),

        // 6. 画像なし・作品多い女優TOP10
        db.execute(sql`
          SELECT
            pe.id, pe.name,
            COUNT(pp.product_id) as product_count
          FROM performers pe
          JOIN product_performers pp ON pe.id = pp.performer_id
          WHERE pe.image_url IS NULL OR pe.image_url = ''
          GROUP BY pe.id, pe.name
          ORDER BY product_count DESC
          LIMIT 10
        `),

        // 7. 収集率統計（推定総数との比較）- DTIはサブサービスに分割
        db.execute(sql`
          WITH asp_data AS (
            SELECT
              CASE
                WHEN ps.asp_name = 'DTI' THEN 'DTI: ' || SPLIT_PART(p.normalized_product_id, '-', 1)
                ELSE ps.asp_name
              END as asp_name,
              ps.product_id
            FROM product_sources ps
            JOIN products p ON ps.product_id = p.id
          )
          SELECT asp_name, COUNT(DISTINCT product_id) as count
          FROM asp_data
          GROUP BY asp_name
          ORDER BY count DESC
        `),

        // 8. 最新リリース日（プロバイダー別）- DTIはサブサービスに分割
        db.execute(sql`
          WITH asp_data AS (
            SELECT
              CASE
                WHEN ps.asp_name = 'DTI' THEN 'DTI: ' || SPLIT_PART(p.normalized_product_id, '-', 1)
                ELSE ps.asp_name
              END as asp_name,
              p.release_date
            FROM product_sources ps
            JOIN products p ON ps.product_id = p.id
          )
          SELECT asp_name, MAX(release_date) as latest_release
          FROM asp_data
          GROUP BY asp_name
          ORDER BY latest_release DESC NULLS LAST
        `),

        // 9. 日別収集数（過去14日）- DTIはサブサービスに分割
        db.execute(sql`
          WITH asp_data AS (
            SELECT
              CASE
                WHEN ps.asp_name = 'DTI' THEN 'DTI: ' || SPLIT_PART(p.normalized_product_id, '-', 1)
                ELSE ps.asp_name
              END as asp_name,
              p.created_at
            FROM product_sources ps
            JOIN products p ON ps.product_id = p.id
            WHERE p.created_at > NOW() - INTERVAL '14 days'
          )
          SELECT DATE(created_at) as date, asp_name, COUNT(*) as count
          FROM asp_data
          GROUP BY DATE(created_at), asp_name
          ORDER BY date DESC, count DESC
        `),

        // 10. 生データテーブル件数
        db.execute(sql`
          SELECT 'raw_html_data' as table_name, COUNT(*) as count FROM raw_html_data
          UNION ALL
          SELECT 'raw_csv_data', COUNT(*) FROM raw_csv_data
          UNION ALL
          SELECT 'duga_raw_responses', COUNT(*) FROM duga_raw_responses
          UNION ALL
          SELECT 'sokmil_raw_responses', COUNT(*) FROM sokmil_raw_responses
          UNION ALL
          SELECT 'mgs_raw_pages', COUNT(*) FROM mgs_raw_pages
        `),

        // 11. AI生成コンテンツ統計
        safeQuery(db, () => db.execute(sql`
          SELECT
            'products' as table_name,
            COUNT(*) as total,
            COUNT(CASE WHEN ai_description IS NOT NULL THEN 1 END) as with_ai_description,
            COUNT(CASE WHEN ai_tags IS NOT NULL THEN 1 END) as with_ai_tags,
            COUNT(CASE WHEN ai_review IS NOT NULL THEN 1 END) as with_ai_review,
            COUNT(CASE WHEN ai_catchphrase IS NOT NULL THEN 1 END) as with_ai_catchphrase
          FROM products
        `)),

        // 12. 演者AIレビュー統計
        safeQuery(db, () => db.execute(sql`
          SELECT
            COUNT(*) as total_performers,
            COUNT(CASE WHEN ai_review IS NOT NULL THEN 1 END) as with_ai_review,
            COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as with_height,
            COUNT(CASE WHEN bust IS NOT NULL THEN 1 END) as with_measurements,
            COUNT(CASE WHEN birthday IS NOT NULL THEN 1 END) as with_birthday,
            COUNT(CASE WHEN twitter_id IS NOT NULL OR instagram_id IS NOT NULL THEN 1 END) as with_social
          FROM performers
        `)),

        // 13. 多言語翻訳統計
        safeQuery(db, () => db.execute(sql`
          SELECT
            'products' as table_name,
            COUNT(*) as total,
            COUNT(CASE WHEN title_en IS NOT NULL AND title_en != '' THEN 1 END) as en,
            COUNT(CASE WHEN title_zh IS NOT NULL AND title_zh != '' THEN 1 END) as zh,
            COUNT(CASE WHEN title_zh_tw IS NOT NULL AND title_zh_tw != '' THEN 1 END) as zh_tw,
            COUNT(CASE WHEN title_ko IS NOT NULL AND title_ko != '' THEN 1 END) as ko
          FROM products
          UNION ALL
          SELECT
            'performers' as table_name,
            COUNT(*) as total,
            COUNT(CASE WHEN name_en IS NOT NULL AND name_en != '' THEN 1 END) as en,
            COUNT(CASE WHEN name_zh IS NOT NULL AND name_zh != '' THEN 1 END) as zh,
            COUNT(CASE WHEN name_zh_tw IS NOT NULL AND name_zh_tw != '' THEN 1 END) as zh_tw,
            COUNT(CASE WHEN name_ko IS NOT NULL AND name_ko != '' THEN 1 END) as ko
          FROM performers
          UNION ALL
          SELECT
            'tags' as table_name,
            COUNT(*) as total,
            COUNT(CASE WHEN name_en IS NOT NULL AND name_en != '' THEN 1 END) as en,
            COUNT(CASE WHEN name_zh IS NOT NULL AND name_zh != '' THEN 1 END) as zh,
            COUNT(CASE WHEN name_zh_tw IS NOT NULL AND name_zh_tw != '' THEN 1 END) as zh_tw,
            COUNT(CASE WHEN name_ko IS NOT NULL AND name_ko != '' THEN 1 END) as ko
          FROM tags
        `)),

        // 14. DBテーブル行数サマリー
        safeQuery(db, () => db.execute(sql`
          SELECT 'products' as table_name, COUNT(*) as count FROM products
          UNION ALL SELECT 'product_sources', COUNT(*) FROM product_sources
          UNION ALL SELECT 'product_performers', COUNT(*) FROM product_performers
          UNION ALL SELECT 'product_images', COUNT(*) FROM product_images
          UNION ALL SELECT 'product_videos', COUNT(*) FROM product_videos
          UNION ALL SELECT 'product_tags', COUNT(*) FROM product_tags
          UNION ALL SELECT 'product_reviews', COUNT(*) FROM product_reviews
          UNION ALL SELECT 'product_rating_summary', COUNT(*) FROM product_rating_summary
          UNION ALL SELECT 'product_sales', COUNT(*) FROM product_sales
          UNION ALL SELECT 'performers', COUNT(*) FROM performers
          UNION ALL SELECT 'performer_aliases', COUNT(*) FROM performer_aliases
          UNION ALL SELECT 'performer_images', COUNT(*) FROM performer_images
          UNION ALL SELECT 'performer_external_ids', COUNT(*) FROM performer_external_ids
          UNION ALL SELECT 'tags', COUNT(*) FROM tags
          UNION ALL SELECT 'wiki_crawl_data', COUNT(*) FROM wiki_crawl_data
          UNION ALL SELECT 'wiki_performer_index', COUNT(*) FROM wiki_performer_index
          ORDER BY count DESC
        `)),

        // 14.5 日別増加量（今日と昨日の比較）
        safeQuery(db, () => db.execute(sql`
          SELECT
            'products' as table_name,
            (SELECT COUNT(*) FROM products WHERE created_at >= CURRENT_DATE) as today,
            (SELECT COUNT(*) FROM products WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE) as yesterday
          UNION ALL
          SELECT
            'product_sources',
            (SELECT COUNT(*) FROM product_sources WHERE created_at >= CURRENT_DATE),
            (SELECT COUNT(*) FROM product_sources WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE)
          UNION ALL
          SELECT
            'performers',
            (SELECT COUNT(*) FROM performers WHERE created_at >= CURRENT_DATE),
            (SELECT COUNT(*) FROM performers WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE)
          UNION ALL
          SELECT
            'product_sales_active',
            (SELECT COUNT(*) FROM product_sales WHERE is_active = true),
            0
        `)),

        // 15. ASP総数を動的に取得
        deps.getAllASPTotals(),

        // 16. performer_aliasesテーブル件数
        db.execute(sql`SELECT COUNT(*) as cnt FROM performer_aliases`).catch(() => ({ rows: [{ cnt: 0 }] })),
      ];

      // SEO Indexing統計（オプション）
      const seoQueries = includeSeoIndexing ? [
        // SEO Indexing Status
        safeQuery(db, () => db.execute(sql`
          SELECT
            status,
            COUNT(*) as count
          FROM seo_indexing_status
          GROUP BY status
          ORDER BY count DESC
        `)),

        // SEO Indexing Summary
        safeQuery(db, () => db.execute(sql`
          SELECT
            (SELECT COUNT(*) FROM seo_indexing_status) as total_indexed,
            (SELECT COUNT(*) FROM seo_indexing_status WHERE status = 'requested') as requested,
            (SELECT COUNT(*) FROM seo_indexing_status WHERE status = 'pending') as pending,
            (SELECT COUNT(*) FROM seo_indexing_status WHERE status = 'error') as errors,
            (SELECT COUNT(*) FROM seo_indexing_status WHERE status = 'ownership_required') as ownership_required,
            (SELECT MAX(last_requested_at) FROM seo_indexing_status) as last_requested_at,
            (SELECT COUNT(*) FROM products) - (SELECT COUNT(*) FROM seo_indexing_status) as not_requested
        `)),
      ] : [];

      const results = await Promise.all([...baseQueries, ...seoQueries]);

      const [
        aspSummary,
        videoStats,
        performerStats,
        totalStats,
        topPerformers,
        noImagePerformers,
        collectionRates,
        latestReleases,
        dailyCollection,
        rawDataCounts,
        aiContentStats,
        performerAiStats,
        translationStats,
        tableRowCounts,
        dailyGrowth,
        aspTotals,
        aliasResult,
      ] = results.slice(0, 17) as [
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        { rows: unknown[] },
        unknown[],
        unknown[],
        unknown[],
        unknown[],
        unknown[],
        ASPTotal[],
        { rows: { cnt: number }[] },
      ];

      // SEO results (if enabled)
      let seoIndexingByStatus: unknown[] = [];
      let seoIndexingSummary: unknown[] = [];
      if (includeSeoIndexing && results.length > 17) {
        seoIndexingByStatus = results[17] as unknown[];
        seoIndexingSummary = results[18] as unknown[];
      }

      // total_aliasesを追加
      const totalAliases = String(aliasResult.rows[0]?.cnt ?? 0);
      const performerStatsData = { ...(performerStats.rows[0] as object), total_aliases: totalAliases };

      // ASP名から推定総数へのマップを構築
      const estimates: Record<string, number> = {};
      for (const total of aspTotals) {
        if (total.apiTotal !== null) {
          estimates[total.asp] = total.apiTotal;
          // DTI: プレフィックス付きでも登録
          estimates[`DTI: ${total.asp}`] = total.apiTotal;
        }
      }

      const collectionRatesWithEstimates = (collectionRates.rows as { asp_name: string; count: string }[]).map(row => {
        const aspName = deps.mapDBNameToASPName(row.asp_name);
        const estimated = estimates[row.asp_name] || estimates[aspName] || null;
        const collected = parseInt(row['count']);

        // 対応するASPTotalからソース情報を取得
        const totalInfo = aspTotals.find(t =>
          t.asp === aspName || t.asp === row.asp_name || `DTI: ${t.asp}` === row.asp_name
        );

        return {
          asp_name: row.asp_name,
          collected,
          estimated,
          rate: estimated ? ((collected / estimated) * 100).toFixed(2) : null,
          source: totalInfo?.source || null,
        };
      });

      const response: Record<string, unknown> = {
        aspSummary: aspSummary.rows,
        videoStats: videoStats.rows,
        performerStats: performerStatsData,
        totalStats: totalStats.rows[0],
        topPerformers: topPerformers.rows,
        noImagePerformers: noImagePerformers.rows,
        collectionRates: collectionRatesWithEstimates,
        latestReleases: latestReleases.rows,
        dailyCollection: dailyCollection.rows,
        rawDataCounts: rawDataCounts.rows,
        aiContentStats,
        performerAiStats,
        translationStats,
        tableRowCounts,
        dailyGrowth,
        generatedAt: new Date().toISOString(),
      };

      // SEO統計を追加（オプション）
      if (includeSeoIndexing) {
        response['seoIndexingByStatus'] = seoIndexingByStatus;
        response['seoIndexingSummary'] = seoIndexingSummary.length > 0 ? seoIndexingSummary[0] : null;
      }

      return NextResponse.json(response);
    } catch (error) {
      return createApiErrorResponse(error, 'Failed to fetch stats', 500, {
        endpoint: '/api/admin/stats',
      });
    }
  };
}
