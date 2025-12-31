import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // セール情報のある商品を確認
    const result = await pool.query(`
      SELECT
        p.id,
        LEFT(p.title, 40) as title_short,
        ps.sale_price,
        ps.regular_price,
        ps.discount_percent,
        ps.end_at,
        src.asp_name
      FROM products p
      JOIN product_sources src ON src.product_id = p.id
      JOIN product_sales ps ON ps.product_source_id = src.id
      WHERE ps.is_active = TRUE
      AND (ps.end_at IS NULL OR ps.end_at > NOW())
      ORDER BY ps.discount_percent DESC
      LIMIT 10
    `);

    console.log('=== セール情報のある商品（上位10件） ===');
    result.rows.forEach((row: any, i: number) => {
      console.log('[' + (i+1) + '] ID: ' + row.id);
      console.log('    タイトル: ' + row.title_short + '...');
      console.log('    ASP: ' + row.asp_name);
      console.log('    価格: ¥' + row.sale_price + ' (通常: ¥' + row.regular_price + ') ' + row.discount_percent + '%OFF');
      console.log('    終了: ' + row.end_at);
      console.log('');
    });

    // 件数確認
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      JOIN product_sources src ON src.product_id = p.id
      JOIN product_sales ps ON ps.product_source_id = src.id
      WHERE ps.is_active = TRUE
      AND (ps.end_at IS NULL OR ps.end_at > NOW())
    `);
    console.log('セール中の商品数:', countResult.rows[0].count);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
