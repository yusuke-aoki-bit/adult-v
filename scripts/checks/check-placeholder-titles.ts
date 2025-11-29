import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  console.log('=== ASP別プレースホルダータイトル確認 ===\n');

  // 各ASPでプレースホルダータイトル（ASP名+ID形式）のものを確認
  const placeholders = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(*) FILTER (WHERE p.title LIKE '%作品%' OR p.title LIKE ps.asp_name || '-%' OR p.title ~ ('^' || ps.asp_name || '-[0-9]+$')) as placeholder_count,
      COUNT(*) as total
    FROM product_sources ps
    JOIN products p ON ps.product_id = p.id
    GROUP BY ps.asp_name
    ORDER BY total DESC
  `);

  console.log('=== 統計 ===');
  console.table(placeholders.rows);

  // 各ASPごとの具体的なサンプル
  const asps = ['ソクミル', 'Japanska', 'FC2', 'MGS', 'DUGA', 'DTI', 'b10f'];

  for (const asp of asps) {
    const samples = await db.execute(sql`
      SELECT p.title, ps.original_product_id
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      WHERE ps.asp_name = ${asp}
      AND (
        p.title LIKE ${asp + '作品%'}
        OR p.title LIKE ${asp + '-%'}
        OR p.title LIKE '%アダルト動画%'
        OR LENGTH(p.title) < 10
      )
      LIMIT 5
    `);

    if ((samples.rows as any[]).length > 0) {
      console.log(`\n=== ${asp} - 不正な可能性のあるタイトル ===`);
      for (const row of samples.rows as any[]) {
        console.log(`  ${row.original_product_id}: ${(row.title || '').substring(0, 50)}`);
      }
    }
  }

  // 説明文がトップページの説明のものを確認
  const badDescriptions = await db.execute(sql`
    SELECT ps.asp_name, COUNT(*) as count
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.description LIKE '%アダルト動画・エロ動画ソクミル%'
      OR p.description LIKE '%人気のアダルトビデオを高画質・低価格%'
      OR p.description LIKE '%全作品無料のサンプル動画付き%'
    GROUP BY ps.asp_name
    ORDER BY count DESC
  `);

  console.log('\n=== トップページ説明文を持つ商品 ===');
  console.table(badDescriptions.rows);

  process.exit(0);
}

main().catch(console.error);
