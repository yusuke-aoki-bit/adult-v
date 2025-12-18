/**
 * performers.is_fanza_only フラグを更新するスクリプト
 *
 * FANZA専用女優 = FANZAの作品のみに出演し、他ASPの作品には出演していない女優
 *
 * 使用方法:
 *   npx tsx --env-file=.env.local scripts/update-fanza-only-flag.ts
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../packages/database/src/client.js';

async function updateFanzaOnlyFlag() {
  console.log('=== Updating is_fanza_only flag for performers ===\n');

  const db = getDb();

  try {
    // まずカラムが存在するか確認し、なければ追加
    console.log('Checking if column exists...');
    const columnExists = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'performers' AND column_name = 'is_fanza_only'
      ) as exists
    `);

    if (!columnExists.rows[0]?.exists) {
      console.log('Adding is_fanza_only column to performers table...');
      await db.execute(sql`
        ALTER TABLE performers
        ADD COLUMN is_fanza_only BOOLEAN DEFAULT FALSE
      `);
      console.log('Column added successfully.');

      // インデックスも追加
      console.log('Adding index...');
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_performers_fanza_only ON performers(is_fanza_only)
      `);
      console.log('Index added successfully.');
    } else {
      console.log('Column already exists.');
    }

    // FANZA専用女優を特定してフラグを更新
    // FANZA専用女優 = FANZAの作品のみに出演し、他ASPの作品には出演していない女優
    console.log('\nCalculating FANZA-only performers...');

    // 一旦全員をFALSEにリセット
    const resetResult = await db.execute(sql`
      UPDATE performers SET is_fanza_only = FALSE
    `);
    console.log(`Reset ${resetResult.rowCount} performers to is_fanza_only = FALSE`);

    // FANZA専用女優をTRUEに更新
    // 条件：FANZAの作品がある AND FANZA以外の作品がない
    const updateResult = await db.execute(sql`
      UPDATE performers p
      SET is_fanza_only = TRUE
      WHERE EXISTS (
        -- FANZAの作品に出演している
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id AND ps.asp_name = 'FANZA'
      )
      AND NOT EXISTS (
        -- FANZA以外のASPの作品には出演していない
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id AND ps.asp_name != 'FANZA'
      )
    `);
    console.log(`Updated ${updateResult.rowCount} performers to is_fanza_only = TRUE`);

    // 統計を表示
    const stats = await db.execute<{ is_fanza_only: boolean; count: string }>(sql`
      SELECT is_fanza_only, COUNT(*) as count
      FROM performers
      GROUP BY is_fanza_only
      ORDER BY is_fanza_only
    `);

    console.log('\n=== Statistics ===');
    for (const row of stats.rows) {
      const label = row.is_fanza_only ? 'FANZA-only' : 'Multi-ASP';
      console.log(`${label}: ${row.count} performers`);
    }

    // 作品のある女優数も表示
    const activeStats = await db.execute<{ is_fanza_only: boolean; count: string }>(sql`
      SELECT p.is_fanza_only, COUNT(DISTINCT p.id) as count
      FROM performers p
      INNER JOIN product_performers pp ON p.id = pp.performer_id
      GROUP BY p.is_fanza_only
      ORDER BY p.is_fanza_only
    `);

    console.log('\n=== Active Performers (with products) ===');
    for (const row of activeStats.rows) {
      const label = row.is_fanza_only ? 'FANZA-only' : 'Multi-ASP';
      console.log(`${label}: ${row.count} performers`);
    }

    console.log('\n=== Update completed successfully ===');
  } catch (error) {
    console.error('Error updating is_fanza_only flag:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

updateFanzaOnlyFlag().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
