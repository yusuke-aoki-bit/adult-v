import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTable() {
  const client = await pool.connect();
  try {
    // product_performer_lookup テーブル作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_performer_lookup (
        id SERIAL PRIMARY KEY,
        product_code VARCHAR(100) NOT NULL,
        product_code_normalized VARCHAR(100) NOT NULL,
        performer_names TEXT[] NOT NULL DEFAULT '{}',
        source VARCHAR(50) NOT NULL,
        title VARCHAR(500),
        source_url TEXT,
        crawled_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_code_normalized, source)
      )
    `);

    // インデックス作成
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lookup_product_code_norm
      ON product_performer_lookup(product_code_normalized)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lookup_source
      ON product_performer_lookup(source)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_lookup_performer_names
      ON product_performer_lookup USING GIN(performer_names)
    `);

    console.log('Table product_performer_lookup created successfully');

    // テーブル構造確認
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'product_performer_lookup'
      ORDER BY ordinal_position
    `);
    console.log('Table structure:');
    result.rows.forEach((r: { column_name: string; data_type: string }) =>
      console.log(`  ${r.column_name}: ${r.data_type}`),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

createTable().catch(console.error);
