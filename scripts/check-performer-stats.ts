import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== 演者情報 収集・紐づけ状況 ===\n');
  console.log('更新日時:', new Date().toISOString().slice(0, 16).replace('T', ' '), 'UTC\n');

  // 1. 演者数
  const performers = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
  console.log('📊 演者統計');
  console.log('─'.repeat(50));
  console.log(`総演者数: ${performers.rows[0].count}`);

  // 演者画像統計
  const performerImages = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN image_url IS NOT NULL THEN 1 END) as with_image
    FROM performers
  `);
  const total = Number(performerImages.rows[0].total);
  const withImage = Number(performerImages.rows[0].with_image);
  console.log(`画像あり: ${withImage} (${((withImage / total) * 100).toFixed(1)}%)`);
  console.log(`画像なし: ${total - withImage} (${(((total - withImage) / total) * 100).toFixed(1)}%)`);

  // 2. 商品-演者紐づけ
  console.log('\n📊 商品-演者紐づけ統計');
  console.log('─'.repeat(50));

  const productPerformers = await db.execute(sql`SELECT COUNT(*) as count FROM product_performers`);
  console.log(`紐づけレコード数: ${productPerformers.rows[0].count}`);

  const productsWithPerformers = await db.execute(sql`
    SELECT COUNT(DISTINCT product_id) as count FROM product_performers
  `);
  console.log(`演者紐づけ済み商品数: ${productsWithPerformers.rows[0].count}`);

  const totalProducts = await db.execute(sql`SELECT COUNT(*) as count FROM products`);
  const linkedProducts = Number(productsWithPerformers.rows[0].count);
  const totalProductsNum = Number(totalProducts.rows[0].count);
  console.log(`紐づけ率: ${((linkedProducts / totalProductsNum) * 100).toFixed(1)}%`);

  // 3. ASP別紐づけ状況
  console.log('\n📊 ASP別 演者紐づけ状況');
  console.log('─'.repeat(50));

  const aspPerformerStats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT pp.product_id) as linked_products
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total_products DESC
  `);

  console.log('ASP名'.padEnd(25) + '商品数'.padStart(10) + '紐づけ済'.padStart(10) + '紐づけ率'.padStart(10));
  for (const r of aspPerformerStats.rows) {
    const aspName = (r.asp_name as string).padEnd(25);
    const totalStr = String(r.total_products).padStart(10);
    const linkedStr = String(r.linked_products).padStart(10);
    const rate = Number(r.total_products) > 0
      ? ((Number(r.linked_products) / Number(r.total_products)) * 100).toFixed(1) + '%'
      : '0%';
    console.log(`${aspName}${totalStr}${linkedStr}${rate.padStart(10)}`);
  }

  // 4. 演者別名（エイリアス）統計
  console.log('\n📊 演者別名（エイリアス）統計');
  console.log('─'.repeat(50));

  const aliases = await db.execute(sql`SELECT COUNT(*) as count FROM performer_aliases`);
  console.log(`総別名数: ${aliases.rows[0].count}`);

  const performersWithAliases = await db.execute(sql`
    SELECT COUNT(DISTINCT performer_id) as count FROM performer_aliases
  `);
  console.log(`別名登録済み演者数: ${performersWithAliases.rows[0].count}`);

  // 5. 外部ID（Wikiなど）統計
  console.log('\n📊 演者外部ID統計');
  console.log('─'.repeat(50));

  try {
    const externalIds = await db.execute(sql`
      SELECT external_source, COUNT(*) as count
      FROM performer_external_ids
      GROUP BY external_source
      ORDER BY count DESC
    `);

    if (externalIds.rows.length > 0) {
      for (const r of externalIds.rows) {
        console.log(`  ${r.external_source}: ${r.count}`);
      }
    } else {
      console.log('  (データなし)');
    }
  } catch {
    const totalExtIds = await db.execute(sql`SELECT COUNT(*) as count FROM performer_external_ids`);
    console.log(`  総外部ID数: ${totalExtIds.rows[0].count}`);
  }

  // 6. 演者タグ統計
  console.log('\n📊 演者タグ統計');
  console.log('─'.repeat(50));

  const performerTags = await db.execute(sql`SELECT COUNT(*) as count FROM performer_tags`);
  console.log(`総タグ数: ${performerTags.rows[0].count}`);

  const performersWithTags = await db.execute(sql`
    SELECT COUNT(DISTINCT performer_id) as count FROM performer_tags
  `);
  console.log(`タグ付き演者数: ${performersWithTags.rows[0].count}`);

  // 7. 演者紐づけ候補（未確定）
  console.log('\n📊 演者紐づけ候補（未確定）');
  console.log('─'.repeat(50));

  const candidates = await db.execute(sql`SELECT COUNT(*) as count FROM product_performer_candidates`);
  console.log(`候補レコード数: ${candidates.rows[0].count}`);

  // 8. Wiki クロールデータ
  console.log('\n📊 Wiki クロールデータ');
  console.log('─'.repeat(50));

  const wikiData = await db.execute(sql`SELECT COUNT(*) as count FROM wiki_crawl_data`);
  console.log(`wiki_crawl_data: ${wikiData.rows[0].count}`);

  const wikiIndex = await db.execute(sql`SELECT COUNT(*) as count FROM wiki_performer_index`);
  console.log(`wiki_performer_index: ${wikiIndex.rows[0].count}`);

  // 9. 最近追加された演者（上位10件）
  console.log('\n📊 最近追加された演者（上位10件）');
  console.log('─'.repeat(50));

  const recentPerformers = await db.execute(sql`
    SELECT id, name, name_ruby, created_at
    FROM performers
    ORDER BY created_at DESC
    LIMIT 10
  `);

  for (const r of recentPerformers.rows) {
    const date = new Date(r.created_at as string).toISOString().slice(0, 10);
    const ruby = r.name_ruby ? ` (${r.name_ruby})` : '';
    console.log(`  ${date}: ${r.name}${ruby}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
