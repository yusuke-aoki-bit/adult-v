/**
 * サンプル動画抽出スクリプト
 *
 * raw_html_data / mgs_raw_pages からサンプル動画URLを抽出し、
 * product_videos テーブルに保存する
 *
 * 使い方:
 * npx tsx packages/crawlers/src/enrichment/extract-sample-videos.ts [--limit 1000] [--source fanza|mgs|all] [--dry-run]
 */

import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { getDb } from '../lib/db';

// CLI引数パーサー
function parseArgs(): { limit: number; source: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let limit = 10000;
  let source = 'all';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    if (arg === '--limit' && nextArg) {
      limit = parseInt(nextArg, 10);
      i++;
    } else if (arg?.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '10000', 10);
    } else if (arg === '--source' && nextArg) {
      source = nextArg;
      i++;
    } else if (arg?.startsWith('--source=')) {
      source = arg.split('=')[1] ?? 'all';
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { limit, source, dryRun };
}

interface ExtractedVideo {
  productId: number;
  aspName: string;
  videoUrl: string;
  videoType: string;
}

// FANZA用の動画URL抽出
function extractFanzaVideos(html: string): string[] {
  const videos: string[] = [];
  const videoUrlSet = new Set<string>();

  // パターン1: litevideo MP4
  const liteVideoMatches = html.matchAll(/src="(https:\/\/[^"]*litevideo[^"]*\.mp4[^"]*)"/gi);
  for (const match of liteVideoMatches) {
    const url = match[1]?.split('?')[0] ?? '';
    if (url && !videoUrlSet.has(url)) {
      videoUrlSet.add(url);
      videos.push(url);
    }
  }

  // パターン2: data-src属性のサンプル動画
  const dataSrcMatches = html.matchAll(/data-src="(https:\/\/[^"]*(?:sample|preview)[^"]*\.mp4[^"]*)"/gi);
  for (const match of dataSrcMatches) {
    const url = match[1]?.split('?')[0] ?? '';
    if (url && !videoUrlSet.has(url)) {
      videoUrlSet.add(url);
      videos.push(url);
    }
  }

  // パターン3: cc3001.dmm.co.jp からのサンプル動画
  const cc3001Matches = html.matchAll(/["'](https:\/\/cc3001\.dmm\.co\.jp\/[^"']*\.mp4[^"']*)["']/gi);
  for (const match of cc3001Matches) {
    const url = match[1]?.split('?')[0] ?? '';
    if (url && !videoUrlSet.has(url)) {
      videoUrlSet.add(url);
      videos.push(url);
    }
  }

  // パターン4: sample.mp4 や _sm_w.mp4 などのパターン
  const sampleMp4Matches = html.matchAll(/["'](https:\/\/[^"']*(?:_sm_|sample|_sample_)[^"']*\.mp4[^"']*)["']/gi);
  for (const match of sampleMp4Matches) {
    const url = match[1]?.split('?')[0] ?? '';
    if (url && !videoUrlSet.has(url)) {
      videoUrlSet.add(url);
      videos.push(url);
    }
  }

  return videos;
}

// MGS用の動画URL抽出
function extractMgsVideos(html: string): string[] {
  const videos: string[] = [];
  const $ = cheerio.load(html);

  // パターン1: video source タグから
  const videoSrc = $('video source').attr('src');
  if (videoSrc) {
    const url = videoSrc.startsWith('http') ? videoSrc : `https://www.mgstage.com${videoSrc}`;
    videos.push(url);
  }

  // パターン2: data-video-url 属性
  if (videos.length === 0) {
    const dataVideoUrl = $('[data-video-url]').attr('data-video-url');
    if (dataVideoUrl) {
      const url = dataVideoUrl.startsWith('http') ? dataVideoUrl : `https://www.mgstage.com${dataVideoUrl}`;
      videos.push(url);
    }
  }

  // パターン3: sample_movie リンク
  if (videos.length === 0) {
    const sampleMovieLink = $('a[href*="sample_movie"]').attr('href');
    if (sampleMovieLink) {
      const url = sampleMovieLink.startsWith('http') ? sampleMovieLink : `https://www.mgstage.com${sampleMovieLink}`;
      videos.push(url);
    }
  }

  // パターン4: JavaScriptから sample_url を抽出
  if (videos.length === 0) {
    const scriptContent = $('script:contains("sample_url")').html();
    if (scriptContent) {
      const sampleUrlMatch = scriptContent.match(/sample_url['":\s]+['"]([^'"]+)['"]/);
      if (sampleUrlMatch && sampleUrlMatch[1]) {
        const url = sampleUrlMatch[1].startsWith('http')
          ? sampleUrlMatch[1]
          : `https://www.mgstage.com${sampleUrlMatch[1]}`;
        videos.push(url);
      }
    }
  }

  return videos;
}

async function main() {
  const { limit, source, dryRun } = parseArgs();

  console.log('=== サンプル動画抽出スクリプト ===');
  console.log(`ソース: ${source}`);
  console.log(`リミット: ${limit}`);
  console.log(`ドライラン: ${dryRun}`);
  console.log('');

  const db = getDb();

  let totalExtracted = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  // FANZA (raw_html_data) から抽出
  if (source === 'all' || source === 'fanza') {
    console.log('--- FANZA (raw_html_data) 処理中 ---');

    // product_videosに登録済みのproduct_idを取得
    const existingFanzaResult = await db.execute(sql`
      SELECT DISTINCT product_id FROM product_videos WHERE asp_name = 'FANZA'
    `);
    const existingFanzaIds = new Set((existingFanzaResult.rows as { product_id: number }[]).map((r) => r.product_id));
    console.log(`既存の動画データ: ${existingFanzaIds.size}件`);

    // raw_html_dataから未処理のデータを取得
    const fanzaResult = await db.execute(sql`
      SELECT
        r.id,
        r.product_id as original_id,
        r.html_content,
        p.id as db_product_id
      FROM raw_html_data r
      JOIN products p ON p.normalized_product_id = CONCAT('fanza-', r.product_id)
      WHERE r.source = 'FANZA'
      AND r.html_content IS NOT NULL
      AND p.id NOT IN (SELECT DISTINCT product_id FROM product_videos WHERE asp_name = 'FANZA')
      ORDER BY r.id DESC
      LIMIT ${limit}
    `);

    console.log(`処理対象: ${fanzaResult.rows?.length || 0}件`);

    for (const row of (fanzaResult.rows || []) as any[]) {
      const html = row.html_content;
      if (!html) continue;

      const videos = extractFanzaVideos(html);
      if (videos.length > 0) {
        totalExtracted += videos.length;

        if (!dryRun) {
          for (let i = 0; i < videos.length; i++) {
            await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${row.db_product_id}, 'FANZA', ${videos[i]}, 'sample', ${i})
              ON CONFLICT DO NOTHING
            `);
            totalSaved++;
          }
        }
        console.log(`  [FANZA] product_id=${row.db_product_id}: ${videos.length}件の動画抽出`);
      } else {
        totalSkipped++;
      }
    }
  }

  // MGS (mgs_raw_pages) から抽出
  if (source === 'all' || source === 'mgs') {
    console.log('--- MGS (mgs_raw_pages) 処理中 ---');

    // product_videosに登録済みのproduct_idを取得
    const existingMgsResult = await db.execute(sql`
      SELECT DISTINCT product_id FROM product_videos WHERE asp_name = 'MGS'
    `);
    const existingMgsIds = new Set((existingMgsResult.rows as { product_id: number }[]).map((r) => r.product_id));
    console.log(`既存の動画データ: ${existingMgsIds.size}件`);

    // mgs_raw_pagesから未処理のデータを取得
    const mgsResult = await db.execute(sql`
      SELECT
        r.id,
        r.product_id as original_id,
        r.raw_html as html_content,
        p.id as db_product_id
      FROM mgs_raw_pages r
      JOIN products p ON p.normalized_product_id = CONCAT('mgs-', r.product_id)
      WHERE r.raw_html IS NOT NULL
      AND p.id NOT IN (SELECT DISTINCT product_id FROM product_videos WHERE asp_name = 'MGS')
      ORDER BY r.id DESC
      LIMIT ${limit}
    `);

    console.log(`処理対象: ${mgsResult.rows?.length || 0}件`);

    for (const row of (mgsResult.rows || []) as any[]) {
      const html = row.html_content;
      if (!html) continue;

      const videos = extractMgsVideos(html);
      if (videos.length > 0) {
        totalExtracted += videos.length;

        if (!dryRun) {
          for (let i = 0; i < videos.length; i++) {
            await db.execute(sql`
              INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
              VALUES (${row.db_product_id}, 'MGS', ${videos[i]}, 'sample', ${i})
              ON CONFLICT DO NOTHING
            `);
            totalSaved++;
          }
        }
        console.log(`  [MGS] product_id=${row.db_product_id}: ${videos.length}件の動画抽出`);
      } else {
        totalSkipped++;
      }
    }
  }

  console.log('');
  console.log('=== 完了 ===');
  console.log(`抽出した動画URL: ${totalExtracted}件`);
  console.log(`保存した動画: ${totalSaved}件`);
  console.log(`動画なしでスキップ: ${totalSkipped}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
