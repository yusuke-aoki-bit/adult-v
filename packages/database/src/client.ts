// サーバーサイドでのみデータベースにアクセス
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

// データベース接続を管理するオブジェクト
const dbStore: { instance: ReturnType<typeof drizzle> | null; pool: Pool | null } = {
  instance: null,
  pool: null,
};

/**
 * データベース接続を取得（サーバーサイドのみ）
 */
function getDb() {
  // クライアントサイドではエラー
  if (typeof window !== 'undefined') {
    throw new Error('Database access is only available on the server side');
  }

  if (!dbStore.instance) {
    try {
      // 環境変数から接続情報を取得
      const connectionString = process.env.DATABASE_URL || '';

      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Cloud SQL Proxy経由かどうかを判定（Unix socketパスを含むかチェック）
      const isCloudSqlProxy = connectionString.includes('/cloudsql/');

      // URLから接続情報をパースして、スペースなどの余分な文字を除去
      const url = new URL(connectionString);
      const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

      const isDev = process.env.NODE_ENV !== 'production';
      // Cloud Run Jobs用の設定（長時間バッチ処理に最適化）
      const isCloudRunJob = process.env.K_SERVICE !== undefined || process.env.CLOUD_RUN_JOB !== undefined;

      dbStore.pool = new Pool({
        connectionString: cleanConnectionString,
        // Cloud SQL Proxy経由の場合はSSL不要、それ以外は環境に応じて設定
        ssl: isCloudSqlProxy ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
        // 環境に応じた接続プール設定
        max: isDev ? 5 : (isCloudRunJob ? 10 : 50), // 開発: 5, ジョブ: 10, Webサーバー: 50
        min: isDev ? 0 : (isCloudRunJob ? 1 : 10), // 開発: 0, ジョブ: 1, Webサーバー: 10
        idleTimeoutMillis: isDev ? 10000 : (isCloudRunJob ? 30000 : 60000), // 開発: 10秒, ジョブ: 30秒, Web: 60秒
        connectionTimeoutMillis: isDev ? 10000 : 30000, // 接続タイムアウト: 開発10秒, 本番30秒
        allowExitOnIdle: isDev || isCloudRunJob, // 開発・ジョブ環境では終了を許可
        // クエリタイムアウト
        query_timeout: isDev ? 30000 : 120000, // 開発: 30秒, 本番: 120秒（長いクエリ対応）
        statement_timeout: isDev ? 30000 : 120000,
      });

      // 接続エラー時のハンドリング
      dbStore.pool.on('error', (err) => {
        console.error('Unexpected database pool error:', err);
        // 接続プールをリセット
        dbStore.instance = null;
        dbStore.pool = null;
      });

      dbStore.instance = drizzle(dbStore.pool, { schema });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return dbStore.instance;
}

// 接続終了用関数
async function closeDb() {
  if (dbStore.pool) {
    await dbStore.pool.end();
    dbStore.pool = null;
    dbStore.instance = null;
  }
}

export { getDb, closeDb };
// 後方互換性のため
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});
