/**
 * SEO関連テーブルのマイグレーションスクリプト
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Pool } from 'pg';

const PROJECT_ID = 'adult-v';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  return version.payload?.data?.toString() || '';
}

async function main() {
  console.log('🔧 SEOテーブルマイグレーション開始...');

  const databaseUrl = await getSecret('database-url');
  const pool = new Pool({ connectionString: databaseUrl, ssl: false });

  const client = await pool.connect();
  try {
    // seo_metrics テーブル作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS seo_metrics (
        id SERIAL PRIMARY KEY,
        query_type VARCHAR(20) NOT NULL,
        query_or_url TEXT NOT NULL,
        performer_id INTEGER REFERENCES performers(id) ON DELETE SET NULL,
        clicks INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        ctr DECIMAL(6, 4),
        position DECIMAL(6, 2),
        date_start DATE NOT NULL,
        date_end DATE NOT NULL,
        fetched_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✅ seo_metrics table created');

    // seo_metrics インデックス作成
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seo_metrics_query_type ON seo_metrics(query_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seo_metrics_performer ON seo_metrics(performer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seo_metrics_position ON seo_metrics(position)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seo_metrics_impressions ON seo_metrics(impressions)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_seo_metrics_date ON seo_metrics(date_start, date_end)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_metrics_query_url_date ON seo_metrics(query_type, query_or_url, date_start, date_end)`);
    console.log('✅ seo_metrics indexes created');

    // footer_featured_actresses テーブル作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS footer_featured_actresses (
        id SERIAL PRIMARY KEY,
        performer_id INTEGER NOT NULL REFERENCES performers(id) ON DELETE CASCADE,
        performer_name VARCHAR(200) NOT NULL,
        impressions INTEGER DEFAULT 0,
        position DECIMAL(6, 2),
        priority_score INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✅ footer_featured_actresses table created');

    // footer_featured_actresses インデックス作成
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_footer_featured_performer ON footer_featured_actresses(performer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_footer_featured_priority ON footer_featured_actresses(priority_score)`);
    console.log('✅ footer_featured_actresses indexes created');

    // 確認
    const result = await client.query(`
      SELECT 'seo_metrics' as table_name, COUNT(*) as count FROM seo_metrics
      UNION ALL
      SELECT 'footer_featured_actresses', COUNT(*) FROM footer_featured_actresses
    `);
    console.log('\n📊 テーブル状態:');
    for (const row of result.rows) {
      console.log(`  ${row.table_name}: ${row['count']} rows`);
    }

    console.log('\n✨ マイグレーション完了!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
