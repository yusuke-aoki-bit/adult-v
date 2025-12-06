import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('Adding UNIQUE constraint to sokmil_raw_responses...\n');

  try {
    await db.execute(sql`
      ALTER TABLE sokmil_raw_responses
      ADD CONSTRAINT sokmil_raw_responses_item_api_key UNIQUE (item_id, api_type)
    `);

    console.log('✅ Constraint added successfully');
    console.log('   UNIQUE(item_id, api_type) on sokmil_raw_responses\n');

  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('⚠️  Constraint already exists (skipped)');
    } else {
      console.error('❌ Error adding constraint:', error.message);
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
