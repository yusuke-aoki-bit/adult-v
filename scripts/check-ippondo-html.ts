import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function checkIppondoHTML() {
  const db = getDb();

  console.log('========================================');
  console.log('一本道 (1pondo) HTML CONTENT CHECK');
  console.log('========================================\n');

  try {
    // Get one sample HTML to see what's being stored
    const sample = await db.execute(sql`
      SELECT
        product_id,
        html_content
      FROM raw_html_data
      WHERE source = '一本道'
      LIMIT 1
    `);

    if (sample.rows.length > 0) {
      const row = sample.rows[0];
      const htmlContent = String(row.html_content);

      console.log(`Product ID: ${row.product_id}`);
      console.log(`HTML Length: ${htmlContent.length} bytes`);
      console.log('\nHTML Content (first 1000 chars):');
      console.log('----------------------------------------');
      console.log(htmlContent.substring(0, 1000));
      console.log('----------------------------------------');

      // Check if it's an error page
      if (htmlContent.includes('404') || htmlContent.includes('Not Found') || htmlContent.includes('エラー')) {
        console.log('\n⚠️  This appears to be an error page!');
      }

      if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html')) {
        console.log('\n✓ Valid HTML structure found');
      } else {
        console.log('\n⚠️  No valid HTML structure found');
      }
    }

    console.log('\n========================================');
    console.log('CHECK COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error checking HTML:', error);
    throw error;
  }
}

checkIppondoHTML()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
