import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== minnano-av 重複データ確認 ===\n');

  // performersテーブルの総数
  const total = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers`);
  console.log('performers 総数:', (total.rows[0] as any).cnt);

  // 名前の重複確認
  const duplicateNames = await db.execute(sql`
    SELECT name, COUNT(*) as cnt
    FROM performers
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('\n=== 重複名前 TOP 20 ===');
  let duplicateCount = 0;
  for (const r of duplicateNames.rows as any[]) {
    console.log(`  ${r.name}: ${r.cnt}件`);
    duplicateCount += parseInt(r.cnt) - 1;
  }

  // 重複している名前の総数
  const totalDuplicates = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM (
      SELECT name FROM performers GROUP BY name HAVING COUNT(*) > 1
    ) sub
  `);
  console.log(`\n重複している名前の種類: ${(totalDuplicates.rows[0] as any).cnt}`);

  // ユニークな名前の数
  const uniqueNames = await db.execute(sql`
    SELECT COUNT(DISTINCT name) as cnt FROM performers
  `);
  console.log(`ユニークな名前の数: ${(uniqueNames.rows[0] as any).cnt}`);

  // minnano_av_idがあるか確認
  try {
    const withMinnanoId = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM performers WHERE minnano_av_id IS NOT NULL
    `);
    console.log(`\nminnano_av_id あり: ${(withMinnanoId.rows[0] as any).cnt}`);
  } catch (e) {
    console.log('\nminnano_av_id カラムなし');
  }

  // 詳細情報の充実度
  const withBirthday = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE birthday IS NOT NULL
  `);
  const withBust = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE bust IS NOT NULL
  `);
  const withImage = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE image_url IS NOT NULL
  `);
  const withHeight = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE height IS NOT NULL
  `);

  console.log('\n=== 詳細情報の充実度 ===');
  console.log(`  生年月日あり: ${(withBirthday.rows[0] as any).cnt}`);
  console.log(`  バストあり: ${(withBust.rows[0] as any).cnt}`);
  console.log(`  身長あり: ${(withHeight.rows[0] as any).cnt}`);
  console.log(`  画像あり: ${(withImage.rows[0] as any).cnt}`);

  // 最近更新されたperformer
  const recentUpdated = await db.execute(sql`
    SELECT name, updated_at, birthday, bust, image_url IS NOT NULL as has_image
    FROM performers
    WHERE updated_at IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  console.log('\n=== 最近更新されたperformer ===');
  for (const r of recentUpdated.rows as any[]) {
    console.log(`  ${r.name} (${r.updated_at}) - 誕生日:${r.birthday || 'なし'} バスト:${r.bust || 'なし'} 画像:${r.has_image}`);
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
