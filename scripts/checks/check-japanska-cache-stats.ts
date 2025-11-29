/**
 * Japanska キャッシュの統計を確認
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // キャッシュされたHTMLの統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN html_content LIKE '%class="movie_ttl"%' THEN 1 END) as has_movie_ttl,
      COUNT(CASE WHEN html_content LIKE '%<!--home.html-->%' THEN 1 END) as is_home_page
    FROM raw_html_data
    WHERE source = 'Japanska'
  `);
  console.log('=== Japanska raw_html_data キャッシュ統計 ===');
  console.table(stats.rows);

  // movie_ttlがないキャッシュのproduct_idを取得
  const noTitle = await db.execute(sql`
    SELECT r.product_id
    FROM raw_html_data r
    WHERE r.source = 'Japanska'
    AND r.html_content NOT LIKE '%class="movie_ttl"%'
    LIMIT 10
  `);
  console.log('\nmovie_ttlがないキャッシュ (sample):');
  console.table(noTitle.rows);

  // 現在のproductsのタイトル状況
  const productTitles = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN p.title LIKE 'Japanska作品%' THEN 1 END) as placeholder,
      COUNT(CASE WHEN p.title NOT LIKE 'Japanska作品%' AND p.title NOT LIKE 'Japanska-%' THEN 1 END) as real_title
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
  `);
  console.log('\n=== products タイトル状況 ===');
  console.table(productTitles.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
