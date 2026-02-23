/**
 * Seed site tags script
 * Run with: DATABASE_URL="..." npx tsx scripts/seed-site-tags.ts
 */

import { getDb } from '../lib/db/index';
import { tags } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const SITE_TAGS = [
  { name: 'DUGA', category: 'site' },
  { name: 'カリビアンコムプレミアム', category: 'site' },
  { name: '一本道', category: 'site' },
  { name: 'HEYZO', category: 'site' },
  { name: 'カリビアンコム', category: 'site' },
];

async function seedSiteTags() {
  try {
    console.log('Starting site tags seeding...\n');

    const db = getDb();
    let createdCount = 0;
    let skippedCount = 0;

    for (const siteTag of SITE_TAGS) {
      // Check if tag already exists
      const existing = await db.select().from(tags).where(eq(tags.name, siteTag.name)).limit(1);

      if (existing.length > 0) {
        console.log(`  ⚠️  Tag already exists: ${siteTag.name}`);
        skippedCount++;
        continue;
      }

      // Insert tag
      await db.insert(tags).values({
        name: siteTag.name,
        category: siteTag.category,
      });

      console.log(`  ✓ Created tag: ${siteTag.name}`);
      createdCount++;
    }

    console.log('\n========================================');
    console.log(`Site tags seeding completed!`);
    console.log(`  ✓ Created: ${createdCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

seedSiteTags();
