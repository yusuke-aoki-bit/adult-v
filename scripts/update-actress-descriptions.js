/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 女優の説明文を更新するスクリプト
 * 
 * 「APEXアフィリエイトCSVから取得した女優情報です。」や
 * 「DUGAアフィリエイトCSVから取得した女優情報です。」を削除
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== 女優説明文更新スクリプト ===\n');

// 説明文に「アフィリエイトCSVから取得した女優情報です。」が含まれる女優を検索
const actresses = db.prepare("SELECT id, name, description FROM actresses WHERE description LIKE '%アフィリエイトCSVから取得した女優情報です。%'").all();

if (actresses.length === 0) {
  console.log('更新が必要な女優が見つかりませんでした。');
  db.close();
  process.exit(0);
}

console.log(`更新対象: ${actresses.length}件\n`);

// トランザクション開始
const update = db.transaction(() => {
  for (const actress of actresses) {
    // 「アフィリエイトCSVから取得した女優情報です。」を削除
    let newDescription = actress.description
      .replace(/DUGAアフィリエイトCSVから取得した女優情報です。/, '')
      .replace(/APEXアフィリエイトCSVから取得した女優情報です。/, '')
      .replace(/アフィリエイトCSVから取得した女優情報です。/, '')
      .trim();
    
    // 末尾の句点や余分なスペースを削除
    newDescription = newDescription.replace(/[。、]+$/, '').trim();
    
    console.log(`更新中: ${actress.name}`);
    console.log(`  旧: ${actress.description}`);
    console.log(`  新: ${newDescription}`);
    
    db.prepare('UPDATE actresses SET description = ? WHERE id = ?').run(newDescription, actress.id);
    console.log('  ✓ 更新しました\n');
  }
});

try {
  update();
  console.log('更新が完了しました！');
} catch (error) {
  console.error('更新エラー:', error);
  process.exit(1);
}

db.close();

