/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * CSVデータをデータベースにインポートするスクリプト
 * Usage: node scripts/import-csv-to-db.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const apexJsonPath = path.join(__dirname, '..', 'data', 'apex.json');

function main() {
  console.log('=== CSVデータをデータベースにインポート ===\n');

  // データベースファイルが存在しない場合は作成
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // テーブル作成
  console.log('テーブルを作成中...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      affiliate_url TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_label TEXT NOT NULL,
      actress_id TEXT,
      actress_name TEXT,
      release_date TEXT,
      duration INTEGER,
      format TEXT,
      rating REAL,
      review_count INTEGER,
      review_highlight TEXT,
      cta_label TEXT,
      tags TEXT,
      is_featured INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      discount INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS category_idx ON products(category);
    CREATE INDEX IF NOT EXISTS provider_idx ON products(provider);
    CREATE INDEX IF NOT EXISTS actress_id_idx ON products(actress_id);
    CREATE INDEX IF NOT EXISTS is_featured_idx ON products(is_featured);
    CREATE INDEX IF NOT EXISTS is_new_idx ON products(is_new);
    CREATE INDEX IF NOT EXISTS release_date_idx ON products(release_date);

    CREATE TABLE IF NOT EXISTS actresses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      catchcopy TEXT,
      description TEXT,
      hero_image TEXT,
      thumbnail TEXT,
      primary_genres TEXT,
      services TEXT,
      release_count INTEGER DEFAULT 0,
      trending_score INTEGER DEFAULT 0,
      fan_score INTEGER DEFAULT 0,
      highlight_works TEXT,
      tags TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS name_idx ON actresses(name);
    CREATE INDEX IF NOT EXISTS trending_score_idx ON actresses(trending_score);
    CREATE INDEX IF NOT EXISTS release_count_idx ON actresses(release_count);
  `);

  // apex.jsonを読み込み
  if (!fs.existsSync(apexJsonPath)) {
    console.error(`[import-csv-to-db] apex.json not found: ${apexJsonPath}`);
    console.error('先に node scripts/convert-apex.js を実行してください。');
    process.exit(1);
  }

  const apexData = JSON.parse(fs.readFileSync(apexJsonPath, 'utf-8'));
  console.log(`データ読み込み: ${apexData.length}件\n`);

  // 既存データを削除
  console.log('既存データを削除中...');
  db.exec("DELETE FROM products WHERE provider = 'duga'");
  db.exec("DELETE FROM actresses WHERE id LIKE 'duga-%'");

  // トランザクション開始
  const insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, title, description, category, price, affiliate_url,
      provider, provider_label, actress_id, actress_name, release_date,
      image_url, tags, is_featured, is_new, review_highlight, cta_label,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `);

  const insertMany = db.transaction((products) => {
    for (const product of products) {
      try {
        const actressName = product.actress || product.actressName || null;
        // 女優IDはプロバイダープレフィックスなし（今後他プロバイダーとの統合を考慮）
        const actressId = actressName && actressName !== '---' ? actressName.toLowerCase().replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-').replace(/^-+|-+$/g, '') : null;
        
        insertProduct.run(
          product.id,
          product.title || '',
          product.description || null,
          product.category || 'premium',
          parseInt(product.price || '0', 10) || 0,
          product.url || '#',
          'duga',
          'DUGA（CSV）',
          actressId,
          actressName && actressName !== '---' ? actressName : null,
          product.releaseDate || null,
          null, // image_urlは後で生成
          product.category ? JSON.stringify([product.category]) : null,
          0, // is_featured
          0, // is_new
          product.description ? `${product.description.slice(0, 70)}…` : null,
          'DUGA公式で見る',
        );
      } catch (error) {
        console.error(`エラー: 商品ID ${product.id} のインポートに失敗:`, error.message);
      }
    }
  });

  // バッチ処理でインポート
  const BATCH_SIZE = 1000;
  let imported = 0;

  for (let i = 0; i < apexData.length; i += BATCH_SIZE) {
    const batch = apexData.slice(i, i + BATCH_SIZE);
    insertMany(batch);
    imported += batch.length;
    console.log(`インポート中: ${imported}/${apexData.length}件 (${Math.round((imported / apexData.length) * 100)}%)`);
  }

  // 画像URLを更新（商品IDから生成）
  console.log('\n画像URLを更新中...');
  const updateImageUrl = db.prepare(`
    UPDATE products
    SET image_url = ?
    WHERE id = ?
  `);

  const updateManyImages = db.transaction((productIds) => {
    for (const productId of productIds) {
      const parts = productId.split('-');
      if (parts.length >= 2) {
        const series = parts[0];
        const number = parts.slice(1).join('-');
        const imageUrl = `https://pic.duga.jp/unsecure/${series}/${number}/noauth/240x180.jpg`;
        updateImageUrl.run(imageUrl, productId);
      }
    }
  });

  const productIds = apexData.map((p) => p.id);
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);
    updateManyImages(batch);
  }

  // 女優データを生成（データベースから抽出）
  console.log('\n女優データを生成中...');
  const actressMap = new Map();
  
  // データベースからDUGA商品の女優情報を取得
  const apexProductsFromDb = db.prepare("SELECT actress_name, GROUP_CONCAT(id) as product_ids, COUNT(*) as product_count FROM products WHERE provider = 'duga' AND actress_name IS NOT NULL AND actress_name != '' AND actress_name != '---' GROUP BY actress_name").all();
  
  apexProductsFromDb.forEach((row) => {
    const name = row.actress_name.trim();
    if (name) {
      actressMap.set(name, {
        name,
        productCount: row.product_count,
        products: row.product_ids ? row.product_ids.split(',') : [],
      });
    }
  });

  // プロバイダープレフィックス付きIDを削除（移行対応）
  const deleteOldActresses = db.prepare("DELETE FROM actresses WHERE id LIKE 'duga-%' OR id LIKE 'apex-%'");
  deleteOldActresses.run();

  const insertActress = db.prepare(`
    INSERT OR REPLACE INTO actresses (
      id, name, catchcopy, description, hero_image, thumbnail,
      primary_genres, services, release_count, trending_score, fan_score,
      highlight_works, tags, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
  `);

  actressMap.forEach(({ name, productCount, products: productList }) => {
    // 女優IDはプロバイダープレフィックスなし（今後他プロバイダーとの統合を考慮）
    const actressId = name.toLowerCase().replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-').replace(/^-+|-+$/g, '');
    const initials = name.slice(0, 2);
    const thumbnail = `https://placehold.co/400x520/052e16/ffffff?text=${encodeURIComponent(initials)}`;

    const trendingScore = Math.min(100, 50 + productCount * 2);
    const fanScore = Math.min(100, 60 + productCount * 1.5);
    const catchcopy = productCount >= 10 ? '人気女優' : productCount >= 5 ? '注目の女優' : '新進女優';
      const description = `${productCount}作品をリリース。`;

    insertActress.run(
      actressId,
      name,
      catchcopy,
      description,
      thumbnail,
      thumbnail,
      JSON.stringify(['premium']),
      JSON.stringify(['duga']),
      productCount,
      Math.round(trendingScore),
      Math.round(fanScore),
      JSON.stringify(productList.slice(0, 3)),
      productCount >= 20 ? JSON.stringify(['人気', '多数作品']) : productCount >= 10 ? JSON.stringify(['注目']) : JSON.stringify([]),
    );
  });

  console.log(`女優データ: ${actressMap.size}件を生成しました\n`);

  // 統計情報
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  const actressCount = db.prepare('SELECT COUNT(*) as count FROM actresses').get();

  console.log('=== インポート完了 ===');
  console.log(`商品数: ${productCount.count}件`);
  console.log(`女優数: ${actressCount.count}件`);
  console.log(`データベース: ${dbPath}`);

  db.close();
}

main();

