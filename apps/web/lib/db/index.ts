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
      const connectionString = process.env.DATABASE_URL || '';

      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      // Cloud SQL Proxy経由かどうかを判定（Unix socketパスを含むかチェック）
      const isCloudSqlProxy = connectionString.includes('/cloudsql/');

      // URLから接続情報をパースして、スペースなどの余分な文字を除去
      const url = new URL(connectionString);
      const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

      // 開発環境と本番環境で接続プール設定を分ける
      const isDev = process.env.NODE_ENV !== 'production';

      dbStore.pool = new Pool({
        connectionString: cleanConnectionString,
        // Cloud SQL Proxy経由の場合はSSL不要、それ以外は環境に応じて設定
        ssl: isCloudSqlProxy ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
        max: isDev ? 10 : 50, // 開発環境では10、本番は50
        min: isDev ? 2 : 10, // 開発環境では2、本番は10
        idleTimeoutMillis: isDev ? 30000 : 60000, // 開発環境では30秒、本番は60秒
        connectionTimeoutMillis: 15000, // 接続タイムアウト（15秒）
        allowExitOnIdle: isDev, // 開発環境ではアイドル時に終了を許可
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
