/**
 * パフォーマンス向上のためのインデックス追加スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/add-performance-indexes.ts
 *
 * 追加されるインデックス:
 * 1. performers.is_fanza_only + name: 女優リスト表示用
 * 2. products.release_date: 新着順ソート用
 * 3. product_performers.performer_id: 女優作品数カウント用
 * 4. product_sources.asp_name + product_id: ASP別フィルタリング用
 * 5. product_sales.is_active + end_at: セール商品取得用
 */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '../packages/database/src/client.js';

interface IndexDefinition {
  name: string;
  table: string;
  columns: string;
  condition?: string;
}

const indexes: IndexDefinition[] = [
  // 女優リスト用（FANZA除外 + 名前順）
  {
    name: 'idx_performers_fanza_only_name',
    table: 'performers',
    columns: 'is_fanza_only, name',
  },
  // 女優リスト用（作品数でソート時に使用）
  {
    name: 'idx_performers_fanza_only_id',
    table: 'performers',
    columns: 'is_fanza_only, id',
  },
  // 商品の発売日順ソート用
  {
    name: 'idx_products_release_date_desc',
    table: 'products',
    columns: 'release_date DESC NULLS LAST',
  },
  // 女優作品数カウント用（頻繁に使用）
  {
    name: 'idx_product_performers_performer_id',
    table: 'product_performers',
    columns: 'performer_id',
  },
  // 商品ID + 演者ID の複合インデックス
  {
    name: 'idx_product_performers_product_performer',
    table: 'product_performers',
    columns: 'product_id, performer_id',
  },
  // ASP別フィルタリング用
  {
    name: 'idx_product_sources_asp_product',
    table: 'product_sources',
    columns: 'asp_name, product_id',
  },
  // セール商品取得用（アクティブなセールのみ）
  {
    name: 'idx_product_sales_active',
    table: 'product_sales',
    columns: 'is_active, end_at',
    condition: 'is_active = true',
  },
  // セール商品の割引率順ソート用
  {
    name: 'idx_product_sales_discount',
    table: 'product_sales',
    columns: 'discount_percent DESC NULLS LAST',
    condition: 'is_active = true',
  },
  // タグ名順ソート用
  {
    name: 'idx_tags_category_name',
    table: 'tags',
    columns: 'category, name',
  },
  // 商品タグの商品ID用（JOIN高速化）
  {
    name: 'idx_product_tags_product_id',
    table: 'product_tags',
    columns: 'product_id',
  },
  // 商品タグのタグID用（JOIN高速化）
  {
    name: 'idx_product_tags_tag_id',
    table: 'product_tags',
    columns: 'tag_id',
  },
];

async function addPerformanceIndexes() {
  console.log('=== Adding Performance Indexes ===\n');

  const db = getDb();

  try {
    for (const index of indexes) {
      console.log(`Checking index: ${index.name}...`);

      // インデックスが既に存在するか確認
      const existsResult = await db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE indexname = ${index.name}
        ) as exists
      `);

      if (existsResult.rows[0]?.exists) {
        console.log(`  -> Already exists, skipping.`);
        continue;
      }

      // インデックスを作成
      console.log(`  -> Creating index...`);
      const createSql = index.condition
        ? `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns}) WHERE ${index.condition}`
        : `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns})`;

      try {
        await db.execute(sql.raw(createSql));
        console.log(`  -> Created successfully.`);
      } catch (error) {
        // CONCURRENTLY はトランザクション内では使用できないので、通常のCREATE INDEXにフォールバック
        const fallbackSql = index.condition
          ? `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns}) WHERE ${index.condition}`
          : `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns})`;
        await db.execute(sql.raw(fallbackSql));
        console.log(`  -> Created (non-concurrent).`);
      }
    }

    // 作成されたインデックスの一覧を表示
    console.log('\n=== Current Performance Indexes ===');
    const result = await db.execute<{ indexname: string; tablename: string; indexdef: string }>(sql`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);

    for (const row of result.rows) {
      console.log(`${row.tablename}.${row.indexname}`);
    }

    console.log('\n=== Index creation completed successfully ===');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

addPerformanceIndexes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
