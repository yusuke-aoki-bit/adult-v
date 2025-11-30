import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  const client = await pool.connect();
  try {
    // サムネイルURLを確認
    const result = await client.query(`
      SELECT id, title, default_thumbnail_url
      FROM products
      WHERE default_thumbnail_url IS NOT NULL
        AND default_thumbnail_url != ''
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log('=== Sample Thumbnail URLs ===');
    for (const row of result.rows) {
      console.log('ID:', row.id);
      console.log('  Title:', (row.title || '').substring(0, 50));
      console.log('  URL:', row.default_thumbnail_url);
      console.log('');
    }

    // URL形式の分析
    const urlStats = await client.query(`
      SELECT
        CASE
          WHEN default_thumbnail_url LIKE 'https://%' THEN 'https'
          WHEN default_thumbnail_url LIKE 'http://%' THEN 'http'
          WHEN default_thumbnail_url LIKE '//%' THEN 'protocol-relative'
          ELSE 'other'
        END as url_type,
        COUNT(*) as count
      FROM products
      WHERE default_thumbnail_url IS NOT NULL
        AND default_thumbnail_url != ''
      GROUP BY 1
    `);
    console.log('=== URL Type Distribution ===');
    for (const row of urlStats.rows) {
      console.log(`${row.url_type}: ${row.count}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check();
