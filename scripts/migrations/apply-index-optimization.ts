import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyIndexOptimization() {
  const db = getDb();

  console.log('📊 Applying database index optimizations...');

  try {
    const migrationPath = path.join(__dirname, '../drizzle/migrations/0009_optimize_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration SQL...');
    await db.execute(sql.raw(migrationSQL));

    console.log('✅ Index optimization complete!');
    console.log('');
    console.log('Created indexes:');
    console.log('  - Products: release_date, created_at, runtime, title (full-text)');
    console.log('  - Product sources: asp_name, original_product_id, composite');
    console.log('  - Product performers: performer_id, composite');
    console.log('  - Performers: name (full-text), name (lowercase)');
    console.log('  - Product tags: tag_id, composite');
    console.log('  - Tags: category, name (lowercase)');
    console.log('  - Product images: product_id, asp_name');
    console.log('  - Product views: product_id, viewed_at, composite');
    console.log('  - Performer aliases: name, performer_id');
    console.log('');
    console.log('Performance improvements expected:');
    console.log('  - Faster product searches by date/title');
    console.log('  - Faster actress filtering');
    console.log('  - Faster tag-based queries');
    console.log('  - Faster ranking calculations');

  } catch (error) {
    console.error('❌ Error applying index optimization:', error);
    throw error;
  }

  process.exit(0);
}

applyIndexOptimization();
