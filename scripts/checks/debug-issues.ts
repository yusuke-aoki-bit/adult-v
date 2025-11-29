import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // 1. release_dateの実際の値を確認（DATE型）
  const dates = await db.execute(sql`
    SELECT release_date::text as rd, COUNT(*) as cnt
    FROM products
    WHERE release_date IS NOT NULL
    GROUP BY release_date
    ORDER BY release_date DESC
    LIMIT 10
  `);
  console.log('=== 最新のrelease_date値 ===');
  console.table(dates.rows);

  // 2. 14日以内の作品数を確認
  const today = new Date().toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log('今日:', today, '14日前:', fourteenDaysAgo);

  const recentProducts = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM products
    WHERE release_date >= ${fourteenDaysAgo}::date
  `);
  console.log('14日以内の作品数:', recentProducts.rows[0]);

  // 3. 新作がある女優の数
  const newReleaseActresses = await db.execute(sql`
    SELECT COUNT(DISTINCT pp.performer_id) as cnt
    FROM product_performers pp
    JOIN products p ON pp.product_id = p.id
    WHERE p.release_date >= ${fourteenDaysAgo}::date
  `);
  console.log('14日以内新作のある女優数:', newReleaseActresses.rows[0]);

  // 4. 最近の作品のASP別分布と出演者紐付け状況
  const recentByAsp = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT pp.performer_id) as performer_count
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE p.release_date >= ${fourteenDaysAgo}::date
    GROUP BY ps.asp_name
    ORDER BY product_count DESC
  `);
  console.log('=== 14日以内の作品（ASP別）出演者紐付け状況 ===');
  console.table(recentByAsp.rows);

  // 5. 出演数0の女優がいるか確認
  const zeroProducts = await db.execute(sql`
    SELECT pe.id, pe.name, COUNT(pp.product_id) as product_count
    FROM performers pe
    LEFT JOIN product_performers pp ON pe.id = pp.performer_id
    GROUP BY pe.id, pe.name
    HAVING COUNT(pp.product_id) = 0
    LIMIT 10
  `);
  console.log('=== 出演数0の女優（サンプル）===');
  console.table(zeroProducts.rows);

  // 出演数0の女優の総数
  const zeroCount = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM performers pe
    WHERE NOT EXISTS (
      SELECT 1 FROM product_performers pp WHERE pp.performer_id = pe.id
    )
  `);
  console.log('出演数0の女優の総数:', zeroCount.rows[0]);

  // 6. performersテーブルのカラム確認
  const columns = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'performers'
    ORDER BY ordinal_position
  `);
  console.log('=== performersテーブルのカラム ===');
  console.log(columns.rows.map((r: any) => r.column_name).join(', '));

  // 7. 人気女優の画像状況
  const popularActresses = await db.execute(sql`
    SELECT pe.id, pe.name, pe.image_url, COUNT(pp.product_id) as cnt
    FROM performers pe
    JOIN product_performers pp ON pe.id = pp.performer_id
    GROUP BY pe.id, pe.name, pe.image_url
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('=== 人気女優TOP10の画像状況 ===');
  console.table(popularActresses.rows);

  // 8. 「ルナ」という名前の女優を調べる
  const lunaActresses = await db.execute(sql`
    SELECT pe.id, pe.name, COUNT(pp.product_id) as product_count
    FROM performers pe
    LEFT JOIN product_performers pp ON pe.id = pp.performer_id
    WHERE pe.name LIKE '%ルナ%'
    GROUP BY pe.id, pe.name
    ORDER BY product_count DESC
    LIMIT 10
  `);
  console.log('=== 「ルナ」を含む女優 ===');
  console.table(lunaActresses.rows);

  // 9. product_performersの総数とユニーク
  const ppStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT product_id) as products,
      COUNT(DISTINCT performer_id) as performers
    FROM product_performers
  `);
  console.log('=== product_performersテーブル統計 ===');
  console.table(ppStats.rows);

  process.exit(0);
}

main();
