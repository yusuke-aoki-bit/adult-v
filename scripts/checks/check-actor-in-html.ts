/**
 * Check for actor information patterns in raw HTML
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkActorPatterns() {
  console.log('=== Checking for actor information patterns in HTML ===\n');

  const result = await db.execute(sql`
    SELECT
      source,
      product_id,
      html_content
    FROM raw_html_data
    WHERE source = '一本道'
    LIMIT 5
  `);

  for (const row of result.rows as any[]) {
    console.log(`\n=== ${row.source} - ${row.product_id} ===`);

    const html = row.html_content;

    // Pattern 1: ec_item_brand
    const brandMatch = html.match(/var\s+ec_item_brand\s*=\s*['"]([^'"]+)['"]/);
    if (brandMatch) {
      console.log('Pattern 1 (ec_item_brand):', brandMatch[1]);
    } else {
      console.log('Pattern 1 (ec_item_brand): NOT FOUND');
    }

    // Pattern 2: Title format
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      console.log('Title:', titleMatch[1]);
      const titleActorMatch = titleMatch[1].match(/^([^\s【]+)\s*【[^】]+】/);
      if (titleActorMatch) {
        console.log('Pattern 2 (title format):', titleActorMatch[1]);
      } else {
        console.log('Pattern 2 (title format): NOT FOUND in title');
      }
    }

    // Pattern 3: 出演者 label
    const actorMatches = html.match(/出演者?[:：]?\s*([^<\n]+)/i);
    if (actorMatches) {
      console.log('Pattern 3 (出演者 label):', actorMatches[1]);
    } else {
      console.log('Pattern 3 (出演者 label): NOT FOUND');
    }

    // Additional search: look for any instance of 出演
    const appearances = html.match(/出演[^<]{0,100}/gi);
    if (appearances && appearances.length > 0) {
      console.log('\nFound "出演" instances:');
      appearances.slice(0, 3).forEach((app, i) => {
        console.log(`  ${i + 1}. ${app}`);
      });
    }

    console.log('\n---');
  }
}

checkActorPatterns().catch(console.error).finally(() => process.exit(0));
