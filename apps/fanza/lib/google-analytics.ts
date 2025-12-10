/**
 * Google Analytics Data API 統合
 *
 * GA4からアクセスデータを取得し、人気コンテンツ分析に活用
 *
 * 前提条件:
 *   - GA4プロパティが設定済み
 *   - サービスアカウントにGA4の閲覧権限を付与
 *   - GOOGLE_SERVICE_ACCOUNT_KEY_FILE が設定されていること
 *   - GOOGLE_ANALYTICS_PROPERTY_ID が設定されていること
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as fs from 'fs';
import * as path from 'path';

// GA4プロパティID
const PROPERTY_ID = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

/**
 * Analytics Data APIクライアントを取得
 */
function getAnalyticsClient(): BetaAnalyticsDataClient {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  if (!keyFilePath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_FILE が設定されていません');
  }

  const fullPath = path.resolve(keyFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`サービスアカウントキーファイルが見つかりません: ${fullPath}`);
  }

  return new BetaAnalyticsDataClient({
    keyFilename: fullPath,
  });
}

export interface PageViewData {
  pagePath: string;
  pageTitle: string;
  screenPageViews: number;
  activeUsers: number;
}

export interface PopularContent {
  products: PageViewData[];
  performers: PageViewData[];
  tags: PageViewData[];
}

/**
 * 人気ページを取得
 */
export async function getPopularPages(
  startDate: string = '7daysAgo',
  endDate: string = 'today',
  limit: number = 100
): Promise<PageViewData[]> {
  if (!PROPERTY_ID) {
    throw new Error('GOOGLE_ANALYTICS_PROPERTY_ID が設定されていません');
  }

  const client = getAnalyticsClient();

  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' },
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
    ],
    orderBys: [
      { metric: { metricName: 'screenPageViews' }, desc: true },
    ],
    limit,
  });

  if (!response.rows) {
    return [];
  }

  return response.rows.map((row) => ({
    pagePath: row.dimensionValues?.[0]?.value || '',
    pageTitle: row.dimensionValues?.[1]?.value || '',
    screenPageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
    activeUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
  }));
}

/**
 * カテゴリ別の人気コンテンツを取得
 */
export async function getPopularContent(
  startDate: string = '7daysAgo',
  endDate: string = 'today'
): Promise<PopularContent> {
  const allPages = await getPopularPages(startDate, endDate, 500);

  const products: PageViewData[] = [];
  const performers: PageViewData[] = [];
  const tags: PageViewData[] = [];

  for (const page of allPages) {
    if (page.pagePath.startsWith('/products/')) {
      products.push(page);
    } else if (page.pagePath.startsWith('/actresses/')) {
      performers.push(page);
    } else if (page.pagePath.startsWith('/tags/')) {
      tags.push(page);
    }
  }

  return {
    products: products.slice(0, 100),
    performers: performers.slice(0, 100),
    tags: tags.slice(0, 50),
  };
}

/**
 * 検索キーワードを取得
 */
export async function getSearchTerms(
  startDate: string = '7daysAgo',
  endDate: string = 'today',
  limit: number = 100
): Promise<{ term: string; count: number }[]> {
  if (!PROPERTY_ID) {
    throw new Error('GOOGLE_ANALYTICS_PROPERTY_ID が設定されていません');
  }

  const client = getAnalyticsClient();

  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'searchTerm' }],
    metrics: [{ name: 'eventCount' }],
    orderBys: [
      { metric: { metricName: 'eventCount' }, desc: true },
    ],
    limit,
  });

  if (!response.rows) {
    return [];
  }

  return response.rows
    .map((row) => ({
      term: row.dimensionValues?.[0]?.value || '',
      count: parseInt(row.metricValues?.[0]?.value || '0', 10),
    }))
    .filter((item) => item.term && item.term !== '(not set)');
}

/**
 * トラフィックソースを取得
 */
export async function getTrafficSources(
  startDate: string = '7daysAgo',
  endDate: string = 'today'
): Promise<{ source: string; medium: string; users: number }[]> {
  if (!PROPERTY_ID) {
    throw new Error('GOOGLE_ANALYTICS_PROPERTY_ID が設定されていません');
  }

  const client = getAnalyticsClient();

  const [response] = await client.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [
      { metric: { metricName: 'activeUsers' }, desc: true },
    ],
    limit: 50,
  });

  if (!response.rows) {
    return [];
  }

  return response.rows.map((row) => ({
    source: row.dimensionValues?.[0]?.value || '',
    medium: row.dimensionValues?.[1]?.value || '',
    users: parseInt(row.metricValues?.[0]?.value || '0', 10),
  }));
}

/**
 * Analytics API設定確認
 */
export function checkAnalyticsApiConfig(): { keyFile: boolean; propertyId: boolean } {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  return {
    keyFile: !!keyFile && fs.existsSync(path.resolve(keyFile)),
    propertyId: !!PROPERTY_ID,
  };
}
