import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function examineRawHtml() {
  const db = getDb();

  console.log('=== Examining raw_html_data ===\n');

  // Get sample from each source
  const sources = await db.execute(sql`
    SELECT DISTINCT source FROM raw_html_data ORDER BY source
  `);

  for (const row of sources.rows) {
    const source = (row as any).source;
    console.log(`\n--- ${source} ---`);

    const sample = await db.execute(sql`
      SELECT product_id, LEFT(html_content, 1000) as html_preview
      FROM raw_html_data
      WHERE source = ${source}
      LIMIT 1
    `);

    if (sample.rows.length > 0) {
      const data = sample.rows[0] as any;
      console.log(`Product ID: ${data.product_id}`);
      console.log(`HTML Preview:\n${data.html_preview}\n`);
    }
  }

  process.exit(0);
}

examineRawHtml();
