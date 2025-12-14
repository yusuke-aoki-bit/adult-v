/**
 * DB負荷調査スクリプト
 */
import { getDb } from "../packages/crawlers/src/lib/db/index.js";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== DB負荷調査 ===\n");

  // テーブルサイズ
  console.log("📊 テーブルサイズ TOP 15:");
  const sizes = await db.execute(sql`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 15
  `);

  for (const row of sizes.rows as any[]) {
    console.log(`  ${row.table_name}: ${row.total_size} (${row.row_count} rows)`);
  }

  // インデックス使用状況
  console.log("\n🔍 未使用/低使用インデックス:");
  const unusedIdx = await db.execute(sql`
    SELECT
      schemaname || '.' || relname AS table_name,
      indexrelname AS index_name,
      pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
      idx_scan as scans
    FROM pg_stat_user_indexes ui
    JOIN pg_index i ON ui.indexrelid = i.indexrelid
    WHERE NOT indisunique AND idx_scan < 50
    ORDER BY pg_relation_size(i.indexrelid) DESC
    LIMIT 10
  `);

  for (const row of unusedIdx.rows as any[]) {
    console.log(`  ${row.index_name} on ${row.table_name}: ${row.index_size} (scans: ${row.scans})`);
  }

  // 現在実行中のクエリ
  console.log("\n⏳ 実行中クエリ:");
  const active = await db.execute(sql`
    SELECT
      pid,
      EXTRACT(EPOCH FROM (now() - query_start))::int as duration_sec,
      state,
      substring(query, 1, 150) as query_preview
    FROM pg_stat_activity
    WHERE state != 'idle' AND query NOT LIKE '%pg_stat%'
    ORDER BY query_start
    LIMIT 10
  `);

  if (active.rows.length === 0) {
    console.log("  アクティブなクエリなし");
  } else {
    for (const row of active.rows as any[]) {
      console.log(`  PID ${row.pid}: ${row.duration_sec}s - ${row.state}`);
      console.log(`    ${row.query_preview}`);
    }
  }

  // DBキャッシュヒット率
  console.log("\n💾 キャッシュヒット率:");
  const cacheHit = await db.execute(sql`
    SELECT
      sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 as hit_ratio
    FROM pg_statio_user_tables
  `);

  const hitRatio = (cacheHit.rows[0] as any)?.hit_ratio;
  console.log(`  ヒット率: ${hitRatio ? hitRatio.toFixed(2) : 'N/A'}%`);

  // 接続数
  console.log("\n🔌 接続状況:");
  const connections = await db.execute(sql`
    SELECT
      count(*) as total,
      sum(case when state = 'active' then 1 else 0 end) as active,
      sum(case when state = 'idle' then 1 else 0 end) as idle
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);

  const conn = connections.rows[0] as any;
  console.log(`  総接続: ${conn.total}, アクティブ: ${conn.active}, アイドル: ${conn.idle}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
