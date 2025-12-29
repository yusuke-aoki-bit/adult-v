/**
 * FC2商品数をデバッグするスクリプト
 */

import { getDb } from '../lib/db';
import { products, productSources } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== FC2商品数デバッグ ===\n');

  // 1. product_sourcesでFC2の件数
  const fc2SourceCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_sources WHERE asp_name = 'FC2'
  `);
  console.log(`1. product_sources (asp_name='FC2'): ${(fc2SourceCount.rows[0] as { count: number }).count}件`);

  // 2. FC2商品のサンプル（original_product_idも確認）
  const fc2Samples = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, p.title, ps.asp_name, ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FC2'
    LIMIT 10
  `);
  console.log('\n2. FC2商品サンプル（10件）:');
  for (const row of fc2Samples.rows as { id: number; normalized_product_id: string; title: string; asp_name: string; original_product_id: string }[]) {
    console.log(`   - [${row.id}] normalizedId=${row.normalized_product_id}, originalId=${row.original_product_id}`);
    console.log(`     title: ${row.title.substring(0, 50)}...`);
  }

  // 3. FC2商品の重複タイトル確認（「FC2動画アダルト」の詳細）
  const duplicateTitles = await db.execute(sql`
    SELECT p.title, COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FC2'
    GROUP BY p.title
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\n3. FC2で重複しているタイトル:');
  for (const row of duplicateTitles.rows as { title: string; count: number }[]) {
    console.log(`   - 「${row.title.substring(0, 40)}...」: ${row.count}件`);
  }

  // 4. 「FC2動画アダルト」タイトルの商品詳細を確認
  const fc2AdultSamples = await db.execute(sql`
    SELECT p.id, p.normalized_product_id, ps.original_product_id, p.title
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FC2' AND p.title = 'FC2動画アダルト'
    LIMIT 10
  `);
  console.log('\n4. 「FC2動画アダルト」商品のID確認:');
  for (const row of fc2AdultSamples.rows as { id: number; normalized_product_id: string; original_product_id: string; title: string }[]) {
    console.log(`   - [${row.id}] normalizedId=${row.normalized_product_id}, originalId=${row.original_product_id}`);
  }

  // 5. 商品テーブルのASP別商品数
  const providerCheck = await db.execute(sql`
    SELECT ps.asp_name, COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY count DESC
  `);
  console.log('\n5. ASP別商品数:');
  for (const row of providerCheck.rows as { asp_name: string; count: number }[]) {
    console.log(`   - ${row.asp_name}: ${row.count}件`);
  }

  // 6. normalizedProductIdのパターン確認
  const normalizedIdPatterns = await db.execute(sql`
    SELECT
      CASE
        WHEN p.normalized_product_id LIKE 'FC2-%' THEN 'FC2-*'
        WHEN p.normalized_product_id LIKE 'fc2-%' THEN 'fc2-*'
        ELSE 'other'
      END as pattern,
      COUNT(*) as count
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FC2'
    GROUP BY pattern
  `);
  console.log('\n6. FC2商品のnormalizedProductIdパターン:');
  for (const row of normalizedIdPatterns.rows as { pattern: string; count: number }[]) {
    console.log(`   - ${row.pattern}: ${row.count}件`);
  }

  console.log('\n=== 完了 ===');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
