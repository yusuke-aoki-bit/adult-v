/**
 * raw_html_data テーブルのHTMLデータをGCSに移行するスクリプト
 * 移行後、DBのhtml_contentをNULLに更新
 */
import { getDb } from "../packages/crawlers/src/lib/db/index.js";
import { sql } from "drizzle-orm";
import { saveHtmlToGcs } from "../packages/crawlers/src/lib/google-apis.js";

const db = getDb();
const BATCH_SIZE = 100;
const DELAY_MS = 100; // GCSレート制限対策

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1000;
  const sourceArg = args.find(a => a.startsWith('--source='));
  const sourceFilter = sourceArg ? sourceArg.split('=')[1] : null;

  console.log("=== raw_html_data → GCS 移行スクリプト ===\n");
  console.log(`バッチサイズ: ${BATCH_SIZE}`);
  console.log(`上限: ${limit}`);
  if (sourceFilter) console.log(`ソースフィルタ: ${sourceFilter}`);
  console.log("");

  let totalMigrated = 0;
  let totalFailed = 0;
  let totalBytes = 0;
  let offset = 0;

  while (totalMigrated + totalFailed < limit) {
    // DBからhtml_contentがあるレコードを取得
    const sourceCondition = sourceFilter
      ? sql`AND source = ${sourceFilter}`
      : sql``;

    const records = await db.execute(sql`
      SELECT id, source, product_id, html_content
      FROM raw_html_data
      WHERE html_content IS NOT NULL AND gcs_url IS NULL
      ${sourceCondition}
      ORDER BY id
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `);

    if (records.rows.length === 0) {
      console.log("\n✅ 移行対象のレコードがなくなりました");
      break;
    }

    console.log(`\nバッチ処理: ${records.rows.length} レコード (offset: ${offset})`);

    for (const row of records.rows as any[]) {
      if (totalMigrated + totalFailed >= limit) break;

      try {
        const html = row.html_content as string;
        const source = (row.source as string).toLowerCase().replace(/[^a-z0-9]/g, '-');
        const productId = row.product_id as string;

        // GCSに保存
        const gcsUrl = await saveHtmlToGcs(source, productId, html);

        if (gcsUrl) {
          // DBのgcs_urlを更新し、html_contentをNULLに
          await db.execute(sql`
            UPDATE raw_html_data
            SET gcs_url = ${gcsUrl}, html_content = NULL
            WHERE id = ${row.id}
          `);

          totalBytes += html.length;
          totalMigrated++;

          if (totalMigrated % 50 === 0) {
            console.log(`  移行済み: ${totalMigrated}, サイズ: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
          }
        } else {
          console.log(`  ✗ GCS保存失敗: ${row.source}/${productId}`);
          totalFailed++;
        }

        // レート制限対策
        if (totalMigrated % 10 === 0) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      } catch (e: any) {
        console.log(`  ✗ エラー: ${row.source}/${row.product_id} - ${e.message}`);
        totalFailed++;
      }
    }

    offset += BATCH_SIZE;
  }

  console.log("\n=== 移行完了 ===");
  console.log(`成功: ${totalMigrated}`);
  console.log(`失敗: ${totalFailed}`);
  console.log(`移行サイズ: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  // 残りの件数を確認
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM raw_html_data
    WHERE html_content IS NOT NULL AND gcs_url IS NULL
  `);
  console.log(`\n残り: ${(remaining.rows[0] as any).count} 件`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
