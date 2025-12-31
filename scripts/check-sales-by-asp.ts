import { Pool } from 'pg';

async function main() {
  console.log('Connecting to database...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Test connection
    const testResult = await pool.query('SELECT 1 as test');
    console.log('Connection successful:', testResult.rows[0]);

    // ASP別のアクティブセール数を確認
    const result = await pool.query(`
      SELECT src.asp_name, COUNT(*) as count
      FROM product_sales ps
      JOIN product_sources src ON ps.product_source_id = src.id
      WHERE ps.is_active = TRUE
      GROUP BY src.asp_name
      ORDER BY count DESC
    `);
    console.log('\n=== ASP別アクティブセール数 ===');
    result.rows.forEach((row: any) => {
      console.log(row.asp_name + ':', row.count + '件');
    });

    // FANZA以外のセール数
    const nonFanzaResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM product_sales ps
      JOIN product_sources src ON ps.product_source_id = src.id
      WHERE ps.is_active = TRUE
      AND LOWER(src.asp_name) != 'fanza'
    `);
    console.log('\n=== FANZA以外のアクティブセール数 ===');
    console.log(nonFanzaResult.rows[0].count + '件');

    // FANZA以外のセール商品サンプル
    const sampleResult = await pool.query(`
      SELECT
        p.id as product_id,
        p.title,
        psl.id as source_id,
        src.asp_name,
        src.original_product_id,
        src.affiliate_url,
        ps.sale_price,
        ps.regular_price,
        ps.discount_percent
      FROM product_sales ps
      JOIN product_sources src ON ps.product_source_id = src.id
      JOIN products p ON src.product_id = p.id
      JOIN product_sources psl ON psl.product_id = p.id
      WHERE ps.is_active = TRUE
      AND LOWER(src.asp_name) != 'fanza'
      ORDER BY ps.discount_percent DESC
      LIMIT 5
    `);
    console.log('\n=== FANZA以外のセール商品（サンプル） ===');
    sampleResult.rows.forEach((row: any, i: number) => {
      console.log('[' + (i+1) + '] ProductID:', row.product_id);
      console.log('    ASP:', row.asp_name, '| 品番:', row.original_product_id);
      console.log('    価格: ¥' + row.sale_price + ' (通常: ¥' + row.regular_price + ') ' + row.discount_percent + '%OFF');
      console.log('    URL:', row.affiliate_url?.substring(0, 60) + '...');
      console.log('');
    });

    // 特定の商品IDでgetProductSourcesWithSalesのロジックをテスト
    const testProductId = 790230;
    console.log('\n=== 商品ID ' + testProductId + ' のソース情報 ===');

    // sources取得（FANZA以外）
    const sourcesResult = await pool.query(`
      SELECT
        ps.id,
        ps.asp_name,
        ps.original_product_id,
        ps.price,
        ps.currency,
        ps.affiliate_url,
        ps.is_subscription,
        ps.product_type
      FROM product_sources ps
      WHERE ps.product_id = $1
      AND LOWER(ps.asp_name) != 'fanza'
    `, [testProductId]);
    console.log('ソース数:', sourcesResult.rows.length);

    if (sourcesResult.rows.length > 0) {
      const sourceIds = sourcesResult.rows.map((s: any) => s.id);
      console.log('ソースIDs:', sourceIds);

      // セール情報取得
      const salesResult = await pool.query(`
        SELECT
          product_source_id,
          regular_price,
          sale_price,
          discount_percent,
          end_at,
          is_active
        FROM product_sales
        WHERE product_source_id = ANY($1)
        AND is_active = TRUE
      `, [sourceIds]);
      console.log('セール数:', salesResult.rows.length);
      salesResult.rows.forEach((row: any) => {
        console.log('  sourceId:', row.product_source_id, '| ¥' + row.sale_price + ' (通常¥' + row.regular_price + ') ' + row.discount_percent + '%OFF');
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    console.log('\nConnection closed');
  }
}

main();
