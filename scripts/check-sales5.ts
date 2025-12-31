import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // is_active状態を確認
  const activeResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active,
      COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive
    FROM product_sales
  `);
  console.log('=== is_active状態 ===');
  console.log('総数:', activeResult.rows[0].total);
  console.log('is_active=TRUE:', activeResult.rows[0].active);
  console.log('is_active=FALSE:', activeResult.rows[0].inactive);

  // is_active=TRUEのセールをサンプル表示
  const sampleResult = await pool.query(`
    SELECT ps.id, ps.sale_price, ps.regular_price, ps.discount_percent, 
           ps.is_active, ps.end_at, ps.fetched_at,
           src.asp_name, src.original_product_id
    FROM product_sales ps
    JOIN product_sources src ON ps.product_source_id = src.id
    WHERE ps.is_active = TRUE
    ORDER BY ps.fetched_at DESC
    LIMIT 5
  `);
  console.log('\n=== is_active=TRUEのセール（サンプル） ===');
  sampleResult.rows.forEach((row: any, i: number) => {
    console.log('[' + (i+1) + ']', row.asp_name, row.original_product_id);
    console.log('    価格:', row.sale_price, '円 (通常', row.regular_price, '円)', row.discount_percent + '%OFF');
    console.log('    is_active:', row.is_active, ', end_at:', row.end_at);
    console.log('    fetched_at:', row.fetched_at);
  });

  await pool.end();
}

main().catch(console.error);
