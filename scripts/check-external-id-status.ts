import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  // external_idがあって詳細情報がないperformer
  const withExternalId = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM performers p
    JOIN performer_external_ids pei ON p.id = pei.performer_id AND pei.provider = 'minnano-av'
    WHERE p.birthday IS NULL AND p.height IS NULL AND p.bust IS NULL
  `);
  console.log('external_idあり＋詳細なし:', (withExternalId.rows[0] as any).cnt);

  // external_idがないperformer
  const withoutExternalId = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM performers p
    WHERE NOT EXISTS (
      SELECT 1 FROM performer_external_ids pei
      WHERE pei.performer_id = p.id AND pei.provider = 'minnano-av'
    )
  `);
  console.log('external_idなし:', (withoutExternalId.rows[0] as any).cnt);

  // external_id総数
  const totalExternal = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM performer_external_ids WHERE provider = 'minnano-av'
  `);
  console.log('minnano-av external_id総数:', (totalExternal.rows[0] as any).cnt);

  // 合計
  const total = await db.execute(sql`SELECT COUNT(*) as cnt FROM performers`);
  console.log('performers総数:', (total.rows[0] as any).cnt);

  process.exit(0);
}
check().catch(e => {
  console.error(e);
  process.exit(1);
});
