/**
 * Apply PostgreSQL Full Text Search migration
 * Since psql is not available in WSL, we use Drizzle to execute the SQL
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyFtsMigration() {
  const db = getDb();

  console.log('=== Applying PostgreSQL Full Text Search Migration ===\n');

  try {
    // Step 1: Add search_vector column
    console.log('1. Adding search_vector column...');
    await db.execute(sql`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS search_vector tsvector
    `);
    console.log('✅ Column added\n');

    // Step 2: Create trigger function
    console.log('2. Creating trigger function...');
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      DECLARE
        product_ids_text text;
      BEGIN
        -- product_sourcesからoriginal_product_idを取得して統合
        SELECT string_agg(original_product_id, ' ')
        INTO product_ids_text
        FROM product_sources
        WHERE product_id = NEW.id;

        -- tsvectorを生成（重み付き）
        -- タイトル(A) > 品番(B) > 説明(C)
        NEW.search_vector :=
          setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW.normalized_product_id, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(product_ids_text, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');

        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Trigger function created\n');

    // Step 3: Create trigger
    console.log('3. Creating trigger...');
    await db.execute(sql`
      DROP TRIGGER IF EXISTS products_search_vector_trigger ON products
    `);
    await db.execute(sql`
      CREATE TRIGGER products_search_vector_trigger
        BEFORE INSERT OR UPDATE ON products
        FOR EACH ROW
        EXECUTE FUNCTION products_search_vector_update()
    `);
    console.log('✅ Trigger created\n');

    // Step 4: Create GIN index
    console.log('4. Creating GIN index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_products_search_vector
        ON products USING GIN (search_vector)
    `);
    console.log('✅ GIN index created\n');

    // Step 5: Add column comment
    console.log('5. Adding column comment...');
    await db.execute(sql`
      COMMENT ON COLUMN products.search_vector IS 'Full text search vector (auto-updated by trigger)'
    `);
    console.log('✅ Comment added\n');

    console.log('=== Migration Applied Successfully ===\n');
    console.log('Next step: Run scripts/backfill-search-vectors.ts to populate existing data');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

applyFtsMigration().then(() => process.exit(0));
