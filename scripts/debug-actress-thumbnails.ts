import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== 演者サムネイル取得デバッグ ===\n');

  // 1. 最初の10人の女優でサムネイル取得状況を確認
  const performers = await db.execute(sql`
    SELECT p.id, p.name, p.profile_image_url
    FROM performers p
    INNER JOIN product_performers pp ON p.id = pp.performer_id
    GROUP BY p.id, p.name, p.profile_image_url
    HAVING COUNT(pp.product_id) > 5
    ORDER BY COUNT(pp.product_id) DESC
    LIMIT 10
  `);

  console.log('サンプル女優:');
  for (const performer of performers.rows as any[]) {
    console.log(`ID: ${performer.id} | ${performer.name} | profile: ${performer.profile_image_url ? '有' : '無'}`);

    // この女優の商品サムネイル状況
    const thumbs = await db.execute(sql`
      SELECT
        prod.id,
        prod.default_thumbnail_url,
        ps.asp_name
      FROM product_performers pp
      INNER JOIN products prod ON pp.product_id = prod.id
      INNER JOIN product_sources ps ON prod.id = ps.product_id
      WHERE pp.performer_id = ${performer.id}
      ORDER BY CASE WHEN ps.asp_name != 'DTI' THEN 0 ELSE 1 END, prod.created_at DESC
      LIMIT 5
    `);

    for (const t of thumbs.rows as any[]) {
      const url = t.default_thumbnail_url;
      const status = url && url.trim() !== '' ? url.substring(0, 60) + '...' : 'NO IMAGE';
      console.log(`  - [${t.asp_name}] ${status}`);
    }
    console.log('');
  }

  // 2. NO IMAGEになっている演者がいるか確認
  const noImagePerformers = await db.execute(sql`
    SELECT p.id, p.name
    FROM performers p
    WHERE p.profile_image_url IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM product_performers pp
      INNER JOIN products prod ON pp.product_id = prod.id
      WHERE pp.performer_id = p.id
        AND prod.default_thumbnail_url IS NOT NULL
        AND prod.default_thumbnail_url != ''
    )
    AND EXISTS (
      SELECT 1 FROM product_performers pp2 WHERE pp2.performer_id = p.id
    )
    LIMIT 10
  `);

  console.log('=== 画像なし女優 (profile_image_url無し + 商品サムネイル無し) ===');
  console.log(`${noImagePerformers.rows.length}人見つかりました`);
  for (const p of noImagePerformers.rows as any[]) {
    console.log(`ID: ${p.id} | ${p.name}`);
  }
}

check().catch(console.error);
