/**
 * DTI API data import script
 * Fetches data from DTI widget API endpoints
 */

import { getDb } from '../lib/db/index';
import { tags } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

interface DTIApiResponse {
  data: Array<{
    site_id: number;
    site_name: string;
    count: number;
  }>;
}

const DTI_ENDPOINTS = [
  { sid: 2477, url: 'https://ad2widget.dtiserv2.com/mn?&sid=2477' },
  { sid: 2468, url: 'https://ad2widget.dtiserv2.com/mn?&sid=2468' },
  { sid: 2470, url: 'https://ad2widget.dtiserv2.com/mn?&sid=2470' },
  { sid: 2665, url: 'https://ad2widget.dtiserv2.com/mn?&sid=2665' },
];

async function fetchDTIData(url: string): Promise<DTIApiResponse | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function seedDTIData() {
  try {
    console.log('Starting DTI API data import...\n');

    const db = getDb();
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const endpoint of DTI_ENDPOINTS) {
      console.log(`Fetching data from sid=${endpoint.sid}...`);

      const data = await fetchDTIData(endpoint.url);

      if (!data || !data.data || data.data.length === 0) {
        console.log(`  ⚠️  No data returned from sid=${endpoint.sid}`);
        skippedCount++;
        continue;
      }

      for (const site of data.data) {
        try {
          const siteName = site.site_name;
          const siteCount = site.count;

          console.log(`  Site: ${siteName} (${siteCount} products)`);

          // Check if tag exists
          const existingTag = await db
            .select()
            .from(tags)
            .where(eq(tags.name, siteName))
            .limit(1);

          if (existingTag.length > 0) {
            console.log(`    ✓ Tag already exists`);
          } else {
            await db.insert(tags).values({
              name: siteName,
              category: 'site',
            });
            console.log(`    ✓ Created tag for site: ${siteName}`);
            importedCount++;
          }
        } catch (error) {
          console.error(`  ❌ Error importing site ${site.site_name}:`, error);
          errorCount++;
        }
      }

      console.log('');
    }

    console.log('\n========================================');
    console.log(`DTI Import completed!`);
    console.log(`  ✓ Imported: ${importedCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('========================================\n');

    console.log('\nNote: These endpoints only provide site statistics.');
    console.log('To import actual product data, you need access to product listing APIs.');
    console.log('Site IDs found:');
    DTI_ENDPOINTS.forEach(e => console.log(`  - sid=${e.sid}`));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedDTIData();
