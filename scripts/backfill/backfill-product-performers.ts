/**
 * 未紐付き商品に出演者を紐付けるバックフィルスクリプト
 *
 * 処理フロー:
 * 1. product_performersに紐付けがない商品を取得
 * 2. raw_csv_data / raw_html_data から女優名を取得
 * 3. performersテーブルで既存の女優を検索（名前またはエイリアス）
 * 4. 見つからない場合は新規作成
 * 5. product_performersに紐付けを追加
 */

import { getDb } from '../lib/db';
import { performers, productPerformers, performerAliases } from '../lib/db/schema';
import { sql, eq, and, or, notInArray } from 'drizzle-orm';

const db = getDb();

// 無効な女優名のパターン
const INVALID_PATTERNS = [
  /^[0-9]+$/,           // 数字のみ
  /^[a-zA-Z0-9_-]+$/,   // 英数字のみ（品番系）
  /^素人/,              // 素人で始まる
  /企画/,               // 企画系
  /^他$/,               // 「他」のみ
  /^→/,                 // 矢印で始まる
  /^[ぁ-ん]$/,          // ひらがな1文字
  /^[ァ-ヶ]$/,          // カタカナ1文字
  /^[一-龯]$/,          // 漢字1文字
];

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2) return false;
  if (name.length > 50) return false;

  for (const pattern of INVALID_PATTERNS) {
    if (pattern.test(name)) return false;
  }

  return true;
}

function splitPerformerNames(names: string): string[] {
  if (!names) return [];

  // 複数の区切り文字に対応
  return names
    .split(/[、,，・／/\s]+/)
    .map(n => n.trim())
    .filter(n => isValidPerformerName(n));
}

async function findOrCreatePerformer(name: string): Promise<number | null> {
  try {
    // 1. 完全一致で検索
    let performer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });

    if (performer) {
      return performer.id;
    }

    // 2. エイリアスで検索
    const alias = await db.query.performerAliases.findFirst({
      where: eq(performerAliases.aliasName, name),
    });

    if (alias) {
      return alias.performerId;
    }

    // 3. 新規作成
    const [newPerformer] = await db
      .insert(performers)
      .values({
        name: name,
        nameKana: null,
      })
      .returning();

    return newPerformer.id;
  } catch (error) {
    // ユニーク制約違反の場合は既存を再取得
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function backfillFromRawCsvData(limit: number, aspFilter?: string) {
  console.log('\n=== raw_csv_dataからの紐付け ===\n');

  // 未紐付きの商品を取得
  let query = sql`
    SELECT DISTINCT
      ps.product_id,
      ps.asp_name,
      ps.original_product_id,
      rc.raw_data->>'actress' as actress_names
    FROM product_sources ps
    INNER JOIN raw_csv_data rc ON rc.product_id = ps.original_product_id AND rc.source = ps.asp_name
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE pp.product_id IS NULL
      AND rc.raw_data->>'actress' IS NOT NULL
      AND rc.raw_data->>'actress' != ''
  `;

  if (aspFilter) {
    query = sql`${query} AND ps.asp_name = ${aspFilter}`;
  }

  query = sql`${query} LIMIT ${limit}`;

  const products = await db.execute(query);

  console.log(`処理対象: ${products.rows.length}件\n`);

  let processed = 0;
  let newRelations = 0;
  let errors = 0;

  for (const row of products.rows as any[]) {
    try {
      const names = splitPerformerNames(row.actress_names);

      if (names.length === 0) continue;

      for (const name of names) {
        const performerId = await findOrCreatePerformer(name);

        if (!performerId) {
          errors++;
          continue;
        }

        // 紐付け作成
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

      if (processed % 100 === 0) {
        console.log(`進捗: ${processed}/${products.rows.length} (紐付け: ${newRelations}件)`);
      }
    } catch (error) {
      errors++;
      console.error(`エラー (product_id: ${row.product_id}):`, error);
    }
  }

  console.log(`\n処理完了: ${processed}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`エラー: ${errors}件`);
}

async function backfillFromRawHtmlData(limit: number, sourceFilter?: string) {
  console.log('\n=== raw_html_dataからの紐付け ===\n');

  // 未紐付きの商品を取得（HTMLソース）
  let query = sql`
    SELECT DISTINCT
      ps.product_id,
      ps.asp_name,
      ps.original_product_id,
      rh.parsed_data->>'actress' as actress_names
    FROM product_sources ps
    INNER JOIN raw_html_data rh ON rh.product_id = ps.original_product_id AND rh.source = ps.asp_name
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE pp.product_id IS NULL
      AND rh.parsed_data->>'actress' IS NOT NULL
      AND rh.parsed_data->>'actress' != ''
  `;

  if (sourceFilter) {
    query = sql`${query} AND ps.asp_name = ${sourceFilter}`;
  }

  query = sql`${query} LIMIT ${limit}`;

  const products = await db.execute(query);

  console.log(`処理対象: ${products.rows.length}件\n`);

  let processed = 0;
  let newRelations = 0;
  let errors = 0;

  for (const row of products.rows as any[]) {
    try {
      const names = splitPerformerNames(row.actress_names);

      if (names.length === 0) continue;

      for (const name of names) {
        const performerId = await findOrCreatePerformer(name);

        if (!performerId) {
          errors++;
          continue;
        }

        // 紐付け作成
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

      if (processed % 100 === 0) {
        console.log(`進捗: ${processed}/${products.rows.length} (紐付け: ${newRelations}件)`);
      }
    } catch (error) {
      errors++;
      console.error(`エラー (product_id: ${row.product_id}):`, error);
    }
  }

  console.log(`\n処理完了: ${processed}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`エラー: ${errors}件`);
}

async function showStats() {
  console.log('=== 紐付け状況統計 ===\n');

  const stats = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NULL THEN ps.product_id END) as no_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY no_performer DESC
  `);

  console.table(stats.rows);
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000');
  const asp = args.find(a => a.startsWith('--asp='))?.split('=')[1];
  const source = args.find(a => a.startsWith('--source='))?.split('=')[1]; // csv or html
  const statsOnly = args.includes('--stats');

  console.log('=== 商品-出演者紐付けバックフィルスクリプト ===\n');
  console.log(`設定: limit=${limit}, asp=${asp || 'all'}, source=${source || 'all'}\n`);

  // 統計表示
  await showStats();

  if (statsOnly) {
    process.exit(0);
  }

  // CSVからのバックフィル
  if (!source || source === 'csv') {
    await backfillFromRawCsvData(limit, asp);
  }

  // HTMLからのバックフィル
  if (!source || source === 'html') {
    await backfillFromRawHtmlData(limit, asp);
  }

  // 最終統計
  console.log('\n=== 処理後の統計 ===\n');
  await showStats();

  process.exit(0);
}

main().catch(console.error);
