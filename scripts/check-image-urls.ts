import { getDb } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';
import { getFullSizeImageUrl } from '../lib/image-utils.js';

async function main() {
  const db = getDb();

  // 各ASPから画像URLサンプルを取得
  const result = await db.execute(sql`
    SELECT DISTINCT
      ps.asp_name,
      p.default_thumbnail_url as sample_url
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.default_thumbnail_url IS NOT NULL
      AND p.default_thumbnail_url != ''
    ORDER BY ps.asp_name
    LIMIT 30
  `);

  console.log('=== Image URL Conversion Test ===\n');

  for (const row of result.rows as any[]) {
    const original = row.sample_url;
    const fullSize = getFullSizeImageUrl(original);
    const changed = original !== fullSize;

    console.log(`[${row.asp_name}]`);
    console.log(`  Original: ${original.substring(0, 80)}...`);
    console.log(`  FullSize: ${fullSize.substring(0, 80)}...`);
    console.log(`  Changed: ${changed ? 'YES' : 'NO'}`);
    console.log('');
  }
}

main().catch(console.error);
