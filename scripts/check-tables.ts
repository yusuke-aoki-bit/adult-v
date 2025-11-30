import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db';

async function checkTables() {
  const db = getDb();

  // product_videosテーブルの存在確認
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('product_videos', 'raw_html_data')
  `);
  console.log('Tables found:', JSON.stringify(tables.rows));

  // product_videosの構造
  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'product_videos'
  `);
  console.log('product_videos columns:', JSON.stringify(columns.rows));

  // raw_html_dataの構造
  const rawColumns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'raw_html_data'
  `);
  console.log('raw_html_data columns:', JSON.stringify(rawColumns.rows));

  process.exit(0);
}

checkTables().catch(e => { console.error(e); process.exit(1); });
