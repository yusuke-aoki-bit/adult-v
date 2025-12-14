import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  // performersテーブルの総数
  const total = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers`);
  console.log('=== performers テーブル ===');
  console.log('総数:', (total.rows[0] as any).cnt);

  // ソース別
  const sources = await db.execute(sql`
    SELECT source, COUNT(*) as cnt
    FROM performers
    WHERE source IS NOT NULL
    GROUP BY source
    ORDER BY cnt DESC
  `);
  console.log('\nソース別:');
  for (const r of sources.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  // minnano-avからの最近のデータ
  const recent = await db.execute(sql`
    SELECT name, source, created_at
    FROM performers
    WHERE source = 'minnano-av'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log('\n最近追加されたminnano-av performer:');
  for (const r of recent.rows as any[]) {
    console.log(`  ${r.name} (${r.created_at})`);
  }

  // 生年月日があるperformer数
  const withBirthday = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE birthday IS NOT NULL
  `);
  console.log('\n生年月日あり:', (withBirthday.rows[0] as any).cnt);

  // 3サイズがあるperformer数
  const with3sizes = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers
    WHERE bust IS NOT NULL OR waist IS NOT NULL OR hip IS NOT NULL
  `);
  console.log('3サイズあり:', (with3sizes.rows[0] as any).cnt);

  // 画像があるperformer数
  const withImage = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performers WHERE image_url IS NOT NULL
  `);
  console.log('画像あり:', (withImage.rows[0] as any).cnt);

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
