import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  // 出演者の総数
  const performers = await db.execute(sql`SELECT COUNT(*) as count FROM performers`);
  console.log('Total performers:', performers.rows[0].count);

  // product_performersの紐付け数
  const links = await db.execute(sql`SELECT COUNT(*) as count FROM product_performers`);
  console.log('Product-performer links:', links.rows[0].count);

  // wiki_crawl_dataがあるか
  try {
    const wikiData = await db.execute(sql`SELECT COUNT(*) as count FROM wiki_crawl_data`);
    console.log('\nWiki crawl data:', wikiData.rows[0].count);

    // 処理済み/未処理
    const wikiStats = await db.execute(sql`
      SELECT processed, COUNT(*) as count
      FROM wiki_crawl_data
      GROUP BY processed
    `);
    console.log('Wiki crawl data status:');
    for (const row of wikiStats.rows as any[]) {
      console.log('  processed=' + row.processed + ': ' + row.count);
    }
  } catch (e) {
    console.log('\nwiki_crawl_data table does not exist');
  }

  // ASP別の紐付け状況
  const byAsp = await db.execute(sql`
    SELECT ps.asp_name,
           COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer,
           COUNT(DISTINCT ps.product_id) as total
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);
  console.log('\nPerformer links by ASP:');
  for (const row of byAsp.rows as any[]) {
    const pct = row.total > 0 ? ((row.with_performer / row.total) * 100).toFixed(1) : '0.0';
    console.log(`  ${row.asp_name}: ${row.with_performer}/${row.total} (${pct}%)`);
  }

  // DUGAの出演者なし商品のサンプル
  const dugaNoPerformer = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DUGA'
      AND NOT EXISTS (SELECT 1 FROM product_performers pp WHERE pp.product_id = p.id)
    LIMIT 10
  `);
  console.log('\nDUGA products without performers (sample):');
  for (const row of dugaNoPerformer.rows as any[]) {
    console.log(`  ${row.normalized_product_id}: ${(row.title || '').substring(0, 50)}`);
  }
}

check().catch(console.error);
