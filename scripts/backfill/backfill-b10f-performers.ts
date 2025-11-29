/**
 * b10f商品に出演者を紐付けるバックフィルスクリプト
 *
 * ローカルCSVファイル(tmp/b10f-latest.csv)から出演者情報を取得し、
 * affiliate_urlのIDでマッチングして紐付けを行う
 */

import { getDb } from '../lib/db';
import { performers, productPerformers } from '../lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const db = getDb();

// 無効な女優名のパターン
const INVALID_PATTERNS = [
  /^[0-9]+$/,
  /^[a-zA-Z0-9_-]+$/,
  /^素人/,
  /企画/,
  /^他$/,
  /^→/,
  /^[ぁ-ん]$/,
  /^[ァ-ヶ]$/,
  /^[一-龯]$/,
  /^-$/,
  /^---$/,
];

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (name.length > 50) return false;
  if (name === '-' || name === '---' || name === 'N/A') return false;

  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

interface B10fProduct {
  productId: string;
  performers: string;
}

function parseCsv(csv: string): B10fProduct[] {
  const lines = csv.split('\n');
  const products: B10fProduct[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split(',');
    if (fields.length < 13) continue;

    products.push({
      productId: fields[0],
      performers: fields[12],
    });
  }

  return products;
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch (error) {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10000');

  console.log('=== b10f 出演者紐付けバックフィル ===\n');

  // 1. ローカルCSVファイルを読み込み
  const csvPath = path.join(process.cwd(), 'tmp', 'b10f-latest.csv');
  console.log(`📥 CSVファイルを読み込み中: ${csvPath}\n`);

  if (!fs.existsSync(csvPath)) {
    console.log('❌ CSVファイルがありません。crawl-b10f-csv.tsを先に実行してください。');
    process.exit(1);
  }

  const csvData = fs.readFileSync(csvPath, 'utf-8');
  console.log(`✅ CSVデータ読み込み完了: ${csvData.length}バイト\n`);

  // 2. CSVをパース
  const allProducts = parseCsv(csvData);
  console.log(`✅ パース完了: ${allProducts.length}件の商品\n`);

  // 3. CSVデータをマップ化
  console.log('📊 CSVデータをマップ化中...\n');
  const csvMap = new Map<string, string>();
  for (const p of allProducts) {
    if (p.performers && p.performers.trim()) {
      csvMap.set(p.productId, p.performers);
    }
  }
  console.log(`✅ 出演者情報ありの商品: ${csvMap.size}件\n`);

  // 4. 未紐付きb10f商品を取得（affiliate_urlからIDを抽出）
  console.log('🔍 未紐付き商品を検索中...\n');

  const unlinkedProducts = await db.execute(sql`
    SELECT ps.product_id, ps.original_product_id, ps.affiliate_url
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'b10f'
    AND pp.product_id IS NULL
    LIMIT ${limit}
  `);

  console.log(`✅ 未紐付き商品: ${unlinkedProducts.rows.length}件\n`);

  // サンプル表示
  if (unlinkedProducts.rows.length > 0) {
    const samples = (unlinkedProducts.rows as any[]).slice(0, 3);
    console.log('サンプル:');
    for (const s of samples) {
      const urlMatch = s.affiliate_url?.match(/\/p\/(\d+)\.html/);
      console.log(`  original_product_id=${s.original_product_id}, URL ID=${urlMatch?.[1] || 'N/A'}`);
    }
    const csvSampleKeys = Array.from(csvMap.keys()).slice(0, 5);
    console.log(`CSVサンプルキー: ${csvSampleKeys.join(', ')}\n`);
  }

  // 5. 紐付け処理
  let processed = 0;
  let newRelations = 0;
  let noPerformerInCsv = 0;
  let matched = 0;
  let errors = 0;

  for (const row of unlinkedProducts.rows as any[]) {
    try {
      // affiliate_urlからIDを抽出: https://b10f.jp/p/52142.html -> 52142
      let productIdFromUrl: string | null = null;
      if (row.affiliate_url) {
        const urlMatch = row.affiliate_url.match(/\/p\/(\d+)\.html/);
        if (urlMatch) {
          productIdFromUrl = urlMatch[1];
        }
      }

      // CSVからマッチ（URLのID優先、なければoriginal_product_id）
      let performerNames = productIdFromUrl ? csvMap.get(productIdFromUrl) : null;
      if (!performerNames) {
        performerNames = csvMap.get(row.original_product_id);
      }

      if (!performerNames) {
        noPerformerInCsv++;
        continue;
      }

      matched++;

      const names = performerNames
        .split(',')
        .map(n => n.trim())
        .filter(n => isValidPerformerName(n));

      if (names.length === 0) {
        continue;
      }

      for (const name of names) {
        const performerId = await findOrCreatePerformer(name);

        if (!performerId) {
          errors++;
          continue;
        }

        await db
          .insert(productPerformers)
          .values({
            productId: row.product_id,
            performerId: performerId,
          })
          .onConflictDoNothing();

        newRelations++;
      }

      processed++;

      if (processed % 500 === 0) {
        console.log(`進捗: ${processed}/${unlinkedProducts.rows.length} (紐付け: ${newRelations}件)`);
      }
    } catch (error) {
      errors++;
      console.error(`エラー (product_id: ${row.product_id}):`, error);
    }
  }

  console.log('\n=== 完了 ===');
  console.log(`処理済み: ${processed}件`);
  console.log(`CSVマッチ: ${matched}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`CSVに出演者なし/マッチなし: ${noPerformerInCsv}件`);
  console.log(`エラー: ${errors}件`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'b10f'
  `);

  console.log('\n=== b10f紐付け状況 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
