/**
 * AIレビュー翻訳カラム追加マイグレーション
 *
 * Cloud Run Job経由で実行
 */

import { getDb } from '../../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== AI Review Translation Columns Migration ===');
  console.log('Time:', new Date().toISOString());

  const db = getDb();

  try {
    // 商品AIレビュー翻訳カラム追加
    console.log('Adding products AI review translation columns...');
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_en TEXT`);
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_zh TEXT`);
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_review_ko TEXT`);

    // 演者AIレビュー翻訳カラム追加
    console.log('Adding performers AI review translation columns...');
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_en TEXT`);
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_zh TEXT`);
    await db.execute(sql`ALTER TABLE performers ADD COLUMN IF NOT EXISTS ai_review_ko TEXT`);

    // コメント追加
    console.log('Adding column comments...');
    await db.execute(sql`COMMENT ON COLUMN products.ai_review_en IS 'AI生成レビュー（英語）'`);
    await db.execute(sql`COMMENT ON COLUMN products.ai_review_zh IS 'AI生成レビュー（中国語簡体字）'`);
    await db.execute(sql`COMMENT ON COLUMN products.ai_review_ko IS 'AI生成レビュー（韓国語）'`);
    await db.execute(sql`COMMENT ON COLUMN performers.ai_review_en IS 'AI生成演者レビュー（英語）'`);
    await db.execute(sql`COMMENT ON COLUMN performers.ai_review_zh IS 'AI生成演者レビュー（中国語簡体字）'`);
    await db.execute(sql`COMMENT ON COLUMN performers.ai_review_ko IS 'AI生成演者レビュー（韓国語）'`);

    // 確認
    console.log('\nVerifying columns...');
    const productsResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
        AND column_name LIKE 'ai_review_%'
      ORDER BY column_name
    `);

    const performersResult = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'performers'
        AND column_name LIKE 'ai_review_%'
      ORDER BY column_name
    `);

    console.log(
      'Products AI review columns:',
      (productsResult.rows as Array<{ column_name: string }>).map((r) => r.column_name),
    );
    console.log(
      'Performers AI review columns:',
      (performersResult.rows as Array<{ column_name: string }>).map((r) => r.column_name),
    );

    console.log('\n=== Migration Completed Successfully ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
