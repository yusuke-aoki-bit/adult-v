import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== 商品画像状況チェック ===\n');

  // ASP別商品画像状況
  const noImageStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '' THEN p.id END) as no_image,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '' THEN p.id END) as with_image
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY no_image DESC
  `);
  console.log('=== ASP別商品画像状況 ===');
  console.table(noImageStats.rows);

  // 女優61810の商品で画像なしの数
  const actress61810NoImage = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as total,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '' THEN p.id END) as no_image
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE pp.performer_id = 61810
    GROUP BY ps.asp_name
    ORDER BY no_image DESC
  `);
  console.log('\n=== 女優ID 61810のASP別画像なし ===');
  console.table(actress61810NoImage.rows);

  // 女優ID 61810の商品 (最新30件)
  const actress61810 = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.default_thumbnail_url,
      ps.asp_name
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE pp.performer_id = 61810
    ORDER BY p.release_date DESC NULLS LAST
    LIMIT 30
  `);
  console.log('\n=== 女優ID 61810の商品 (最新30件) ===');
  console.table(actress61810.rows.map((r: any) => ({
    id: r.id,
    title: (r.title || '').substring(0, 30),
    asp: r.asp_name,
    thumbnail: r.default_thumbnail_url ? (r.default_thumbnail_url.substring(0, 50) + '...') : 'NO IMAGE'
  })));

  // 画像なし商品の具体例（女優61810）
  const noImageProducts = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      ps.asp_name,
      ps.original_product_id
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE pp.performer_id = 61810
    AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
    LIMIT 20
  `);
  console.log('\n=== 女優ID 61810の画像なし商品 ===');
  console.table(noImageProducts.rows.map((r: any) => ({
    id: r.id,
    title: (r.title || '').substring(0, 40),
    asp: r.asp_name,
    original_id: r.original_product_id
  })));

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
