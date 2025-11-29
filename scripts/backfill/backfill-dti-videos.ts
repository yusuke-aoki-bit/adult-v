/**
 * DTI商品のサンプル動画URLをバックフィルするスクリプト
 *
 * original_product_idからサンプル動画URLパターンを生成
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== DTI サンプル動画バックフィル ===\n');

  // DTI商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT ps.product_id, ps.original_product_id, rhd.source
    FROM product_sources ps
    LEFT JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id
    WHERE ps.asp_name = 'DTI'
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = ps.product_id AND pv.asp_name = 'DTI'
      )
    LIMIT 5000
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  let added = 0;
  let skipped = 0;

  for (const row of products.rows as any[]) {
    const productId = row.product_id;
    const originalId = row.original_product_id;
    const source = row.source || '';

    let sampleVideoUrl: string | null = null;

    // ソースに応じてサンプル動画URLを生成
    if (source.includes('1pondo') || originalId.match(/^\d{6}_\d{3}$/)) {
      // 一本道: YYMMDD_XXX 形式
      sampleVideoUrl = `https://smovie.1pondo.tv/sample/movies/${originalId}/1080p.mp4`;
    } else if (source.includes('Caribbeancom') || source.includes('caribbean')) {
      // カリビアンコム
      sampleVideoUrl = `https://www.caribbeancom.com/moviepages/${originalId}/sample/sample.mp4`;
    } else if (source.includes('10musume')) {
      // 天然むすめ
      sampleVideoUrl = `https://www.10musume.com/moviepages/${originalId}/sample/sample.mp4`;
    } else if (source.includes('Pacopacomama')) {
      // パコパコママ
      sampleVideoUrl = `https://www.pacopacomama.com/moviepages/${originalId}/sample/sample.mp4`;
    } else if (source.includes('muramura')) {
      // むらむら
      sampleVideoUrl = `https://www.muramura.tv/moviepages/${originalId}/sample/sample.mp4`;
    } else if (originalId.match(/^\d{6}_\d{3}$/)) {
      // デフォルト: 一本道形式のIDなら一本道と推測
      sampleVideoUrl = `https://smovie.1pondo.tv/sample/movies/${originalId}/1080p.mp4`;
    }

    if (sampleVideoUrl) {
      try {
        await db.execute(sql`
          INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
          VALUES (${productId}, 'DTI', ${sampleVideoUrl}, 'sample', 0)
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
