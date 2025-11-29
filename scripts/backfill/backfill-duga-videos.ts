/**
 * DUGA商品のサンプル動画URLをバックフィルするスクリプト
 *
 * raw_html_dataからサンプル動画URLを抽出して保存
 */

import * as cheerio from 'cheerio';
import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const SOURCE_NAME = 'DUGA';

async function main() {
  const db = getDb();
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : 5000;

  console.log('=== DUGA サンプル動画バックフィル ===\n');
  console.log(`Limit: ${limit}\n`);

  // DUGA商品で動画がまだないものを取得（raw_html_dataがあるもの）
  const products = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.original_product_id,
      rhd.html_content
    FROM product_sources ps
    INNER JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id AND rhd.source = 'DUGA'
    WHERE ps.asp_name = 'DUGA'
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = ps.product_id AND pv.asp_name = 'DUGA'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of products.rows as any[]) {
    const productId = row.product_id;
    const originalId = row.original_product_id;
    const htmlContent = row.html_content;

    if (!htmlContent) {
      skipped++;
      continue;
    }

    try {
      const $ = cheerio.load(htmlContent);
      const sampleVideos: string[] = [];

      // パターン1: video要素のsrc
      $('video source, video').each((_, elem) => {
        const src = $(elem).attr('src');
        if (src && src.includes('.mp4')) {
          const fullUrl = src.startsWith('http') ? src : `https://duga.jp${src}`;
          if (!sampleVideos.includes(fullUrl)) {
            sampleVideos.push(fullUrl);
          }
        }
      });

      // パターン2: data-sample-video属性
      $('[data-sample-video], [data-video-src], [data-movie]').each((_, elem) => {
        const videoUrl = $(elem).attr('data-sample-video') ||
                        $(elem).attr('data-video-src') ||
                        $(elem).attr('data-movie');
        if (videoUrl && videoUrl.includes('.mp4')) {
          const fullUrl = videoUrl.startsWith('http') ? videoUrl : `https://duga.jp${videoUrl}`;
          if (!sampleVideos.includes(fullUrl)) {
            sampleVideos.push(fullUrl);
          }
        }
      });

      // パターン3: JavaScriptからの動画URL抽出
      const htmlText = $.html();
      const mp4Matches = htmlText.match(/(https?:\/\/[^"'\s]+\.mp4)/gi);
      if (mp4Matches) {
        for (const url of mp4Matches) {
          if (!sampleVideos.includes(url) && url.includes('duga')) {
            sampleVideos.push(url);
          }
        }
      }

      // パターン4: サンプル動画のリンク
      $('a[href*="sample"], a[href*="movie"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href && href.includes('.mp4')) {
          const fullUrl = href.startsWith('http') ? href : `https://duga.jp${href}`;
          if (!sampleVideos.includes(fullUrl)) {
            sampleVideos.push(fullUrl);
          }
        }
      });

      // パターン5: DUGAの既知のサンプル動画URLパターン生成
      // DUGA: https://sample.duga.jp/ppv/{productId}/{productId}_sm_w.mp4
      // または: https://sample.duga.jp/ppv/{productId}/sample.mp4
      if (sampleVideos.length === 0) {
        // 推測によるURL生成
        const guessedUrls = [
          `https://sample.duga.jp/ppv/${originalId}/${originalId}_sm_w.mp4`,
          `https://sample.duga.jp/ppv/${originalId}/sample.mp4`,
        ];
        // これらは後で検証が必要なので、一旦スキップ
      }

      if (sampleVideos.length > 0) {
        for (let i = 0; i < sampleVideos.length; i++) {
          const videoUrl = sampleVideos[i];
          await db.execute(sql`
            INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
            VALUES (${productId}, ${SOURCE_NAME}, ${videoUrl}, 'sample', ${i})
            ON CONFLICT DO NOTHING
          `);
        }
        added++;

        if (added % 100 === 0) {
          console.log(`進捗: ${added}件追加`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`エラー (product_id: ${productId}):`, error);
      errors++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`追加: ${added}件`);
  console.log(`スキップ: ${skipped}件`);
  console.log(`エラー: ${errors}件`);

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
