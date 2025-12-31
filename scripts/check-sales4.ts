import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 最新のセール終了日を確認
  const latestResult = await pool.query(`
    SELECT MAX(end_at) as latest_end, MIN(end_at) as earliest_end
    FROM product_sales
  `);
  console.log('=== セール終了日の範囲 ===');
  console.log('最新終了日:', latestResult.rows[0].latest_end);
  console.log('最古終了日:', latestResult.rows[0].earliest_end);

  // 最近のセール（期限切れ含む）
  const recentResult = await pool.query(`
    SELECT ps.end_at, ps.sale_name, ps.sale_price, src.asp_name
    FROM product_sales ps
    JOIN product_sources src ON ps.product_source_id = src.id
    ORDER BY ps.end_at DESC
    LIMIT 10
  `);
  console.log('\n=== 最近のセール（期限切れ含む） ===');
  recentResult.rows.forEach((row: any, i: number) => {
    console.log('[' + (i+1) + ']', row.asp_name, ':', row.sale_name, '- 終了:', row.end_at);
  });

  // 現在時刻
  const nowResult = await pool.query('SELECT NOW() as now');
  console.log('\n現在時刻:', nowResult.rows[0].now);

  await pool.end();
}

main().catch(console.error);
