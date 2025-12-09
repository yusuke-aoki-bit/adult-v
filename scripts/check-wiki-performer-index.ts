/**
 * wiki_performer_index テーブルの確認スクリプト
 */

import { db } from '../lib/db';
import { wikiPerformerIndex } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const count = await db.select({ count: sql<number>`count(*)` }).from(wikiPerformerIndex);
  console.log('Total records:', count[0].count);

  const samples = await db.select().from(wikiPerformerIndex).limit(10);
  console.log('\nSample records:');
  for (const s of samples) {
    console.log(`  ${s.maker}: ${s.performerName} (romaji: ${s.performerNameRomaji || 'N/A'})`);
  }
}

main().catch(console.error);
