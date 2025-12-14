/**
 * raw_html_data テーブル分析スクリプト
 */
import { getDb } from "../packages/crawlers/src/lib/db/index.js";
import { sql } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== raw_html_data テーブル分析 ===\n");

  // GCS URLの有無で分類
  const stats = await db.execute(sql`
    SELECT
      CASE WHEN gcs_url IS NOT NULL THEN 'GCS保存済み' ELSE 'DBのみ' END as storage,
      COUNT(*) as count,
      pg_size_pretty(SUM(COALESCE(octet_length(html_content), 0))) as html_size
    FROM raw_html_data
    GROUP BY CASE WHEN gcs_url IS NOT NULL THEN 'GCS保存済み' ELSE 'DBのみ' END
  `);

  for (const row of stats.rows as any[]) {
    console.log(`${row.storage}: ${row.count} rows, HTML size: ${row.html_size || "N/A"}`);
  }

  // ソース別
  console.log("\n--- ソース別 ---");
  const bySource = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count,
      SUM(CASE WHEN gcs_url IS NOT NULL THEN 1 ELSE 0 END) as gcs_count,
      SUM(CASE WHEN html_content IS NOT NULL THEN 1 ELSE 0 END) as db_html_count
    FROM raw_html_data
    GROUP BY source
    ORDER BY count DESC
  `);

  for (const row of bySource.rows as any[]) {
    console.log(`${row.source}: ${row.count} total, GCS: ${row.gcs_count}, DB HTML: ${row.db_html_count}`);
  }

  // GCS保存済みでDBにもHTMLがあるもの（削除可能）
  console.log("\n--- 削除可能なHTML (GCS保存済み & DBにHTMLあり) ---");
  const deletable = await db.execute(sql`
    SELECT
      source,
      COUNT(*) as count,
      pg_size_pretty(SUM(octet_length(html_content))) as size
    FROM raw_html_data
    WHERE gcs_url IS NOT NULL AND html_content IS NOT NULL
    GROUP BY source
    ORDER BY SUM(octet_length(html_content)) DESC
  `);

  let totalDeletable = 0;
  for (const row of deletable.rows as any[]) {
    console.log(`${row.source}: ${row.count} rows, ${row.size}`);
    totalDeletable += parseInt(row.count);
  }
  console.log(`\n削除可能な合計: ${totalDeletable} rows`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
