/**
 * SEO/分析強化 Cron API エンドポイント
 *
 * Google APIs を使用してSEO・分析を強化:
 * - Indexing API: URLの即時インデックス登録リクエスト
 * - Analytics Data API: アクセス解析データ取得・キャッシュ
 *
 * GET /api/cron/seo-enhance?type=indexing|analytics&limit=100
 *
 * 注意: Indexing API と Analytics API はサービスアカウント認証が必要
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest, unauthorizedResponse } from '@/lib/cron-auth';
import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import {
  requestIndexing,
  getAnalyticsReport,
  checkGoogleApiConfig,
} from '@/lib/google-apis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分タイムアウト

interface Stats {
  totalProcessed: number;
  success: number;
  errors: number;
  skipped: number;
}

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://adult-v.pages.dev';

/**
 * URLのインデックス登録リクエスト
 * 新規商品や更新商品のURLをGoogleにインデックス登録リクエスト
 */
async function requestIndexingForProducts(
  db: ReturnType<typeof getDb>,
  limit: number
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };
  const results: any[] = [];

  // インデックス登録未リクエストの商品を取得
  const productsResult = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.updated_at
    FROM products p
    LEFT JOIN seo_indexing_status sis ON p.id = sis.product_id
    WHERE sis.product_id IS NULL
       OR (sis.status = 'pending' AND sis.last_requested_at < NOW() - INTERVAL '7 days')
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `);

  const products = productsResult.rows as Array<{
    id: number;
    normalized_product_id: string;
    updated_at: Date;
  }>;

  for (const product of products) {
    stats.totalProcessed++;

    const productUrl = `${SITE_BASE_URL}/products/${product.normalized_product_id}`;

    try {
      const success = await requestIndexing(productUrl, 'URL_UPDATED');

      if (success) {
        // インデックス状態を更新
        await db.execute(sql`
          INSERT INTO seo_indexing_status (
            url,
            product_id,
            status,
            last_requested_at
          )
          VALUES (
            ${productUrl},
            ${product.id},
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
          productId: product.id,
          url: productUrl,
          status: 'requested',
        });
      } else {
        // サービスアカウント未設定の場合はpendingのまま
        await db.execute(sql`
          INSERT INTO seo_indexing_status (
            url,
            product_id,
            status,
            error_message
          )
          VALUES (
            ${productUrl},
            ${product.id},
            'pending',
            'Service account not configured'
          )
          ON CONFLICT (url)
          DO UPDATE SET
            status = 'pending',
            error_message = 'Service account not configured'
        `);

        stats.skipped++;
      }

      // レート制限
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`[seo-enhance] Indexing error for ${product.id}:`, error);

      await db.execute(sql`
        INSERT INTO seo_indexing_status (
          url,
          product_id,
          status,
          error_message
        )
        VALUES (
          ${productUrl},
          ${product.id},
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

  return { stats, results };
}

/**
 * アクセス解析データの取得・キャッシュ
 * Google Analytics 4 からレポートを取得してキャッシュ
 */
async function fetchAnalyticsData(
  db: ReturnType<typeof getDb>,
  reportType: string
): Promise<{ stats: Stats; results: any }> {
  const stats: Stats = { totalProcessed: 1, success: 0, errors: 0, skipped: 0 };

  const ga4PropertyId = process.env.GA4_PROPERTY_ID || '';

  if (!ga4PropertyId) {
    return {
      stats: { ...stats, skipped: 1 },
      results: { error: 'GA4_PROPERTY_ID not configured' },
    };
  }

  // 日付範囲を計算
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const dateRange = `${startDate}_${endDate}`;

  // キャッシュチェック
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
        // カスタムディメンション（performer_name）が設定されている場合
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

    const report = await getAnalyticsReport(
      ga4PropertyId,
      dimensions,
      metrics,
      startDate,
      endDate
    );

    if (report) {
      // キャッシュに保存（24時間有効）
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
 * インデックスステータスと合わせて取得
 */
async function getSitemapData(
  db: ReturnType<typeof getDb>,
  limit: number
): Promise<{ stats: Stats; results: any[] }> {
  const stats: Stats = { totalProcessed: 0, success: 0, errors: 0, skipped: 0 };

  const productsResult = await db.execute(sql`
    SELECT
      p.id,
      p.normalized_product_id,
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
    normalized_product_id: string;
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
      url: `${SITE_BASE_URL}/products/${p.normalized_product_id}`,
      lastmod: p.updated_at,
      indexingStatus: p.indexing_status || 'not_requested',
      lastRequestedAt: p.last_requested_at,
    })),
  };
}

export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const db = getDb();
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'indexing';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const reportType = url.searchParams.get('report') || 'top-pages';

    // API設定チェック
    const apiConfig = checkGoogleApiConfig();
    console.log(`[seo-enhance] API Config:`, apiConfig);

    let result: { stats: Stats; results: any };

    switch (type) {
      case 'indexing':
        result = await requestIndexingForProducts(db, limit);
        break;

      case 'analytics':
        result = await fetchAnalyticsData(db, reportType);
        break;

      case 'sitemap':
        result = await getSitemapData(db, limit);
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
}
