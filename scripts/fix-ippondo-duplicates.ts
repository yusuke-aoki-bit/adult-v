import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function fixIppondoDuplicates() {
  const db = getDb();

  console.log('========================================');
  console.log('一本道 (1pondo) DUPLICATE FIX');
  console.log('========================================\n');

  try {
    // Step 1: Check current count
    console.log('Step 1: Checking current data...');
    const countBefore = await db.execute(sql`
      SELECT COUNT(*) as total FROM raw_html_data WHERE source = '一本道'
    `);
    console.log(`  Current records: ${countBefore.rows[0].total}`);

    // Step 2: Delete all old homepage data (same hash)
    console.log('\nStep 2: Deleting old homepage duplicates...');
    const deleteResult = await db.execute(sql`
      DELETE FROM raw_html_data
      WHERE source = '一本道'
      AND hash = (
        SELECT hash
        FROM raw_html_data
        WHERE source = '一本道'
        GROUP BY hash
        HAVING COUNT(*) > 1
        LIMIT 1
      )
    `);
    console.log(`  Deleted: ${deleteResult.rowCount} records`);

    // Step 3: Verify cleanup
    console.log('\nStep 3: Verifying cleanup...');
    const countAfter = await db.execute(sql`
      SELECT COUNT(*) as total FROM raw_html_data WHERE source = '一本道'
    `);
    console.log(`  Remaining records: ${countAfter.rows[0].total}`);

    console.log('\n========================================');
    console.log('CLEANUP COMPLETE');
    console.log('========================================\n');
    console.log('Next step: Re-run crawler with correct startId');
    console.log('  cd scripts && npm run crawl:1pondo');

  } catch (error) {
    console.error('Error fixing duplicates:', error);
    throw error;
  }
}

fixIppondoDuplicates()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
