import { getDb } from '../packages/crawlers/src/lib/db/index.js';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('Checking performer_tags table...');

  try {
    // テーブルの存在確認
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'performer_tags'
    `);

    if (result.rows.length > 0) {
      console.log('Table already exists');
    } else {
      console.log('Creating performer_tags table...');
      await db.execute(sql`
        CREATE TABLE performer_tags (
          performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          source VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          PRIMARY KEY (performer_id, tag_id)
        )
      `);
      console.log('Table created!');

      // インデックスを作成
      await db.execute(sql`
        CREATE INDEX idx_performer_tags_performer ON performer_tags(performer_id)
      `);
      await db.execute(sql`
        CREATE INDEX idx_performer_tags_tag ON performer_tags(tag_id)
      `);
      console.log('Indexes created!');
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

main().finally(() => process.exit(0));
