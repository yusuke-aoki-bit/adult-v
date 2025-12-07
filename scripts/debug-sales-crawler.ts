/**
 * セールクローラーのデバッグスクリプト
 * 取得した商品IDがDBと一致するか確認
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { robustFetch } from '../lib/crawler';

async function main() {
  const db = getDb();

  console.log('=== セールクローラー デバッグ ===\n');

  // DUGAのセールページを取得
  console.log('DUGAセールページを取得中...');
  const response = await robustFetch('https://duga.jp/search/=/campaignid=sale/', {
    init: {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    },
    timeoutMs: 30000,
  });

  if (!response.ok) {
    console.error(`Failed to fetch: ${response.status}`);
    process.exit(1);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // セール商品IDを抽出
  const saleProductIds: string[] = [];

  // .contentslist内のpid属性を持つ要素
  $('.contentslist').each((_, el) => {
    const $item = $(el);
    const $hoverbox = $item.find('[pid]');
    if ($hoverbox.length > 0) {
      const productId = $hoverbox.attr('pid');
      if (productId && !saleProductIds.includes(productId)) {
        saleProductIds.push(productId);
      }
    }
  });

  // /ppv/リンクからも抽出
  $('a[href*="/ppv/"]').each((_, el) => {
    const link = $(el).attr('href');
    if (link) {
      const productIdMatch = link.match(/\/ppv\/([^\/\?]+)/);
      if (productIdMatch) {
        const productId = productIdMatch[1];
        if (!saleProductIds.includes(productId)) {
          saleProductIds.push(productId);
        }
      }
    }
  });

  console.log(`\n取得したセール商品ID数: ${saleProductIds.length}`);
  console.log('サンプル:');
  saleProductIds.slice(0, 10).forEach((id, i) => {
    console.log(`  ${i + 1}. ${id}`);
  });

  // DBの商品IDを確認
  console.log('\n--- DBの既存DUGA商品IDとの照合 ---');

  const dbDugaSample = await db.execute(sql`
    SELECT original_product_id
    FROM product_sources
    WHERE asp_name = 'DUGA'
    LIMIT 20
  `);

  console.log('\nDB内のDUGA商品IDサンプル:');
  (dbDugaSample.rows as { original_product_id: string }[]).forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.original_product_id}`);
  });

  // マッチするか確認
  if (saleProductIds.length > 0) {
    const saleIdsForQuery = saleProductIds.slice(0, 50);
    const matchResult = await db.execute(sql`
      SELECT original_product_id, price
      FROM product_sources
      WHERE asp_name = 'DUGA'
      AND original_product_id IN (${sql.join(saleIdsForQuery.map(id => sql`${id}`), sql`, `)})
    `);

    console.log(`\n--- マッチング結果 ---`);
    console.log(`チェック対象: ${saleIdsForQuery.length}件`);
    console.log(`マッチ数: ${matchResult.rows.length}件`);

    if (matchResult.rows.length > 0) {
      console.log('\nマッチした商品:');
      (matchResult.rows as { original_product_id: string; price: number | null }[])
        .slice(0, 5)
        .forEach((row, i) => {
          console.log(`  ${i + 1}. ${row.original_product_id} (価格: ${row.price ?? 'null'})`);
        });
    }

    // マッチしなかった商品IDを表示
    const matchedIds = new Set((matchResult.rows as { original_product_id: string }[]).map(r => r.original_product_id));
    const unmatchedIds = saleIdsForQuery.filter(id => !matchedIds.has(id));
    if (unmatchedIds.length > 0) {
      console.log(`\nマッチしなかった商品ID (先頭5件):`);
      unmatchedIds.slice(0, 5).forEach((id, i) => {
        console.log(`  ${i + 1}. ${id}`);
      });
    }
  }

  process.exit(0);
}

main().catch(console.error);
