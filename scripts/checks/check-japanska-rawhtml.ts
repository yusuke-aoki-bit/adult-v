/**
 * Japanska raw_html_data を確認
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // raw_html_dataからJapanskaのサンプルを取得
  const sample = await db.execute(sql`
    SELECT id, product_id, SUBSTRING(html_content, 1, 10000) as html_snippet, LENGTH(html_content) as html_length
    FROM raw_html_data
    WHERE source = 'Japanska'
    ORDER BY id
    LIMIT 3
  `);

  for (const row of sample.rows) {
    const r = row as any;
    console.log('\n===========================================');
    console.log('ID:', r.id);
    console.log('Product ID:', r.product_id);
    console.log('HTML Length:', r.html_length);

    const html = r.html_snippet;

    // movie_ttlを探す
    const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    console.log('\nmovie_ttl match:', movieTtlMatch ? movieTtlMatch[1] : 'NOT FOUND');

    // home.htmlコメント確認
    console.log('Contains home.html comment:', html.includes('<!--home.html-->'));

    // movie_ttl divを検索（より広いパターン）
    const movieTtlDiv = html.match(/class="movie_ttl"[^>]*>([\s\S]{0,500})/i);
    if (movieTtlDiv) {
      console.log('\nmovie_ttl div context:', movieTtlDiv[1].substring(0, 200));
    }

    // タイトルタグ
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) console.log('\nTitle tag:', titleMatch[1].substring(0, 80));
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
