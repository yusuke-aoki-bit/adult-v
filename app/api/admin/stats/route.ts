import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getAllASPTotals, mapDBNameToASPName } from '@/lib/asp-totals';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// クエリを安全に実行するヘルパー関数
async function safeQuery<T>(
  db: ReturnType<typeof getDb>,
  queryFn: () => Promise<{ rows: T[] }>,
  defaultValue: T[] = []
): Promise<T[]> {
  try {
    const result = await queryFn();
    return result.rows;
  } catch (error) {
    console.error('Query error:', error);
    return defaultValue;
  }
}

export async function GET() {
  try {
    const db = getDb();

    // 1. ASP別 総合収集状況（DTIはサブサービスに分割）
    const aspSummary = await db.execute(sql`
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
    `);

    // 2. 動画数詳細
    const videoStats = await db.execute(sql`
      SELECT
        asp_name,
        COUNT(*) as total_videos,
        COUNT(DISTINCT product_id) as products_with_video
      FROM product_videos
      GROUP BY asp_name
      ORDER BY total_videos DESC
    `);

    // 3. 演者統計
    // performer_aliasesテーブルが存在しない場合があるため別クエリで取得
    let totalAliases = '0';
    try {
      const aliasResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM performer_aliases`);
      totalAliases = String(aliasResult.rows[0]?.cnt ?? 0);
    } catch {
      // テーブルが存在しない場合は0
    }

    const performerStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM performers) as total_performers,
        (SELECT COUNT(*) FROM performers WHERE image_url IS NOT NULL AND image_url != '') as with_image,
        0 as with_wiki,
        (SELECT COUNT(DISTINCT performer_id) FROM product_performers) as with_products,
        (SELECT COUNT(*) FROM product_performers) as total_links
    `);

    // total_aliasesを追加
    const performerStatsData = { ...(performerStats.rows[0] as object), total_aliases: totalAliases };

    // 4. 全体統計
    const totalStats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM products WHERE default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' AND default_thumbnail_url NOT LIKE '%placehold%') as products_with_image,
        (SELECT COUNT(DISTINCT product_id) FROM product_videos) as products_with_video,
        (SELECT COUNT(*) FROM product_videos) as total_videos,
        (SELECT COUNT(DISTINCT product_id) FROM product_performers) as products_with_performer
    `);

    // 5. 人気女優TOP10
    const topPerformers = await db.execute(sql`
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
    `);

    // 6. 画像なし・作品多い女優TOP10
    const noImagePerformers = await db.execute(sql`
      SELECT
        pe.id, pe.name,
        COUNT(pp.product_id) as product_count
      FROM performers pe
      JOIN product_performers pp ON pe.id = pp.performer_id
      WHERE pe.image_url IS NULL OR pe.image_url = ''
      GROUP BY pe.id, pe.name
      ORDER BY product_count DESC
      LIMIT 10
    `);

    // 7. 収集率統計（推定総数との比較）- DTIはサブサービスに分割
    const collectionRates = await db.execute(sql`
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
    `);

    // 8. 最新リリース日（プロバイダー別）- DTIはサブサービスに分割
    const latestReleases = await db.execute(sql`
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
    `);

    // 9. 日別収集数（過去14日）- DTIはサブサービスに分割
    const dailyCollection = await db.execute(sql`
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
    `);

    // 10. 生データテーブル件数
    const rawDataCounts = await db.execute(sql`
      SELECT 'raw_html_data' as table_name, COUNT(*) as count FROM raw_html_data
      UNION ALL
      SELECT 'raw_csv_data', COUNT(*) FROM raw_csv_data
      UNION ALL
      SELECT 'duga_raw_responses', COUNT(*) FROM duga_raw_responses
      UNION ALL
      SELECT 'sokmil_raw_responses', COUNT(*) FROM sokmil_raw_responses
      UNION ALL
      SELECT 'mgs_raw_pages', COUNT(*) FROM mgs_raw_pages
    `);

    // 11. 作品画像統計（image_type別、ASP別）
    const productImageStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(image_type, 'unknown') as image_type,
        COALESCE(asp_name, 'unknown') as asp_name,
        COUNT(*) as count,
        COUNT(DISTINCT product_id) as products
      FROM product_images
      GROUP BY COALESCE(image_type, 'unknown'), COALESCE(asp_name, 'unknown')
      ORDER BY count DESC
    `));

    // 12. 作品動画統計（video_type別、quality別）
    const productVideoTypeStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(video_type, 'unknown') as video_type,
        COALESCE(quality, 'unknown') as quality,
        COALESCE(asp_name, 'unknown') as asp_name,
        COUNT(*) as count,
        COUNT(DISTINCT product_id) as products
      FROM product_videos
      GROUP BY COALESCE(video_type, 'unknown'), COALESCE(quality, 'unknown'), COALESCE(asp_name, 'unknown')
      ORDER BY count DESC
    `));

    // 13. 演者画像統計
    const performerImageStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(image_type, 'unknown') as image_type,
        COALESCE(source, 'unknown') as source,
        COUNT(*) as count,
        COUNT(DISTINCT performer_id) as performers,
        SUM(CASE WHEN is_primary THEN 1 ELSE 0 END) as primary_count
      FROM performer_images
      GROUP BY COALESCE(image_type, 'unknown'), COALESCE(source, 'unknown')
      ORDER BY count DESC
    `));

    // 14. 演者別名統計
    const performerAliasStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(source, 'unknown') as source,
        COUNT(*) as count,
        COUNT(DISTINCT performer_id) as performers,
        SUM(CASE WHEN is_primary THEN 1 ELSE 0 END) as primary_count
      FROM performer_aliases
      GROUP BY COALESCE(source, 'unknown')
      ORDER BY count DESC
    `));

    // 15. 演者外部ID統計
    const performerExternalIdStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        provider,
        COUNT(*) as count,
        COUNT(DISTINCT performer_id) as performers
      FROM performer_external_ids
      GROUP BY provider
      ORDER BY count DESC
    `));

    // 16. タグ/ジャンル統計
    const tagStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(t.category, 'unknown') as category,
        COUNT(DISTINCT t.id) as tag_count,
        COUNT(pt.tag_id) as product_tag_links,
        COUNT(DISTINCT pt.product_id) as products_with_tag
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY COALESCE(t.category, 'unknown')
      ORDER BY product_tag_links DESC
    `));

    // 17. タグ使用頻度TOP20
    const topTags = await safeQuery(db, () => db.execute(sql`
      SELECT t.name, t.category, COUNT(pt.product_id) as product_count
      FROM tags t
      JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY t.id, t.name, t.category
      ORDER BY product_count DESC
      LIMIT 20
    `));

    // 18. レビュー統計
    const reviewStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        asp_name,
        COUNT(*) as review_count,
        COUNT(DISTINCT product_id) as products_reviewed,
        ROUND(AVG(rating::numeric), 2) as avg_rating
      FROM product_reviews
      GROUP BY asp_name
      ORDER BY review_count DESC
    `));

    // 19. 評価サマリー統計
    const ratingSummaryStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        asp_name,
        COUNT(*) as summary_count,
        ROUND(AVG(average_rating::numeric), 2) as avg_rating,
        SUM(total_reviews) as total_reviews
      FROM product_rating_summary
      GROUP BY asp_name
      ORDER BY summary_count DESC
    `));

    // 20. セール統計
    const salesStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(sale_type, 'unknown') as sale_type,
        COUNT(*) as count,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count,
        ROUND(AVG(discount_percent), 1) as avg_discount,
        MIN(discount_percent) as min_discount,
        MAX(discount_percent) as max_discount
      FROM product_sales
      GROUP BY COALESCE(sale_type, 'unknown')
      ORDER BY count DESC
    `));

    // 21. Wikiクロールデータ統計
    const wikiCrawlStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT product_code) as unique_products,
        COUNT(DISTINCT performer_name) as unique_performers,
        COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_count
      FROM wiki_crawl_data
      GROUP BY source
      ORDER BY total_records DESC
    `));

    // 22. Wikiインデックス統計
    const wikiIndexStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        source,
        COUNT(*) as total_records,
        COUNT(DISTINCT product_code) as unique_product_codes,
        COUNT(DISTINCT performer_name) as unique_performers,
        SUM(CASE WHEN verified THEN 1 ELSE 0 END) as verified_count
      FROM wiki_performer_index
      GROUP BY source
      ORDER BY total_records DESC
    `));

    // 23. AI生成コンテンツ統計
    const aiContentStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        'products' as table_name,
        COUNT(*) as total,
        COUNT(CASE WHEN ai_description IS NOT NULL THEN 1 END) as with_ai_description,
        COUNT(CASE WHEN ai_tags IS NOT NULL THEN 1 END) as with_ai_tags,
        COUNT(CASE WHEN ai_review IS NOT NULL THEN 1 END) as with_ai_review,
        COUNT(CASE WHEN ai_catchphrase IS NOT NULL THEN 1 END) as with_ai_catchphrase
      FROM products
    `));

    // 24. 演者AIレビュー統計
    const performerAiStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COUNT(*) as total_performers,
        COUNT(CASE WHEN ai_review IS NOT NULL THEN 1 END) as with_ai_review,
        COUNT(CASE WHEN height IS NOT NULL THEN 1 END) as with_height,
        COUNT(CASE WHEN bust IS NOT NULL THEN 1 END) as with_measurements,
        COUNT(CASE WHEN birthday IS NOT NULL THEN 1 END) as with_birthday,
        COUNT(CASE WHEN twitter_id IS NOT NULL OR instagram_id IS NOT NULL THEN 1 END) as with_social
      FROM performers
    `));

    // 25. 多言語翻訳統計
    const translationStats = await safeQuery(db, () => db.execute(sql`
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
    `));

    // 26. 価格統計（通貨別）
    const priceStats = await safeQuery(db, () => db.execute(sql`
      SELECT
        COALESCE(currency, 'JPY') as currency,
        asp_name,
        COUNT(*) as count,
        MIN(price) as min_price,
        MAX(price) as max_price,
        ROUND(AVG(price)) as avg_price
      FROM product_sources
      WHERE price IS NOT NULL AND price > 0
      GROUP BY COALESCE(currency, 'JPY'), asp_name
      ORDER BY count DESC
    `));

    // 27. DBテーブル行数サマリー
    const tableRowCounts = await safeQuery(db, () => db.execute(sql`
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
    `));

    // ASP総数を動的に取得（キャッシュあり、1時間有効）
    const aspTotals = await getAllASPTotals();

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
      const aspName = mapDBNameToASPName(row.asp_name);
      const estimated = estimates[row.asp_name] || estimates[aspName] || null;
      const collected = parseInt(row.count);

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

    return NextResponse.json({
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
      // 新規追加統計
      productImageStats,
      productVideoTypeStats,
      performerImageStats,
      performerAliasStats,
      performerExternalIdStats,
      tagStats,
      topTags,
      reviewStats,
      ratingSummaryStats,
      salesStats,
      wikiCrawlStats,
      wikiIndexStats,
      aiContentStats,
      performerAiStats,
      translationStats,
      priceStats,
      tableRowCounts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
