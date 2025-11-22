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

      dbStore.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // 最大接続数
        idleTimeoutMillis: 30000, // アイドル接続のタイムアウト
        connectionTimeoutMillis: 10000, // 接続タイムアウト
        // PostgreSQL connection options
        // This ensures client_encoding is set immediately on connection
        options: '-c client_encoding=UTF8',
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
