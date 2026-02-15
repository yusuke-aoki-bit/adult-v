// サーバーサイドでのみデータベースにアクセス
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

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
      const connectionString = process.env['DATABASE_URL'] || '';

      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Cloud SQL Proxy経由かどうかを判定（Unix socketパスを含むかチェック）
      const isCloudSqlProxy = connectionString.includes('/cloudsql/');

      // URLから接続情報をパース
      const url = new URL(connectionString);

      // sslmodeパラメータを確認（VPC内部接続などでSSL無効の場合）
      const sslMode = url.searchParams.get('sslmode');
      const sslDisabled = sslMode === 'disable' || sslMode === 'allow' || sslMode === 'prefer';

      // プライベートIP（10.x.x.x, 172.16-31.x.x, 192.168.x.x）またはlocalhost/127.0.0.1への接続はSSL不要
      const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|localhost)/.test(url.hostname);

      // URLから接続情報をパースして、スペースなどの余分な文字を除去
      const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

      const isDev = process.env['NODE_ENV'] !== 'production';
      // Cloud Run Jobs用の設定（長時間バッチ処理に最適化）
      const isCloudRunJob = process.env['K_SERVICE'] !== undefined || process.env['CLOUD_RUN_JOB'] !== undefined;

      // SSL設定: Cloud SQL Proxy、sslmode=disable、プライベートIPの場合はSSL無効
      const shouldDisableSsl = isCloudSqlProxy || sslDisabled || isPrivateIp;

      dbStore.pool = new Pool({
        connectionString: cleanConnectionString,
        // SSL設定: 無効化条件に該当しない本番環境のみSSL有効
        ssl: shouldDisableSsl ? false : (process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false),
        // 環境に応じた接続プール設定
        max: isDev ? 5 : (isCloudRunJob ? 10 : 20), // 開発: 5, ジョブ: 10, Webサーバー: 20
        min: isDev ? 0 : (isCloudRunJob ? 1 : 2), // 開発: 0, ジョブ: 1, Webサーバー: 2
        idleTimeoutMillis: isDev ? 10000 : 30000, // 開発: 10秒, 本番: 30秒（統一してコスト削減）
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

// Graceful shutdown: プロセス終了時にDB接続をクリーンアップ
if (typeof process !== 'undefined') {
  const shutdown = () => {
    closeDb().catch(() => {});
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export { getDb, closeDb };
// 後方互換性のため
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});
