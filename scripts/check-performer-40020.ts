/**
 * Check performer ID 40020 data
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { getDb } from '../lib/db/index';
import { sql } from 'drizzle-orm';

async function checkPerformer() {
  const db = getDb();

  console.log('=== Checking Performer ID 40020 ===\n');

  const result = await db.execute(sql`
    SELECT id, name, slug, created_at
    FROM performers
    WHERE id = 40020
  `);

  if (result.rows.length === 0) {
    console.log('Performer ID 40020 not found');
  } else {
    const performer = result.rows[0];
    console.log(`ID: ${performer.id}`);
    console.log(`Name: ${performer.name}`);
    console.log(`Slug: ${performer.slug}`);
    console.log(`Created: ${performer.created_at}`);

    // バイトレベルチェック
    console.log(`\nName bytes: ${Buffer.from(String(performer.name), 'utf-8').toString('hex').substring(0, 60)}...`);
  }

  // 関連する作品数も確認
  const productCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM product_performers
    WHERE performer_id = 40020
  `);
  console.log(`\nRelated products: ${productCount.rows[0].count}`);
}

checkPerformer()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });
