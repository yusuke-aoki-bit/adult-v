import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  const result = await db.execute(sql`
    SELECT html_content
    FROM raw_html_data
    WHERE source = 'Japanska' AND product_id = '34009'
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    const html = (result.rows[0] as any).html_content as string;
    console.log('HTML length:', html.length);

    // タイトルパターンを探す
    const h1Matches = html.match(/<h1[^>]*>([^<]*)<\/h1>/gi);
    console.log('\nH1 tags:', h1Matches?.slice(0, 5));

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    console.log('\nTitle tag:', titleMatch?.[1]?.substring(0, 200));

    // og:title
    const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    console.log('\nog:title:', ogMatch?.[1]?.substring(0, 100));

    // movie title search
    const movieIndex = html.indexOf('PureMoeMix');
    if (movieIndex > -1) {
      console.log('\nPureMoeMix context:', html.substring(movieIndex - 50, movieIndex + 100));
    }

    // Find any h1 content
    const allH1 = html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
    console.log('\nAll H1 contents:');
    let count = 0;
    for (const match of allH1) {
      console.log(`  ${count++}: ${match[1].substring(0, 100).trim()}`);
      if (count > 5) break;
    }
  } else {
    console.log('No HTML found');
  }

  process.exit(0);
}

main().catch(console.error);
