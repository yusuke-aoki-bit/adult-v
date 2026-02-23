/**
 * データ品質レポート API ハンドラー
 *
 * 欠損データの詳細分析と改善候補を返す
 * 品質閾値を下回る場合はSlack通知を送信
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '../lib/cron-auth';
import { notifyDataQualityAlert } from '../utils/slack-notify';
import type { SQL } from 'drizzle-orm';

// 品質アラートの閾値設定
const QUALITY_THRESHOLDS = {
  performerImageRate: 40, // 演者画像率
  performerDebutYearRate: 25, // デビュー年率
  productThumbnailRate: 70, // サムネイル率
  productLinkingRate: 50, // 紐づけ率
  reviewCoverageRate: 5, // レビューカバー率
};

export interface DataQualityReportDeps {
  getDb: () => {
    execute: (sql: SQL) => Promise<{ rows: unknown[] }>;
  };
  sql: typeof import('drizzle-orm').sql;
}

export interface PerformerMissingData {
  id: number;
  name: string;
  productCount: number;
  missingFields: string[];
}

export interface ProductMissingData {
  id: number;
  normalizedProductId: string;
  title: string;
  aspName: string;
  missingFields: string[];
}

export interface DataQualityReport {
  timestamp: string;
  summary: {
    performers: {
      total: number;
      withImage: number;
      withHeight: number;
      withBirthday: number;
      withDebutYear: number;
      withNameKana: number;
      withAiReview: number;
      completenessScore: number; // 0-100
    };
    products: {
      total: number;
      withThumbnail: number;
      withDescription: number;
      withDuration: number;
      withReleaseDate: number;
      withTranslation: number;
      withAiReview: number;
      completenessScore: number;
    };
    linking: {
      totalProducts: number;
      linkedProducts: number;
      linkingRate: number;
      avgPerformersPerProduct: number;
    };
    reviews: {
      totalReviews: number;
      productsWithReviews: number;
      productsWithRatingSummary: number;
      reviewCoverageRate: number;
      avgReviewsPerProduct: number;
      totalHelpfulVotes: number;
      byAsp: Array<{
        aspName: string;
        reviewCount: number;
        avgRating: number;
        productsWithReviews: number;
      }>;
    };
  };
  topPriorityPerformers: PerformerMissingData[];
  topPriorityProducts: ProductMissingData[];
  aspBreakdown: Array<{
    aspName: string;
    productCount: number;
    thumbnailRate: number;
    descriptionRate: number;
    linkingRate: number;
    reviewRate: number;
  }>;
  recommendations: string[];
}

export function createDataQualityReportHandler(deps: DataQualityReportDeps) {
  const { getDb, sql } = deps;

  return async function GET(request: NextRequest) {
    if (!verifyCronRequest(request)) {
      return unauthorizedResponse();
    }

    const db = getDb();

    try {
      // 演者データ品質サマリー
      const performerSummary = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(profile_image_url) as with_image,
          COUNT(height) as with_height,
          COUNT(birthday) as with_birthday,
          COUNT(debut_year) as with_debut_year,
          COUNT(name_kana) as with_name_kana,
          COUNT(ai_review) as with_ai_review
        FROM performers
      `);

      // 商品データ品質サマリー
      const productSummary = await db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(default_thumbnail_url) as with_thumbnail,
          COUNT(description) as with_description,
          COUNT(duration) as with_duration,
          COUNT(release_date) as with_release_date,
          COUNT(title_en) as with_translation,
          COUNT(ai_review) as with_ai_review
        FROM products
      `);

      // 紐づけ統計
      const linkingSummary = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM products) as total_products,
          (SELECT COUNT(DISTINCT product_id) FROM product_performers) as linked_products,
          (SELECT AVG(performer_count)::numeric(10,2) FROM (
            SELECT product_id, COUNT(*) as performer_count
            FROM product_performers
            GROUP BY product_id
          ) sub) as avg_performers_per_product
      `);

      // 優先度の高い演者（作品数が多いのに情報欠損）
      const topPriorityPerformers = await db.execute(sql`
        SELECT
          pf.id,
          pf.name,
          COUNT(DISTINCT pp.product_id)::int as product_count,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN pf.profile_image_url IS NULL THEN 'image' END,
            CASE WHEN pf.height IS NULL THEN 'height' END,
            CASE WHEN pf.birthday IS NULL THEN 'birthday' END,
            CASE WHEN pf.debut_year IS NULL THEN 'debutYear' END,
            CASE WHEN pf.name_kana IS NULL THEN 'nameKana' END,
            CASE WHEN pf.ai_review IS NULL THEN 'aiReview' END
          ], NULL) as missing_fields
        FROM performers pf
        INNER JOIN product_performers pp ON pf.id = pp.performer_id
        WHERE pf.profile_image_url IS NULL
           OR pf.height IS NULL
           OR pf.birthday IS NULL
           OR pf.debut_year IS NULL
        GROUP BY pf.id, pf.name, pf.profile_image_url, pf.height, pf.birthday, pf.debut_year, pf.name_kana, pf.ai_review
        HAVING COUNT(DISTINCT pp.product_id) >= 10
        ORDER BY COUNT(DISTINCT pp.product_id) DESC
        LIMIT 20
      `);

      // 優先度の高い商品（サムネイルや説明欠損）
      const topPriorityProducts = await db.execute(sql`
        SELECT
          p.id,
          p.normalized_product_id,
          p.title,
          ps.asp_name,
          ARRAY_REMOVE(ARRAY[
            CASE WHEN p.default_thumbnail_url IS NULL THEN 'thumbnail' END,
            CASE WHEN p.description IS NULL THEN 'description' END,
            CASE WHEN p.duration IS NULL THEN 'duration' END,
            CASE WHEN p.release_date IS NULL THEN 'releaseDate' END
          ], NULL) as missing_fields
        FROM products p
        LEFT JOIN product_sources ps ON p.id = ps.product_id
        WHERE p.default_thumbnail_url IS NULL
           OR p.description IS NULL
        ORDER BY p.id DESC
        LIMIT 20
      `);

      // ASP別内訳
      const aspBreakdown = await db.execute(sql`
        SELECT
          ps.asp_name,
          COUNT(DISTINCT ps.product_id)::int as product_count,
          ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL THEN p.id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as thumbnail_rate,
          ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.description IS NOT NULL THEN p.id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as description_rate,
          ROUND(100.0 * COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN p.id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as linking_rate,
          ROUND(100.0 * COUNT(DISTINCT CASE WHEN prs.product_id IS NOT NULL THEN p.id END) / NULLIF(COUNT(DISTINCT ps.product_id), 0), 1) as review_rate
        FROM product_sources ps
        INNER JOIN products p ON ps.product_id = p.id
        LEFT JOIN product_performers pp ON p.id = pp.product_id
        LEFT JOIN product_rating_summary prs ON p.id = prs.product_id AND prs.asp_name = ps.asp_name
        GROUP BY ps.asp_name
        ORDER BY COUNT(DISTINCT ps.product_id) DESC
      `);

      // レビュー統計
      const reviewSummary = await db.execute(sql`
        SELECT
          COUNT(*)::int as total_reviews,
          COUNT(DISTINCT product_id)::int as products_with_reviews,
          COALESCE(SUM(helpful), 0)::int as total_helpful_votes,
          ROUND(AVG(rating)::numeric, 2) as avg_rating
        FROM product_reviews
      `);

      const ratingSummaryStat = await db.execute(sql`
        SELECT COUNT(DISTINCT product_id)::int as products_with_rating_summary
        FROM product_rating_summary
      `);

      const reviewsByAsp = await db.execute(sql`
        SELECT
          asp_name,
          COUNT(*)::int as review_count,
          ROUND(AVG(rating)::numeric, 2) as avg_rating,
          COUNT(DISTINCT product_id)::int as products_with_reviews
        FROM product_reviews
        GROUP BY asp_name
        ORDER BY COUNT(*) DESC
      `);

      // レポート生成
      const perfSummary = performerSummary.rows[0] as Record<string, string>;
      const prodSummary = productSummary.rows[0] as Record<string, string>;
      const linkSummary = linkingSummary.rows[0] as Record<string, string>;

      const perfTotal = parseInt(perfSummary['total']!, 10);
      const prodTotal = parseInt(prodSummary['total']!, 10);

      // 完全性スコア計算（各フィールドの充足率の平均）
      const performerCompletenessScore = Math.round(
        ((parseInt(perfSummary['with_image']!, 10) / perfTotal) * 100 +
          (parseInt(perfSummary['with_height']!, 10) / perfTotal) * 100 +
          (parseInt(perfSummary['with_birthday']!, 10) / perfTotal) * 100 +
          (parseInt(perfSummary['with_debut_year']!, 10) / perfTotal) * 100) /
          4,
      );

      const productCompletenessScore = Math.round(
        ((parseInt(prodSummary['with_thumbnail']!, 10) / prodTotal) * 100 +
          (parseInt(prodSummary['with_description']!, 10) / prodTotal) * 100 +
          (parseInt(prodSummary['with_duration']!, 10) / prodTotal) * 100 +
          (parseInt(prodSummary['with_release_date']!, 10) / prodTotal) * 100) /
          4,
      );

      // 推奨事項の生成
      const recommendations: string[] = [];

      const imageRate = (parseInt(perfSummary['with_image']!, 10) / perfTotal) * 100;
      if (imageRate < 50) {
        recommendations.push(
          `演者画像の補充率が${imageRate.toFixed(1)}%と低いです。SOKMIL Actor APIからの画像取得を推奨します。`,
        );
      }

      const debutYearRate = (parseInt(perfSummary['with_debut_year']!, 10) / perfTotal) * 100;
      if (debutYearRate < 30) {
        recommendations.push(
          `デビュー年データの補充率が${debutYearRate.toFixed(1)}%です。performer-pipelineの定期実行を推奨します。`,
        );
      }

      const thumbnailRate = (parseInt(prodSummary['with_thumbnail']!, 10) / prodTotal) * 100;
      if (thumbnailRate < 80) {
        recommendations.push(
          `商品サムネイルの補充率が${thumbnailRate.toFixed(1)}%です。backfill-imagesの実行を推奨します。`,
        );
      }

      const linkingRate =
        (parseFloat(linkSummary['linked_products']!) / parseFloat(linkSummary['total_products']!)) * 100;
      if (linkingRate < 60) {
        recommendations.push(
          `商品-演者紐づけ率が${linkingRate.toFixed(1)}%です。normalize-performersの実行を推奨します。`,
        );
      }

      const translationRate = (parseInt(prodSummary['with_translation']!, 10) / prodTotal) * 100;
      if (translationRate < 10) {
        recommendations.push(
          `多言語翻訳率が${translationRate.toFixed(1)}%です。translation-backfillの実行を推奨します。`,
        );
      }

      // レビュー統計の変数展開
      const revSummary = reviewSummary.rows[0] as Record<string, string | number>;
      const ratingSummaryCount =
        (ratingSummaryStat.rows[0] as Record<string, number>)['products_with_rating_summary'] || 0;
      const productsWithReviews = parseInt(String(revSummary['products_with_reviews']), 10) || 0;
      const reviewCoverageRate = prodTotal > 0 ? (productsWithReviews / prodTotal) * 100 : 0;

      if (reviewCoverageRate < 10) {
        recommendations.push(
          `レビュー保有率が${reviewCoverageRate.toFixed(1)}%です。backfill-reviewsの実行を推奨します。`,
        );
      }

      const report: DataQualityReport = {
        timestamp: new Date().toISOString(),
        summary: {
          performers: {
            total: perfTotal,
            withImage: parseInt(perfSummary['with_image']!, 10),
            withHeight: parseInt(perfSummary['with_height']!, 10),
            withBirthday: parseInt(perfSummary['with_birthday']!, 10),
            withDebutYear: parseInt(perfSummary['with_debut_year']!, 10),
            withNameKana: parseInt(perfSummary['with_name_kana']!, 10),
            withAiReview: parseInt(perfSummary['with_ai_review']!, 10),
            completenessScore: performerCompletenessScore,
          },
          products: {
            total: prodTotal,
            withThumbnail: parseInt(prodSummary['with_thumbnail']!, 10),
            withDescription: parseInt(prodSummary['with_description']!, 10),
            withDuration: parseInt(prodSummary['with_duration']!, 10),
            withReleaseDate: parseInt(prodSummary['with_release_date']!, 10),
            withTranslation: parseInt(prodSummary['with_translation']!, 10),
            withAiReview: parseInt(prodSummary['with_ai_review']!, 10),
            completenessScore: productCompletenessScore,
          },
          linking: {
            totalProducts: parseInt(linkSummary['total_products']!, 10),
            linkedProducts: parseInt(linkSummary['linked_products']!, 10),
            linkingRate: linkingRate,
            avgPerformersPerProduct: parseFloat(linkSummary['avg_performers_per_product'] ?? '0'),
          },
          reviews: {
            totalReviews: parseInt(String(revSummary['total_reviews']), 10) || 0,
            productsWithReviews,
            productsWithRatingSummary: ratingSummaryCount,
            reviewCoverageRate,
            avgReviewsPerProduct:
              productsWithReviews > 0
                ? (parseInt(String(revSummary['total_reviews']), 10) || 0) / productsWithReviews
                : 0,
            totalHelpfulVotes: parseInt(String(revSummary['total_helpful_votes']), 10) || 0,
            byAsp: (
              reviewsByAsp.rows as Array<{
                asp_name: string;
                review_count: number;
                avg_rating: string;
                products_with_reviews: number;
              }>
            ).map((row) => ({
              aspName: row.asp_name,
              reviewCount: row.review_count,
              avgRating: parseFloat(row.avg_rating || '0'),
              productsWithReviews: row.products_with_reviews,
            })),
          },
        },
        topPriorityPerformers: (
          topPriorityPerformers.rows as Array<{
            id: number;
            name: string;
            product_count: number;
            missing_fields: string[];
          }>
        ).map((row) => ({
          id: row['id'],
          name: row['name'],
          productCount: row.product_count,
          missingFields: row.missing_fields,
        })),
        topPriorityProducts: (
          topPriorityProducts.rows as Array<{
            id: number;
            normalized_product_id: string;
            title: string;
            asp_name: string;
            missing_fields: string[];
          }>
        ).map((row) => ({
          id: row['id'],
          normalizedProductId: row.normalized_product_id,
          title: row['title'],
          aspName: row.asp_name,
          missingFields: row.missing_fields,
        })),
        aspBreakdown: (
          aspBreakdown.rows as Array<{
            asp_name: string;
            product_count: number;
            thumbnail_rate: string;
            description_rate: string;
            linking_rate: string;
            review_rate: string;
          }>
        ).map((row) => ({
          aspName: row.asp_name,
          productCount: row.product_count,
          thumbnailRate: parseFloat(row.thumbnail_rate || '0'),
          descriptionRate: parseFloat(row.description_rate || '0'),
          linkingRate: parseFloat(row.linking_rate || '0'),
          reviewRate: parseFloat(row.review_rate || '0'),
        })),
        recommendations,
      };

      // 品質アラートのチェックとSlack通知
      const alertPromises: Promise<boolean>[] = [];

      if (imageRate < QUALITY_THRESHOLDS.performerImageRate) {
        alertPromises.push(
          notifyDataQualityAlert(
            'Performer Image Rate',
            imageRate,
            QUALITY_THRESHOLDS.performerImageRate,
            '演者画像の補充率が低下しています。SOKMIL Actor APIからの取得を推奨します。',
          ),
        );
      }

      if (debutYearRate < QUALITY_THRESHOLDS.performerDebutYearRate) {
        alertPromises.push(
          notifyDataQualityAlert(
            'Performer Debut Year Rate',
            debutYearRate,
            QUALITY_THRESHOLDS.performerDebutYearRate,
            'デビュー年データの補充率が低下しています。performer-pipelineの実行を推奨します。',
          ),
        );
      }

      if (thumbnailRate < QUALITY_THRESHOLDS.productThumbnailRate) {
        alertPromises.push(
          notifyDataQualityAlert(
            'Product Thumbnail Rate',
            thumbnailRate,
            QUALITY_THRESHOLDS.productThumbnailRate,
            '商品サムネイルの補充率が低下しています。backfill-imagesの実行を推奨します。',
          ),
        );
      }

      if (linkingRate < QUALITY_THRESHOLDS.productLinkingRate) {
        alertPromises.push(
          notifyDataQualityAlert(
            'Product Linking Rate',
            linkingRate,
            QUALITY_THRESHOLDS.productLinkingRate,
            '商品-演者紐づけ率が低下しています。normalize-performersの実行を推奨します。',
          ),
        );
      }

      if (reviewCoverageRate < QUALITY_THRESHOLDS.reviewCoverageRate) {
        alertPromises.push(
          notifyDataQualityAlert(
            'Review Coverage Rate',
            reviewCoverageRate,
            QUALITY_THRESHOLDS.reviewCoverageRate,
            'レビューカバー率が低下しています。backfill-reviewsの実行を推奨します。',
          ),
        );
      }

      // Slack通知を非同期で送信（レスポンスを待たない）
      if (alertPromises.length > 0) {
        Promise.allSettled(alertPromises).then((results) => {
          const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
          console.log(`[data-quality-report] Sent ${successCount}/${alertPromises.length} Slack alerts`);
        });
      }

      return NextResponse.json({
        success: true,
        report,
        alertsSent: alertPromises.length,
      });
    } catch (error) {
      console.error('Data quality report error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  };
}
