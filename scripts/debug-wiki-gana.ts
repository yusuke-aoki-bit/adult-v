import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../packages/database/src/client';

async function main() {
  // GANAを含む品番を検索
  console.log('Searching for GANA in wiki_crawl_data...');
  const ganaResult = await db.execute(sql`
    SELECT product_code, performer_name, source
    FROM wiki_crawl_data
    WHERE product_code ILIKE '%GANA%'
    LIMIT 20
  `);

  if (ganaResult.rows.length === 0) {
    console.log('  No GANA products found in wiki');
  } else {
    for (const row of ganaResult.rows as any[]) {
      console.log(`  ${row.product_code} → ${row.performer_name} (${row.source})`);
    }
  }

  // 実際にwikiにあるシリーズを確認
  console.log('\n--- Top product code prefixes in wiki ---');
  const prefixes = await db.execute(sql`
    SELECT
      SUBSTRING(product_code FROM '^[A-Z]+') as prefix,
      COUNT(*) as count
    FROM wiki_crawl_data
    WHERE product_code ~ '^[A-Z]+'
    GROUP BY prefix
    ORDER BY count DESC
    LIMIT 30
  `);
  for (const row of prefixes.rows as any[]) {
    console.log(`  ${row.prefix}: ${row.count}`);
  }

  await closeDb();
}

main().catch(console.error);
