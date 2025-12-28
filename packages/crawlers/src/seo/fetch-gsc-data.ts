/**
 * Google Search Console データ取得スクリプト
 *
 * GSC APIから検索パフォーマンスデータを取得し、
 * フッター表示用の注目女優リストを更新する
 */

import { google } from 'googleapis';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

// スキーマ定義（ローカルコピー）
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  decimal,
  date,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

const performers = pgTable('performers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
});

const seoMetrics = pgTable(
  'seo_metrics',
  {
    id: serial('id').primaryKey(),
    queryType: varchar('query_type', { length: 20 }).notNull(),
    queryOrUrl: text('query_or_url').notNull(),
    performerId: integer('performer_id'),
    clicks: integer('clicks').default(0),
    impressions: integer('impressions').default(0),
    ctr: decimal('ctr', { precision: 6, scale: 4 }),
    position: decimal('position', { precision: 6, scale: 2 }),
    dateStart: date('date_start').notNull(),
    dateEnd: date('date_end').notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    queryUrlUnique: uniqueIndex('idx_seo_metrics_query_url_date').on(
      table.queryType,
      table.queryOrUrl,
      table.dateStart,
      table.dateEnd,
    ),
  }),
);

const footerFeaturedActresses = pgTable(
  'footer_featured_actresses',
  {
    id: serial('id').primaryKey(),
    performerId: integer('performer_id').notNull(),
    performerName: varchar('performer_name', { length: 200 }).notNull(),
    impressions: integer('impressions').default(0),
    position: decimal('position', { precision: 6, scale: 2 }),
    priorityScore: integer('priority_score').default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    performerUnique: uniqueIndex('idx_footer_featured_performer').on(table.performerId),
    priorityIdx: index('idx_footer_featured_priority').on(table.priorityScore),
  }),
);

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const PROJECT_ID = 'adult-v';
// GSCに登録されているサイトURL（環境変数で上書き可能）
const SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:adult-v.web.app';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

async function main() {
  console.log('🔍 GSCデータ取得開始...');

  // シークレットから認証情報とDB URLを取得
  const [serviceAccountKey, databaseUrl] = await Promise.all([
    getSecret('google-service-account-key'),
    getSecret('database-url'),
  ]);

  // DB接続
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  // Google Auth設定
  const credentials = JSON.parse(serviceAccountKey);
  console.log(`🔑 サービスアカウント: ${credentials.client_email}`);
  console.log(`🌐 サイトURL: ${SITE_URL}`);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // 過去28日間のデータを取得
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // 昨日まで（GSCは当日データなし）
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 27); // 28日間

  const dateStartStr = startDate.toISOString().split('T')[0];
  const dateEndStr = endDate.toISOString().split('T')[0];

  console.log(`📅 期間: ${dateStartStr} 〜 ${dateEndStr}`);

  // 1. クエリ別データを取得
  console.log('📊 検索クエリデータ取得中...');
  const queryResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: dateStartStr,
      endDate: dateEndStr,
      dimensions: ['query'],
      rowLimit: 1000,
    },
  });

  const queryRows = (queryResponse.data.rows || []) as GSCRow[];
  console.log(`  取得クエリ数: ${queryRows.length}`);

  // 2. ページ別データを取得
  console.log('📄 ページデータ取得中...');
  const pageResponse = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: dateStartStr,
      endDate: dateEndStr,
      dimensions: ['page'],
      rowLimit: 1000,
    },
  });

  const pageRows = (pageResponse.data.rows || []) as GSCRow[];
  console.log(`  取得ページ数: ${pageRows.length}`);

  // 3. DBに保存
  console.log('💾 DBに保存中...');

  // クエリデータをバッチ保存（N+1解消）
  const BATCH_SIZE = 100;
  const queryValues = queryRows.map(row => ({
    queryType: 'query' as const,
    queryOrUrl: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: String(row.ctr),
    position: String(row.position),
    dateStart: dateStartStr,
    dateEnd: dateEndStr,
  }));

  for (let i = 0; i < queryValues.length; i += BATCH_SIZE) {
    const batch = queryValues.slice(i, i + BATCH_SIZE);
    await db
      .insert(seoMetrics)
      .values(batch)
      .onConflictDoUpdate({
        target: [seoMetrics.queryType, seoMetrics.queryOrUrl, seoMetrics.dateStart, seoMetrics.dateEnd],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
          fetchedAt: new Date(),
        },
      });
  }

  // 存在するperformer IDのセットを取得（外部キー制約対応）
  const existingPerformers = await db.select({ id: performers.id }).from(performers);
  const existingPerformerIds = new Set(existingPerformers.map(p => p.id));

  // ページデータをバッチ保存（N+1解消）
  const pageValues = pageRows.map(row => {
    const url = row.keys[0];
    let performerId: number | null = null;

    // /actress/{id} パターンを検出
    const actressMatch = url.match(/\/actress\/(\d+)/);
    if (actressMatch) {
      const parsedId = parseInt(actressMatch[1], 10);
      // 存在するperformerのみ関連付け（外部キー制約エラー防止）
      if (existingPerformerIds.has(parsedId)) {
        performerId = parsedId;
      }
    }

    return {
      queryType: 'page' as const,
      queryOrUrl: url,
      performerId,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: String(row.ctr),
      position: String(row.position),
      dateStart: dateStartStr,
      dateEnd: dateEndStr,
    };
  });

  for (let i = 0; i < pageValues.length; i += BATCH_SIZE) {
    const batch = pageValues.slice(i, i + BATCH_SIZE);
    await db
      .insert(seoMetrics)
      .values(batch)
      .onConflictDoUpdate({
        target: [seoMetrics.queryType, seoMetrics.queryOrUrl, seoMetrics.dateStart, seoMetrics.dateEnd],
        set: {
          clicks: sql`excluded.clicks`,
          impressions: sql`excluded.impressions`,
          ctr: sql`excluded.ctr`,
          position: sql`excluded.position`,
          performerId: sql`excluded.performer_id`,
          fetchedAt: new Date(),
        },
      });
  }

  // 4. フッター用女優リストを更新
  console.log('🎭 フッター女優リスト更新中...');

  // クエリから女優名を抽出してマッチング
  // 順位50以上 & 表示回数5以上の女優を優先
  const actressQueries = queryRows.filter(row => {
    const query = row.keys[0];
    // 作品タイトルっぽいもの（長すぎる、特殊文字多い）は除外
    if (query.length > 20 || /[【】「」]/.test(query)) return false;
    // ブランド名っぽいものも除外
    if (/mgs|duga|fanza|dmm|fc2/i.test(query)) return false;
    // 表示回数2以上のもの
    return row.impressions >= 2;
  });

  console.log(`  女優候補クエリ: ${actressQueries.length}件`);

  // 女優名でperformersテーブルを検索してマッチング
  const matchedActresses: Array<{
    performerId: number;
    performerName: string;
    impressions: number;
    position: number;
    priorityScore: number;
  }> = [];

  for (const row of actressQueries) {
    const query = row.keys[0].trim();

    // DBで女優名を検索
    const foundPerformers = await db
      .select({ id: performers.id, name: performers.name })
      .from(performers)
      .where(eq(performers.name, query))
      .limit(1);

    if (foundPerformers.length > 0) {
      const performer = foundPerformers[0];

      // 優先度スコア計算: 順位が低い（50以上）が表示回数が多いものを優先
      // スコア = 表示回数 * (順位 / 10) → 順位が高いほどスコアが高い
      const priorityScore = Math.round(row.impressions * (row.position / 10));

      matchedActresses.push({
        performerId: performer.id,
        performerName: performer.name,
        impressions: row.impressions,
        position: row.position,
        priorityScore,
      });
    }
  }

  console.log(`  マッチした女優: ${matchedActresses.length}名`);

  // 優先度順でソート（高い順）
  matchedActresses.sort((a, b) => b.priorityScore - a.priorityScore);

  // 上位20名をフッターテーブルに保存
  // まず既存データをクリア
  await db.delete(footerFeaturedActresses);

  // 新データをバッチ挿入（N+1クエリ回避）
  const top20 = matchedActresses.slice(0, 20);
  if (top20.length > 0) {
    await db.insert(footerFeaturedActresses).values(
      top20.map(actress => ({
        performerId: actress.performerId,
        performerName: actress.performerName,
        impressions: actress.impressions,
        position: String(actress.position),
        priorityScore: actress.priorityScore,
      }))
    );
  }

  console.log(`✅ フッター女優リスト更新完了: ${Math.min(matchedActresses.length, 20)}名`);

  // 結果サマリー
  console.log('\n📈 更新結果サマリー:');
  console.log(`  - クエリデータ: ${queryRows.length}件`);
  console.log(`  - ページデータ: ${pageRows.length}件`);
  console.log(`  - フッター女優: ${Math.min(matchedActresses.length, 20)}名`);

  // 上位5名を表示
  console.log('\n🌟 フッター表示女優 (上位5名):');
  for (const actress of matchedActresses.slice(0, 5)) {
    console.log(`  - ${actress.performerName}: 表示${actress.impressions}回, 順位${actress.position.toFixed(1)}, スコア${actress.priorityScore}`);
  }

  await pool.end();
  console.log('\n✨ GSCデータ取得完了');
}

main().catch(console.error);
