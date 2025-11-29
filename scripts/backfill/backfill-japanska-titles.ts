/**
 * Japanska商品タイトルをraw_html_dataから再抽出してバックフィル
 */
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function main() {
  console.log('=== Japanska タイトルバックフィル ===\n');

  // 修正前の状態確認
  const beforeStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%' THEN 1 END) as placeholder_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
  `);
  console.log('修正前:');
  console.table(beforeStats.rows);

  // raw_html_dataからタイトルを抽出して更新
  const rawData = await db.execute(sql`
    SELECT r.product_id, r.html_content, p.id as internal_product_id, p.title as current_title
    FROM raw_html_data r
    JOIN product_sources ps ON ps.original_product_id = r.product_id AND ps.asp_name = 'Japanska'
    JOIN products p ON p.id = ps.product_id
    WHERE r.source = 'Japanska'
  `);

  console.log(`\n処理対象: ${rawData.rows.length}件\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rawData.rows) {
    const r = row as any;
    const html = r.html_content;

    // タイトル抽出
    let title = '';

    // パターン1: <div class="movie_ttl"><p>タイトル</p></div>
    const movieTtlMatch = html.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    if (movieTtlMatch) {
      title = movieTtlMatch[1].trim();
    }

    // フォールバック（タイトルがサイト共通テキストの場合はスキップ）
    if (!title || title.includes('JAPANSKA') || title.includes('幅広いジャンル') || title.includes('30日')) {
      skippedCount++;
      continue;
    }

    // 現在のタイトルがプレースホルダーまたはID形式の場合のみ更新
    const currentTitle = r.current_title;
    if (currentTitle.startsWith('Japanska作品') || currentTitle.startsWith('Japanska-') ||
        currentTitle.includes('JAPANSKA') || currentTitle.includes('幅広いジャンル')) {
      await db.execute(sql`
        UPDATE products
        SET title = ${title}, updated_at = NOW()
        WHERE id = ${r.internal_product_id}
      `);
      console.log(`✓ ${r.product_id}: "${currentTitle.substring(0, 30)}..." → "${title.substring(0, 50)}..."`);
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`\n更新: ${updatedCount}件, スキップ: ${skippedCount}件`);

  // 修正後の確認
  const afterStats = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN p.title LIKE 'Japanska作品%' OR p.title LIKE 'Japanska-%' THEN 1 END) as placeholder_count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
  `);
  console.log('\n修正後:');
  console.table(afterStats.rows);

  // サンプル表示
  const sample = await db.execute(sql`
    SELECT p.title, p.normalized_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'Japanska'
    ORDER BY p.updated_at DESC
    LIMIT 10
  `);
  console.log('\n修正後サンプル:');
  console.table(sample.rows);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
