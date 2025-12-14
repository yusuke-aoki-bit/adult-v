import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== 演者画像状況 詳細確認 ===\n');

  // performers.profile_image_url の状況
  const profileImages = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN profile_image_url IS NOT NULL THEN 1 END) as with_profile_image
    FROM performers
  `);
  console.log('📊 performers.profile_image_url');
  console.log('─'.repeat(50));
  const total = Number(profileImages.rows[0].total);
  const withProfile = Number(profileImages.rows[0].with_profile_image);
  console.log(`  総演者数: ${total}`);
  console.log(`  profile_image_url あり: ${withProfile} (${((withProfile / total) * 100).toFixed(1)}%)`);
  console.log(`  profile_image_url なし: ${total - withProfile}`);

  // performer_images テーブルの状況
  console.log('\n📊 performer_images テーブル');
  console.log('─'.repeat(50));

  const performerImagesCount = await db.execute(sql`SELECT COUNT(*) as count FROM performer_images`);
  console.log(`  総画像数: ${performerImagesCount.rows[0].count}`);

  const performersWithImages = await db.execute(sql`
    SELECT COUNT(DISTINCT performer_id) as count FROM performer_images
  `);
  console.log(`  画像がある演者数: ${performersWithImages.rows[0].count}`);

  // ソース別
  const imagesBySource = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM performer_images
    GROUP BY source
    ORDER BY count DESC
  `);
  if (imagesBySource.rows.length > 0) {
    console.log('\n  ソース別:');
    for (const r of imagesBySource.rows) {
      console.log(`    ${r.source || '(null)'}: ${r.count}`);
    }
  }

  // 画像タイプ別
  const imagesByType = await db.execute(sql`
    SELECT image_type, COUNT(*) as count
    FROM performer_images
    GROUP BY image_type
    ORDER BY count DESC
  `);
  if (imagesByType.rows.length > 0) {
    console.log('\n  画像タイプ別:');
    for (const r of imagesByType.rows) {
      console.log(`    ${r.image_type || '(null)'}: ${r.count}`);
    }
  }

  // Wiki データの画像状況
  console.log('\n📊 Wiki クロールデータの画像状況');
  console.log('─'.repeat(50));

  const wikiWithImages = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_image
    FROM wiki_crawl_data
  `);
  const wikiTotal = Number(wikiWithImages.rows[0].total);
  const wikiWithImg = Number(wikiWithImages.rows[0].with_image);
  console.log(`  wiki_crawl_data 総数: ${wikiTotal}`);
  console.log(`  画像URLあり: ${wikiWithImg} (${wikiTotal > 0 ? ((wikiWithImg / wikiTotal) * 100).toFixed(1) : 0}%)`);

  // Wikiから画像を取り込めていない演者の数
  console.log('\n📊 Wiki連携状況');
  console.log('─'.repeat(50));

  const wikiLinkedPerformers = await db.execute(sql`
    SELECT COUNT(DISTINCT performer_id) as count
    FROM performer_external_ids
  `);
  console.log(`  Wiki連携済み演者数: ${wikiLinkedPerformers.rows[0].count}`);

  // プロフィール画像があるがperformer_imagesにない演者
  const profileOnlyCount = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM performers p
    WHERE p.profile_image_url IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM performer_images pi WHERE pi.performer_id = p.id)
  `);
  console.log(`  profile_image_urlのみ（performer_imagesなし）: ${profileOnlyCount.rows[0].count}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
