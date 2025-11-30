/**
 * YouTube Data APIを使って商品に関連する動画を検索・リンクするスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/backfill/link-youtube-videos.ts --limit=100
 *   npx tsx scripts/backfill/link-youtube-videos.ts --dry-run
 *
 * 前提条件:
 *   - GOOGLE_API_KEY が .env.local に設定されていること
 *
 * 機能:
 *   - 演者名でYouTube動画を検索
 *   - 関連するインタビュー、グラビア動画を発見
 *   - 演者のソーシャルメディア情報を補完
 */

import { getDb } from '../../lib/db';
import { performers } from '../../lib/db/schema';
import { sql, eq, isNull, and } from 'drizzle-orm';
import { searchYouTubeVideos, getYouTubeVideoDetails, checkGoogleApiConfig, YouTubeVideo } from '../../lib/google-apis';

const db = getDb();

interface PerformerWithYouTube {
  id: number;
  name: string;
  youtubeChannelId?: string;
  youtubeVideos?: YouTubeVideo[];
}

/**
 * 演者名に基づいてYouTube動画を検索
 */
async function searchPerformerVideos(performerName: string): Promise<YouTubeVideo[]> {
  // 検索クエリを複数パターンで試行
  const queries = [
    `${performerName} グラビア`,
    `${performerName} インタビュー`,
    `${performerName} 公式`,
  ];

  const allVideos: YouTubeVideo[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    const videos = await searchYouTubeVideos(query, 5);

    for (const video of videos) {
      if (!seenIds.has(video.id)) {
        seenIds.add(video.id);
        allVideos.push(video);
      }
    }

    // API制限対策
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return allVideos;
}

/**
 * 動画が関連性が高いかチェック
 */
function isRelevantVideo(video: YouTubeVideo, performerName: string): boolean {
  const titleLower = video.title.toLowerCase();
  const descLower = (video.description || '').toLowerCase();
  const nameLower = performerName.toLowerCase();

  // タイトルか説明に演者名が含まれている
  if (titleLower.includes(nameLower) || descLower.includes(nameLower)) {
    return true;
  }

  // 公式チャンネルっぽい
  if (video.channelTitle.includes(performerName)) {
    return true;
  }

  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '50');
  const dryRun = args.includes('--dry-run');
  const offset = parseInt(args.find((a) => a.startsWith('--offset='))?.split('=')[1] || '0');

  console.log('=== YouTube Data APIを使った関連動画検索 ===\n');
  console.log(`設定: limit=${limit}, offset=${offset}, dryRun=${dryRun}\n`);

  // API設定を確認
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.youtube) {
    console.error('\n❌ YouTube Data APIが設定されていません');
    console.error('   .env.localに GOOGLE_API_KEY を設定してください');
    process.exit(1);
  }

  console.log('✅ YouTube Data API: 設定済み\n');

  // 商品紐付きのある人気演者を取得
  const targetPerformers = await db.execute(sql`
    SELECT p.id, p.name, COUNT(pp.product_id) as product_count
    FROM performers p
    JOIN product_performers pp ON p.id = pp.performer_id
    WHERE p.name IS NOT NULL
      AND LENGTH(p.name) >= 2
    GROUP BY p.id, p.name
    HAVING COUNT(pp.product_id) >= 5
    ORDER BY COUNT(pp.product_id) DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `);

  console.log(`📋 対象演者: ${targetPerformers.rows.length}人\n`);

  if (targetPerformers.rows.length === 0) {
    console.log('✅ 処理対象の演者がいません');
    process.exit(0);
  }

  // 統計
  let processed = 0;
  let videosFound = 0;
  let relevantVideos = 0;
  let failed = 0;

  // 結果を蓄積
  const results: PerformerWithYouTube[] = [];

  for (const row of targetPerformers.rows) {
    const performer = row as { id: number; name: string; product_count: number };
    processed++;

    console.log(`[${processed}/${targetPerformers.rows.length}] ${performer.name} (作品数: ${performer.product_count})`);

    try {
      // YouTube動画を検索
      const videos = await searchPerformerVideos(performer.name);

      if (videos.length === 0) {
        console.log(`  ⏭️ 動画が見つかりませんでした`);
        continue;
      }

      videosFound += videos.length;
      console.log(`  🎬 発見: ${videos.length}件`);

      // 関連性の高い動画をフィルタ
      const relevant = videos.filter((v) => isRelevantVideo(v, performer.name));
      relevantVideos += relevant.length;

      if (relevant.length > 0) {
        console.log(`  ✅ 関連動画: ${relevant.length}件`);
        for (const video of relevant.slice(0, 3)) {
          console.log(`    - ${video.title.substring(0, 50)}...`);
          console.log(`      https://www.youtube.com/watch?v=${video.id}`);
        }

        results.push({
          id: performer.id,
          name: performer.name,
          youtubeVideos: relevant,
        });
      }
    } catch (error) {
      failed++;
      console.error(`  ❌ エラー:`, error);
    }

    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み演者: ${processed}人`);
  console.log(`発見した動画: ${videosFound}件`);
  console.log(`関連動画: ${relevantVideos}件`);
  console.log(`エラー: ${failed}件`);

  // 関連動画が見つかった演者のサマリー
  if (results.length > 0) {
    console.log('\n=== 関連動画が見つかった演者 ===');
    for (const result of results.slice(0, 20)) {
      console.log(`${result.name}: ${result.youtubeVideos?.length || 0}件`);
    }
  }

  if (dryRun) {
    console.log('\n⚠️ dry-runモードのため、実際の変更は行われていません');
  }

  process.exit(0);
}

main().catch(console.error);
