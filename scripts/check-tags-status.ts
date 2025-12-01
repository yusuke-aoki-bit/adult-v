import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const client = await pool.connect();
  try {
    const cats = await client.query('SELECT category, COUNT(*) as cnt FROM tags GROUP BY category ORDER BY cnt DESC');
    console.log('=== Tags by Category ===');
    for (const row of cats.rows) {
      console.log(`${row.category}: ${row.cnt}`);
    }

    const genre = await client.query(`
      SELECT t.id, t.name, COUNT(pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.category = 'genre'
      GROUP BY t.id, t.name
      ORDER BY product_count DESC
      LIMIT 10
    `);
    console.log('\n=== Top Genre Tags (with product count) ===');
    for (const row of genre.rows) {
      console.log(`${row.name}: ${row.product_count} products`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
check().catch(console.error);
