/**
 * PageSpeed結果テーブルのマイグレーション
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
  console.log('🔧 PageSpeed テーブルマイグレーション開始...');

  const databaseUrl = await getSecret('database-url');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // pagespeed_results テーブル作成
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pagespeed_results (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        strategy VARCHAR(10) NOT NULL,
        -- Scores (0-100)
        performance_score INTEGER,
        accessibility_score INTEGER,
        best_practices_score INTEGER,
        seo_score INTEGER,
        -- Core Web Vitals (in ms)
        fcp INTEGER,
        lcp INTEGER,
        tbt INTEGER,
        cls DECIMAL(6, 4),
        si INTEGER,
        -- Field Data (CrUX)
        field_lcp INTEGER,
        field_fid INTEGER,
        field_cls DECIMAL(6, 4),
        field_inp INTEGER,
        -- Status
        passed BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        -- Full audit data
        audit_data JSONB,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('✅ pagespeed_results テーブル作成完了');

    // インデックス作成
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pagespeed_url_strategy ON pagespeed_results(url, strategy);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pagespeed_fetched_at ON pagespeed_results(fetched_at);
    `);
    console.log('✅ インデックス作成完了');

    console.log('\n✨ マイグレーション完了');
  } catch (error) {
    console.error('❌ マイグレーションエラー:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
