/**
 * MGS商品のサンプル動画URLをバックフィルするスクリプト
 *
 * MGSの動画URLパターン: https://sample.mgstage.com/sample/{category}/{id}/{id}_sample.mp4
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== MGS サンプル動画バックフィル ===\n');

  // MGS商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT ps.product_id, ps.original_product_id, p.normalized_product_id
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    WHERE ps.asp_name = 'MGS'
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = ps.product_id AND pv.asp_name = 'MGS'
      )
    LIMIT 5000
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  let added = 0;
  let skipped = 0;

  for (const row of products.rows as any[]) {
    const productId = row.product_id;
    const originalId = row.original_product_id;

    // MGSのproduct_idからカテゴリを推測
    // 例: 300MAAN-001, ABW-001, STARS-001 など
    let sampleVideoUrl: string | null = null;

    // MGSのサンプル動画URLパターン
    // https://sample.mgstage.com/sample/amateur/300mium/300mium-946/300mium-946_sample.mp4
    if (originalId) {
      // 一般的なMGSパターン
      const idLower = originalId.toLowerCase();
      const parts = originalId.split('-');

      if (parts.length >= 2) {
        const prefix = parts[0].toLowerCase();
        // カテゴリを推測（簡易版）
        let category = 'amateur';
        if (/^(abw|stars|sdjs|sdab)$/i.test(prefix)) {
          category = 'sod';
        } else if (/^(300maan|300mium|259luxu)$/i.test(prefix)) {
          category = 'amateur';
        } else if (/^(ipx|ipz|idea)$/i.test(prefix)) {
          category = 'ideapocket';
        }

        sampleVideoUrl = `https://sample.mgstage.com/sample/${category}/${prefix}/${idLower}/${idLower}_sample.mp4`;
      }
    }

    if (sampleVideoUrl) {
      try {
        await db.execute(sql`
          INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
          VALUES (${productId}, 'MGS', ${sampleVideoUrl}, 'sample', 0)
          ON CONFLICT DO NOTHING
        `);
        added++;

        if (added % 500 === 0) {
          console.log(`進捗: ${added}件追加`);
        }
      } catch (error) {
        console.error(`エラー (product_id: ${productId}):`, error);
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`追加: ${added}件`);
  console.log(`スキップ: ${skipped}件`);

  // 確認
  const videoCount = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count FROM product_videos GROUP BY asp_name ORDER BY count DESC
  `);
  console.log('\n📊 product_videos テーブル（ASP別）:');
  console.table(videoCount.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
