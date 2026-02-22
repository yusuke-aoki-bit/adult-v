/**
 * SEO/分析強化 ハンドラー
 *
 * Google APIs を使用してSEO・分析を強化:
 * - Indexing API: URLの即時インデックス登録リクエスト
 * - Analytics Data API: アクセス解析データ取得・キャッシュ
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import type { DbExecutor } from '../db-queries/types';

interface Stats {
  totalProcessed: number;
  success: number;
  errors: number;
  skipped: number;
}

interface IndexingStats extends Stats {
  ownershipVerificationRequired?: boolean;
}

interface GoogleApiConfig {
  indexing: boolean;
  analytics: boolean;
}

interface IndexingResult {
  success: boolean;
  requiresOwnershipVerification?: boolean;
  error?: string;
}

interface AnalyticsReportResult {
  rows?: any[];
}

interface SeoEnhanceHandlerDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => DbExecutor;
  requestIndexing: (url: string, type?: 'URL_UPDATED' | 'URL_DELETED') => Promise<IndexingResult>;
  getAnalyticsReport: (
    propertyId: string,
    dimensions: string[],
    metrics: string[],
    startDate: string,
    endDate: string
  ) => Promise<AnalyticsReportResult | null>;
  checkGoogleApiConfig: () => GoogleApiConfig;
  siteBaseUrl?: string;
}

/**
 * URLのインデックス登録リクエスト
 */
async function requestIndexingForProducts(
  db: ReturnType<SeoEnhanceHandlerDeps['getDb']>,
  limit: number,
  deps: SeoEnhanceHandlerDeps,
  startTime?: number,
  timeLimit?: number
): Promise<{ stats: IndexingStats; results: any[]; warning?: string }> {
  const stats: IndexingStats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };
  const results: any[] = [];
  let ownershipVerificationRequired = false;
  const siteBaseUrl = deps.siteBaseUrl || process.env['NEXT_PUBLIC_SITE_URL'] || 'https://adult-v.com';

  // サイトマップとの整合性を保つため、数値IDベースのURLを使用
  // 品番URLはcanonicalで数値IDにリダイレクトされるため、Indexing APIには数値IDを送信
  const productsResult = await db.execute(sql`
    SELECT p.id, p.updated_at
    FROM products p
    LEFT JOIN seo_indexing_status sis ON p.id = sis.product_id
    WHERE sis.product_id IS NULL
       OR (sis.status = 'pending' AND sis.last_requested_at < NOW() - INTERVAL '7 days')
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    updated_at: Date;
  }>;

  for (const product of products) {
    if (startTime && timeLimit && Date.now() - startTime > timeLimit) {
      console.log(`[seo-enhance] Time limit reached, processed ${stats.totalProcessed}/${products.length}`);
      break;
    }
    stats.totalProcessed++;

    // 数値IDベースのURL（サイトマップと同じ形式）
    const productUrl = `${siteBaseUrl}/products/${product['id']}`;

    try {
      const result = await deps.requestIndexing(productUrl, 'URL_UPDATED');

      if (result.success) {
        await db.execute(sql`
          INSERT INTO seo_indexing_status (
            url,
            product_id,
            status,
            last_requested_at
          )
          VALUES (
            ${productUrl},
            ${product['id']},
            'requested',
            NOW()
          )
          ON CONFLICT (url)
          DO UPDATE SET
            status = 'requested',
            last_requested_at = NOW()
        `);

        stats.success++;
        results.push({
          productId: product['id'],
          url: productUrl,
          status: 'requested',
        });
      } else if (result.requiresOwnershipVerification) {
        ownershipVerificationRequired = true;
        await db.execute(sql`
          INSERT INTO seo_indexing_status (
            url,
            product_id,
            status,
            error_message
          )
          VALUES (
            ${productUrl},
            ${product['id']},
            'ownership_required',
            ${result.error || 'URL ownership verification required'}
          )
          ON CONFLICT (url)
          DO UPDATE SET
            status = 'ownership_required',
            error_message = EXCLUDED.error_message
        `);

        stats.skipped++;
      } else {
        await db.execute(sql`
          INSERT INTO seo_indexing_status (
            url,
            product_id,
            status,
            error_message
          )
          VALUES (
            ${productUrl},
            ${product['id']},
            'error',
            ${result.error || 'Unknown error'}
          )
          ON CONFLICT (url)
          DO UPDATE SET
            status = 'error',
            error_message = EXCLUDED.error_message
        `);

        stats.errors++;
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`[seo-enhance] Indexing error for ${product['id']}:`, error);

      await db.execute(sql`
        INSERT INTO seo_indexing_status (
          url,
          product_id,
          status,
          error_message
        )
        VALUES (
          ${productUrl},
          ${product['id']},
          'error',
          ${error instanceof Error ? error.message : 'Unknown error'}
        )
        ON CONFLICT (url)
        DO UPDATE SET
          status = 'error',
          error_message = EXCLUDED.error_message
      `);

      stats.errors++;
    }
  }

  stats.ownershipVerificationRequired = ownershipVerificationRequired;

  if (ownershipVerificationRequired) {
    return {
      stats,
      results,
      warning: 'Search Console ownership verification required. Add the service account email as an owner in Google Search Console for this domain.',
    };
  }

  return { stats, results };
}

/**
 * アクセス解析データの取得・キャッシュ
 */
async function fetchAnalyticsData(
  db: ReturnType<SeoEnhanceHandlerDeps['getDb']>,
  reportType: string,
  deps: SeoEnhanceHandlerDeps
): Promise<{ stats: Stats; results: any }> {
  const stats: Stats = { totalProcessed: 1, success: 0, errors: 0, skipped: 0 };

  const ga4PropertyId = process.env['GA4_PROPERTY_ID'] || '';

  if (!ga4PropertyId) {
    return {
      stats: { ...stats, skipped: 1 },
      results: { error: 'GA4_PROPERTY_ID not configured' },
    };
  }

  const today = new Date();
  const endDate = today.toISOString().split('T')[0] ?? '';
  const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0] ?? '';
  const dateRange = `${startDate}_${endDate}`;

  const cacheResult = await db.execute(sql`
    SELECT data, cached_at
    FROM analytics_cache
    WHERE report_type = ${reportType}
      AND date_range = ${dateRange}
      AND expires_at > NOW()
  `);

  if (cacheResult.rows.length > 0) {
    const cached = cacheResult.rows[0] as { data: any; cached_at: Date };
    return {
      stats: { ...stats, skipped: 1 },
      results: {
        fromCache: true,
        cachedAt: cached.cached_at,
        data: cached.data,
      },
    };
  }

  try {
    let dimensions: string[];
    let metrics: string[];

    switch (reportType) {
      case 'top-pages':
        dimensions = ['pagePath'];
        metrics = ['screenPageViews', 'averageSessionDuration'];
        break;
      case 'top-performers':
        dimensions = ['customEvent:performer_name'];
        metrics = ['eventCount'];
        break;
      case 'traffic-sources':
        dimensions = ['sessionSource', 'sessionMedium'];
        metrics = ['sessions', 'conversions'];
        break;
      default:
        dimensions = ['pagePath'];
        metrics = ['screenPageViews'];
    }

    const report = await deps.getAnalyticsReport(
      ga4PropertyId,
      dimensions,
      metrics,
      startDate,
      endDate
    );

    if (report) {
      await db.execute(sql`
        INSERT INTO analytics_cache (
          report_type,
          date_range,
          data,
          cached_at,
          expires_at
        )
        VALUES (
          ${reportType},
          ${dateRange},
          ${JSON.stringify(report)}::jsonb,
          NOW(),
          NOW() + INTERVAL '24 hours'
        )
        ON CONFLICT (report_type, date_range)
        DO UPDATE SET
          data = EXCLUDED.data,
          cached_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours'
      `);

      stats.success = 1;
      return {
        stats,
        results: {
          fromCache: false,
          reportType,
          dateRange,
          data: report,
        },
      };
    } else {
      stats.skipped = 1;
      return {
        stats,
        results: { error: 'Analytics API returned null (service account may not be configured)' },
      };
    }
  } catch (error) {
    console.error(`[seo-enhance] Analytics error:`, error);
    stats.errors = 1;
    return {
      stats,
      results: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}

/**
 * サイトマップ用の商品リスト取得
 */
async function getSitemapData(
  db: ReturnType<SeoEnhanceHandlerDeps['getDb']>,
  limit: number,
  siteBaseUrl: string
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };

  // サイトマップとの整合性を保つため、数値IDベースのURLを使用
  const productsResult = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.updated_at,
      sis.status as indexing_status,
      sis.last_requested_at
    FROM products p
    LEFT JOIN seo_indexing_status sis ON p.id = sis.product_id
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    title: string;
    updated_at: Date;
    indexing_status: string | null;
    last_requested_at: Date | null;
  }>;

  stats.totalProcessed = products.length;
  stats.success = products.length;

  return {
    stats,
    results: products.map(p => ({
      url: `${siteBaseUrl}/products/${p.id}`,
      lastmod: p.updated_at,
      indexingStatus: p.indexing_status || 'not_requested',
      lastRequestedAt: p.last_requested_at,
    })),
  };
}

export function createSeoEnhanceHandler(deps: SeoEnhanceHandlerDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const startTime = Date.now();
    const TIME_LIMIT = 150_000; // 150秒（Cloud Scheduler 180秒タイムアウトの83%）
    const siteBaseUrl = deps.siteBaseUrl || process.env['NEXT_PUBLIC_SITE_URL'] || 'https://adult-v.com';

    try {
      const url = new URL(request['url']);
      const type = url.searchParams.get('type') || 'indexing';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
      const reportType = url.searchParams.get('report') || 'top-pages';

      const apiConfig = deps.checkGoogleApiConfig();

      let result: { stats: Stats; results: any; warning?: string };

      switch (type) {
        case 'indexing':
          result = await requestIndexingForProducts(db, limit, deps, startTime, TIME_LIMIT);
          break;

        case 'analytics':
          result = await fetchAnalyticsData(db, reportType, deps);
          break;

        case 'sitemap':
          result = await getSitemapData(db, limit, siteBaseUrl);
          break;

        default:
          return NextResponse.json({
            success: false,
            error: `Unknown SEO enhancement type: ${type}`,
            availableTypes: ['indexing', 'analytics', 'sitemap'],
          }, { status: 400 });
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      return NextResponse.json({
        success: true,
        message: `SEO enhancement (${type}) completed`,
        type,
        limit,
        apiConfig: {
          indexing: apiConfig.indexing,
          analytics: apiConfig.analytics,
        },
        stats: result.stats,
        ...(result.warning && { warning: result.warning }),
        results: Array.isArray(result.results)
          ? result.results.slice(0, 10)
          : result.results,
        duration: `${duration}s`,
      });
    } catch (error) {
      console.error('[seo-enhance] Error:', error);
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
