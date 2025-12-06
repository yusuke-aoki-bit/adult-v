import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function addColumn() {
  console.log('Adding gcs_url column to wiki_crawl_data...');

  // カラムを追加
  await db.execute(sql`ALTER TABLE wiki_crawl_data ADD COLUMN gcs_url TEXT`);
  console.log('Column added.');

  // コメント追加
  await db.execute(
    sql`COMMENT ON COLUMN wiki_crawl_data.gcs_url IS 'GCSに保存した場合のURL (gs://bucket/path)'`
  );
  console.log('Comment added.');

  // 確認
  const result = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'wiki_crawl_data' AND column_name = 'gcs_url'
  `);
  console.log('Verification:', result.rows.length > 0 ? 'SUCCESS' : 'FAILED');

  process.exit(0);
}
addColumn().catch((e) => {
  console.error(e);
  process.exit(1);
});
