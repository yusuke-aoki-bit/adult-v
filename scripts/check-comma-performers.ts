import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  // カンマを含む女優名を検索
  const result = await db.execute(sql`
    SELECT id, name FROM performers WHERE name LIKE '%,%' ORDER BY id LIMIT 20
  `);

  console.log('=== カンマを含む女優名 ===');
  console.log(`件数: ${result.rows?.length || 0}`);
  for (const row of result.rows || []) {
    console.log(`ID: ${row.id}, Name: ${row.name}`);
  }

  // 総数
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM performers WHERE name LIKE '%,%'
  `);
  console.log(`\n総カンマ含む女優数: ${countResult.rows?.[0]?.count || 0}`);

  await pool.end();
}

main().catch(console.error);
