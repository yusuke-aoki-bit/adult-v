/**
 * マイグレーション 0025 実行スクリプト
 * wiki_performer_index テーブルの作成
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const migrationPath = path.join(__dirname, '../drizzle/migrations/0025_add_wiki_performer_index.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Running migration 0025_add_wiki_performer_index.sql...');

  // コメントを除去してからSQLをステートメントごとに分割
  const cleanSql = migrationSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // セミコロンで分割し、空でないステートメントを抽出
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Found ${statements.length} statements to execute`);

  for (const statement of statements) {
    try {
      console.log(`\nExecuting: ${statement.substring(0, 80)}...`);
      await db.execute(sql.raw(statement));
      console.log('  OK');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 既に存在するエラーは無視
      if (errorMessage.includes('already exists')) {
        console.log(`  Skipped (already exists)`);
      } else {
        console.error(`  Error: ${errorMessage}`);
      }
    }
  }

  console.log('\nMigration completed!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
