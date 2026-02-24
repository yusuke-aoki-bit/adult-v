/**
 * ワンタイムマイグレーション実行ハンドラー
 *
 * 使い方:
 * 1. マイグレーション名をパラメータで指定: ?migration=ai-review-translations
 * 2. デプロイ後にエンドポイントを呼び出す
 */

import { sql } from 'drizzle-orm';

// DB型定義 - 依存注入パターンのため any を使用
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

interface RunMigrationDeps {
  getDb: () => AnyDb;
}

// サポートされているマイグレーション
const MIGRATIONS: Record<string, { sql: string; verify: string }> = {
  'fix-mgs-affiliate-urls': {
    sql: `
      -- MGSアフィリエイトURLにHTMLウィジェットコードが入っている問題を修正
      UPDATE product_sources
      SET affiliate_url = 'https://www.mgstage.com/product/product_detail/' || original_product_id || '/?af_id=6CS5PGEBQDUYPZLHYEM33TBZFJ'
      WHERE asp_name = 'MGS' AND affiliate_url LIKE '<%';
    `,
    verify: `SELECT COUNT(*) as remaining FROM product_sources WHERE asp_name = 'MGS' AND affiliate_url LIKE '<%'`,
  },
  'ai-review-translations': {
    sql: `
      -- AIレビュー翻訳カラム追加
      ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_en TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_zh TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_ko TEXT;

      ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_en TEXT;
      ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_zh TEXT;
      ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_ko TEXT;

      COMMENT ON COLUMN products.ai_review_en IS 'AI生成レビュー（英語）';
      COMMENT ON COLUMN products.ai_review_zh IS 'AI生成レビュー（中国語簡体字）';
      COMMENT ON COLUMN products.ai_review_ko IS 'AI生成レビュー（韓国語）';

      COMMENT ON COLUMN performers.ai_review_en IS 'AI生成演者レビュー（英語）';
      COMMENT ON COLUMN performers.ai_review_zh IS 'AI生成演者レビュー（中国語簡体字）';
      COMMENT ON COLUMN performers.ai_review_ko IS 'AI生成演者レビュー（韓国語）';
    `,
    verify: `
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name LIKE 'ai_review_%'
      ORDER BY column_name
    `,
  },
  'fix-duga-640x480-urls': {
    sql: `
      -- DUGA 640x480.jpg URLを正しい240x180.jpgに修正
      -- 旧getFullSizeImageUrl()が240x180→640x480に変換してDB保存していた問題の修正
      UPDATE products
      SET default_thumbnail_url = REPLACE(default_thumbnail_url, '/640x480.jpg', '/240x180.jpg'),
          updated_at = NOW()
      WHERE default_thumbnail_url LIKE '%/640x480.jpg';
    `,
    verify: `
      SELECT
        (SELECT COUNT(*) FROM products WHERE default_thumbnail_url LIKE '%/640x480.jpg') as remaining_640x480,
        (SELECT COUNT(*) FROM products WHERE default_thumbnail_url LIKE '%/240x180.jpg') as total_240x180
    `,
  },
  'fix-protocol-relative-urls': {
    sql: `
      -- プロトコル相対URL (//domain.com/...) をhttps://に正規化
      UPDATE products
      SET default_thumbnail_url = 'https:' || default_thumbnail_url,
          updated_at = NOW()
      WHERE default_thumbnail_url LIKE '//%'
        AND default_thumbnail_url NOT LIKE 'http%';
    `,
    verify: `
      SELECT
        (SELECT COUNT(*) FROM products WHERE default_thumbnail_url LIKE '//%' AND default_thumbnail_url NOT LIKE 'http%') as remaining_protocol_relative
    `,
  },
};

export function createRunMigrationHandler(deps: RunMigrationDeps) {
  return async (migrationName: string) => {
    const startTime = Date.now();
    console.log(`[run-migration] Starting migration: ${migrationName}`);

    const migration = MIGRATIONS[migrationName];
    if (!migration) {
      return {
        success: false,
        error: `Unknown migration: ${migrationName}. Available: ${Object.keys(MIGRATIONS).join(', ')}`,
        duration: Date.now() - startTime,
      };
    }

    const db = deps.getDb();

    try {
      // マイグレーション実行
      await db.execute(sql.raw(migration.sql));

      // 確認クエリ
      const verifyResult = await db.execute(sql.raw(migration.verify));

      const duration = Date.now() - startTime;
      console.log(`[run-migration] Completed in ${duration}ms`);

      return {
        success: true,
        migration: migrationName,
        verification: verifyResult.rows,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[run-migration] Failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  };
}
