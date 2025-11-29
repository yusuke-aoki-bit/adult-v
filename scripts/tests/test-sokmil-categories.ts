import { SokmilClient } from '../lib/providers/sokmil-client';
import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const client = new SokmilClient({
    apiKey: process.env.SOKMIL_API_KEY || '',
    affiliateId: '47418-001'
  });

  console.log('=== ����APIƹ�: �ƴ���X ===\n');

  const response = await client.getNewReleases(1, 3);
  console.log(`取得した商品数: ${response.data.length}\n`);

  for (const item of response.data) {
    const genreCount = item.genres ? item.genres.length : 0;
    console.log(`商品ID: ${item.itemId}`);
    console.log(`タイトル: ${item.itemName}`);
    console.log(`ジャンル数: ${genreCount}`);

    if (item.genres && item.genres.length > 0) {
      console.log('  ����:');
      for (const genre of item.genres) {
        console.log(`    - ${genre.name}`);

        // �ƴ���DBk�X
        const categoryResult = await db.execute(sql`
          INSERT INTO categories (name)
          VALUES (${genre.name})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);

        const categoryId = (categoryResult.rows[0] as any).id;
        console.log(`      �ƴ��ID: ${categoryId}`);
      }
    }
    console.log('');
  }

  console.log(' �ƴ���XƹȌ�\n');

  // �ƴ������n�p��
  const count = await db.execute(sql`SELECT COUNT(*) as count FROM categories`);
  console.log(`�ƴ��������p: ${(count.rows[0] as any).count}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('���:', error);
  process.exit(1);
});
