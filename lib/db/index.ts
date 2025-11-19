// サーバーサイドでのみデータベースにアクセス
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

// データベース接続を管理するオブジェクト
const dbStore: { instance: ReturnType<typeof drizzle> | null } = {
  instance: null,
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
      const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
      const sqlite = new Database(dbPath);

      // WALモードを有効化（パフォーマンス向上）
      sqlite.pragma('journal_mode = WAL');

      // 接続タイムアウトを設定
      sqlite.pragma('busy_timeout = 3000');

      dbStore.instance = drizzle(sqlite, { schema });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return dbStore.instance;
}

export { getDb };
// 後方互換性のため
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  },
});

