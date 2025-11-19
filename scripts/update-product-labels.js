/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 商品のproviderLabelとctaLabelを更新するスクリプト
 * 
 * 「APEX（CSV）」→「DUGA（CSV）」
 * 「APEX公式で見る」→「DUGA公式で見る」
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== 商品ラベル更新スクリプト ===\n');

// 更新対象の商品を検索
const products = db.prepare(`
  SELECT id, title, provider_label, cta_label 
  FROM products 
  WHERE provider_label LIKE '%APEX%' OR cta_label LIKE '%APEX%'
`).all();

if (products.length === 0) {
  console.log('更新が必要な商品が見つかりませんでした。');
  db.close();
  process.exit(0);
}

console.log(`更新対象: ${products.length}件\n`);

// トランザクション開始
const update = db.transaction(() => {
  for (const product of products) {
    let newProviderLabel = product.provider_label;
    let newCtaLabel = product.cta_label;
    let updated = false;

    // providerLabelの更新
    if (product.provider_label && product.provider_label.includes('APEX')) {
      newProviderLabel = product.provider_label
        .replace(/APEX（CSV）/g, 'DUGA（CSV）')
        .replace(/APEX \(CSV\)/g, 'DUGA（CSV）')
        .replace(/APEX/g, 'DUGA');
      updated = true;
    }

    // ctaLabelの更新
    if (product.cta_label && product.cta_label.includes('APEX')) {
      newCtaLabel = product.cta_label
        .replace(/APEX公式で見る/g, 'DUGA公式で見る')
        .replace(/APEXで視聴/g, 'DUGA公式で見る')
        .replace(/APEX/g, 'DUGA');
      updated = true;
    }

    if (updated) {
      console.log(`更新中: ${product.title}`);
      if (product.provider_label !== newProviderLabel) {
        console.log(`  providerLabel: "${product.provider_label}" → "${newProviderLabel}"`);
      }
      if (product.cta_label !== newCtaLabel) {
        console.log(`  ctaLabel: "${product.cta_label}" → "${newCtaLabel}"`);
      }
      
      db.prepare(`
        UPDATE products 
        SET provider_label = ?, cta_label = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(newProviderLabel, newCtaLabel, product.id);
      console.log('  ✓ 更新しました\n');
    }
  }
});

try {
  update();
  console.log('更新が完了しました！');
  
  // 確認: 残っているAPEXの数を確認
  const remaining = db.prepare(`
    SELECT COUNT(*) as count 
    FROM products 
    WHERE provider_label LIKE '%APEX%' OR cta_label LIKE '%APEX%'
  `).get();
  console.log(`\n残っているAPEXを含む商品: ${remaining.count}件`);
} catch (error) {
  console.error('更新エラー:', error);
  process.exit(1);
}

db.close();

