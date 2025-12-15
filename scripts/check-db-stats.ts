import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local loading
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('DATABASE_URL not set');
    return;
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  // PostgreSQL統計情報の確認
  const stats = await db.execute(sql`
    SELECT
      relname as table_name,
      n_live_tup as row_count,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC
    LIMIT 15
  `);
  console.log('Table sizes:');
  for (const row of stats.rows) {
    console.log(`  ${(row as any).table_name}: ${(row as any).row_count} rows (${(row as any).total_size})`);
  }

  // Active connections
  const connections = await db.execute(sql`
    SELECT count(*) as count, state, usename
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state, usename
    ORDER BY count DESC
  `);
  console.log('\nActive connections:');
  for (const row of connections.rows) {
    console.log(`  ${(row as any).usename || 'unknown'}: ${(row as any).count} (${(row as any).state || 'no state'})`);
  }

  // Long running queries
  const longQueries = await db.execute(sql`
    SELECT
      pid,
      now() - pg_stat_activity.query_start AS duration,
      query,
      state
    FROM pg_stat_activity
    WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
      AND state != 'idle'
      AND datname = current_database()
    ORDER BY duration DESC
    LIMIT 5
  `);
  console.log('\nLong running queries (>5s):');
  if (longQueries.rows.length === 0) {
    console.log('  None');
  } else {
    for (const row of longQueries.rows) {
      const q = (row as any).query || '';
      console.log(`  PID ${(row as any).pid}: ${(row as any).duration} - ${q.substring(0, 100)}...`);
    }
  }

  // Index usage stats
  const indexStats = await db.execute(sql`
    SELECT
      schemaname,
      relname as table_name,
      indexrelname as index_name,
      idx_scan as scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    WHERE idx_scan > 0
    ORDER BY idx_scan DESC
    LIMIT 10
  `);
  console.log('\nMost used indexes:');
  for (const row of indexStats.rows) {
    console.log(`  ${(row as any).index_name}: ${(row as any).scans} scans`);
  }

  // Missing indexes (sequential scans on large tables)
  const seqScans = await db.execute(sql`
    SELECT
      schemaname,
      relname as table_name,
      seq_scan,
      seq_tup_read,
      idx_scan,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    WHERE seq_scan > 0
      AND n_live_tup > 1000
      AND (idx_scan = 0 OR seq_scan > idx_scan * 10)
    ORDER BY seq_tup_read DESC
    LIMIT 10
  `);
  console.log('\nPotential missing indexes (high seq scans):');
  for (const row of seqScans.rows) {
    console.log(`  ${(row as any).table_name}: ${(row as any).seq_scan} seq scans, ${(row as any).idx_scan || 0} idx scans (${(row as any).row_count} rows)`);
  }

  await pool.end();
}

main().catch(console.error);
