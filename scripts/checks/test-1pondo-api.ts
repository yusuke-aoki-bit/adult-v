import { getDb } from '../../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();

  // 一本道の具体的なproduct_idを取得
  const products = await db.execute(sql`
    SELECT p.normalized_product_id, ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
    AND p.normalized_product_id LIKE '一本道-%'
    LIMIT 5
  `);

  console.log('=== 一本道商品サンプル ===');
  for (const row of products.rows as any[]) {
    console.log('normalized:', row.normalized_product_id, '| original:', row.original_product_id);

    // normalized_product_idからproduct_idを抽出
    const match = row.normalized_product_id.match(/^一本道-(.+)$/);
    if (match) {
      const productId = match[1];
      console.log('  抽出ID:', productId);

      // 一本道APIをテスト
      const apiUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${productId}.json`;
      console.log('  API URL:', apiUrl);

      try {
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        console.log('  Status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('  ActressesJa:', data.ActressesJa);
          console.log('  Title:', data.Title);
        } else {
          const text = await response.text();
          console.log('  Response:', text.substring(0, 200));
        }
      } catch (e: any) {
        console.log('  Error:', e.message);
      }
    }
    console.log('');
  }

  process.exit(0);
}

main();
