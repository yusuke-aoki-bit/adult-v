/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CSVファイルの取り込み状況を確認するスクリプト
 */

const fs = require('fs');
const path = require('path');

console.log('=== CSV取り込み状況チェック ===\n');

// 1. CSVファイルの確認
const csvPath = path.join(__dirname, '..', 'data', 'apex.csv');
if (fs.existsSync(csvPath)) {
  const csvContent = fs.readFileSync(csvPath);
  const lines = csvContent.toString().split('\n').filter((l) => l.trim());
  console.log(`✓ CSVファイル存在: ${csvPath}`);
  console.log(`  行数: ${lines.length - 1} (ヘッダー除く)\n`);
} else {
  console.log(`✗ CSVファイルが見つかりません: ${csvPath}\n`);
}

// 2. apex.tsファイルの確認
const apexTsPath = path.join(__dirname, '..', 'data', 'apex.ts');
if (fs.existsSync(apexTsPath)) {
  const apexTsContent = fs.readFileSync(apexTsPath, 'utf-8');
  const dataMatch = apexTsContent.match(/export const apexData = \[([\s\S]*)\];/);
  if (dataMatch) {
    // 配列内のオブジェクト数をカウント
    const objectCount = (dataMatch[1].match(/\{/g) || []).length;
    console.log(`✓ apex.tsファイル存在: ${apexTsPath}`);
    console.log(`  データ件数: ${objectCount}\n`);
  } else {
    console.log(`⚠ apex.tsファイルにデータが見つかりません\n`);
  }
} else {
  console.log(`✗ apex.tsファイルが見つかりません: ${apexTsPath}\n`);
}

// 3. apex.tsファイルのサンプルデータ表示
if (fs.existsSync(apexTsPath)) {
  const apexTsContent = fs.readFileSync(apexTsPath, 'utf-8');
  const firstProductMatch = apexTsContent.match(/"id":\s*"([^"]+)"/);
  if (firstProductMatch) {
    console.log(`  最初の商品ID: ${firstProductMatch[1]}`);
  }
  
  // 最後の商品IDを探す
  const allProductIds = apexTsContent.match(/"id":\s*"([^"]+)"/g);
  if (allProductIds && allProductIds.length > 0) {
    const lastProductId = allProductIds[allProductIds.length - 1].match(/"([^"]+)"/)[1];
    console.log(`  最後の商品ID: ${lastProductId}`);
    console.log(`  総商品数（推定）: ${allProductIds.length}\n`);
  }
}

console.log('=== 確認完了 ===');


