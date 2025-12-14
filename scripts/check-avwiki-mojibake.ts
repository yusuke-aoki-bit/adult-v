import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  // raw_html_dataにav-wiki関連のデータがあるか
  const rawCount = await db.execute(sql`
    SELECT source, COUNT(*) as cnt
    FROM raw_html_data
    WHERE source ILIKE '%wiki%' OR source ILIKE '%av%'
    GROUP BY source
  `);
  console.log('=== raw_html_data (wiki関連) ===');
  for (const r of rawCount.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  // wiki_crawl_dataのソース別件数
  const wikiSources = await db.execute(sql`
    SELECT source, COUNT(*) as cnt
    FROM wiki_crawl_data
    GROUP BY source
  `);
  console.log('\n=== wiki_crawl_data ソース別 ===');
  for (const r of wikiSources.rows as any[]) {
    console.log(`  ${r.source}: ${r.cnt}`);
  }

  // av-wikiの文字化けサンプル
  const mojibakeSample = await db.execute(sql`
    SELECT performer_name, product_code, source_url
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    LIMIT 10
  `);
  console.log('\n=== av-wiki サンプルデータ ===');
  for (const r of mojibakeSample.rows as any[]) {
    console.log(`  ${r.performer_name} | ${r.product_code}`);
  }

  // raw_html_dataのカラム構造を確認
  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'raw_html_data'
    ORDER BY ordinal_position
  `);
  console.log('\n=== raw_html_data カラム構造 ===');
  for (const r of columns.rows as any[]) {
    console.log(`  ${r.column_name}: ${r.data_type}`);
  }

  // av-wikiのraw_html_dataサンプル
  const rawSample = await db.execute(sql`
    SELECT id, product_id, source, html_content IS NOT NULL as has_html,
           LENGTH(html_content) as html_length
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
    LIMIT 5
  `);
  console.log('\n=== av-wiki raw_html_data サンプル ===');
  for (const r of rawSample.rows as any[]) {
    console.log(`  ID: ${r.id}, ProductID: ${r.product_id}, HasHTML: ${r.has_html}, Length: ${r.html_length}`);
  }

  // source_urlのパターンを確認（バックフィル用）
  const urlPatterns = await db.execute(sql`
    SELECT source_url, COUNT(*) as cnt
    FROM wiki_crawl_data
    WHERE source = 'av-wiki'
    GROUP BY source_url
    ORDER BY cnt DESC
    LIMIT 5
  `);
  console.log('\n=== av-wiki URL パターン ===');
  for (const r of urlPatterns.rows as any[]) {
    console.log(`  ${r.source_url}: ${r.cnt}件`);
  }

  process.exit(0);
}
check().catch(e => {
  console.error(e);
  process.exit(1);
});
