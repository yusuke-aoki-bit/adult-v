/**
 * HEYZO/DTI raw_html_data を再処理して出演者情報を抽出するスクリプト
 *
 * 既存のprocess-raw-data APIでは出演者抽出がなかったHEYZO/DTI HTMLを
 * 再処理して performers と product_performers テーブルを更新する
 *
 * 使用法:
 * DATABASE_URL="..." npx tsx scripts/reprocess-heyzo-performers.ts [--limit=N]
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  isValidPerformerName,
  normalizePerformerName,
} from '../lib/performer-validation';

const db = getDb();

interface RawHtmlRow {
  id: number;
  source: string;
  product_id: string;
  html_content: string;
  url?: string;
}

interface Stats {
  processed: number;
  performersExtracted: number;
  linksCreated: number;
  errors: number;
  skipped: number;
}

/**
 * HTMLから出演者名を抽出
 */
function extractPerformers($: cheerio.CheerioAPI, source: string): string[] {
  const performerNames: string[] = [];

  // パターン1: <tr class="table-actor"> <td>出演</td> <td> <a href="..."><span>名前</span></a>
  $('tr.table-actor td a span, .table-actor a span').each((_, elem) => {
    const name = $(elem).text().trim();
    if (name && name.length > 1 && name.length < 30) {
      performerNames.push(name);
    }
  });

  // パターン2: 出演テーブル行から直接抽出
  if (performerNames.length === 0) {
    $('td:contains("出演")').next('td').find('a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        performerNames.push(name);
      }
    });
  }

  // パターン3: movieActress関連
  if (performerNames.length === 0) {
    $('[class*="actress"] a, [class*="actor"] a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        performerNames.push(name);
      }
    });
  }

  // パターン4: href="/actress/xxx" のリンク
  if (performerNames.length === 0) {
    $('a[href*="/actress/"]').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        performerNames.push(name);
      }
    });
  }

  // 重複を削除し、バリデーション
  const uniqueNames = [...new Set(performerNames)];
  return uniqueNames.filter((name) => {
    const normalized = normalizePerformerName(name);
    return normalized && isValidPerformerName(normalized);
  });
}

async function reprocessHeyzoPerformers() {
  console.log('=== HEYZO/DTI 出演者情報 再処理スクリプト ===\n');

  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 1000;
  const dryRun = process.argv.includes('--dry-run');

  console.log(`設定: limit=${limit}, dryRun=${dryRun}\n`);

  const stats: Stats = {
    processed: 0,
    performersExtracted: 0,
    linksCreated: 0,
    errors: 0,
    skipped: 0,
  };

  // 1. HEYZO/DTI系のソース確認
  console.log('【1】HEYZO/DTI系 raw_html_data の状況確認');
  const sources = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM raw_html_data
    WHERE source ILIKE '%heyzo%'
       OR source ILIKE '%1pondo%'
       OR source ILIKE '%caribbeancom%'
       OR source ILIKE '%カリビアンコム%'
       OR source ILIKE '%hey動画%'
    GROUP BY source
    ORDER BY count DESC
  `);
  console.table(sources.rows);

  // 2. 処理対象: 出演者が未登録の商品に紐づくraw_html_data
  console.log('\n【2】出演者未登録の商品を再処理...');

  // normalized_product_idを使って商品IDを取得
  const rawDataResult = await db.execute(sql`
    SELECT rhd.id, rhd.source, rhd.product_id, rhd.html_content, rhd.url
    FROM raw_html_data rhd
    INNER JOIN product_sources ps ON (
      (ps.original_product_id = rhd.product_id AND ps.asp_name = 'DTI')
      OR (ps.original_product_id = rhd.product_id)
    )
    INNER JOIN products p ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON pp.product_id = p.id
    WHERE (rhd.source ILIKE '%heyzo%'
       OR rhd.source ILIKE '%1pondo%'
       OR rhd.source ILIKE '%caribbeancom%'
       OR rhd.source ILIKE '%カリビアンコム%'
       OR rhd.source ILIKE '%hey動画%')
      AND pp.product_id IS NULL
    LIMIT ${limit}
  `);

  const rawDataRows = rawDataResult.rows as unknown as RawHtmlRow[];
  console.log(`処理対象: ${rawDataRows.length}件\n`);

  for (const row of rawDataRows) {
    try {
      stats.processed++;

      const $ = cheerio.load(row.html_content);
      const performerNames = extractPerformers($, row.source);

      if (performerNames.length === 0) {
        stats.skipped++;
        continue;
      }

      console.log(
        `[${stats.processed}/${rawDataRows.length}] ${row.source} / ${row.product_id}: ${performerNames.join(', ')}`
      );

      if (dryRun) {
        stats.performersExtracted += performerNames.length;
        continue;
      }

      // 商品IDを取得
      const productResult = await db.execute(sql`
        SELECT ps.product_id
        FROM product_sources ps
        WHERE ps.original_product_id = ${row.product_id}
          AND ps.asp_name IN ('DTI', 'HEYZO')
        LIMIT 1
      `);

      if (productResult.rows.length === 0) {
        // DTIでなければ別の方法で検索
        const altProductResult = await db.execute(sql`
          SELECT p.id as product_id
          FROM products p
          WHERE p.normalized_product_id LIKE ${'%' + row.product_id}
          LIMIT 1
        `);
        if (altProductResult.rows.length === 0) {
          stats.skipped++;
          continue;
        }
      }

      const productId = (
        (productResult.rows[0] as { product_id: number }) ||
        (await db
          .execute(
            sql`
          SELECT p.id as product_id FROM products p
          WHERE p.normalized_product_id LIKE ${'%' + row.product_id}
          LIMIT 1
        `
          )
          .then((r) => r.rows[0] as { product_id: number }))
      )?.product_id;

      if (!productId) {
        stats.skipped++;
        continue;
      }

      // 出演者を登録
      for (const performerName of performerNames) {
        const normalized = normalizePerformerName(performerName);
        if (!normalized) continue;

        // performers テーブルにupsert
        const performerResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${normalized})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);
        const performerId = (performerResult.rows[0] as { id: number }).id;
        stats.performersExtracted++;

        // product_performers テーブルにリンク
        const linkResult = await db.execute(sql`
          INSERT INTO product_performers (product_id, performer_id)
          VALUES (${productId}, ${performerId})
          ON CONFLICT DO NOTHING
          RETURNING product_id
        `);

        if (linkResult.rowCount && linkResult.rowCount > 0) {
          stats.linksCreated++;
        }
      }
    } catch (error) {
      stats.errors++;
      console.error(`Error processing id=${row.id}:`, error);
    }
  }

  console.log('\n=== 処理結果 ===');
  console.table([stats]);

  if (dryRun) {
    console.log(
      '\n⚠️  DRY RUN モード。実際に保存するには --dry-run を外して実行してください'
    );
  }

  process.exit(0);
}

reprocessHeyzoPerformers().catch((error) => {
  console.error('❌ エラー:', error);
  process.exit(1);
});
