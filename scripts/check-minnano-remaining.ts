import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== minnano-av 残件確認 ===\n');

  // performersテーブルの総数
  const total = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers`);
  console.log('performers 総数:', (total.rows[0] as any).cnt);

  // 詳細情報が未取得のperformer数（生年月日、身長、バストいずれもなし）
  const withoutDetails = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers
    WHERE birthday IS NULL AND height IS NULL AND bust IS NULL
  `);
  console.log('詳細情報なし:', (withoutDetails.rows[0] as any).cnt);

  // 詳細情報があるperformer数
  const withDetails = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers
    WHERE birthday IS NOT NULL OR height IS NOT NULL OR bust IS NOT NULL
  `);
  console.log('詳細情報あり:', (withDetails.rows[0] as any).cnt);

  // profile_image_urlカラムがあるか確認
  try {
    const withProfileImage = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM performers WHERE profile_image_url IS NOT NULL
    `);
    console.log('profile_image_url あり:', (withProfileImage.rows[0] as any).cnt);
  } catch (e) {
    console.log('profile_image_url カラムなし');
  }

  // カラム構造を確認
  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'performers'
    ORDER BY ordinal_position
  `);
  console.log('\n=== performers カラム構造 ===');
  for (const r of columns.rows as any[]) {
    console.log(`  ${r.column_name}: ${r.data_type}`);
  }

  // 詳細情報あり/なしの割合を計算
  const totalCount = parseInt((total.rows[0] as any).cnt);
  const withDetailsCount = parseInt((withDetails.rows[0] as any).cnt);
  const withoutDetailsCount = parseInt((withoutDetails.rows[0] as any).cnt);

  console.log('\n=== サマリー ===');
  console.log(`詳細情報取得済み: ${withDetailsCount} (${(withDetailsCount / totalCount * 100).toFixed(1)}%)`);
  console.log(`詳細情報未取得: ${withoutDetailsCount} (${(withoutDetailsCount / totalCount * 100).toFixed(1)}%)`);

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
