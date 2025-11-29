/**
 * Japanska DBデータを確認するスクリプト
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  // raw_html_dataからJapanskaのサンプルを取得
  const sample = await db.execute(sql`
    SELECT id, product_id, url, SUBSTRING(html_content, 1, 3000) as html_snippet, LENGTH(html_content) as html_length
    FROM raw_html_data
    WHERE source = 'Japanska'
    LIMIT 1
  `);

  if (sample.rows.length > 0) {
    const row = sample.rows[0] as any;
    console.log('=== Japanska raw_html_data sample ===');
    console.log('ID:', row.id);
    console.log('Product ID:', row.product_id);
    console.log('URL:', row.url);
    console.log('HTML Length:', row.html_length);
    console.log('\nHTML snippet (first 3000 chars):');
    console.log(row.html_snippet);
  } else {
    console.log('No Japanska raw HTML found in database');
  }

  // Japanska商品のタイトル状況を確認
  console.log('\n\n=== Japanska products title status ===');
  const titleStatus = await db.execute(sql`
    SELECT
      p.title,
      p.normalized_product_id,
      LENGTH(p.title) as title_length
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    LIMIT 20
  `);
  console.table(titleStatus.rows);

  // sourceの一覧を確認
  const sources = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    GROUP BY source
    ORDER BY count DESC
  `);
  console.log('\n=== All sources in raw_html_data ===');
  console.table(sources.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
