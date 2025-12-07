/**
 * カテゴリからタグへのバックフィル スクリプト
 *
 * categoriesテーブルにあるジャンル情報をtagsテーブルにコピーし、
 * product_categoriesの関連をproduct_tagsにも作成
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/backfill/backfill-categories-to-tags.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function backfillCategoriesToTags() {
  const client = await pool.connect();

  try {
    console.log('=== Categories to Tags Backfill Started ===\n');

    // 1. 全カテゴリを取得
    const categories = await client.query(`
      SELECT id, name FROM categories
      WHERE name NOT IN ('全ての作品')
      ORDER BY id
    `);

    console.log(`Found ${categories.rows.length} categories\n`);

    // 2. 各カテゴリをタグとして作成・更新
    let tagsCreated = 0;
    let tagsExisted = 0;
    const categoryToTagMap: Map<number, number> = new Map();

    for (const category of categories.rows) {
      // tagsテーブルにupsert
      const tagResult = await client.query(`
        INSERT INTO tags (name, category, created_at)
        VALUES ($1, 'genre', NOW())
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, (xmax = 0) as is_new
      `, [category.name]);

      const tagId = tagResult.rows[0].id;
      const isNew = tagResult.rows[0].is_new;

      categoryToTagMap.set(category.id, tagId);

      if (isNew) {
        tagsCreated++;
      } else {
        tagsExisted++;
      }
    }

    console.log(`Tags: ${tagsCreated} created, ${tagsExisted} already existed\n`);

    // 3. product_categoriesからproduct_tagsへの関連をコピー
    console.log('Copying product_categories to product_tags...\n');

    let totalLinked = 0;
    let skipped = 0;

    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const productCategories = await client.query(`
        SELECT pc.product_id, pc.category_id
        FROM product_categories pc
        ORDER BY pc.product_id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (productCategories.rows.length === 0) break;

      console.log(`Processing batch at offset ${offset} (${productCategories.rows.length} rows)...`);

      for (const pc of productCategories.rows) {
        const tagId = categoryToTagMap.get(pc.category_id);
        if (!tagId) {
          skipped++;
          continue;
        }

        const result = await client.query(`
          INSERT INTO product_tags (product_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [pc.product_id, tagId]);

        if (result.rowCount && result.rowCount > 0) {
          totalLinked++;
        } else {
          skipped++;
        }
      }

      offset += batchSize;
    }

    console.log(`\nProduct-tag links: ${totalLinked} created, ${skipped} skipped (already exist or no mapping)\n`);

    // 4. 結果を表示
    console.log('=== Final Statistics ===\n');

    const tagStats = await client.query(`
      SELECT t.category as tag_category, COUNT(DISTINCT t.id) as tag_count, COUNT(pt.product_id) as product_count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      GROUP BY t.category
      ORDER BY product_count DESC
    `);
    console.log('Tags by category:');
    console.table(tagStats.rows);

    const topTags = await client.query(`
      SELECT t.name, COUNT(pt.product_id) as count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.category = 'genre'
      GROUP BY t.id, t.name
      ORDER BY count DESC
      LIMIT 20
    `);
    console.log('\nTop 20 genre tags:');
    console.table(topTags.rows);

    const withTags = await client.query(`
      SELECT COUNT(DISTINCT product_id) as count FROM product_tags
    `);
    console.log(`\nProducts with tags: ${withTags.rows[0].count}`);

    console.log('\n=== Categories to Tags Backfill Completed ===');

  } finally {
    client.release();
    await pool.end();
  }
}

backfillCategoriesToTags().catch(console.error);
