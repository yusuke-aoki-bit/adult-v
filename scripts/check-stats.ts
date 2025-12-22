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
    // 商品数統計
    console.log('=== 商品数統計 ===');
    const total = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log('総商品数:', total.rows[0].count);

    // ASP別商品数
    const byAsp = await pool.query(`
      SELECT ps.asp_name, COUNT(*) as count
      FROM product_sources ps
      GROUP BY ps.asp_name
      ORDER BY count DESC
    `);
    console.log('\nASP別商品数:');
    byAsp.rows.forEach(r => console.log(`  ${r.asp_name}: ${r.count}`));

    // 演者数
    const performers = await pool.query('SELECT COUNT(*) as count FROM performers');
    console.log('\n総演者数:', performers.rows[0].count);

    // 演者紐づけ統計
    const ppLinks = await pool.query('SELECT COUNT(*) as count FROM product_performers');
    console.log('商品-演者紐づけ数:', ppLinks.rows[0].count);

    // 演者紐づけがある商品の割合
    const withPerformers = await pool.query(`
      SELECT COUNT(DISTINCT product_id) as count FROM product_performers
    `);
    console.log('演者紐づけのある商品数:', withPerformers.rows[0].count);

    const pct = ((parseInt(withPerformers.rows[0].count) / parseInt(total.rows[0].count)) * 100).toFixed(1);
    console.log('演者紐づけ率:', pct + '%');

    // TMP系の演者紐づけ状況
    console.log('\n=== TMP系ASP演者紐づけ状況 ===');
    const tmpPerformers = await pool.query(`
      SELECT ps.asp_name,
             COUNT(DISTINCT p.id) as total_products,
             COUNT(DISTINCT pp.product_id) as with_performers
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      WHERE ps.asp_name IN ('HEYDOUGA', 'X1X', 'ENKOU55', 'UREKKO', 'TVDEAV')
      GROUP BY ps.asp_name
      ORDER BY total_products DESC
    `);
    tmpPerformers.rows.forEach(r => {
      const pct = ((parseInt(r.with_performers) / parseInt(r.total_products)) * 100).toFixed(1);
      console.log(`  ${r.asp_name}: ${r.with_performers}/${r.total_products} (${pct}%)`);
    });

    // 最近追加された商品
    console.log('\n=== 直近7日間の追加商品 ===');
    const recent = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM products
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    if (recent.rows.length === 0) {
      console.log('  (直近7日間の追加なし)');
    } else {
      recent.rows.forEach(r => console.log(`  ${r.date.toISOString().split('T')[0]}: ${r.count}件`));
    }

    // 過去30日間の推移
    console.log('\n=== 過去30日間の商品追加推移 ===');
    const monthly = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM products
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    if (monthly.rows.length === 0) {
      console.log('  (過去30日間の追加なし)');
    } else {
      console.log(`  期間: ${monthly.rows.length}日間で ${monthly.rows.reduce((sum, r) => sum + parseInt(r.count), 0)}件追加`);
    }

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
