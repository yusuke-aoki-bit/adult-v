import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  // 女優と商品画像の紐付け状況を確認
  console.log('=== 演者サムネイル取得状況 ===\n');

  // 1. 商品画像がある女優と無い女優の数
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT perf.id) FILTER (WHERE prod.default_thumbnail_url IS NOT NULL AND prod.default_thumbnail_url != '') as with_image,
      COUNT(DISTINCT perf.id) FILTER (WHERE prod.default_thumbnail_url IS NULL OR prod.default_thumbnail_url = '') as without_image
    FROM performers perf
    INNER JOIN product_performers pp ON perf.id = pp.performer_id
    INNER JOIN products prod ON pp.product_id = prod.id
  `);
  console.log('商品画像統計:', stats.rows[0]);

  // 2. ASP別の商品画像状況
  const aspStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(*) as total_products,
      COUNT(*) FILTER (WHERE p.default_thumbnail_url IS NOT NULL AND p.default_thumbnail_url != '') as with_image,
      COUNT(*) FILTER (WHERE p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '') as without_image
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY total_products DESC
  `);
  console.log('\n=== ASP別商品画像状況 ===');
  for (const row of aspStats.rows as any[]) {
    console.log(`${row.asp_name}: ${row.with_image}/${row.total_products} (${Math.round(row.with_image/row.total_products*100)}%)`);
  }

  // 3. サムネイルが取れない女優のサンプル
  const noThumbActresses = await db.execute(sql`
    SELECT
      p.id,
      p.name,
      COUNT(pp.product_id) as product_count,
      array_agg(DISTINCT ps.asp_name) as asps
    FROM performers p
    INNER JOIN product_performers pp ON p.id = pp.performer_id
    INNER JOIN products prod ON pp.product_id = prod.id
    INNER JOIN product_sources ps ON prod.id = ps.product_id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp2
      INNER JOIN products prod2 ON pp2.product_id = prod2.id
      WHERE pp2.performer_id = p.id
        AND prod2.default_thumbnail_url IS NOT NULL
        AND prod2.default_thumbnail_url != ''
    )
    GROUP BY p.id, p.name
    ORDER BY COUNT(pp.product_id) DESC
    LIMIT 20
  `);
  console.log('\n=== サムネイル無し女優サンプル ===');
  for (const row of noThumbActresses.rows as any[]) {
    console.log(`ID: ${row.id} | ${row.name} | ${row.product_count}本 | ASP: ${row.asps}`);
  }

  // 4. DTIのみの女優でサムネイル有り・無しの確認
  const dtiOnlyStats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT p.id) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE pp.performer_id = p.id
            AND prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
        )
      ) as dti_with_thumb,
      COUNT(DISTINCT p.id) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM product_performers pp
          INNER JOIN products prod ON pp.product_id = prod.id
          WHERE pp.performer_id = p.id
            AND prod.default_thumbnail_url IS NOT NULL
            AND prod.default_thumbnail_url != ''
        )
      ) as dti_without_thumb
    FROM performers p
    INNER JOIN product_performers pp ON p.id = pp.performer_id
    INNER JOIN product_sources ps ON pp.product_id = ps.product_id
    WHERE ps.asp_name = 'dti'
    AND NOT EXISTS (
      SELECT 1 FROM product_performers pp2
      INNER JOIN product_sources ps2 ON pp2.product_id = ps2.product_id
      WHERE pp2.performer_id = p.id AND ps2.asp_name != 'dti'
    )
  `);
  console.log('\n=== DTIのみ女優のサムネイル状況 ===');
  console.log('サムネイル有り:', (dtiOnlyStats.rows[0] as any).dti_with_thumb);
  console.log('サムネイル無し:', (dtiOnlyStats.rows[0] as any).dti_without_thumb);
}

check().catch(console.error);
