/**
 * wiki_crawl_dataのデバッグ用スクリプト
 */

import { getDb } from '../../lib/db';
import { products, productPerformers, performers } from '../../lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { extractProductCodes, getPerformersFromWikiCrawlData } from '../../lib/crawler-utils';

const db = getDb();

async function main() {
  const productCode = process.argv[2] || 'MFCS-191';

  console.log(`=== ${productCode} のデバッグ情報 ===\n`);

  // 1. 品番から生成される検索パターン
  const searchCodes = extractProductCodes(productCode);
  console.log('1. 生成される検索パターン:');
  searchCodes.forEach(code => console.log(`   - ${code}`));

  // 2. wiki_crawl_dataから検索
  console.log('\n2. wiki_crawl_data検索:');
  const wikiPerformers = await getPerformersFromWikiCrawlData(db, productCode);
  if (wikiPerformers.length > 0) {
    console.log(`   ✓ 見つかった演者: ${wikiPerformers.join(', ')}`);
  } else {
    console.log('   ✗ wiki_crawl_dataに該当データなし');

    // wiki_crawl_dataの全体数を確認
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM wiki_crawl_data`);
    console.log(`   (wiki_crawl_data総レコード数: ${(countResult.rows[0] as { count: number }).count})`);

    // 「黒島玲衣」のデータがあるか検索
    console.log('\n   黒島玲衣の検索:');
    const kuroResult = await db.execute(sql`SELECT product_code, performer_name FROM wiki_crawl_data WHERE performer_name LIKE '%黒島%' LIMIT 5`);
    if (kuroResult.rows.length > 0) {
      kuroResult.rows.forEach((row) => {
        const r = row as { product_code: string; performer_name: string };
        console.log(`   - ${r.product_code}: ${r.performer_name}`);
      });
    } else {
      console.log('   黒島玲衣の情報なし');
    }
  }

  // 3. 商品の現在の演者紐付けを確認
  console.log('\n3. 現在の商品・演者紐付け:');

  // 品番で商品を検索
  const [product] = await db
    .select({
      id: products['id'],
      normalizedProductId: products.normalizedProductId,
      title: products['title'],
    })
    .from(products)
    .where(sql`UPPER(${products.normalizedProductId}) = ANY(ARRAY[${sql.join(searchCodes.map(c => sql`${c.toUpperCase()}`), sql`, `)}]::text[])`)
    .limit(1);

  if (product) {
    console.log(`   商品ID: ${product['id']}`);
    console.log(`   品番: ${product.normalizedProductId}`);
    console.log(`   タイトル: ${product['title']}`);

    const currentPerformers = await db
      .select({ name: performers['name'] })
      .from(productPerformers)
      .innerJoin(performers, eq(productPerformers.performerId, performers['id']))
      .where(eq(productPerformers.productId, product['id']));

    if (currentPerformers.length > 0) {
      console.log(`   現在の演者: ${currentPerformers.map(p => p.name).join(', ')}`);
    } else {
      console.log('   現在の演者: (なし)');
    }
  } else {
    console.log('   ✗ 商品が見つかりません');
  }

  console.log('\n=== 完了 ===');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
