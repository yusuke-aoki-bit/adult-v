/**
 * パフォーマンス最適化のための追加インデックスを作成
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';

const indexes = [
  {
    name: 'idx_pp_product_performer_combo',
    table: 'product_performers',
    columns: 'product_id, performer_id',
  },
  {
    name: 'idx_pt_product_tag_combo',
    table: 'product_tags',
    columns: 'product_id, tag_id',
  },
  {
    name: 'idx_sources_product_price',
    table: 'product_sources',
    columns: 'product_id, price',
  },
  {
    name: 'idx_cache_product_price',
    table: 'product_cache',
    columns: 'product_id, price',
  },
  {
    name: 'idx_products_release_created',
    table: 'products',
    columns: 'release_date DESC NULLS LAST, created_at DESC',
  },
  {
    name: 'idx_performers_created',
    table: 'performers',
    columns: 'created_at DESC',
  },
  {
    name: 'idx_pp_performer_only',
    table: 'product_performers',
    columns: 'performer_id',
  },
];

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== パフォーマンス最適化インデックス追加 ===\n');

  for (const idx of indexes) {
    try {
      const sql = `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.columns})`;
      console.log(`Creating: ${idx.name}...`);
      await pool.query(sql);
      console.log(`  → OK`);
    } catch (error: any) {
      if (error.code === '42P07') {
        console.log(`  → Already exists (skip)`);
      } else {
        console.error(`  → Error: ${error.message}`);
      }
    }
  }

  // ANALYZE実行
  console.log('\n=== ANALYZE実行 ===\n');
  const tables = ['products', 'performers', 'product_performers', 'product_tags', 'product_sources', 'product_cache', 'tags'];
  for (const table of tables) {
    try {
      await pool.query(`ANALYZE ${table}`);
      console.log(`ANALYZE ${table} → OK`);
    } catch (error: any) {
      console.error(`ANALYZE ${table} → Error: ${error.message}`);
    }
  }

  console.log('\n=== 完了 ===');
  await pool.end();
}

main().catch(console.error);
