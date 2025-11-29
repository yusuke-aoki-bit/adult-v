/**
 * 既存商品のサンプル動画をバックフィルするスクリプト
 *
 * 各ASPごとにサンプル動画URLを生成/取得して product_videos テーブルに保存
 *
 * 使い方:
 * DATABASE_URL="..." npx tsx scripts/backfill-sample-videos.ts [--asp b10f|duga|sokmil|dti|mgs|japanska|fc2] [--limit 100]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

interface BackfillStats {
  processed: number;
  videosAdded: number;
  skipped: number;
  errors: number;
}

/**
 * b10f: 画像URLからサンプル動画URLを生成
 * パターン: /images/{id}/s.mp4
 */
async function backfillB10f(limit: number): Promise<BackfillStats> {
  console.log('\n=== b10f サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // b10f商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, p.default_thumbnail_url, ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'b10f'
      AND p.default_thumbnail_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'b10f'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const thumbnailUrl = row.default_thumbnail_url as string;
      if (!thumbnailUrl) {
        stats.skipped++;
        continue;
      }

      // /1s.jpg を /s.mp4 に変換
      const baseImageUrl = thumbnailUrl.replace(/\/1s\.jpg$/, '');
      const sampleVideoUrl = `${baseImageUrl}/s.mp4`;

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'b10f', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[b10f] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[b10f] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * DUGA: 生データ (duga_raw_responses) からサンプル動画URLを取得
 */
async function backfillDuga(limit: number): Promise<BackfillStats> {
  console.log('\n=== DUGA サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // DUGA商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, drr.raw_json
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN duga_raw_responses drr ON ps.original_product_id = drr.product_id
    WHERE ps.asp_name = 'DUGA'
      AND drr.raw_json IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'DUGA'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const rawJson = row.raw_json;
      if (!rawJson) {
        stats.skipped++;
        continue;
      }

      const sampleVideos = rawJson.sampleVideos || rawJson.sample_videos || [];

      if (sampleVideos.length === 0) {
        stats.skipped++;
        continue;
      }

      for (let i = 0; i < sampleVideos.length; i++) {
        const videoUrl = sampleVideos[i];
        await db.execute(sql`
          INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
          VALUES (${row.id}, 'DUGA', ${videoUrl}, 'sample', ${i})
          ON CONFLICT DO NOTHING
        `);
        stats.videosAdded++;
      }

      if (stats.processed % 100 === 0) {
        console.log(`[DUGA] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[DUGA] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * ソクミル: 生データ (sokmil_raw_responses) からサンプル動画URLを取得
 */
async function backfillSokmil(limit: number): Promise<BackfillStats> {
  console.log('\n=== ソクミル サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // ソクミル商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, srr.raw_json
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN sokmil_raw_responses srr ON ps.original_product_id = srr.item_id
    WHERE ps.asp_name = 'ソクミル'
      AND srr.raw_json IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'ソクミル'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const rawJson = row.raw_json;
      if (!rawJson) {
        stats.skipped++;
        continue;
      }

      // sampleVideoUrl または sample_video_url を確認
      const sampleVideoUrl = rawJson.sampleVideoUrl || rawJson.sample_video_url;

      if (!sampleVideoUrl) {
        stats.skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'ソクミル', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[ソクミル] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[ソクミル] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * DTI (1pondo/Caribbeancom等): 生HTMLデータからサンプル動画URLを抽出
 */
async function backfillDti(limit: number): Promise<BackfillStats> {
  console.log('\n=== DTI サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // DTI商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, rhd.html_content, rhd.source
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id
      AND rhd.source IN ('1pondo', 'Caribbeancom', 'Pacopacomama', '10musume', 'muramura')
    WHERE ps.asp_name = 'DTI'
      AND rhd.html_content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'DTI'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const html = row.html_content as string;
      if (!html) {
        stats.skipped++;
        continue;
      }

      // サンプル動画URLパターン
      const videoPatterns = [
        /data-video-url="([^"]+\.mp4)"/i,
        /<source[^>]*src="([^"]+\.mp4)"/i,
        /sample[_-]?video[_-]?url["']?\s*[=:]\s*["']([^"']+\.mp4)/i,
        /https?:\/\/[^\s"']+sample[^\s"']*\.mp4/gi,
      ];

      let sampleVideoUrl: string | null = null;

      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match) {
          sampleVideoUrl = match[1] || match[0];
          break;
        }
      }

      if (!sampleVideoUrl) {
        stats.skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'DTI', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[DTI] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[DTI] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * MGS: 生HTMLデータからサンプル動画URLを抽出
 */
async function backfillMgs(limit: number): Promise<BackfillStats> {
  console.log('\n=== MGS サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // MGS商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, rhd.html_content
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id
      AND rhd.source = 'MGS'
    WHERE ps.asp_name = 'MGS'
      AND rhd.html_content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'MGS'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const html = row.html_content as string;
      if (!html) {
        stats.skipped++;
        continue;
      }

      // MGSサンプル動画パターン
      const videoPatterns = [
        /sample_video_url\s*[=:]\s*["']([^"']+)/i,
        /<source[^>]*src="([^"]+sample[^"]*\.mp4)"/i,
        /data-src="([^"]+sample[^"]*\.mp4)"/i,
        /https?:\/\/[^\s"'<>]+sample[^\s"'<>]*\.mp4/gi,
      ];

      let sampleVideoUrl: string | null = null;

      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match) {
          sampleVideoUrl = match[1] || match[0];
          break;
        }
      }

      if (!sampleVideoUrl) {
        stats.skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'MGS', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[MGS] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[MGS] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * Japanska: 生HTMLデータからサンプル動画URLを抽出
 */
async function backfillJapanska(limit: number): Promise<BackfillStats> {
  console.log('\n=== Japanska サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // Japanska商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, rhd.html_content
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id
      AND rhd.source = 'Japanska'
    WHERE ps.asp_name = 'Japanska'
      AND rhd.html_content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'Japanska'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const html = row.html_content as string;
      if (!html) {
        stats.skipped++;
        continue;
      }

      // Japanskaサンプル動画パターン
      const videoPatterns = [
        /<source[^>]*src="([^"]+\.mp4)"/i,
        /(?:video|movie)\/[^"']+\.mp4/i,
        /(?:video_?url|sample_?url)\s*[=:]\s*["']([^"']+\.mp4)["']/i,
      ];

      let sampleVideoUrl: string | null = null;

      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match) {
          const url = match[1] || match[0];
          sampleVideoUrl = url.startsWith('http')
            ? url
            : `https://www.japanska-xxx.com/${url}`;
          break;
        }
      }

      if (!sampleVideoUrl) {
        stats.skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'Japanska', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[Japanska] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[Japanska] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

/**
 * FC2: 生HTMLデータからサンプル動画URLを抽出
 */
async function backfillFc2(limit: number): Promise<BackfillStats> {
  console.log('\n=== FC2 サンプル動画バックフィル ===\n');

  const stats: BackfillStats = { processed: 0, videosAdded: 0, skipped: 0, errors: 0 };

  // FC2商品で動画がまだないものを取得
  const products = await db.execute(sql`
    SELECT p.id, ps.original_product_id, rhd.html_content
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN raw_html_data rhd ON ps.original_product_id = rhd.product_id
      AND rhd.source = 'FC2'
    WHERE ps.asp_name = 'FC2'
      AND rhd.html_content IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_videos pv
        WHERE pv.product_id = p.id AND pv.asp_name = 'FC2'
      )
    LIMIT ${limit}
  `);

  console.log(`対象商品数: ${products.rows.length}\n`);

  for (const row of products.rows as any[]) {
    stats.processed++;

    try {
      const html = row.html_content as string;
      if (!html) {
        stats.skipped++;
        continue;
      }

      // FC2サンプル動画パターン
      const videoPatterns = [
        /<source[^>]*src="([^"]+\.mp4)"/i,
        /data-video="([^"]+\.mp4)"/i,
        /sample[_-]?video[^"']*["']([^"']+\.mp4)/i,
        /https?:\/\/[^\s"'<>]+\.mp4/gi,
      ];

      let sampleVideoUrl: string | null = null;

      for (const pattern of videoPatterns) {
        const match = html.match(pattern);
        if (match) {
          sampleVideoUrl = match[1] || match[0];
          break;
        }
      }

      if (!sampleVideoUrl) {
        stats.skipped++;
        continue;
      }

      await db.execute(sql`
        INSERT INTO product_videos (product_id, asp_name, video_url, video_type, display_order)
        VALUES (${row.id}, 'FC2', ${sampleVideoUrl}, 'sample', 0)
        ON CONFLICT DO NOTHING
      `);

      stats.videosAdded++;

      if (stats.processed % 100 === 0) {
        console.log(`[FC2] 進捗: ${stats.processed}/${products.rows.length}`);
      }
    } catch (error: any) {
      stats.errors++;
      console.error(`[FC2] エラー (product_id: ${row.id}): ${error.message}`);
    }
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);

  // 引数パース
  let targetAsp: string | null = null;
  let limit = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--asp' && args[i + 1]) {
      targetAsp = args[i + 1].toLowerCase();
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
  }

  console.log('=== サンプル動画バックフィル ===\n');
  console.log(`設定: targetAsp=${targetAsp || 'ALL'}, limit=${limit}\n`);

  const allStats: { [key: string]: BackfillStats } = {};

  // 各ASPのバックフィル実行
  if (!targetAsp || targetAsp === 'b10f') {
    allStats['b10f'] = await backfillB10f(limit);
  }

  if (!targetAsp || targetAsp === 'duga') {
    allStats['DUGA'] = await backfillDuga(limit);
  }

  if (!targetAsp || targetAsp === 'sokmil') {
    allStats['ソクミル'] = await backfillSokmil(limit);
  }

  if (!targetAsp || targetAsp === 'dti') {
    allStats['DTI'] = await backfillDti(limit);
  }

  if (!targetAsp || targetAsp === 'mgs') {
    allStats['MGS'] = await backfillMgs(limit);
  }

  if (!targetAsp || targetAsp === 'japanska') {
    allStats['Japanska'] = await backfillJapanska(limit);
  }

  if (!targetAsp || targetAsp === 'fc2') {
    allStats['FC2'] = await backfillFc2(limit);
  }

  // 結果サマリー
  console.log('\n\n=== バックフィル完了 ===\n');
  console.table(allStats);

  // 最終統計
  const finalStats = await db.execute(sql`
    SELECT asp_name, COUNT(*) as count
    FROM product_videos
    GROUP BY asp_name
    ORDER BY count DESC
  `);

  console.log('\n📊 product_videos テーブル（ASP別）:');
  console.table(finalStats.rows);

  const totalCount = await db.execute(sql`
    SELECT COUNT(*) as total FROM product_videos
  `);
  console.log(`\n総動画レコード数: ${totalCount.rows[0].total}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
