/**
 * TMP系サイト（HEYDOUGA, X1X, ENKOU55, UREKKO）の
 * サムネイルURLがNULLの商品を修復するスクリプト
 *
 * 実行: npx tsx scripts/fix-tmp-thumbnails.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// .envファイルを手動で読み込む
function loadEnv() {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  const envPath = path.resolve(__dirname, '../.env');
  const targetPath = fs.existsSync(envLocalPath) ? envLocalPath : envPath;

  if (!fs.existsSync(targetPath)) {
    console.error('.env or .env.local file not found');
    process.exit(1);
  }
  const content = fs.readFileSync(targetPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex);
      let value = trimmed.substring(eqIndex + 1);
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

loadEnv();

/**
 * ASPごとのサムネイルURL生成関数
 */
function generateThumbnailUrl(aspName: string, originalProductId: string): string | null {
  switch (aspName) {
    case 'HEYDOUGA': {
      // HEYDOUGA: {site_id}-{movie_id} -> https://www.heydouga.com/contents/{site_id}/{movie_id}/player_thumb.webp
      const [siteId, movieId] = originalProductId.split('-');
      if (!siteId || !movieId) return null;
      return `https://www.heydouga.com/contents/${siteId}/${movieId}/player_thumb.webp`;
    }

    case 'X1X': {
      // X1X: 6桁ID 117274 -> http://static.x1x.com/images/title/11/72/74/player.jpg
      const paddedId = originalProductId.padStart(6, '0');
      const aa = paddedId.slice(0, 2);
      const bb = paddedId.slice(2, 4);
      const cc = paddedId.slice(4, 6);
      return `http://static.x1x.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
    }

    case 'ENKOU55': {
      // ENKOU55: 6桁ID 118197 -> http://static.enkou55.com/images/title/11/81/97/player.jpg
      const paddedId = originalProductId.padStart(6, '0');
      const aa = paddedId.slice(0, 2);
      const bb = paddedId.slice(2, 4);
      const cc = paddedId.slice(4, 6);
      return `http://static.enkou55.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
    }

    case 'UREKKO': {
      // UREKKO: 6桁ID 116275 -> http://static.urekko.com/images/title/11/62/75/player.jpg
      const paddedId = originalProductId.padStart(6, '0');
      const aa = paddedId.slice(0, 2);
      const bb = paddedId.slice(2, 4);
      const cc = paddedId.slice(4, 6);
      return `http://static.urekko.com/images/title/${aa}/${bb}/${cc}/player.jpg`;
    }

    case 'TVDEAV': {
      // TVDEAV: n2018 -> https://tvdeav.com/media/product/n2018/list_image/_v/160x240_default.jpg
      return `https://tvdeav.com/media/product/${originalProductId}/list_image/_v/160x240_default.jpg`;
    }

    default:
      return null;
  }
}

async function fixThumbnails() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🔧 TMP系サムネイル修復スクリプトを開始...\n');

    // 対象ASP
    const targetAsps = ['HEYDOUGA', 'X1X', 'ENKOU55', 'UREKKO', 'TVDEAV'];

    for (const aspName of targetAsps) {
      console.log(`\n=== ${aspName} の修復 ===`);

      // 全商品を取得（既存URLも正しいパターンに修正）
      const result = await pool.query(`
        SELECT p.id, p.normalized_product_id, ps.original_product_id, p.default_thumbnail_url
        FROM products p
        JOIN product_sources ps ON p.id = ps.product_id
        WHERE ps.asp_name = $1
      `, [aspName]);

      console.log(`  対象商品: ${result.rows.length}件`);

      if (result.rows.length === 0) {
        continue;
      }

      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const row of result.rows) {
        const thumbnailUrl = generateThumbnailUrl(aspName, row.original_product_id);

        if (!thumbnailUrl) {
          console.log(`  ⚠️ URL生成失敗: ${row.original_product_id}`);
          failed++;
          continue;
        }

        // 既に正しいURLなら更新しない
        if (row.default_thumbnail_url === thumbnailUrl) {
          skipped++;
          continue;
        }

        try {
          await pool.query(`
            UPDATE products
            SET default_thumbnail_url = $1, updated_at = NOW()
            WHERE id = $2
          `, [thumbnailUrl, row.id]);
          updated++;
          if (updated <= 3) {
            console.log(`    ${row.original_product_id}: ${row.default_thumbnail_url || 'NULL'} -> ${thumbnailUrl}`);
          }
        } catch (err) {
          console.error(`  ❌ 更新失敗: ${row.id}`, err);
          failed++;
        }
      }

      console.log(`  ✅ 更新: ${updated}件, スキップ: ${skipped}件, 失敗: ${failed}件`);
    }

    // 修復後の統計を表示
    console.log('\n=== 修復後の統計 ===');
    for (const aspName of targetAsps) {
      const stats = await pool.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN p.default_thumbnail_url IS NOT NULL THEN 1 ELSE 0 END) as with_thumb
        FROM products p
        JOIN product_sources ps ON p.id = ps.product_id
        WHERE ps.asp_name = $1
      `, [aspName]);

      const row = stats.rows[0];
      console.log(`${aspName}: 合計 ${row.total}, サムネイルあり ${row.with_thumb}`);
    }

    console.log('\n✅ 修復完了');

  } finally {
    await pool.end();
  }
}

fixThumbnails().catch(console.error);
