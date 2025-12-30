import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // セール情報の総数確認
  const countResult = await pool.query(`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN sale_end_at > NOW() THEN 1 END) as active
    FROM product_sales
  `);
  console.log('=== product_sales テーブル ===');
  console.log('総数:', countResult.rows[0].total);
  console.log('有効なセール:', countResult.rows[0].active);

  // 有効なセールのサンプル
  const sampleResult = await pool.query(`
    SELECT ps.id, ps.product_source_id, ps.sale_price, ps.regular_price,
           ps.discount_percent, ps.sale_end_at, ps.sale_name,
           src.asp_name, src.product_id
    FROM product_sales ps
    JOIN product_sources src ON ps.product_source_id = src.id
    WHERE ps.sale_end_at > NOW()
    ORDER BY ps.sale_end_at ASC
    LIMIT 10
  `);

  console.log('\n=== 有効なセール（サンプル） ===');
  sampleResult.rows.forEach((row: any, i: number) => {
    console.log('[' + (i+1) + '] ASP:', row.asp_name, 'ProductID:', row.product_id);
    console.log('    価格:', row.sale_price, '円 (通常' + row.regular_price + '円)', row.discount_percent + '%OFF');
    console.log('    終了:', row.sale_end_at);
  });

  // ASP別のセール数
  const aspResult = await pool.query(`
    SELECT src.asp_name, COUNT(*) as count
    FROM product_sales ps
    JOIN product_sources src ON ps.product_source_id = src.id
    WHERE ps.sale_end_at > NOW()
    GROUP BY src.asp_name
    ORDER BY count DESC
  `);

  console.log('\n=== ASP別の有効セール数 ===');
  aspResult.rows.forEach((row: any) => {
    console.log(row.asp_name + ':', row.count + '件');
  });

  await pool.end();
}

main().catch(console.error);
