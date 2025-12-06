/**
 * コンテンツ強化用テーブル作成スクリプト
 *
 * 実行: DATABASE_URL="..." npx tsx scripts/create-enhancement-tables.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Creating content enhancement tables...\n');

    // 1. 画像メタデータテーブル（Vision API）
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_image_metadata (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        face_count INTEGER DEFAULT 0,
        labels TEXT[] DEFAULT '{}',
        analyzed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id)
      )
    `);
    console.log('✓ Created: product_image_metadata');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_image_metadata_product
      ON product_image_metadata(product_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_image_metadata_labels
      ON product_image_metadata USING GIN(labels)
    `);

    // 2. 翻訳テーブル（Translation API）
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_translations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        title_en TEXT,
        title_zh TEXT,
        title_ko TEXT,
        description_en TEXT,
        description_zh TEXT,
        description_ko TEXT,
        translated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id)
      )
    `);
    console.log('✓ Created: product_translations');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_translations_product
      ON product_translations(product_id)
    `);

    // 3. YouTube動画連携テーブル（YouTube API）
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_youtube_videos (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        video_id VARCHAR(50) NOT NULL,
        video_title TEXT,
        thumbnail_url TEXT,
        channel_title TEXT,
        view_count INTEGER,
        linked_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(product_id, video_id)
      )
    `);
    console.log('✓ Created: product_youtube_videos');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_product
      ON product_youtube_videos(product_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_youtube_video
      ON product_youtube_videos(video_id)
    `);

    // 4. SEOインデックス状態テーブル（Indexing API）
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_indexing_status (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending',
        last_requested_at TIMESTAMP,
        indexed_at TIMESTAMP,
        error_message TEXT
      )
    `);
    console.log('✓ Created: seo_indexing_status');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_indexing_status
      ON seo_indexing_status(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_indexing_product
      ON seo_indexing_status(product_id)
    `);

    // 5. アクセス解析キャッシュテーブル（Analytics API）
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_cache (
        id SERIAL PRIMARY KEY,
        report_type VARCHAR(100) NOT NULL,
        date_range VARCHAR(50) NOT NULL,
        data JSONB NOT NULL,
        cached_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        UNIQUE(report_type, date_range)
      )
    `);
    console.log('✓ Created: analytics_cache');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_report
      ON analytics_cache(report_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analytics_expires
      ON analytics_cache(expires_at)
    `);

    // テーブル一覧を表示
    console.log('\n=== Tables Created ===');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'product_image_metadata',
          'product_translations',
          'product_youtube_videos',
          'seo_indexing_status',
          'analytics_cache'
        )
      ORDER BY table_name
    `);

    for (const row of tables.rows) {
      const columns = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [row.table_name]);

      console.log(`\n${row.table_name}:`);
      for (const col of columns.rows) {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      }
    }

    console.log('\n✓ All enhancement tables created successfully');

  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(console.error);
