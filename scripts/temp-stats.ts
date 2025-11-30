import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const db = getDb();
  
  const [totalProducts, withPerformers, withoutPerformers, totalPerformers] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM products`),
    db.execute(sql`SELECT COUNT(DISTINCT product_id) as count FROM product_performers`),
    db.execute(sql`SELECT COUNT(*) as count FROM products p LEFT JOIN product_performers pp ON p.id = pp.product_id WHERE pp.product_id IS NULL`),
    db.execute(sql`SELECT COUNT(*) as count FROM performers`)
  ]);
  
  console.log('\n=== 出演者名寄せ進捗 ===');
  console.log('総商品数:', (totalProducts.rows[0] as any).count);
  console.log('出演者紐付け済み:', (withPerformers.rows[0] as any).count);
  console.log('出演者未紐付け:', (withoutPerformers.rows[0] as any).count);
  console.log('登録出演者数:', (totalPerformers.rows[0] as any).count);
  
  const coverage = ((Number((withPerformers.rows[0] as any).count) / Number((totalProducts.rows[0] as any).count)) * 100).toFixed(2);
  console.log('カバレッジ:', coverage + '%');
  
  process.exit(0);
}
main();
