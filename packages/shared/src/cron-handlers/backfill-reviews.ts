/**
 * レビュー補填ハンドラー
 *
 * DUGAの過去商品に対してレビュー情報を補填取得
 * - 参考票(helpfulYes/helpfulNo)を含む完全なレビューデータを取得
 * - 競合サイトとの差別化ポイント
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db-queries/types';
import { scrapeDugaProductPage } from '../providers/duga-page-scraper';

interface BackfillReviewsStats {
  checked: number;
  reviewsFetched: number;
  reviewsSaved: number;
  ratingSummariesSaved: number;
  failed: number;
  skipped: number;
}

interface ProductToBackfill {
  product_id: number;
  original_product_id: string;
}

export interface BackfillReviewsHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
}

export function createBackfillReviewsHandler(deps: BackfillReviewsHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）

    const stats: BackfillReviewsStats = {
      checked: 0,
      reviewsFetched: 0,
      reviewsSaved: 0,
      ratingSummariesSaved: 0,
      failed: 0,
      skipped: 0,
    };

    try {
      const url = new URL(request['url']);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const minReviewCount = parseInt(url.searchParams.get('minReviews') || '0');
      const forceRefetch = url.searchParams.get('force') === 'true';

      console.log(`[backfill-reviews] Starting: limit=${limit}, minReviews=${minReviewCount}, force=${forceRefetch}`);

      // DUGAの商品でレビュー情報がない（または古い）商品を取得
      // product_rating_summaryにエントリがない商品 = レビュー未取得
      let query;
      if (forceRefetch) {
        // force=true: 全商品を対象（再取得）
        query = sql`
          SELECT ps.product_id, ps.original_product_id
          FROM product_sources ps
          WHERE ps.asp_name = 'DUGA'
          ORDER BY ps.last_updated DESC NULLS LAST
          LIMIT ${limit}
        `;
      } else {
        // 通常: レビュー情報がまだない商品を優先取得
        query = sql`
          SELECT ps.product_id, ps.original_product_id
          FROM product_sources ps
          LEFT JOIN product_rating_summary prs
            ON ps.product_id = prs.product_id
            AND prs.asp_name = 'DUGA'
          WHERE ps.asp_name = 'DUGA'
            AND prs.id IS NULL
          ORDER BY ps.last_updated DESC NULLS LAST
          LIMIT ${limit}
        `;
      }

      const result = await db.execute(query);
      const products = result.rows as unknown as ProductToBackfill[];

      console.log(`[backfill-reviews] Found ${products.length} DUGA products to process`);

      for (const product of products) {
        if (Date.now() - startTime > TIME_LIMIT) {
          console.log(`[backfill-reviews] Time limit reached, processed ${stats.checked}/${products.length}`);
          break;
        }
        stats.checked++;

        try {
          console.log(`[${stats.checked}/${products.length}] Processing: ${product.original_product_id}`);

          // DUGAページからレビュー情報をスクレイピング
          const pageData = await scrapeDugaProductPage(product.original_product_id);

          // レビューがない場合はスキップ
          if (!pageData.aggregateRating && pageData.reviews.length === 0) {
            console.log(`  ℹ️  レビューなし - スキップ`);
            stats.skipped++;
            // レート制限対策
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          // minReviewCountフィルター
          if (minReviewCount > 0 && (pageData.aggregateRating?.reviewCount || 0) < minReviewCount) {
            console.log(`  ℹ️  レビュー数が${minReviewCount}件未満 - スキップ`);
            stats.skipped++;
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          // 集計評価を保存
          if (pageData.aggregateRating) {
            stats.reviewsFetched += pageData.aggregateRating.reviewCount;

            await db.execute(sql`
              INSERT INTO product_rating_summary (
                product_id,
                asp_name,
                average_rating,
                max_rating,
                total_reviews,
                rating_distribution,
                last_updated
              )
              VALUES (
                ${product.product_id},
                'DUGA',
                ${pageData.aggregateRating.averageRating},
                ${pageData.aggregateRating.bestRating},
                ${pageData.aggregateRating.reviewCount},
                ${JSON.stringify({ worstRating: pageData.aggregateRating.worstRating })}::jsonb,
                NOW()
              )
              ON CONFLICT (product_id, asp_name)
              DO UPDATE SET
                average_rating = EXCLUDED.average_rating,
                total_reviews = EXCLUDED.total_reviews,
                rating_distribution = EXCLUDED.rating_distribution,
                last_updated = NOW()
            `);
            stats.ratingSummariesSaved++;

            console.log(
              `  ✓ 評価サマリー保存: ${pageData.aggregateRating.averageRating}点 (${pageData.aggregateRating.reviewCount}件)`,
            );
          }

          // 個別レビューを保存（バッチ処理）
          if (pageData.reviews.length > 0) {
            console.log(`  📝 個別レビュー保存中 (${pageData.reviews.length}件)...`);

            // レビューデータを配列に変換
            const reviewerNames = pageData.reviews.map((r) => r.reviewerName || null);
            const ratings = pageData.reviews.map((r) => r.rating);
            const titles = pageData.reviews.map((r) => r.title || null);
            const contents = pageData.reviews.map((r) => r.content || null);
            const reviewDates = pageData.reviews.map((r) => (r.date ? new Date(r.date).toISOString() : null));
            const helpfuls = pageData.reviews.map((r) => r.helpfulYes ?? 0);
            const sourceReviewIds = pageData.reviews.map((r) => r.reviewId || null);

            await db.execute(sql`
              INSERT INTO product_reviews (
                product_id,
                asp_name,
                reviewer_name,
                rating,
                max_rating,
                title,
                content,
                review_date,
                helpful,
                source_review_id,
                created_at,
                updated_at
              )
              SELECT
                ${product.product_id},
                'DUGA',
                unnest(${reviewerNames}::text[]),
                unnest(${ratings}::int[]),
                5,
                unnest(${titles}::text[]),
                unnest(${contents}::text[]),
                unnest(${reviewDates}::timestamp[]),
                unnest(${helpfuls}::int[]),
                unnest(${sourceReviewIds}::text[]),
                NOW(),
                NOW()
              ON CONFLICT (product_id, asp_name, source_review_id)
              DO UPDATE SET
                reviewer_name = EXCLUDED.reviewer_name,
                rating = EXCLUDED.rating,
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                helpful = EXCLUDED.helpful,
                updated_at = NOW()
            `);
            stats.reviewsSaved += pageData.reviews.length;

            console.log(`  ✓ 個別レビュー保存完了`);
          }

          // レート制限対策（1秒待機）
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          stats.failed++;
          console.error(`  ❌ エラー: ${product.original_product_id}`, error);
          // エラー時も待機
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[backfill-reviews] Completed in ${duration}ms`);
      console.log(`[backfill-reviews] Stats:`, stats);

      return NextResponse.json({
        success: true,
        stats,
        duration,
      });
    } catch (error) {
      console.error('[backfill-reviews] Fatal error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats,
        },
        { status: 500 },
      );
    }
  };
}
