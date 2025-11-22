/**
 * Check raw bytes in database
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { Pool } from 'pg';

async function checkRawBytes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  // Set client encoding
  pool.on('connect', (client) => {
    client.query('SET CLIENT_ENCODING TO UTF8', (err) => {
      if (err) console.error('Failed to set encoding:', err);
    });
  });

  try {
    // Get some DTI products
    const result = await pool.query(`
      SELECT p.id, p.title, pc.asp_name
      FROM product_cache pc
      JOIN products p ON pc.product_id = p.id
      WHERE pc.asp_name = 'DTI'
      ORDER BY pc.cached_at DESC
      LIMIT 5
    `);

    console.log('=== Database Raw Data Analysis ===\n');
    for (const row of result.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`Title: ${row.title}`);
      console.log(`Bytes: ${Buffer.from(row.title, 'utf-8').length} bytes`);
      console.log(`First 20 bytes: ${Buffer.from(row.title, 'utf-8').slice(0, 20).toString('hex')}`);
      console.log('---');
    }

    // Check client_encoding
    const encoding = await pool.query('SHOW client_encoding');
    console.log(`\nCurrent client_encoding: ${encoding.rows[0].client_encoding}`);

  } finally {
    await pool.end();
  }
}

checkRawBytes();
