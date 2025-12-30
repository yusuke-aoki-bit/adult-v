import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../packages/database/src/client';

async function main() {
  // SIROを含む品番を検索
  console.log('Wiki SIRO data:');
  const wikiSiro = await db.execute(sql`
    SELECT product_code, performer_name, source
    FROM wiki_crawl_data
    WHERE product_code LIKE 'SIRO-%'
    LIMIT 10
  `);
  for (const row of wikiSiro.rows as any[]) {
    console.log(`  ${row.product_code} → ${row.performer_name} (${row.source})`);
  }

  // MGSのSIRO商品を確認
  console.log('\nMGS SIRO products with fake performers:');
  const mgsSiro = await db.execute(sql`
    SELECT DISTINCT p.normalized_product_id, pf.name as performer_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN performers pf ON pp.performer_id = pf.id
    WHERE ps.asp_name = 'MGS'
    AND p.normalized_product_id LIKE '%siro-%'
    AND pf.name LIKE '%歳%'
    LIMIT 10
  `);
  for (const row of mgsSiro.rows as any[]) {
    console.log(`  ${row.normalized_product_id} → ${row.performer_name}`);
  }

  // マッチングテスト
  if (mgsSiro.rows.length > 0) {
    console.log('\n--- Matching test ---');
    const testProduct = mgsSiro.rows[0] as any;
    const code = testProduct.normalized_product_id.replace(/^\d+/, '').toUpperCase();
    console.log(`Looking for: ${code}`);

    const matchResult = await db.execute(sql`
      SELECT product_code, performer_name
      FROM wiki_crawl_data
      WHERE product_code ILIKE ${code}
      LIMIT 5
    `);
    if (matchResult.rows.length > 0) {
      for (const row of matchResult.rows as any[]) {
        console.log(`  Matched: ${row.product_code} → ${row.performer_name}`);
      }
    } else {
      console.log('  No match found');
    }
  }

  await closeDb();
}

main().catch(console.error);
