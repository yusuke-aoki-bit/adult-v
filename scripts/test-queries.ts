import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';

async function test() {
  const db = getDb();

  // backfill-videos のクエリ
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT p.id, p.normalized_product_id, ps.asp_name, ps.original_product_id
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      LEFT JOIN product_videos pv ON p.id = pv.product_id
      WHERE pv.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    `);
    console.log('backfill-videos query OK:', result.rows.length, 'rows');
  } catch (e) {
    console.error('backfill-videos query FAILED:', e);
  }

  // process-raw-data のクエリ
  try {
    const result = await db.execute(sql`
      SELECT id, source, product_id, html_content, url
      FROM raw_html_data
      WHERE processed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);
    console.log('process-raw-data query OK:', result.rows.length, 'rows');
  } catch (e) {
    console.error('process-raw-data query FAILED:', e);
  }

  process.exit(0);
}
test();
