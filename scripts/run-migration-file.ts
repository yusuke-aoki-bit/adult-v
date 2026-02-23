/**
 * SQLファイルからマイグレーションを実行するスクリプト
 *
 * 使い方:
 *   npx tsx scripts/run-migration-file.ts drizzle/migrations/0039_add_search_performance_indexes.sql
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local を読み込み
dotenv.config({ path: '.env.local' });

/**
 * SQLを個別ステートメントに分割
 */
function splitStatements(sql: string): string[] {
  // コメント行を削除してからセミコロンで分割
  const lines = sql.split('\n');
  const cleanedLines = lines.filter((line) => !line.trim().startsWith('--'));
  const cleanedSql = cleanedLines.join('\n');

  return cleanedSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: npx tsx scripts/run-migration-file.ts <sql-file>');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  // SQLファイルを読み込み
  const sqlPath = path.resolve(sqlFile);
  if (!fs.existsSync(sqlPath)) {
    console.error(`ERROR: File not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`📄 Loading migration from: ${sqlFile}`);

  const pool = new Pool({
    connectionString,
    ssl: false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 1,
  });

  try {
    console.log('🔄 Running migration...\n');

    const statements = splitStatements(sql);
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const stmt of statements) {
      if (!stmt.trim()) continue;

      // CONCURRENTLYを通常のCREATE INDEXに変換（トランザクション内で実行可能に）
      const normalizedStmt = stmt.replace(/CREATE INDEX CONCURRENTLY/gi, 'CREATE INDEX');

      try {
        const shortStmt = normalizedStmt.substring(0, 100).replace(/\n/g, ' ');
        console.log(`📌 ${shortStmt}...`);
        await pool.query(normalizedStmt);
        successCount++;
        console.log('   ✓ Success');
      } catch (err) {
        const error = err as Error;
        // インデックスが既存の場合はスキップ
        if (error.message.includes('already exists')) {
          skipCount++;
          console.log('   ⏭ Skipped (already exists)');
        } else {
          errorCount++;
          console.error(`   ✗ Failed: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Migration completed:`);
    console.log(`   - ${successCount} statements executed`);
    console.log(`   - ${skipCount} skipped (already exists)`);
    if (errorCount > 0) {
      console.log(`   - ${errorCount} errors`);
    }

    // 確認: インデックス数を表示
    const result = await pool.query(`
      SELECT COUNT(*) as total_indexes
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    console.log(`\n📊 Total indexes in public schema: ${result.rows[0].total_indexes}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
