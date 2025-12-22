import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// .envファイルを手動で読み込む
function loadEnv() {
  // .env.localを優先、なければ.envを使用
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  const envPath = path.resolve(__dirname, '../.env');
  const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;

  if (!fs.existsSync(targetPath)) {
    console.error('.env or .env.local file not found');
    process.exit(1);
  }
  console.log(`Loading env from: ${targetPath}`);
  const content = fs.readFileSync(targetPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);
      // クォートを除去
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

async function checkThumbnails() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('Connecting to database...');

    // 全体の統計
    const total = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN default_thumbnail_url IS NOT NULL THEN 1 ELSE 0 END) as with_thumb
      FROM products
    `);
    console.log('\n=== 全体統計 ===');
    console.log(`総商品数: ${total.rows[0].total}, サムネイルあり: ${total.rows[0].with_thumb}`);

    // ASP別のサムネイルなし商品数
    const aspStats = await pool.query(`
      SELECT
        ps.asp_name,
        COUNT(*) as total,
        SUM(CASE WHEN p.default_thumbnail_url IS NOT NULL THEN 1 ELSE 0 END) as with_thumb,
        SUM(CASE WHEN p.default_thumbnail_url IS NULL THEN 1 ELSE 0 END) as without_thumb
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name IN ('HEYDOUGA', 'X1X', 'ENKOU55', 'UREKKO', 'TVDEAV')
      GROUP BY ps.asp_name
      ORDER BY ps.asp_name
    `);

    console.log('\n=== DTI系ASP別統計 ===');
    for (const row of aspStats.rows) {
      console.log(`${row.asp_name}: 合計 ${row.total}, サムネイルあり ${row.with_thumb}, なし ${row.without_thumb}`);
    }

    // product_sourcesのthumbnail_urlも確認
    const sourceStats = await pool.query(`
      SELECT
        asp_name,
        COUNT(*) as total,
        SUM(CASE WHEN thumbnail_url IS NOT NULL THEN 1 ELSE 0 END) as with_thumb
      FROM product_sources
      WHERE asp_name IN ('HEYDOUGA', 'X1X', 'ENKOU55', 'UREKKO', 'TVDEAV')
      GROUP BY asp_name
      ORDER BY asp_name
    `);

    console.log('\n=== product_sources のサムネイル状況 ===');
    for (const row of sourceStats.rows) {
      console.log(`${row.asp_name}: 合計 ${row.total}, source_thumbnailあり ${row.with_thumb}`);
    }

    // サンプルデータ
    const samples = await pool.query(`
      SELECT p.id, p.default_thumbnail_url, ps.thumbnail_url, ps.asp_name
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = 'HEYDOUGA'
      LIMIT 5
    `);

    console.log('\n=== HEYDOUGAサンプル ===');
    for (const row of samples.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`  product.default_thumbnail_url: ${row.default_thumbnail_url || 'NULL'}`);
      console.log(`  source.thumbnail_url: ${row.thumbnail_url || 'NULL'}`);
    }

  } finally {
    await pool.end();
    console.log('\nDone.');
  }
}

checkThumbnails().catch(console.error);
