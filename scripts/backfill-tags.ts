/**
 * タグバックフィル スクリプト
 *
 * 各ASPの商品にサイトタグを追加
 * Usage: DATABASE_URL="..." npx tsx scripts/backfill-tags.ts [ASP名]
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TagMapping {
  aspName: string;
  siteTagName: string;
}

// ASPとサイトタグの対応
const ASP_TAG_MAPPINGS: TagMapping[] = [
  { aspName: 'DUGA', siteTagName: 'DUGA' },
  { aspName: 'DTI', siteTagName: 'DTI' },
  { aspName: 'b10f', siteTagName: 'b10f' },
  { aspName: 'MGS', siteTagName: 'MGS' },
  { aspName: 'Japanska', siteTagName: 'Japanska' },
  { aspName: 'FC2', siteTagName: 'FC2' },
  { aspName: 'ソクミル', siteTagName: 'ソクミル' },
];

async function ensureTagExists(client: any, tagName: string, category: string): Promise<number> {
  // タグが存在するか確認
  const existing = await client.query(
    `SELECT id FROM tags WHERE name = $1`,
    [tagName]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  // なければ作成
  const inserted = await client.query(
    `INSERT INTO tags (name, category, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
    [tagName, category]
  );

  console.log(`Created tag: ${tagName} (category: ${category})`);
  return inserted.rows[0].id;
}

async function backfillTagsForAsp(client: any, aspName: string, tagId: number): Promise<{ added: number; skipped: number }> {
  // 一括INSERTで全商品にタグを追加（既存は無視）
  const result = await client.query(`
    INSERT INTO product_tags (product_id, tag_id)
    SELECT ps.product_id, $2
    FROM product_sources ps
    WHERE ps.asp_name = $1
      AND NOT EXISTS (
        SELECT 1 FROM product_tags pt
        WHERE pt.product_id = ps.product_id AND pt.tag_id = $2
      )
    ON CONFLICT DO NOTHING
  `, [aspName, tagId]);

  const added = result.rowCount || 0;

  // スキップ数を計算
  const totalResult = await client.query(
    `SELECT COUNT(*) as count FROM product_sources WHERE asp_name = $1`,
    [aspName]
  );
  const total = parseInt(totalResult.rows[0].count);
  const skipped = total - added;

  return { added, skipped };
}

async function backfillAll() {
  const client = await pool.connect();
  const targetAsp = process.argv[2] || null;

  try {
    console.log('=== Tag Backfill Started ===');
    console.log(`Target ASP: ${targetAsp || 'ALL'}`);
    console.log('');

    const mappings = targetAsp
      ? ASP_TAG_MAPPINGS.filter(m => m.aspName === targetAsp)
      : ASP_TAG_MAPPINGS;

    if (mappings.length === 0) {
      console.error(`Unknown ASP: ${targetAsp}`);
      console.log('Available ASPs:', ASP_TAG_MAPPINGS.map(m => m.aspName).join(', '));
      return;
    }

    for (const mapping of mappings) {
      console.log(`Processing ${mapping.aspName}...`);

      // サイトタグを確保
      const tagId = await ensureTagExists(client, mapping.siteTagName, 'site');

      // タグをバックフィル
      const result = await backfillTagsForAsp(client, mapping.aspName, tagId);

      console.log(`  ${mapping.aspName}: Added ${result.added}, Skipped ${result.skipped}`);
    }

    console.log('');
    console.log('=== Tag Backfill Completed ===');

  } finally {
    client.release();
    await pool.end();
  }
}

backfillAll().catch(console.error);
