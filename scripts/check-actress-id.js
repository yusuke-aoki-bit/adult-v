const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

// 「波多野結衣」という名前の女優を検索
const actresses = db.prepare("SELECT id, name FROM actresses WHERE name LIKE '%波多野結衣%' LIMIT 10").all();

console.log('Found actresses:');
console.log(JSON.stringify(actresses, null, 2));

// URLのIDからデコードした名前でIDを生成（プロバイダープレフィックスなし）
const decoded = decodeURIComponent('%E6%B3%A2%E5%A4%9A%E9%87%8E%E7%B5%90%E8%A1%A3');
const generatedId = decoded.toLowerCase().replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-').replace(/^-+|-+$/g, '');

console.log('\nURLから生成されたID:', generatedId);

// そのIDで検索
const foundById = db.prepare('SELECT id, name FROM actresses WHERE id = ?').get(generatedId);
console.log('\nIDで検索結果:', foundById);

db.close();

