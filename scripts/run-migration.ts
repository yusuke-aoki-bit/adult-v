/**
 * マイグレーション実行スクリプト
 *
 * 使い方:
 *   DATABASE_URL="..." npx tsx scripts/run-migration.ts
 */

import { Pool } from 'pg';

const MIGRATION_SQL = `
-- Fix FANZA products with duration stored in seconds instead of minutes
-- Duration values > 600 are likely seconds (max realistic video duration is ~600 minutes = 10 hours)
UPDATE products
SET duration = ROUND(duration::numeric / 60)
WHERE normalized_product_id LIKE 'FANZA-%'
  AND duration > 600;
`;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: false,
  });

  try {
    console.log('🔄 Running migration...');
    await pool.query(MIGRATION_SQL);
    console.log('✅ Migration completed successfully');

    // 確認: duration分布を表示
    const result = await pool.query(`
      SELECT
        CASE
          WHEN duration < 60 THEN 'under_60_min'
          WHEN duration < 180 THEN '60-180_min'
          WHEN duration < 600 THEN '180-600_min'
          ELSE 'over_600_min'
        END as range,
        COUNT(*) as count
      FROM products
      WHERE normalized_product_id LIKE 'FANZA-%'
        AND duration IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);
    console.log('Duration distribution after fix:');
    console.table(result.rows);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
