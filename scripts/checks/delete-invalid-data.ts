import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== 無効データ削除 ===\n');

  // 1. 削除対象のproduct_idを取得
  const targets = await db.execute(sql`
    SELECT DISTINCT p.id, p.title, ps.asp_name
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.description ILIKE '%トップページ%'
       OR p.description ILIKE '%会員登録%'
       OR p.title ILIKE '%トップページ%'
       OR p.title ~ '^(ソクミル|FC2|Japanska|MGS|DUGA|b10f|1pondo|caribbeancom|pacopacomama|10musume|heyzo|Japanska作品)-[0-9]+$'
  `);

  console.log('削除対象:');
  console.table(targets.rows);

  if (targets.rows.length === 0) {
    console.log('削除対象なし');
    process.exit(0);
  }

  const ids = targets.rows.map((r: any) => r.id);
  console.log('\n削除対象ID:', ids);

  // 2. 関連データを削除
  for (const id of ids) {
    const title = targets.rows.find((r: any) => r.id === id)?.title;
    console.log(`\n削除中: product_id=${id} (${title})`);

    const pp = await db.execute(sql`DELETE FROM product_performers WHERE product_id = ${id}`);
    console.log(`  ✓ product_performers (${pp.rowCount}件)`);

    const pc = await db.execute(sql`DELETE FROM product_categories WHERE product_id = ${id}`);
    console.log(`  ✓ product_categories (${pc.rowCount}件)`);

    const pi = await db.execute(sql`DELETE FROM product_images WHERE product_id = ${id}`);
    console.log(`  ✓ product_images (${pi.rowCount}件)`);

    const pv = await db.execute(sql`DELETE FROM product_videos WHERE product_id = ${id}`);
    console.log(`  ✓ product_videos (${pv.rowCount}件)`);

    const prdl = await db.execute(sql`DELETE FROM product_raw_data_links WHERE product_id = ${id}`);
    console.log(`  ✓ product_raw_data_links (${prdl.rowCount}件)`);

    const ps = await db.execute(sql`DELETE FROM product_sources WHERE product_id = ${id}`);
    console.log(`  ✓ product_sources (${ps.rowCount}件)`);

    const p = await db.execute(sql`DELETE FROM products WHERE id = ${id}`);
    console.log(`  ✓ products (${p.rowCount}件)`);
  }

  console.log(`\n✅ ${ids.length}件の無効データを削除しました`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
