import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  try {
    // X1Xの商品IDサンプル
    const x1x = await pool.query(`
      SELECT ps.original_product_id, p.default_thumbnail_url
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'X1X'
      ORDER BY p.id DESC
      LIMIT 10
    `);
    console.log('X1X products (最新10件):');
    x1x.rows.forEach(row => {
      console.log(`  ID: ${row.original_product_id} -> ${row.default_thumbnail_url}`);
    });

    // ENKOU55の商品IDサンプル
    const enkou = await pool.query(`
      SELECT ps.original_product_id, p.default_thumbnail_url
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'ENKOU55'
      ORDER BY p.id DESC
      LIMIT 5
    `);
    console.log('\nENKOU55 products (最新5件):');
    enkou.rows.forEach(row => {
      console.log(`  ID: ${row.original_product_id} -> ${row.default_thumbnail_url}`);
    });

    // UREKKO
    const urekko = await pool.query(`
      SELECT ps.original_product_id, p.default_thumbnail_url
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'UREKKO'
      ORDER BY p.id DESC
      LIMIT 5
    `);
    console.log('\nUREKKO products (最新5件):');
    urekko.rows.forEach(row => {
      console.log(`  ID: ${row.original_product_id} -> ${row.default_thumbnail_url}`);
    });

    // TVDEAV
    const tvdeav = await pool.query(`
      SELECT ps.original_product_id, p.default_thumbnail_url
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'TVDEAV'
      ORDER BY p.id DESC
      LIMIT 10
    `);
    console.log('\nTVDEAV products (最新10件):');
    tvdeav.rows.forEach(row => {
      console.log(`  ID: ${row.original_product_id} -> ${row.default_thumbnail_url}`);
    });

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
