/**
 * 女優の事前計算統計を更新するスクリプト
 *
 * 定期実行（日次など）で以下のカラムを更新:
 * - is_fanza_only: FANZA専用女優フラグ
 * - latest_release_date: 最新作品のリリース日
 * - release_count: 作品数
 *
 * 使用方法:
 *   npx tsx packages/crawlers/src/enrichment/update-performer-stats.ts
 */

import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function updatePerformerStats() {
  console.log('Starting performer stats update...');
  const startTime = Date.now();

  try {
    // 1. is_fanza_only フラグを更新
    console.log('Updating is_fanza_only flag...');

    // まず全員をFALSEにリセット
    await db.execute(sql`UPDATE performers SET is_fanza_only = FALSE`);

    // FANZA作品のみに出演している女優をマーク
    await db.execute(sql`
      UPDATE performers p
      SET is_fanza_only = TRUE
      WHERE EXISTS (
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id
        AND ps.asp_name = 'FANZA'
      )
      AND NOT EXISTS (
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id
        AND ps.asp_name != 'FANZA'
      )
    `);
    console.log('  Updated is_fanza_only flag');

    // 2. latest_release_date と release_count を更新
    console.log('Updating latest_release_date and release_count...');

    await db.execute(sql`
      UPDATE performers p
      SET
        latest_release_date = sub.latest_date,
        release_count = sub.cnt
      FROM (
        SELECT
          pp.performer_id,
          MAX(pr.release_date) as latest_date,
          COUNT(DISTINCT pp.product_id) as cnt
        FROM product_performers pp
        INNER JOIN products pr ON pp.product_id = pr.id
        GROUP BY pp.performer_id
      ) sub
      WHERE p.id = sub.performer_id
    `);
    console.log('  Updated latest_release_date and release_count');

    // 3. ANALYZE実行（クエリプランナーの統計更新）
    console.log('Running ANALYZE on performers table...');
    await db.execute(sql`ANALYZE performers`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nPerformer stats update completed in ${elapsed}s`);

    // 統計情報を表示
    const stats = await db.execute<{
      total: string;
      fanza_only: string;
      with_release_date: string;
      avg_release_count: string;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_fanza_only = TRUE) as fanza_only,
        COUNT(*) FILTER (WHERE latest_release_date IS NOT NULL) as with_release_date,
        ROUND(AVG(COALESCE(release_count, 0)), 1) as avg_release_count
      FROM performers
    `);

    if (stats.rows && stats.rows[0]) {
      console.log('\nStatistics:');
      console.log(`  Total performers: ${stats.rows[0].total}`);
      console.log(`  FANZA-only: ${stats.rows[0].fanza_only}`);
      console.log(`  With release date: ${stats.rows[0].with_release_date}`);
      console.log(`  Average release count: ${stats.rows[0].avg_release_count}`);
    }

    console.log('\n=== Performer stats update completed successfully ===');
    process.exit(0);
  } catch (error) {
    console.error('Error updating performer stats:', error);
    process.exit(1);
  }
}

updatePerformerStats();
