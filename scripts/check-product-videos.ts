import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const videos = await db.execute(sql`SELECT * FROM product_videos WHERE product_id = 181517`);
  console.log('Videos:', JSON.stringify(videos.rows, null, 2));
  process.exit(0);
}
main();
