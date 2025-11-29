import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // Japanska商品の現状
  const status = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%') as placeholder,
      COUNT(*) FILTER (WHERE p.title NOT LIKE 'Japanska作品%' AND p.title NOT LIKE 'Japanska-%') as valid,
      COUNT(*) as total
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
  `);
  console.log('=== Japanska商品タイトル状況 ===');
  console.table(status.rows);

  // raw_html_dataの有効HTMLを確認
  const validHtml = await db.execute(sql`
    SELECT rhd.original_product_id,
           rhd.html NOT LIKE '%<!--home.html-->%' as is_valid,
           substring(rhd.html, 1, 200) as html_preview
    FROM raw_html_data rhd
    WHERE rhd.source = 'Japanska'
    AND rhd.html NOT LIKE '%<!--home.html-->%'
    LIMIT 5
  `);
  console.log('\n=== 有効なHTML (movie_ttlあり) ===');
  console.table(validHtml.rows);

  // 有効なHTMLからタイトルを抽出できるか確認
  const withMovieTtl = await db.execute(sql`
    SELECT
      COUNT(*) as count
    FROM raw_html_data rhd
    WHERE rhd.source = 'Japanska'
    AND rhd.html LIKE '%class="movie_ttl"%'
  `);
  console.log('\n=== movie_ttlクラス含むHTML数 ===');
  console.table(withMovieTtl.rows);

  process.exit(0);
}

main().catch(console.error);
