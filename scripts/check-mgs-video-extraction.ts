import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function main() {
  console.log('=== MGS動画URL抽出テスト（更新版） ===\n');

  // raw_html_dataからMGSのHTMLを取得
  const mgsRawSamples = await db.execute(sql`
    SELECT product_id, html_content
    FROM raw_html_data
    WHERE source = 'MGS'
    AND html_content IS NOT NULL
    LIMIT 10
  `);

  console.log(`取得したサンプル数: ${mgsRawSamples.rows.length}`);

  let foundCount = 0;
  for (const row of mgsRawSamples.rows) {
    const productId = row.product_id as string;
    const htmlContent = row.html_content as string;

    if (!htmlContent) continue;

    const $ = cheerio.load(htmlContent);

    let sampleVideoUrl: string | undefined;

    // パターン1-4: 既存のパターン
    const videoSrc = $('video source').attr('src');
    if (videoSrc) {
      sampleVideoUrl = videoSrc.startsWith('http') ? videoSrc : `https://www.mgstage.com${videoSrc}`;
    }

    if (!sampleVideoUrl) {
      const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
      if (dataVideoUrl) {
        sampleVideoUrl = dataVideoUrl.startsWith('http') ? dataVideoUrl : `https://www.mgstage.com${dataVideoUrl}`;
      }
    }

    if (!sampleVideoUrl) {
      const sampleMovieLink = $('a[href*="sample_movie"]').attr('href');
      if (sampleMovieLink) {
        sampleVideoUrl = sampleMovieLink.startsWith('http') ? sampleMovieLink : `https://www.mgstage.com${sampleMovieLink}`;
      }
    }

    // パターン5: a.button_sample サンプルプレイヤーへのリンク（新規追加）
    if (!sampleVideoUrl) {
      const samplePlayerLink = $('a.button_sample[href*="sampleplayer"]').attr('href');
      if (samplePlayerLink) {
        sampleVideoUrl = samplePlayerLink.startsWith('http')
          ? samplePlayerLink
          : `https://www.mgstage.com${samplePlayerLink}`;
      }
    }

    // パターン6: p.sample_movie_btn 内のリンク（新規追加）
    if (!sampleVideoUrl) {
      const sampleMovieBtnLink = $('p.sample_movie_btn a[href*="sampleplayer"]').attr('href');
      if (sampleMovieBtnLink) {
        sampleVideoUrl = sampleMovieBtnLink.startsWith('http')
          ? sampleMovieBtnLink
          : `https://www.mgstage.com${sampleMovieBtnLink}`;
      }
    }

    if (sampleVideoUrl) {
      foundCount++;
      console.log(`✅ ${productId}: ${sampleVideoUrl}`);
    } else {
      console.log(`❌ ${productId}: not found`);
    }
  }

  console.log(`\n抽出成功: ${foundCount}/${mgsRawSamples.rows.length}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
