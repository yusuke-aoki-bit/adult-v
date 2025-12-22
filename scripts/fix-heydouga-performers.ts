/**
 * HEYDOUGAの既存商品に演者を紐づけするスクリプト
 *
 * 使い方:
 * npx tsx scripts/fix-heydouga-performers.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

function loadEnv() {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  const content = fs.readFileSync(envLocalPath, 'utf-8');
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

// 演者名バリデーション（簡易版）
function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  // 数字のみ、記号のみ、一般的な除外ワードをスキップ
  const invalidPatterns = [
    /^\d+$/,
    /^(new|sale|off|pt|coin|ポイント|円|分|秒|動画|作品|人気|新作)$/i,
    /^(再生|配信|収録|無料|サンプル|特典)$/,
  ];
  return !invalidPatterns.some(pattern => pattern.test(name));
}

// 演者名の正規化
function normalizePerformerName(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .trim();
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Cookie': 'adc=1',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

function extractPerformersFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const performers: string[] = [];

  // HEYDOUGAはimg.nomovieのalt属性から演者名を抽出
  $('section.movie-player img.nomovie, .movie-player img').each((_, el) => {
    const name = $(el).attr('alt')?.trim();
    if (name && isValidPerformerName(name)) {
      const normalized = normalizePerformerName(name);
      if (!performers.includes(normalized)) {
        performers.push(normalized);
      }
    }
  });

  return performers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  try {
    console.log('🔧 HEYDOUGA演者紐づけ修復スクリプトを開始...\n');

    // 演者紐づけがないHEYDOUGA商品を取得
    const result = await pool.query(`
      SELECT p.id, ps.original_product_id
      FROM products p
      JOIN product_sources ps ON p.id = ps.product_id
      LEFT JOIN product_performers pp ON p.id = pp.product_id
      WHERE ps.asp_name = 'HEYDOUGA'
        AND pp.product_id IS NULL
      ORDER BY p.id
    `);

    console.log(`対象商品: ${result.rows.length}件\n`);

    if (result.rows.length === 0) {
      console.log('演者紐づけが必要な商品はありません');
      return;
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of result.rows) {
      const [providerId, movieId] = row.original_product_id.split('-');
      const url = `https://www.heydouga.com/moviepages/${providerId}/${movieId}/index.html`;

      // レート制限
      await sleep(2000 + Math.random() * 1000);

      const html = await fetchPage(url);
      if (!html) {
        failed++;
        continue;
      }

      const performers = extractPerformersFromHtml(html);

      if (performers.length === 0) {
        skipped++;
        continue;
      }

      // 演者を登録・紐づけ
      for (const performerName of performers) {
        // 既存の演者を検索
        let performerResult = await pool.query(
          'SELECT id FROM performers WHERE name = $1',
          [performerName]
        );

        let performerId: number;

        if (performerResult.rows.length === 0) {
          // 新規演者作成
          const insertResult = await pool.query(
            'INSERT INTO performers (name, created_at) VALUES ($1, NOW()) RETURNING id',
            [performerName]
          );
          performerId = insertResult.rows[0].id;
        } else {
          performerId = performerResult.rows[0].id;
        }

        // 商品-演者紐づけ
        await pool.query(
          'INSERT INTO product_performers (product_id, performer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [row.id, performerId]
        );
      }

      updated++;
      console.log(`  ✅ ${row.original_product_id}: ${performers.join(', ')}`);

      // 進捗表示
      if (updated % 10 === 0) {
        console.log(`\n  進捗: ${updated + skipped + failed}/${result.rows.length}\n`);
      }
    }

    console.log('\n========================================');
    console.log('修復完了');
    console.log(`  更新: ${updated}件`);
    console.log(`  スキップ（演者なし）: ${skipped}件`);
    console.log(`  失敗: ${failed}件`);
    console.log('========================================\n');

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
