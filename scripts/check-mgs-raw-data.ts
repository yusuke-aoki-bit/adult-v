/**
 * MGS商品のraw_dataを確認
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const client = await pool.connect();
  try {
    // product_sourcesのカラム構造を確認
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'product_sources'
      ORDER BY ordinal_position
    `);
    console.log('=== product_sources columns ===');
    for (const col of columnsResult.rows) {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    }

    // MGS商品のデータを確認
    const result = await client.query(`
      SELECT
        ps.asp_name,
        ps.product_id,
        ps.external_url,
        ps.affiliate_url,
        p.title,
        p.description,
        p.normalized_product_id
      FROM product_sources ps
      JOIN products p ON ps.product_id = p.id
      WHERE ps.asp_name = 'MGS'
      AND (p.description IS NULL OR p.description = '')
      LIMIT 5
    `);

    console.log('=== MGS商品のraw_data確認 ===');
    console.log(`Found ${result.rows.length} products without description`);

    for (const row of result.rows) {
      console.log('\n--- Product ID:', row.product_id);
      console.log('Title:', row.title);
      console.log('Current Description:', row.description || '(empty)');
      if (row.raw_data) {
        console.log('Raw Data Keys:', Object.keys(row.raw_data));
        console.log('Raw Data Sample:', JSON.stringify(row.raw_data, null, 2).slice(0, 2000));
      } else {
        console.log('Raw Data: NULL');
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
