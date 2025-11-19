/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 女優IDをプロバイダープレフィックスなしに移行するスクリプト
 * 
 * 既存の 'duga-xxx' や 'apex-xxx' 形式のIDを 'xxx' 形式に変更します
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const db = new Database(dbPath);

console.log('=== 女優ID移行スクリプト ===\n');

// プロバイダープレフィックス付きIDを検索
const oldActresses = db.prepare("SELECT id, name FROM actresses WHERE id LIKE 'duga-%' OR id LIKE 'apex-%'").all();

if (oldActresses.length === 0) {
  console.log('移行が必要な女優が見つかりませんでした。');
  db.close();
  process.exit(0);
}

console.log(`移行対象: ${oldActresses.length}件\n`);

// トランザクション開始
const migrate = db.transaction(() => {
  for (const oldActress of oldActresses) {
    // プロバイダープレフィックスを除去
    const newId = oldActress.id.replace(/^(duga|apex)-/, '');
    
    console.log(`移行中: ${oldActress.id} -> ${newId}`);
    
    // 新しいIDが既に存在するか確認
    const existing = db.prepare('SELECT id FROM actresses WHERE id = ?').get(newId);
    
    if (existing) {
      console.log(`  ⚠️  ${newId} は既に存在します。商品のactress_idを更新します...`);
      
      // 商品テーブルのactress_idを更新
      db.prepare('UPDATE products SET actress_id = ? WHERE actress_id = ?').run(newId, oldActress.id);
      
      // 古い女優レコードを削除
      db.prepare('DELETE FROM actresses WHERE id = ?').run(oldActress.id);
      console.log(`  ✓ 商品のactress_idを更新し、古い女優レコードを削除しました`);
    } else {
      // 女優テーブルのIDを更新
      db.prepare('UPDATE actresses SET id = ? WHERE id = ?').run(newId, oldActress.id);
      
      // 商品テーブルのactress_idを更新
      db.prepare('UPDATE products SET actress_id = ? WHERE actress_id = ?').run(newId, oldActress.id);
      
      console.log(`  ✓ IDを更新しました`);
    }
  }
});

try {
  migrate();
  console.log('\n移行が完了しました！');
  
  // 移行後の確認
  const remaining = db.prepare("SELECT COUNT(*) as count FROM actresses WHERE id LIKE 'duga-%' OR id LIKE 'apex-%'").get();
  console.log(`残っているプレフィックス付きID: ${remaining.count}件\n`);
} catch (error) {
  console.error('移行エラー:', error);
  process.exit(1);
}

db.close();

