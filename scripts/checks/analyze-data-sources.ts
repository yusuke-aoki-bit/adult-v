import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== データソース分析 ===\n');

  // ASP別のデータ数
  console.log('【1. ASP別のproduct_sources数】');
  const aspCounts = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_sources
    GROUP BY asp_name
    ORDER BY count DESC
  `);
  console.table(aspCounts.rows);

  // ASP別の商品数（重複排除）
  console.log('\n【2. ASP別の一意商品数】');
  const uniqueProducts = await db.execute(sql`
    SELECT asp_name, COUNT(DISTINCT product_id) as unique_products
    FROM product_sources
    GROUP BY asp_name
    ORDER BY unique_products DESC
  `);
  console.table(uniqueProducts.rows);

  // 全商品数
  console.log('\n【3. 全商品数】');
  const totalProducts = await db.execute(sql`
    SELECT COUNT(*) as total FROM products
  `);
  console.log('総商品数:', totalProducts.rows[0].total);

  // DUGA, Sokmil, MGS以外のASP
  console.log('\n【4. DUGA, Sokmil, MGS以外のASP】');
  const otherAsps = await db.execute(sql`
    SELECT DISTINCT asp_name
    FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
    ORDER BY asp_name
  `);
  console.table(otherAsps.rows);

  // 削除対象のデータ数
  console.log('\n【5. 削除対象データ数】');
  const deleteCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
  `);
  console.log('削除対象のproduct_sources数:', deleteCount.rows[0].count);

  // 削除対象の商品数（重複排除）
  const deleteProducts = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count
    FROM product_sources
    WHERE asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
  `);
  console.log('削除対象の一意商品数:', deleteProducts.rows[0].count);

  // MGS, DUGA, Sokmilにしか紐づいていない商品数
  console.log('\n【6. 保持するASPにのみ紐づく商品数】');
  const keepOnlyProducts = await db.execute(sql`
    SELECT COUNT(DISTINCT p.id) as count
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name NOT IN ('DUGA', 'ソクミル', 'Sokmil', 'MGS')
    )
  `);
  console.log('DUGA/Sokmil/MGSのみの商品数:', keepOnlyProducts.rows[0].count);

  process.exit(0);
}

main().catch(console.error);
