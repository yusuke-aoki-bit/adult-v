/**
 * 演者パイプライン実行スクリプト
 * Cloud Run Jobから直接実行するためのスタンドアロンスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/run-performer-pipeline.ts [--asp=MGS] [--limit=500] [--skip-merge]
 */

import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import { resolve } from 'path';

// 環境変数を読み込み
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { db, closeDb } from '../packages/database/src/client';

interface PipelineStats {
  crawlPhase: {
    source: string;
    entriesFound: number;
    entriesSaved: number;
  }[];
  linkPhase: {
    productsProcessed: number;
    newLinks: number;
  };
  mergePhase: {
    fakePerformersFound: number;
    performersMerged: number;
    productsMoved: number;
    aliasesAdded: number;
  };
  totalDuration: number;
}

// MGS品番を正規化（数字プレフィックスを除去）
// 例: 200GANA-1040 → GANA-1040, 099NTK-895 → NTK-895
function normalizeProductCodeForSearch(code: string): string {
  // 先頭の数字を除去
  return code.replace(/^\d+/, '').toUpperCase();
}

// Wiki検索
async function getPerformersFromWiki(productCode: string): Promise<string[]> {
  // MGS品番の数字プレフィックスを除去
  const normalizedCode = normalizeProductCodeForSearch(productCode);

  const result = await db.execute(sql`
    SELECT DISTINCT performer_name
    FROM wiki_crawl_data
    WHERE product_code ILIKE ${normalizedCode}
    OR product_code ILIKE ${productCode}
    ORDER BY performer_name
  `);
  return (result.rows as { performer_name: string }[]).map((r) => r.performer_name);
}

// FANZA検索
async function findPerformersFromFanza(
  productCode: string
): Promise<{ id: number; name: string }[]> {
  const result = await db.execute(sql`
    SELECT DISTINCT pf.id, pf.name
    FROM performers pf
    JOIN product_performers pp ON pf.id = pp.performer_id
    JOIN products p ON pp.product_id = p.id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FANZA'
    AND (
      p.normalized_product_id ILIKE ${productCode}
      OR p.normalized_product_id ILIKE ${'%' + productCode}
      OR ps.original_product_id ILIKE ${productCode}
      OR ps.original_product_id ILIKE ${'%' + productCode}
    )
    ORDER BY pf.name
  `);
  return result.rows as { id: number; name: string }[];
}

// 演者マージ
async function mergePerformerIntoCorrect(
  fakePerformerId: number,
  fakePerformerName: string,
  correctPerformerId: number,
  correctPerformerName: string
): Promise<{ productsMoved: number; aliasAdded: boolean }> {
  let productsMoved = 0;
  let aliasAdded = false;

  // 1. 商品を移動
  const moveResult = await db.execute(sql`
    UPDATE product_performers
    SET performer_id = ${correctPerformerId}
    WHERE performer_id = ${fakePerformerId}
    AND product_id NOT IN (
      SELECT product_id FROM product_performers WHERE performer_id = ${correctPerformerId}
    )
  `);
  productsMoved = moveResult.rowCount || 0;

  // 2. 重複する紐付けを削除
  await db.execute(sql`
    DELETE FROM product_performers WHERE performer_id = ${fakePerformerId}
  `);

  // 3. エイリアスとして追加
  const aliasResult = await db.execute(sql`
    INSERT INTO performer_aliases (performer_id, alias_name, source)
    VALUES (${correctPerformerId}, ${fakePerformerName}, 'mgs-merge')
    ON CONFLICT (performer_id, alias_name) DO NOTHING
  `);
  aliasAdded = (aliasResult.rowCount || 0) > 0;

  // 4. 仮名演者を削除（他の紐付けがない場合）
  await db.execute(sql`
    DELETE FROM performers
    WHERE id = ${fakePerformerId}
    AND NOT EXISTS (
      SELECT 1 FROM product_performers WHERE performer_id = ${fakePerformerId}
    )
  `);

  console.log(
    `  Merged: ${fakePerformerName} (${fakePerformerId}) → ${correctPerformerName} (${correctPerformerId}), moved ${productsMoved} products`
  );

  return { productsMoved, aliasAdded };
}

// 仮名演者マージ
async function mergeFakePerformers(limit: number): Promise<{
  fakePerformersFound: number;
  performersMerged: number;
  productsMoved: number;
  aliasesAdded: number;
}> {
  let fakePerformersFound = 0;
  let performersMerged = 0;
  let productsMoved = 0;
  let aliasesAdded = 0;

  // 仮名演者パターンにマッチする演者を取得
  const fakePerformers = await db.execute(sql`
    SELECT DISTINCT pf.id, pf.name
    FROM performers pf
    JOIN product_performers pp ON pf.id = pp.performer_id
    JOIN products p ON pp.product_id = p.id
    JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'MGS'
    AND pf.name LIKE '%歳%'
    AND pf.name NOT LIKE '%千歳%'
    AND pf.name NOT LIKE '%万歳%'
    ORDER BY pf.id
    LIMIT ${limit}
  `);

  fakePerformersFound = fakePerformers.rows.length;
  console.log(`  Found ${fakePerformersFound} fake performers`);

  for (const fakePerformer of fakePerformers.rows as { id: number; name: string }[]) {
    // 仮名演者にリンクされている商品の品番を取得
    const productsResult = await db.execute(sql`
      SELECT p.id, p.normalized_product_id
      FROM products p
      JOIN product_performers pp ON p.id = pp.product_id
      WHERE pp.performer_id = ${fakePerformer.id}
      LIMIT 1
    `);

    if (productsResult.rows.length === 0) continue;

    const product = productsResult.rows[0] as { id: number; normalized_product_id: string };
    // MGS品番をそのまま渡す（getPerformersFromWiki内で正規化される）
    const productCode = product.normalized_product_id.toUpperCase();

    // wiki_crawl_dataから正しい演者を検索
    let correctPerformerName: string | null = null;
    let correctPerformerId: number | null = null;

    const wikiPerformers = await getPerformersFromWiki(productCode);
    if (wikiPerformers.length > 0) {
      correctPerformerName = wikiPerformers[0];
    } else {
      // FANZAから検索
      const fanzaPerformers = await findPerformersFromFanza(productCode);
      if (fanzaPerformers.length > 0) {
        correctPerformerName = fanzaPerformers[0].name;
        correctPerformerId = fanzaPerformers[0].id;
      }
    }

    if (!correctPerformerName) {
      console.log(`  Skipping ${fakePerformer.name}: no correct performer found`);
      continue;
    }

    // 正しい演者IDを取得または作成
    if (!correctPerformerId) {
      const performerResult = await db.execute(sql`
        SELECT id FROM performers WHERE name = ${correctPerformerName} LIMIT 1
      `);
      if (performerResult.rows.length > 0) {
        correctPerformerId = (performerResult.rows[0] as { id: number }).id;
      } else {
        const insertResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${correctPerformerName})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);
        correctPerformerId = (insertResult.rows[0] as { id: number }).id;
      }
    }

    if (correctPerformerId === fakePerformer.id) continue;

    // マージ実行
    const mergeResult = await mergePerformerIntoCorrect(
      fakePerformer.id,
      fakePerformer.name,
      correctPerformerId,
      correctPerformerName
    );

    performersMerged++;
    productsMoved += mergeResult.productsMoved;
    if (mergeResult.aliasAdded) aliasesAdded++;
  }

  return { fakePerformersFound, performersMerged, productsMoved, aliasesAdded };
}

// 紐付け処理
async function linkPerformersFromLookup(
  asp: string | undefined,
  limit: number
): Promise<{ productsProcessed: number; newLinks: number }> {
  let productsProcessed = 0;
  let newLinks = 0;

  // 未紐付け商品を取得
  const aspCondition = asp ? sql`AND ps.asp_name = ${asp}` : sql``;
  const products = await db.execute(sql`
    SELECT DISTINCT p.id, p.normalized_product_id, ps.original_product_id
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
    ${aspCondition}
    ORDER BY p.id DESC
    LIMIT ${limit}
  `);

  productsProcessed = products.rows.length;

  for (const product of products.rows as {
    id: number;
    normalized_product_id: string;
    original_product_id: string;
  }[]) {
    const productCode = product.normalized_product_id.replace(/^[A-Z]+-/, '').toUpperCase();

    // performer_lookupから演者を検索
    const performers = await getPerformersFromWiki(productCode);

    for (const performerName of performers) {
      // 演者IDを取得または作成
      const performerResult = await db.execute(sql`
        SELECT id FROM performers WHERE name = ${performerName} LIMIT 1
      `);

      let performerId: number;
      if (performerResult.rows.length > 0) {
        performerId = (performerResult.rows[0] as { id: number }).id;
      } else {
        const insertResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${performerName})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);
        performerId = (insertResult.rows[0] as { id: number }).id;
      }

      // 紐付け
      await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (${product.id}, ${performerId})
        ON CONFLICT DO NOTHING
      `);

      newLinks++;
    }
  }

  return { productsProcessed, newLinks };
}

async function main() {
  const startTime = Date.now();

  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  let asp: string | undefined;
  let limit = 500;
  let skipMerge = false;

  for (const arg of args) {
    if (arg.startsWith('--asp=')) {
      asp = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--skip-merge') {
      skipMerge = true;
    }
  }

  console.log('[performer-pipeline] Starting pipeline');
  console.log(`  ASP: ${asp || 'all'}`);
  console.log(`  Limit: ${limit}`);
  console.log(`  Skip Merge: ${skipMerge}`);

  const stats: PipelineStats = {
    crawlPhase: [],
    linkPhase: { productsProcessed: 0, newLinks: 0 },
    mergePhase: {
      fakePerformersFound: 0,
      performersMerged: 0,
      productsMoved: 0,
      aliasesAdded: 0,
    },
    totalDuration: 0,
  };

  try {
    // Phase 3: 仮名演者マージ
    if (!skipMerge) {
      console.log('\n[Phase 3] Merging fake performers...');
      const mergeResult = await mergeFakePerformers(limit);
      stats.mergePhase = mergeResult;
      console.log(`  Found: ${mergeResult.fakePerformersFound}`);
      console.log(`  Merged: ${mergeResult.performersMerged}`);
      console.log(`  Products moved: ${mergeResult.productsMoved}`);
      console.log(`  Aliases added: ${mergeResult.aliasesAdded}`);
    } else {
      console.log('\n[Phase 3] Skipping fake performer merge');
    }

    stats.totalDuration = Date.now() - startTime;
    console.log(`\n[performer-pipeline] Completed in ${stats.totalDuration}ms`);
    console.log(JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('[performer-pipeline] Error:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
