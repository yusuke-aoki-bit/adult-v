import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function stats() {
  const client = await pool.connect();
  try {
    // Products stats - 中間テーブル経由で出演者有無を確認
    const products = await client.query(`
      SELECT
        COUNT(DISTINCT p.id) as total,
        COUNT(DISTINCT pp.product_id) as with_performers
      FROM products p
      LEFT JOIN product_performers pp ON p.id = pp.product_id
    `);
    const totalProducts = parseInt(products.rows[0].total);
    const withPerformers = parseInt(products.rows[0].with_performers);
    console.log('=== Products ===');
    console.log('Total:', totalProducts);
    console.log('With performers:', withPerformers);
    console.log('Without performers:', totalProducts - withPerformers);

    // Performers stats
    const performers = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN name_kana IS NOT NULL THEN 1 END) as with_kana
      FROM performers
    `);
    console.log('');
    console.log('=== Performers ===');
    console.log('Total:', performers.rows[0].total);
    console.log('With kana:', performers.rows[0].with_kana);

    // Product-Performer relationships
    const ppStats = await client.query(`
      SELECT COUNT(*) as total FROM product_performers
    `);
    console.log('');
    console.log('=== Product-Performer Links ===');
    console.log('Total links:', ppStats.rows[0].total);

    // ASP breakdown
    const aspStats = await client.query(`
      SELECT asp_name as asp, COUNT(*) as count
      FROM product_sources
      GROUP BY asp_name
      ORDER BY count DESC
    `);
    console.log('');
    console.log('=== Products by ASP ===');
    for (const row of aspStats.rows) {
      console.log(`${row.asp}: ${row.count}`);
    }

    // Tags stats
    const tagStats = await client.query(`
      SELECT
        t.category,
        COUNT(DISTINCT t.id) as tag_count,
        COUNT(pt.product_id) as usage_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY t.category
      ORDER BY usage_count DESC
    `);
    console.log('');
    console.log('=== Tags by Category ===');
    for (const row of tagStats.rows) {
      console.log(`${row.category || 'uncategorized'}: ${row.tag_count} tags (${row.usage_count} uses)`);
    }

    // ASP別の出演者充足率
    const aspPerformerStats = await client.query(`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as total_products,
        COUNT(DISTINCT pp.product_id) as products_with_performers,
        ROUND(COUNT(DISTINCT pp.product_id)::numeric / NULLIF(COUNT(DISTINCT ps.product_id), 0) * 100, 1) as coverage_pct
      FROM product_sources ps
      LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
      GROUP BY ps.asp_name
      ORDER BY total_products DESC
    `);
    console.log('');
    console.log('=== ASP別 出演者充足率 ===');
    for (const row of aspPerformerStats.rows) {
      const bar = '█'.repeat(Math.floor(parseFloat(row.coverage_pct || 0) / 5));
      console.log(`${row.asp_name.padEnd(10)}: ${row.products_with_performers}/${row.total_products} (${row.coverage_pct || 0}%) ${bar}`);
    }

    // 商品データ充足率
    const productDataStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description,
        COUNT(CASE WHEN release_date IS NOT NULL THEN 1 END) as with_release_date,
        COUNT(CASE WHEN duration IS NOT NULL AND duration > 0 THEN 1 END) as with_duration,
        COUNT(CASE WHEN default_thumbnail_url IS NOT NULL AND default_thumbnail_url != '' THEN 1 END) as with_thumbnail
      FROM products
    `);
    const pStats = productDataStats.rows[0];
    const total = parseInt(pStats.total);
    console.log('');
    console.log('=== 商品データ充足率 ===');
    console.log(`Description: ${pStats.with_description}/${total} (${(parseInt(pStats.with_description)/total*100).toFixed(1)}%)`);
    console.log(`Release Date: ${pStats.with_release_date}/${total} (${(parseInt(pStats.with_release_date)/total*100).toFixed(1)}%)`);
    console.log(`Duration: ${pStats.with_duration}/${total} (${(parseInt(pStats.with_duration)/total*100).toFixed(1)}%)`);
    console.log(`Thumbnail: ${pStats.with_thumbnail}/${total} (${(parseInt(pStats.with_thumbnail)/total*100).toFixed(1)}%)`);

    // タグ・画像充足率
    const relatedStats = await client.query(`
      SELECT
        (SELECT COUNT(DISTINCT product_id) FROM product_tags) as with_tags,
        (SELECT COUNT(DISTINCT product_id) FROM product_images) as with_images,
        (SELECT COUNT(*) FROM products) as total
    `);
    const rStats = relatedStats.rows[0];
    const rTotal = parseInt(rStats.total);
    console.log('');
    console.log('=== 関連データ充足率 ===');
    console.log(`With Tags: ${rStats.with_tags}/${rTotal} (${(parseInt(rStats.with_tags)/rTotal*100).toFixed(1)}%)`);
    console.log(`With Images: ${rStats.with_images}/${rTotal} (${(parseInt(rStats.with_images)/rTotal*100).toFixed(1)}%)`);

    // ASP別商品データ充足率
    const aspProductDataStats = await client.query(`
      SELECT
        ps.asp_name,
        COUNT(DISTINCT ps.product_id) as total_products,
        COUNT(DISTINCT CASE WHEN p.description IS NOT NULL AND p.description != '' THEN ps.product_id END) as with_description,
        COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' THEN ps.product_id END) as with_thumbnail,
        COUNT(DISTINCT pt.product_id) as with_tags
      FROM product_sources ps
      JOIN products p ON ps.product_id = p.id
      LEFT JOIN product_tags pt ON ps.product_id = pt.product_id
      GROUP BY ps.asp_name
      ORDER BY total_products DESC
    `);
    console.log('');
    console.log('=== ASP別 商品データ充足率 ===');
    console.log('ASP        | Total   | Desc    | Thumb   | Tags');
    console.log('-----------|---------|---------|---------|--------');
    for (const row of aspProductDataStats.rows) {
      const t = parseInt(row.total_products);
      const descPct = (parseInt(row.with_description)/t*100).toFixed(0);
      const thumbPct = (parseInt(row.with_thumbnail)/t*100).toFixed(0);
      const tagsPct = (parseInt(row.with_tags)/t*100).toFixed(0);
      console.log(`${row.asp_name.padEnd(10)} | ${String(t).padStart(7)} | ${descPct.padStart(5)}%  | ${thumbPct.padStart(5)}%  | ${tagsPct.padStart(5)}%`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

stats().catch(console.error);
