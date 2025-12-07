/**
 * DTI系サービスの通貨をUSDに修正
 * カリビアンコムプレミアム、HEYZO等はドル建て
 */

import { db } from '../../lib/db/index.js';
import { sql } from 'drizzle-orm';

const DTI_SERVICES = [
  'カリビアンコム',
  'カリビアンコムプレミアム',
  '一本道',
  'HEYZO',
  '天然むすめ',
  'パコパコママ',
  'ムラムラ',
  '人妻斬り',
  '金髪天國',
];

async function main() {
  console.log('=== DTI通貨修正 (JPY -> USD) ===\n');

  // 現在の状態確認
  const before = await db.execute(sql`
    SELECT asp_name, currency, COUNT(*) as count
    FROM product_sources
    WHERE asp_name IN ('カリビアンコム', 'カリビアンコムプレミアム', '一本道', 'HEYZO', '天然むすめ', 'パコパコママ', 'ムラムラ', '人妻斬り', '金髪天國')
    GROUP BY asp_name, currency
    ORDER BY asp_name
  `);
  console.log('Before:');
  for (const row of before.rows as any[]) {
    console.log(`  ${row.asp_name}: ${row.currency} (${row.count})`);
  }

  // 通貨をUSDに更新
  for (const serviceName of DTI_SERVICES) {
    const result = await db.execute(sql`
      UPDATE product_sources
      SET currency = 'USD', is_subscription = true
      WHERE asp_name = ${serviceName}
    `);
    console.log(`Updated ${serviceName}: ${result.rowCount} rows`);
  }

  // 更新後の確認
  const after = await db.execute(sql`
    SELECT asp_name, currency, is_subscription, COUNT(*) as count
    FROM product_sources
    WHERE asp_name IN ('カリビアンコム', 'カリビアンコムプレミアム', '一本道', 'HEYZO', '天然むすめ', 'パコパコママ', 'ムラムラ', '人妻斬り', '金髪天國')
    GROUP BY asp_name, currency, is_subscription
    ORDER BY asp_name
  `);
  console.log('\nAfter:');
  for (const row of after.rows as any[]) {
    console.log(`  ${row.asp_name}: ${row.currency} (subscription: ${row.is_subscription}, ${row.count})`);
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
