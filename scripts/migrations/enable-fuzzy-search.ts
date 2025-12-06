import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

/**
 * Enable pg_trgm extension and create GIN indexes for fuzzy search
 */
async function enableFuzzySearch() {
  const db = getDb();

  try {
    console.log('Enabling pg_trgm extension...');
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    console.log('✓ pg_trgm extension enabled');

    console.log('\nCreating GIN indexes for fuzzy search...');

    // Create GIN index for products.title
    console.log('Creating index on products.title...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON products USING gin (title gin_trgm_ops);`
    );
    console.log('✓ Created index idx_products_title_trgm');

    // Create GIN index for products.description
    console.log('Creating index on products.description...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops);`
    );
    console.log('✓ Created index idx_products_description_trgm');

    // Create GIN index for performers.name
    console.log('Creating index on performers.name...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performers_name_trgm ON performers USING gin (name gin_trgm_ops);`
    );
    console.log('✓ Created index idx_performers_name_trgm');

    // Create GIN index for performers.name_kana
    console.log('Creating index on performers.name_kana...');
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_performers_name_kana_trgm ON performers USING gin (name_kana gin_trgm_ops);`
    );
    console.log('✓ Created index idx_performers_name_kana_trgm');

    console.log('\n✅ Fuzzy search setup completed successfully!');
    console.log('\nYou can now use similarity-based searches in your queries.');
  } catch (error) {
    console.error('❌ Error enabling fuzzy search:', error);
    throw error;
  }
}

// Run the migration
enableFuzzySearch()
  .then(() => {
    console.log('\nMigration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
