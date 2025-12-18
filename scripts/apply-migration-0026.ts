/**
 * マイグレーション 0026 を適用するスクリプト
 * パフォーマンス最適化のためのカラムとインデックスを追加
 */

import * as fs from 'fs';
import * as path from 'path';

// .env.localから環境変数を読み込み
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

import { getDb, closeDb } from "../packages/crawlers/src/lib/db";
import { sql } from "drizzle-orm";

const db = getDb();

async function applyMigration() {
  console.log('Starting migration 0026...');
  const startTime = Date.now();

  try {
    // PART 1: 事前計算カラムの追加
    console.log('\n=== PART 1: Adding precomputed columns ===');

    console.log('Adding is_fanza_only column...');
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS is_fanza_only BOOLEAN DEFAULT FALSE`);

    console.log('Adding latest_release_date column...');
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS latest_release_date DATE`);

    console.log('Adding release_count column...');
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS release_count INTEGER DEFAULT 0`);

    console.log('Columns added successfully.');

    // PART 2: 事前計算データの更新
    console.log('\n=== PART 2: Updating precomputed data ===');

    console.log('Updating is_fanza_only flag...');
    await db.execute(sql`
      UPDATE performers p
      SET is_fanza_only = TRUE
      WHERE EXISTS (
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id
        AND ps.asp_name = 'FANZA'
      )
      AND NOT EXISTS (
        SELECT 1 FROM product_performers pp
        INNER JOIN product_sources ps ON pp.product_id = ps.product_id
        WHERE pp.performer_id = p.id
        AND ps.asp_name != 'FANZA'
      )
    `);
    console.log('is_fanza_only updated.');

    console.log('Updating latest_release_date and release_count...');
    await db.execute(sql`
      UPDATE performers p
      SET
        latest_release_date = sub.latest_date,
        release_count = sub.cnt
      FROM (
        SELECT
          pp.performer_id,
          MAX(pr.release_date) as latest_date,
          COUNT(DISTINCT pp.product_id) as cnt
        FROM product_performers pp
        INNER JOIN products pr ON pp.product_id = pr.id
        GROUP BY pp.performer_id
      ) sub
      WHERE p.id = sub.performer_id
    `);
    console.log('latest_release_date and release_count updated.');

    // PART 3: インデックスの追加（CONCURRENTLYはトランザクション外で実行）
    console.log('\n=== PART 3: Creating indexes ===');

    const indexes = [
      {
        name: 'idx_performers_is_fanza_only',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_performers_is_fanza_only ON performers(is_fanza_only) WHERE is_fanza_only = FALSE OR is_fanza_only IS NULL`
      },
      {
        name: 'idx_performers_name_kana_sort',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_performers_name_kana_sort ON performers(COALESCE(name_kana, 'ん'))`
      },
      {
        name: 'idx_products_release_normalized',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_products_release_normalized ON products(release_date DESC NULLS LAST, normalized_product_id DESC)`
      },
      {
        name: 'idx_sources_asp_product_covering',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_sources_asp_product_covering ON product_sources(asp_name, product_id) INCLUDE (id)`
      },
      {
        name: 'idx_pp_performer_product',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_pp_performer_product ON product_performers(performer_id, product_id)`
      },
      {
        name: 'idx_product_images_product_covering',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_product_images_product_covering ON product_images(product_id) INCLUDE (id)`
      },
      {
        name: 'idx_product_videos_product_covering',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_product_videos_product_covering ON product_videos(product_id) INCLUDE (id)`
      },
      {
        name: 'idx_product_sales_active',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_product_sales_active ON product_sales(product_source_id, is_active, end_at) WHERE is_active = TRUE`
      },
      {
        name: 'idx_performers_has_review',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_performers_has_review ON performers(id) WHERE ai_review IS NOT NULL`
      },
      {
        name: 'idx_pp_product_count',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_pp_product_count ON product_performers(product_id)`
      },
      {
        name: 'idx_performers_latest_release',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_performers_latest_release ON performers(latest_release_date DESC NULLS LAST)`
      },
      {
        name: 'idx_performers_release_count',
        sql: sql`CREATE INDEX IF NOT EXISTS idx_performers_release_count ON performers(release_count DESC NULLS LAST)`
      }
    ];

    for (const index of indexes) {
      console.log(`Creating ${index.name}...`);
      try {
        await db.execute(index.sql);
        console.log(`  ${index.name} created.`);
      } catch (err) {
        // インデックスが既に存在する場合はスキップ
        console.log(`  ${index.name} may already exist, skipping.`);
      }
    }

    // ANALYZE実行
    console.log('\n=== Running ANALYZE ===');
    const tables = ['performers', 'products', 'product_sources', 'product_performers', 'product_images', 'product_videos', 'product_sales'];
    for (const table of tables) {
      console.log(`ANALYZE ${table}...`);
      await db.execute(sql.raw(`ANALYZE ${table}`));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n=== Migration 0026 completed in ${elapsed}s ===`);

    // 統計情報を表示
    const stats = await db.execute<{
      total: string;
      fanza_only: string;
      with_release_date: string;
      avg_release_count: string;
    }>(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_fanza_only = TRUE) as fanza_only,
        COUNT(*) FILTER (WHERE latest_release_date IS NOT NULL) as with_release_date,
        ROUND(AVG(COALESCE(release_count, 0)), 1) as avg_release_count
      FROM performers
    `);

    if (stats.rows[0]) {
      console.log('\nStatistics:');
      console.log(`  Total performers: ${stats.rows[0].total}`);
      console.log(`  FANZA-only: ${stats.rows[0].fanza_only}`);
      console.log(`  With release date: ${stats.rows[0].with_release_date}`);
      console.log(`  Average release count: ${stats.rows[0].avg_release_count}`);
    }

  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

applyMigration();
