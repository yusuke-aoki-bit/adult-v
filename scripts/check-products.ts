import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL || '';
const url = new URL(connectionString);
const cleanConnectionString = `postgresql://${url.username}:${url.password}@${url.host}${url.pathname}`;

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: false,
  max: 2,
});

const db = drizzle(pool);

async function main() {
  const result = await db.execute(sql`
    SELECT id, normalized_product_id, title
    FROM products
    WHERE normalized_product_id IS NOT NULL
    ORDER BY release_date DESC NULLS LAST
    LIMIT 10
  `);
  console.log(JSON.stringify(result.rows || result, null, 2));
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
