import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../packages/database/src/client';

// MGS品番を正規化（数字プレフィックスを除去）
function normalizeProductCodeForSearch(code: string): string {
  return code.replace(/^\d+/, '').toUpperCase();
}

async function main() {
  // MGS商品の品番を確認
  const mgsProducts = await db.execute(sql`
    SELECT DISTINCT p.normalized_product_id, ps.original_product_id, pf.name as performer_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN performers pf ON pp.performer_id = pf.id
    WHERE ps.asp_name = 'MGS'
    AND pf.name LIKE '%歳%'
    LIMIT 10
  `);

  console.log('MGS fake performer products:');
  for (const row of mgsProducts.rows as any[]) {
    const normalizedCode = normalizeProductCodeForSearch(row.normalized_product_id);
    console.log(`  ${row.normalized_product_id} → ${normalizedCode} → ${row.performer_name}`);
  }

  // 各品番でwiki検索をテスト
  console.log('\n--- Wiki search test ---');
  for (const row of mgsProducts.rows as any[]) {
    const originalCode = row.normalized_product_id.toUpperCase();
    const normalizedCode = normalizeProductCodeForSearch(originalCode);

    const wikiResult = await db.execute(sql`
      SELECT product_code, performer_name, source
      FROM wiki_crawl_data
      WHERE product_code ILIKE ${normalizedCode}
      LIMIT 3
    `);

    if (wikiResult.rows.length > 0) {
      console.log(`\n${originalCode} → ${normalizedCode}:`);
      for (const wikiRow of wikiResult.rows as any[]) {
        console.log(`  Found: ${wikiRow.product_code} → ${wikiRow.performer_name} (${wikiRow.source})`);
      }
    }
  }

  await closeDb();
}

main().catch(console.error);
