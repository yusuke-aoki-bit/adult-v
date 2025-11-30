/**
 * DUGA商品に出演者を紐付けるバックフィルスクリプト
 *
 * 方法1: duga_raw_responsesテーブルから出演者情報を抽出
 * 方法2: DUGA APIを再取得して出演者情報を取得
 */

import { getDb } from '../../lib/db';
import { performers, productPerformers } from '../../lib/db/schema';
import { sql, eq } from 'drizzle-orm';

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
  /モデル/,
  /^N\/A$/i,
  /^不明$/,
  /^非公開$/,
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
  } catch {
    const existingPerformer = await db.query.performers.findFirst({
      where: eq(performers.name, name),
    });
    return existingPerformer?.id || null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '5000');
  const batch = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100');

  console.log('=== DUGA 出演者紐付けバックフィル ===\n');
  console.log(`Limit: ${limit}, Batch: ${batch}\n`);

  // 方法1: duga_raw_responsesから出演者情報を抽出
  console.log('🔍 未紐付きDUGA商品を検索中...\n');

  // duga_raw_responsesから出演者情報を持つレコードを取得
  const rawDataWithPerformers = await db.execute(sql`
    SELECT
      drr.product_id as duga_product_id,
      drr.raw_json,
      ps.product_id,
      p.title
    FROM duga_raw_responses drr
    JOIN product_sources ps ON ps.original_product_id = drr.product_id AND ps.asp_name = 'DUGA'
    JOIN products p ON ps.product_id = p.id
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE pp.product_id IS NULL
    AND drr.raw_json IS NOT NULL
    ORDER BY ps.product_id DESC
    LIMIT ${limit}
  `);

  console.log(`✅ 未紐付き商品（生データあり）: ${rawDataWithPerformers.rows.length}件\n`);

  let processed = 0;
  let newRelations = 0;
  let noPerformerFound = 0;
  let errors = 0;

  for (const row of rawDataWithPerformers.rows as any[]) {
    try {
      const rawJson = row.raw_json;

      // 出演者情報を抽出（DUGA APIの形式に対応）
      let performerNames: string[] = [];

      // performers フィールドを確認
      if (rawJson.performers && Array.isArray(rawJson.performers)) {
        performerNames = rawJson.performers
          .map((p: any) => p.name || p.performer_name || p)
          .filter((n: any) => typeof n === 'string' && n.length > 0);
      }

      // actresses フィールドも確認（別のAPI形式）
      if (performerNames.length === 0 && rawJson.actresses && Array.isArray(rawJson.actresses)) {
        performerNames = rawJson.actresses
          .map((a: any) => a.name || a)
          .filter((n: any) => typeof n === 'string' && n.length > 0);
      }

      // actress フィールドも確認（文字列の場合）
      if (performerNames.length === 0 && rawJson.actress) {
        if (typeof rawJson.actress === 'string') {
          // カンマ区切りの場合
          performerNames = rawJson.actress.split(/[,、]+/).map((n: string) => n.trim());
        } else if (Array.isArray(rawJson.actress)) {
          performerNames = rawJson.actress;
        }
      }

      // タイトルから出演者名を抽出（フォールバック）
      if (performerNames.length === 0 && row.title) {
        // タイトルの「【女優名】」パターンを抽出
        const titleMatch = row.title.match(/【([^】]+)】/);
        if (titleMatch && titleMatch[1]) {
          performerNames = titleMatch[1].split(/[,、／・]+/).map((n: string) => n.trim());
        }
      }

      if (performerNames.length === 0) {
        noPerformerFound++;
        continue;
      }

      // 有効な出演者名のみフィルタリング
      const validPerformers = performerNames.filter(name => isValidPerformerName(name));

      if (validPerformers.length === 0) {
        noPerformerFound++;
        continue;
      }

      // 出演者を紐付け
      for (const name of validPerformers) {
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

      if (processed % batch === 0) {
        console.log(`進捗: ${processed}/${rawDataWithPerformers.rows.length} (紐付け: ${newRelations}件, 出演者なし: ${noPerformerFound}件)`);
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      errors++;
      if (errors < 10) {
        console.error(`エラー (product_id: ${row.product_id}):`, error);
      }
    }
  }

  console.log('\n=== Phase 1 完了（生データからの抽出）===');
  console.log(`処理済み: ${processed}件`);
  console.log(`新規紐付け: ${newRelations}件`);
  console.log(`出演者なし: ${noPerformerFound}件`);
  console.log(`エラー: ${errors}件`);

  // 最終統計
  const stats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ps.product_id) as total,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN ps.product_id END) as with_performer
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    WHERE ps.asp_name = 'DUGA'
  `);

  console.log('\n=== DUGA紐付け状況 ===');
  console.table(stats.rows);

  process.exit(0);
}

main().catch(console.error);
