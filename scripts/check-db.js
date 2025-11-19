/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== データベース確認 ===\n');

const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
console.log(`商品数: ${productCount.count}件`);

const actressNameCount = db.prepare("SELECT COUNT(DISTINCT actress_name) as count FROM products WHERE provider = 'duga' AND actress_name IS NOT NULL AND actress_name != '' AND actress_name != '---'").get();
console.log(`女優名の数（商品テーブル内）: ${actressNameCount.count}件`);

const actressCount = db.prepare('SELECT COUNT(*) as count FROM actresses').get();
console.log(`女優テーブルのデータ数: ${actressCount.count}件\n`);

const sample = db.prepare("SELECT actress_name, COUNT(*) as cnt FROM products WHERE provider = 'duga' AND actress_name IS NOT NULL AND actress_name != '' AND actress_name != '---' GROUP BY actress_name LIMIT 5").all();
console.log('サンプル女優名:');
sample.forEach((row) => {
  console.log(`  ${row.actress_name}: ${row.cnt}件`);
});

db.close();


