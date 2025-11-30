/**
 * Google Cloud Natural Language APIを使って商品タイトルから出演者名を抽出するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/backfill/extract-performers-nlp.ts --limit=100
 *   npx tsx scripts/backfill/extract-performers-nlp.ts --dry-run
 *
 * 前提条件:
 *   - GOOGLE_API_KEY が .env.local に設定されていること
 *
 * 機能:
 *   - 商品タイトルからNLPで人名（PERSON）を抽出
 *   - 抽出した名前を既存の演者データベースと照合
 *   - 新規の場合は演者として登録
 *   - 既存の場合はproduct_performersにリンク
 */

import { getDb } from '../../lib/db';
import { products, performers, productPerformers } from '../../lib/db/schema';
import { sql, eq, and, isNull, or } from 'drizzle-orm';
import { analyzeEntities, checkGoogleApiConfig } from '../../lib/google-apis';

const db = getDb();

interface ExtractedPerformer {
  name: string;
  salience: number;
}

/**
 * タイトルから人名を抽出
 */
async function extractPerformersFromTitle(title: string): Promise<ExtractedPerformer[]> {
  const entities = await analyzeEntities(title);

  return entities
    .filter((e) => e.type === 'PERSON' && e.salience > 0.05)
    .map((e) => ({
      name: e.name.trim(),
      salience: e.salience,
    }))
    .filter((p) => p.name.length >= 2); // 2文字以上
}

/**
 * 演者名で既存の演者を検索
 */
async function findPerformerByName(name: string): Promise<{ id: number; name: string } | null> {
  const result = await db
    .select({ id: performers.id, name: performers.name })
    .from(performers)
    .where(
      or(
        eq(performers.name, name),
        eq(performers.nameKana, name),
        sql`${performers.name} ILIKE ${name}`,
        sql`${performers.aliases} @> ${JSON.stringify([name])}::jsonb`
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 演者を作成
 */
async function createPerformer(name: string): Promise<number> {
  const result = await db
    .insert(performers)
    .values({
      name,
      source: 'nlp_extracted',
    })
    .returning({ id: performers.id });

  return result[0].id;
}

/**
 * 商品と演者をリンク
 */
async function linkProductPerformer(productId: number, performerId: number): Promise<boolean> {
  try {
    // 既存のリンクをチェック
    const existing = await db
      .select()
      .from(productPerformers)
      .where(
        and(
          eq(productPerformers.productId, productId),
          eq(productPerformers.performerId, performerId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return false; // 既にリンク済み
    }

    await db.insert(productPerformers).values({
      productId,
      performerId,
    });

    return true;
  } catch (error) {
    // ユニーク制約違反等は無視
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '50');
  const dryRun = args.includes('--dry-run');
  const offset = parseInt(args.find((a) => a.startsWith('--offset='))?.split('=')[1] || '0');

  console.log('=== Natural Language APIを使った出演者抽出 ===\n');
  console.log(`設定: limit=${limit}, offset=${offset}, dryRun=${dryRun}\n`);

  // API設定を確認
  const apiConfig = checkGoogleApiConfig();
  if (!apiConfig.naturalLanguage) {
    console.error('\n❌ Google Natural Language APIが設定されていません');
    console.error('   .env.localに GOOGLE_API_KEY を設定してください');
    process.exit(1);
  }

  console.log('✅ Google Natural Language API: 設定済み\n');

  // 演者リンクがない商品を取得
  const targetProducts = await db.execute(sql`
    SELECT p.id, p.title
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
      AND p.title IS NOT NULL
      AND LENGTH(p.title) > 5
    ORDER BY p.id
    OFFSET ${offset}
    LIMIT ${limit}
  `);

  console.log(`📋 対象商品: ${targetProducts.rows.length}件\n`);

  if (targetProducts.rows.length === 0) {
    console.log('✅ 処理対象の商品がありません');
    process.exit(0);
  }

  // 統計
  let processed = 0;
  let extractedTotal = 0;
  let newPerformers = 0;
  let linkedTotal = 0;
  let failed = 0;

  for (const row of targetProducts.rows) {
    const product = row as { id: number; title: string };
    processed++;

    console.log(`[${processed}/${targetProducts.rows.length}] ${product.title.substring(0, 50)}...`);

    try {
      // NLPで人名を抽出
      const extracted = await extractPerformersFromTitle(product.title);

      if (extracted.length === 0) {
        console.log(`  ⏭️ 人名が検出されませんでした`);
        continue;
      }

      console.log(`  🔍 検出: ${extracted.map((e) => `${e.name}(${(e.salience * 100).toFixed(0)}%)`).join(', ')}`);
      extractedTotal += extracted.length;

      for (const performer of extracted) {
        if (dryRun) continue;

        // 既存の演者を検索
        let existingPerformer = await findPerformerByName(performer.name);

        if (!existingPerformer) {
          // 新規作成
          const newId = await createPerformer(performer.name);
          existingPerformer = { id: newId, name: performer.name };
          newPerformers++;
          console.log(`  ➕ 新規演者作成: ${performer.name} (ID: ${newId})`);
        }

        // 商品とリンク
        const linked = await linkProductPerformer(product.id, existingPerformer.id);
        if (linked) {
          linkedTotal++;
          console.log(`  🔗 リンク: ${existingPerformer.name}`);
        }
      }
    } catch (error) {
      failed++;
      console.error(`  ❌ エラー:`, error);
    }

    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // 結果表示
  console.log('\n=== 完了 ===');
  console.log(`処理済み商品: ${processed}件`);
  console.log(`抽出した人名: ${extractedTotal}件`);
  console.log(`新規演者作成: ${newPerformers}件`);
  console.log(`リンク作成: ${linkedTotal}件`);
  console.log(`エラー: ${failed}件`);

  if (dryRun) {
    console.log('\n⚠️ dry-runモードのため、実際の変更は行われていません');
  }

  process.exit(0);
}

main().catch(console.error);
