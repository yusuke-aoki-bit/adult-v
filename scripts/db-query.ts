/**
 * Simple DB query helper
 * Usage: npx tsx scripts/db-query.ts "SELECT ..."
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.log('Usage: npx tsx scripts/db-query.ts "SELECT ..."');
    console.log('');
    console.log('Examples:');
    console.log(
      '  npx tsx scripts/db-query.ts "SELECT asp_name, COUNT(*) FROM product_sources GROUP BY asp_name ORDER BY count DESC"',
    );
    console.log('  npx tsx scripts/db-query.ts "SELECT COUNT(*) FROM products"');
    console.log('  npx tsx scripts/db-query.ts "SELECT COUNT(*) FROM performers"');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    const result = await db.execute(sql.raw(query));
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Query failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
