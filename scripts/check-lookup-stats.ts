import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkLookup() {
  const client = await pool.connect();
  try {
    const stats = await client.query(`
      SELECT
        source,
        COUNT(*) as count,
        COUNT(DISTINCT product_code_normalized) as unique_products,
        SUM(array_length(performer_names, 1)) as total_performers
      FROM product_performer_lookup
      GROUP BY source
      ORDER BY count DESC
    `);

    console.log('=== Lookup DB Stats ===');
    if (stats.rows.length === 0) {
      console.log('(empty - crawl still in progress)');
    } else {
      for (const r of stats.rows) {
        console.log(`${r.source}: ${r.count} entries, ${r.unique_products} unique, ${r.total_performers} performers`);
      }
    }

    const total = await client.query('SELECT COUNT(*) as total FROM product_performer_lookup');
    console.log(`\nTotal: ${total.rows[0].total} entries`);

    // サンプルデータ
    const sample = await client.query(`
      SELECT product_code, performer_names, source
      FROM product_performer_lookup
      LIMIT 5
    `);
    console.log('\n=== Sample Data ===');
    for (const r of sample.rows) {
      console.log(`${r.product_code} (${r.source}): ${r.performer_names.join(', ')}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkLookup().catch(console.error);
