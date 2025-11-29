import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== Categories Table Constraints ===\n');

  // Check constraints
  const constraints = await db.execute(sql`
    SELECT conname, contype
    FROM pg_constraint
    WHERE conrelid = 'categories'::regclass
  `);

  console.log('Constraints:');
  console.table(constraints.rows);

  // Check if UNIQUE constraint exists on name column
  const uniqueCheck = await db.execute(sql`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'categories'::regclass
    AND contype = 'u'
  `);

  if (uniqueCheck.rows.length === 0) {
    console.log('\n⚠️  No UNIQUE constraint found on categories table');
    console.log('   This is causing the ON CONFLICT (name) clause to fail\n');
  } else {
    console.log('\n✅ UNIQUE constraint exists');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
