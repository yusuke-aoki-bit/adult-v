import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';

async function main() {
  // 最新のMGS raw HTMLを確認
  const rawData = await db.execute(sql`
    SELECT id, product_id, html_content, gcs_url
    FROM raw_html_data
    WHERE source = 'MGS'
    AND html_content IS NOT NULL
    ORDER BY crawled_at DESC
    LIMIT 1
  `);

  if (rawData.rows.length === 0) {
    console.log('No MGS raw HTML found');
    process.exit(0);
  }

  const row = rawData.rows[0] as Record<string, unknown>;
  console.log('=== MGS Raw HTML Sample ===');
  console.log(`Product ID: ${row.product_id}`);
  console.log(`GCS URL: ${row.gcs_url || 'N/A'}`);

  const html = row.html_content as string;
  if (!html) {
    console.log('No HTML content');
    process.exit(0);
  }

  const $ = cheerio.load(html);

  // 価格セクションを確認
  console.log('\n=== Price Extraction Debug ===');
  const priceTh = $('th:contains("価格")');
  console.log(`Found price th: ${priceTh.length > 0}`);

  if (priceTh.length > 0) {
    const priceTd = priceTh.next('td');
    console.log(`Price td html: ${priceTd.html()?.substring(0, 200)}`);
    console.log(`Price td text: ${priceTd.text().trim()}`);
  }

  // 別のパターンを試す
  console.log('\n=== Alternative Price Patterns ===');
  const tableRows = $('table tr').toArray();
  for (const tr of tableRows.slice(0, 10)) {
    const th = $(tr).find('th').text().trim();
    if (th.includes('価格') || th.includes('price')) {
      console.log(`Found: th="${th}", td="${$(tr).find('td').text().trim().substring(0, 100)}"`);
    }
  }

  // 価格っぽい要素を探す
  console.log('\n=== Price-like Elements ===');
  $('*').each((_, el) => {
    const text = $(el).text().trim();
    if (text.match(/¥\d{1,3}(,\d{3})*/) && text.length < 50) {
      console.log(`Element: ${$(el).prop('tagName')}, Text: "${text}"`);
    }
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
