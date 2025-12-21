/**
 * PageSpeed Insights データ取得スクリプト
 *
 * PSI APIからパフォーマンスデータを取得し、
 * DBに保存して履歴を追跡する
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// PageSpeed結果テーブルスキーマ
const pagespeedResults = pgTable(
  'pagespeed_results',
  {
    id: serial('id').primaryKey(),
    url: text('url').notNull(),
    strategy: varchar('strategy', { length: 10 }).notNull(), // 'mobile' or 'desktop'
    // Scores (0-100)
    performanceScore: integer('performance_score'),
    accessibilityScore: integer('accessibility_score'),
    bestPracticesScore: integer('best_practices_score'),
    seoScore: integer('seo_score'),
    // Core Web Vitals (in ms)
    fcp: integer('fcp'), // First Contentful Paint
    lcp: integer('lcp'), // Largest Contentful Paint
    tbt: integer('tbt'), // Total Blocking Time
    cls: decimal('cls', { precision: 6, scale: 4 }), // Cumulative Layout Shift
    si: integer('si'), // Speed Index
    // Field Data (CrUX)
    fieldLcp: integer('field_lcp'),
    fieldFid: integer('field_fid'),
    fieldCls: decimal('field_cls', { precision: 6, scale: 4 }),
    fieldInp: integer('field_inp'), // Interaction to Next Paint
    // Status
    passed: boolean('passed').default(false),
    errorMessage: text('error_message'),
    // Full audit data for analysis
    auditData: jsonb('audit_data'),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (table) => ({
    urlStrategyIdx: index('idx_pagespeed_url_strategy').on(table.url, table.strategy),
    fetchedAtIdx: index('idx_pagespeed_fetched_at').on(table.fetchedAt),
  }),
);

interface PageSpeedApiResult {
  lighthouseResult?: {
    categories: {
      performance?: { score: number };
      accessibility?: { score: number };
      'best-practices'?: { score: number };
      seo?: { score: number };
    };
    audits: {
      'first-contentful-paint'?: { numericValue: number };
      'largest-contentful-paint'?: { numericValue: number };
      'total-blocking-time'?: { numericValue: number };
      'cumulative-layout-shift'?: { numericValue: number };
      'speed-index'?: { numericValue: number };
    };
  };
  loadingExperience?: {
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      FIRST_INPUT_DELAY_MS?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
      INTERACTION_TO_NEXT_PAINT?: { percentile: number };
    };
  };
  error?: {
    message: string;
  };
}

const PROJECT_ID = 'adult-v';

// 閾値設定
const THRESHOLDS = {
  performance: 70, // 70点以上
  accessibility: 90, // 90点以上
  seo: 90, // 90点以上
  lcp: 4000, // 4秒以下
};

// チェック対象URL
const URLS_TO_CHECK = [
  'https://www.adult-v.com/ja',
  'https://www.adult-v.com/ja/products',
  'https://www.adult-v.com/ja/actresses',
  'https://www.adult-v.com/en',
  'https://www.adult-v.com/en/products',
];

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

async function runPageSpeedCheck(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey?: string
): Promise<{
  url: string;
  strategy: 'mobile' | 'desktop';
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  metrics: { fcp: number; lcp: number; tbt: number; cls: number; si: number };
  fieldData: { lcp?: number; fid?: number; cls?: number; inp?: number };
  passed: boolean;
  errorMessage?: string;
  auditData?: object;
}> {
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('strategy', strategy);
  apiUrl.searchParams.append('category', 'performance');
  apiUrl.searchParams.append('category', 'accessibility');
  apiUrl.searchParams.append('category', 'best-practices');
  apiUrl.searchParams.append('category', 'seo');

  if (apiKey) {
    apiUrl.searchParams.set('key', apiKey);
  }

  console.log(`📊 Checking ${url} (${strategy})...`);

  try {
    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data: PageSpeedApiResult = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.lighthouseResult) {
      throw new Error('Invalid API response: missing lighthouseResult');
    }

    const categories = data.lighthouseResult.categories;
    const audits = data.lighthouseResult.audits;
    const fieldMetrics = data.loadingExperience?.metrics;

    const scores = {
      performance: Math.round((categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((categories.seo?.score ?? 0) * 100),
    };

    const metrics = {
      fcp: Math.round(audits['first-contentful-paint']?.numericValue ?? 0),
      lcp: Math.round(audits['largest-contentful-paint']?.numericValue ?? 0),
      tbt: Math.round(audits['total-blocking-time']?.numericValue ?? 0),
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
      si: Math.round(audits['speed-index']?.numericValue ?? 0),
    };

    const fieldData = {
      lcp: fieldMetrics?.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
      fid: fieldMetrics?.FIRST_INPUT_DELAY_MS?.percentile,
      cls: fieldMetrics?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile,
      inp: fieldMetrics?.INTERACTION_TO_NEXT_PAINT?.percentile,
    };

    // 閾値チェック
    const passed =
      scores.performance >= THRESHOLDS.performance &&
      scores.accessibility >= THRESHOLDS.accessibility &&
      scores.seo >= THRESHOLDS.seo &&
      metrics.lcp <= THRESHOLDS.lcp;

    return {
      url,
      strategy,
      scores,
      metrics,
      fieldData,
      passed,
      auditData: {
        categories: data.lighthouseResult.categories,
        fieldMetrics: data.loadingExperience?.metrics,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error: ${errorMessage}`);
    return {
      url,
      strategy,
      scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
      metrics: { fcp: 0, lcp: 0, tbt: 0, cls: 0, si: 0 },
      fieldData: {},
      passed: false,
      errorMessage,
    };
  }
}

async function ensureTableExists(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // テーブル存在確認
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'pagespeed_results'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('📋 pagespeed_results テーブルを作成中...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS pagespeed_results (
          id SERIAL PRIMARY KEY,
          url TEXT NOT NULL,
          strategy VARCHAR(10) NOT NULL,
          performance_score INTEGER,
          accessibility_score INTEGER,
          best_practices_score INTEGER,
          seo_score INTEGER,
          fcp INTEGER,
          lcp INTEGER,
          tbt INTEGER,
          cls DECIMAL(6, 4),
          si INTEGER,
          field_lcp INTEGER,
          field_fid INTEGER,
          field_cls DECIMAL(6, 4),
          field_inp INTEGER,
          passed BOOLEAN DEFAULT FALSE,
          error_message TEXT,
          audit_data JSONB,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pagespeed_url_strategy ON pagespeed_results(url, strategy);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pagespeed_fetched_at ON pagespeed_results(fetched_at);
      `);
      console.log('✅ テーブル作成完了');
    }
  } finally {
    client.release();
  }
}

async function main() {
  console.log('🚀 PageSpeed Insights データ取得開始...');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // シークレットから認証情報とDB URLを取得
  let databaseUrl: string;
  let apiKey: string | undefined;

  try {
    [databaseUrl, apiKey] = await Promise.all([
      getSecret('database-url'),
      getSecret('pagespeed-api-key').catch(() => undefined),
    ]);
  } catch (error) {
    console.error('❌ シークレット取得エラー:', error);
    process.exit(1);
  }

  if (apiKey) {
    console.log('🔑 PageSpeed APIキー: 設定済み');
  } else {
    console.log('⚠️ PageSpeed APIキーなし（レート制限あり）');
  }

  // DB接続
  const pool = new Pool({ connectionString: databaseUrl });

  // テーブル存在確認・作成
  await ensureTableExists(pool);

  const db = drizzle(pool);

  const results: Array<{
    url: string;
    strategy: string;
    passed: boolean;
    scores: { performance: number };
    metrics: { lcp: number };
  }> = [];

  for (const url of URLS_TO_CHECK) {
    for (const strategy of ['mobile', 'desktop'] as const) {
      const result = await runPageSpeedCheck(url, strategy, apiKey);
      results.push(result);

      // スコア表示
      const statusIcon = result.passed ? '✅' : '⚠️';
      console.log(
        `  ${statusIcon} Performance: ${result.scores.performance}, ` +
          `A11y: ${result.scores.accessibility}, ` +
          `SEO: ${result.scores.seo}, ` +
          `LCP: ${(result.metrics.lcp / 1000).toFixed(2)}s`
      );

      // DBに保存
      await db.insert(pagespeedResults).values({
        url: result.url,
        strategy: result.strategy,
        performanceScore: result.scores.performance,
        accessibilityScore: result.scores.accessibility,
        bestPracticesScore: result.scores.bestPractices,
        seoScore: result.scores.seo,
        fcp: result.metrics.fcp,
        lcp: result.metrics.lcp,
        tbt: result.metrics.tbt,
        cls: String(result.metrics.cls),
        si: result.metrics.si,
        fieldLcp: result.fieldData.lcp,
        fieldFid: result.fieldData.fid,
        fieldCls: result.fieldData.cls ? String(result.fieldData.cls) : null,
        fieldInp: result.fieldData.inp,
        passed: result.passed,
        errorMessage: result.errorMessage,
        auditData: result.auditData,
      });

      // APIレート制限対策
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('');
  }

  // サマリー
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 サマリー:');
  console.log(`  チェック数: ${results.length}`);
  console.log(`  合格: ${results.filter((r) => r.passed).length}`);
  console.log(`  不合格: ${results.filter((r) => !r.passed).length}`);

  // 平均スコア
  const avgPerformance =
    results.reduce((sum, r) => sum + r.scores.performance, 0) / results.length;
  const avgLcp = results.reduce((sum, r) => sum + r.metrics.lcp, 0) / results.length;

  console.log(`  平均 Performance: ${avgPerformance.toFixed(0)}`);
  console.log(`  平均 LCP: ${(avgLcp / 1000).toFixed(2)}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await pool.end();
  console.log('\n✨ PageSpeed Insights データ取得完了');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
