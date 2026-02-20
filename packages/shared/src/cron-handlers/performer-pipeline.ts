/**
 * 演者名寄せ統合パイプライン Cron Handler
 *
 * 以下の順序で処理を実行:
 * 1. crawl: Wikiサイトをクロールしてlookupテーブルに保存
 * 2. link: lookupテーブルから商品-演者紐付けを作成（エイリアスマッチ対応）
 * 3. cross-asp: 同一商品グループ内で演者を伝播（FANZA→他ASP等）
 * 4. dedup: 正規化キー+pg_trgmファジーマッチで重複演者をマージ
 * 5. merge-fake: 仮名演者（○○ N歳/非公開等）を正しい演者にマージ（全ASP対象）
 * 6. debut-year: リリース日からデビュー年を補完
 * 7. performer-stats: 演者統計更新
 * 8. product-stats: 商品非正規化カラム同期
 *
 * GET /api/cron/performer-pipeline?asp=MGS&limit=100
 *
 * パラメータ:
 *   asp - 対象ASP (省略時は全ASP)
 *   limit - 処理件数上限 (デフォルト: 500)
 *   source - クロール対象ソース (カンマ区切り、デフォルト: nakiny,minnano-av)
 *   skipMerge - trueの場合、仮名演者マージをスキップ
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@adult-v/database';
import {
  batchUpsertPerformers,
  batchInsertProductPerformers,
  batchUpdateColumn,
} from '../utils/batch-db';
import {
  isValidPerformerName as isValidPerformerNameComprehensive,
  normalizePerformerName,
  isFakePerformerName,
  generateNormalizedKey,
} from '../lib/performer-validation';

interface PipelineDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
}

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
  crossAspPhase: {
    groupsProcessed: number;
    productsLinked: number;
    newLinks: number;
  };
  dedupPhase: {
    candidatesFound: number;
    performersMerged: number;
    productsMoved: number;
    fuzzyMerged: number;
  };
  mergePhase: {
    fakePerformersFound: number;
    performersMerged: number;
    productsMoved: number;
    aliasesAdded: number;
  };
  debutYearPhase: {
    performersChecked: number;
    debutYearsUpdated: number;
  };
  statsPhase: {
    performersUpdated: number;
  };
  productStatsPhase: {
    productsUpdated: number;
  };
  totalDuration: number;
}

export function createPerformerPipelineHandler(deps: PipelineDeps) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const startTime = Date.now();
    const TIME_LIMIT = 240_000; // 240秒（maxDuration 300秒の80%）
    const db = deps.getDb();

    const { searchParams } = new URL(request['url']);
    const asp = searchParams.get('asp') || undefined;
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const sources = (searchParams.get('source') || 'nakiny,minnano-av').split(',');
    const skipMerge = searchParams.get('skipMerge') === 'true';

    console.log('[performer-pipeline] Starting pipeline');
    console.log(`  ASP: ${asp || 'all'}`);
    console.log(`  Limit: ${limit}`);
    console.log(`  Sources: ${sources.join(', ')}`);
    console.log(`  Skip Merge: ${skipMerge}`);

    // 変更追跡: Phase 2-5で影響を受けたIDを収集し、Phase 7/8のスコープを限定
    const changedPerformerIds = new Set<number>();
    const changedProductIds = new Set<number>();

    const stats: PipelineStats = {
      crawlPhase: [],
      linkPhase: {
        productsProcessed: 0,
        newLinks: 0,
      },
      crossAspPhase: {
        groupsProcessed: 0,
        productsLinked: 0,
        newLinks: 0,
      },
      dedupPhase: {
        candidatesFound: 0,
        performersMerged: 0,
        productsMoved: 0,
        fuzzyMerged: 0,
      },
      mergePhase: {
        fakePerformersFound: 0,
        performersMerged: 0,
        productsMoved: 0,
        aliasesAdded: 0,
      },
      debutYearPhase: {
        performersChecked: 0,
        debutYearsUpdated: 0,
      },
      statsPhase: {
        performersUpdated: 0,
      },
      productStatsPhase: {
        productsUpdated: 0,
      },
      totalDuration: 0,
    };

    try {
      // Phase 1: クロール処理
      // 各ソースからlookupデータを収集
      console.log('\n[Phase 1] Crawling lookup sources...');

      for (const source of sources) {
        const crawlResult = await crawlSource(db, source.trim());
        stats.crawlPhase.push(crawlResult);
        console.log(`  ${source}: ${crawlResult.entriesSaved}/${crawlResult.entriesFound} entries saved`);
      }

      // Phase 2: 紐付け処理
      // lookupテーブルから未紐付け商品に演者を紐付け
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log('\n[Phase 2] Linking performers to products...');
        try {
          const linkResult = await linkPerformersFromLookup(db, asp, limit);
          stats.linkPhase = linkResult;
          for (const id of linkResult.affectedPerformerIds) changedPerformerIds.add(id);
          for (const id of linkResult.affectedProductIds) changedProductIds.add(id);
          console.log(`  Processed: ${linkResult.productsProcessed}, New links: ${linkResult.newLinks}`);
        } catch (e) {
          console.error('[Phase 2] Error:', e);
        }
      } else {
        console.log('\n[Phase 2] Skipped (time limit)');
      }

      // Phase 3: Cross-ASP演者伝播
      // 同一商品グループ内でFANZA等に演者がいるが他ASPにいない場合、演者を伝播
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log('\n[Phase 3] Cross-ASP performer propagation...');
        try {
          const crossAspResult = await propagatePerformersAcrossAsps(db, limit);
          stats.crossAspPhase = crossAspResult;
          for (const id of crossAspResult.affectedPerformerIds) changedPerformerIds.add(id);
          for (const id of crossAspResult.affectedProductIds) changedProductIds.add(id);
          console.log(`  Groups: ${crossAspResult.groupsProcessed}, Products linked: ${crossAspResult.productsLinked}, New links: ${crossAspResult.newLinks}`);
        } catch (e) {
          console.error('[Phase 3] Error:', e);
        }
      } else {
        console.log('\n[Phase 3] Skipped (time limit)');
      }

      // Phase 4: 演者名重複排除（正規化キー + pg_trgm ファジーマッチ）
      // 表記揺れ（ひらがな/カタカナ/スペース有無/全角半角）を統一してマージ
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log('\n[Phase 4] Deduplicating performers (normalization + fuzzy)...');
        try {
          const dedupResult = await deduplicatePerformers(db, limit);
          stats.dedupPhase = dedupResult;
          for (const id of dedupResult.affectedPerformerIds) changedPerformerIds.add(id);
          console.log(`  Candidates: ${dedupResult.candidatesFound}, Merged: ${dedupResult.performersMerged}, Fuzzy: ${dedupResult.fuzzyMerged}`);
        } catch (e) {
          console.error('[Phase 4] Error:', e);
        }
      } else {
        console.log('\n[Phase 4] Skipped (time limit)');
      }

      // Phase 5: 仮名演者マージ処理
      // 「○○ N歳 職業」形式の仮名演者を正しい演者にマージ（全ASP対象）
      if (Date.now() - startTime < TIME_LIMIT && !skipMerge) {
        console.log('\n[Phase 5] Merging fake performers...');
        try {
          const mergeResult = await mergeFakePerformers(db, limit);
          stats.mergePhase = mergeResult;
          for (const id of mergeResult.affectedPerformerIds) changedPerformerIds.add(id);
          console.log(`  Found: ${mergeResult.fakePerformersFound}, Merged: ${mergeResult.performersMerged}`);
          console.log(`  Products moved: ${mergeResult.productsMoved}, Aliases added: ${mergeResult.aliasesAdded}`);
        } catch (e) {
          console.error('[Phase 5] Error:', e);
        }
      } else if (skipMerge) {
        console.log('\n[Phase 5] Skipping fake performer merge (skipMerge=true)');
      } else {
        console.log('\n[Phase 5] Skipped (time limit)');
      }

      // Phase 6: デビュー年データ補完
      // 作品のリリース日から女優のデビュー年を計算・更新
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log('\n[Phase 6] Backfilling debut year data...');
        try {
          const debutYearResult = await backfillDebutYears(db, limit);
          stats.debutYearPhase = debutYearResult;
          console.log(`  Checked: ${debutYearResult.performersChecked}, Updated: ${debutYearResult.debutYearsUpdated}`);
        } catch (e) {
          console.error('[Phase 6] Error:', e);
        }
      } else {
        console.log('\n[Phase 6] Skipped (time limit)');
      }

      // Phase 7: 演者統計更新（latestReleaseDate, releaseCount）
      // 変更があった演者のみ更新（変更なしの場合は全件更新にフォールバック）
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log(`\n[Phase 7] Updating performer stats (scope: ${changedPerformerIds.size > 0 ? changedPerformerIds.size + ' performers' : 'all'})...`);
        try {
          const statsResult = await updatePerformerStats(db, changedPerformerIds);
          stats.statsPhase = statsResult;
          console.log(`  Updated: ${statsResult.performersUpdated} performers`);
        } catch (e) {
          console.error('[Phase 7] Error:', e);
        }
      } else {
        console.log('\n[Phase 7] Skipped (time limit)');
      }

      // Phase 8: 商品統計更新（非正規化カラム同期）
      // 変更があった商品のみ更新（変更なしの場合は全件更新にフォールバック）
      if (Date.now() - startTime < TIME_LIMIT) {
        console.log(`\n[Phase 8] Updating product stats (scope: ${changedProductIds.size > 0 ? changedProductIds.size + ' products' : 'all'})...`);
        try {
          const productStatsResult = await updateProductStats(db, changedProductIds);
          stats.productStatsPhase = productStatsResult;
          console.log(`  Updated: ${productStatsResult.productsUpdated} products`);
        } catch (e) {
          console.error('[Phase 8] Error:', e);
        }
      } else {
        console.log('\n[Phase 8] Skipped (time limit)');
      }

      stats['totalDuration'] = Date.now() - startTime;

      console.log(`\n[performer-pipeline] Complete in ${stats['totalDuration']}ms`);

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[performer-pipeline] Error:', error);
      stats['totalDuration'] = Date.now() - startTime;

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      }, { status: 500 });
    }
  };
}

/**
 * ソースからlookupデータをクロール
 */
async function crawlSource(
  db: any,
  source: string
): Promise<{ source: string; entriesFound: number; entriesSaved: number }> {
  // 簡易的なクロール（詳細は各専用クローラーに委譲）
  // ここではlookupテーブルの既存データを活用
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM product_performer_lookup WHERE source = ${source}
  `);

  const count = parseInt((result.rows[0] as { count: string }).count, 10);

  return {
    source,
    entriesFound: count,
    entriesSaved: 0, // このフェーズでは新規クロールせず既存データを使用
  };
}

/**
 * lookupテーブルから演者を紐付け
 */
async function linkPerformersFromLookup(
  db: any,
  asp: string | undefined,
  limit: number
): Promise<{ productsProcessed: number; newLinks: number; affectedPerformerIds: number[]; affectedProductIds: number[] }> {
  let productsProcessed = 0;
  let newLinks = 0;
  const affectedPerformerIds: number[] = [];
  const affectedProductIds: number[] = [];

  // 未紐付け商品を取得
  const aspCondition = asp ? sql`AND ps.asp_name = ${asp}` : sql``;

  const products = await db.execute(sql`
    SELECT DISTINCT ON (p.id)
      p.id,
      p.normalized_product_id,
      ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
    ${aspCondition}
    ORDER BY p.id
    LIMIT ${limit}
  `);

  const productRows = products.rows as Array<{
    id: number;
    normalized_product_id: string;
    original_product_id: string;
  }>;
  productsProcessed = productRows.length;

  if (productRows.length === 0) {
    return { productsProcessed, newLinks, affectedPerformerIds, affectedProductIds };
  }

  // 1. 全商品の正規化品番を一括計算
  const codeToProducts = new Map<string, number[]>();
  for (const product of productRows) {
    const normalizedCode = normalizeProductCode(product.original_product_id || product.normalized_product_id);
    const existing = codeToProducts.get(normalizedCode) || [];
    existing.push(product['id']);
    codeToProducts.set(normalizedCode, existing);
  }

  // 2. lookupテーブルを一括検索
  const codes = [...codeToProducts.keys()];
  const codeValues = sql.join(codes.map(c => sql`${c}`), sql`, `);

  const lookupResult = await db.execute(sql`
    SELECT product_code_normalized, performer_names
    FROM product_performer_lookup
    WHERE product_code_normalized IN (${codeValues})
  `);

  // 3. 有効な演者名を収集
  const allPerformerNames = new Set<string>();
  const codeToPerformerNames = new Map<string, string[]>();

  for (const row of lookupResult.rows as Array<{ product_code_normalized: string; performer_names: string[] }>) {
    const validNames = row.performer_names.filter(isValidPerformerNameForLookup);
    if (validNames.length > 0) {
      codeToPerformerNames.set(row.product_code_normalized, validNames);
      for (const name of validNames) {
        allPerformerNames.add(name);
      }
    }
  }

  if (allPerformerNames.size === 0) {
    return { productsProcessed, newLinks, affectedPerformerIds, affectedProductIds };
  }

  // 4. 演者名を正規化してから一括UPSERT
  const normalizedPerformerNames = new Set<string>();
  const rawToNormalized = new Map<string, string>();
  for (const rawName of allPerformerNames) {
    const normalized = normalizePerformerName(rawName) || rawName;
    normalizedPerformerNames.add(normalized);
    rawToNormalized.set(rawName, normalized);
  }

  // 正規化名で既存の演者を検索（エイリアスも含む）
  const normalizedNames = [...normalizedPerformerNames];
  const nameValues = sql.join(normalizedNames.map(n => sql`${n}`), sql`, `);

  // 直接名前マッチ + エイリアスマッチを一括検索
  const existingPerformers = await db.execute(sql`
    SELECT id, name FROM performers WHERE name IN (${nameValues})
    UNION
    SELECT pa.performer_id as id, pa.alias_name as name
    FROM performer_aliases pa
    WHERE pa.alias_name IN (${nameValues})
  `);

  const nameToId = new Map<string, number>();
  for (const row of existingPerformers.rows as Array<{ id: number; name: string }>) {
    if (!nameToId.has(row.name)) {
      nameToId.set(row.name, row.id);
    }
  }

  // 未発見の演者を新規作成
  const newPerformerNames = normalizedNames.filter(n => !nameToId.has(n));
  if (newPerformerNames.length > 0) {
    const performerData = newPerformerNames.map(name => ({ name }));
    const upsertedPerformers = await batchUpsertPerformers(db, performerData);
    for (const p of upsertedPerformers) {
      nameToId.set(p.name, p.id);
    }
  }

  // codeToPerformerNames の名前を正規化名にマッピング
  for (const [code, names] of codeToPerformerNames) {
    codeToPerformerNames.set(code, names.map(n => rawToNormalized.get(n) || n));
  }

  // 5. product_performersリンクを一括INSERT
  const links: { productId: number; performerId: number }[] = [];
  for (const [code, performerNames] of codeToPerformerNames) {
    const productIds = codeToProducts.get(code) || [];
    for (const productId of productIds) {
      for (const name of performerNames) {
        const performerId = nameToId.get(name);
        if (performerId) {
          links.push({ productId, performerId });
        }
      }
    }
  }

  newLinks = await batchInsertProductPerformers(db, links);

  // 影響を受けたIDを収集
  for (const link of links) {
    affectedPerformerIds.push(link.performerId);
    affectedProductIds.push(link.productId);
  }

  return { productsProcessed, newLinks, affectedPerformerIds, affectedProductIds };
}

function normalizeProductCode(code: string): string {
  return code.toUpperCase().replace(/[-_\s]/g, '');
}

/**
 * lookupテーブル用の演者名バリデーション
 * performer-validation.ts の包括的なバリデーションを使用し、
 * lookup固有のチェック（長さ制限・文字種制限）を追加
 */
function isValidPerformerNameForLookup(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  // 包括的バリデーション
  if (!isValidPerformerNameComprehensive(name)) return false;
  // 仮名演者を除外
  if (isFakePerformerName(name)) return false;
  return true;
}

/**
 * 品番を正規化して検索用パターンを生成
 */
function normalizeProductCodeForSearch(code: string): string[] {
  const codes: string[] = [];
  const upper = code.toUpperCase();

  codes.push(upper);

  // MGS-xxx形式からプレフィックスを除去
  if (upper.startsWith('MGS-')) {
    codes.push(upper.replace('MGS-', ''));
  }

  // ハイフンなしバージョン
  codes.push(upper.replace(/-/g, ''));

  // 数字プレフィックス付きの変形
  const match = upper.match(/^(\d+)([A-Z]+)-?(\d+)$/);
  if (match) {
    const [, numPrefix, letters, number] = match;
    if (numPrefix && letters && number) {
      codes.push(`${numPrefix}${letters}-${number}`);
      codes.push(`${numPrefix}${letters}${number}`);
      codes.push(`${numPrefix}${letters}-${parseInt(number, 10)}`);
    }
  }

  return [...new Set(codes)];
}

/**
 * 仮名演者を正しい演者にマージ（トランザクション保護）
 *
 * N+1問題を解消: 商品数に関わらず固定数のクエリで完了
 * トランザクションでアトミック性を保証（並行実行時のレースコンディション防止）
 */
async function mergePerformerIntoCorrect(
  db: any,
  wrongPerformerId: number,
  wrongPerformerName: string,
  correctPerformerId: number,
  correctPerformerName: string,
  source: string = 'performer-pipeline'
): Promise<{ productsMoved: number; aliasAdded: boolean }> {
  if (db.transaction) {
    return db.transaction(async (tx: any) => {
      return _doMerge(tx, wrongPerformerId, wrongPerformerName, correctPerformerId, correctPerformerName, source);
    });
  }
  // transaction未対応の場合は直接実行（後方互換）
  return _doMerge(db, wrongPerformerId, wrongPerformerName, correctPerformerId, correctPerformerName, source);
}

async function _doMerge(
  db: any,
  wrongPerformerId: number,
  wrongPerformerName: string,
  correctPerformerId: number,
  correctPerformerName: string,
  source: string,
): Promise<{ productsMoved: number; aliasAdded: boolean }> {
  // 1. 正しい演者にまだリンクされていない商品を一括で移行
  const moveResult = await db.execute(sql`
    UPDATE product_performers pp
    SET performer_id = ${correctPerformerId}
    WHERE pp.performer_id = ${wrongPerformerId}
      AND NOT EXISTS (
        SELECT 1 FROM product_performers pp2
        WHERE pp2.product_id = pp.product_id AND pp2.performer_id = ${correctPerformerId}
      )
  `);
  const productsMoved = moveResult.rowCount ?? 0;

  // 2. 既に正しい演者にリンク済みの場合、仮名演者側のリンクを一括削除
  await db.execute(sql`
    DELETE FROM product_performers
    WHERE performer_id = ${wrongPerformerId}
  `);

  // 3. 仮名をエイリアスとして登録
  const aliasResult = await db.execute(sql`
    INSERT INTO performer_aliases (performer_id, alias_name, source)
    VALUES (${correctPerformerId}, ${wrongPerformerName}, ${source})
    ON CONFLICT DO NOTHING
  `);
  const aliasAdded = (aliasResult.rowCount ?? 0) > 0;

  // 4. 仮名演者のエイリアスを正しい演者に移行（重複はスキップ）
  await db.execute(sql`
    UPDATE performer_aliases
    SET performer_id = ${correctPerformerId}
    WHERE performer_id = ${wrongPerformerId}
      AND alias_name NOT IN (
        SELECT alias_name FROM performer_aliases WHERE performer_id = ${correctPerformerId}
      )
  `);

  // 残った重複エイリアスを削除
  await db.execute(sql`
    DELETE FROM performer_aliases WHERE performer_id = ${wrongPerformerId}
  `);

  // 5. 仮名演者レコードを削除（リンク・エイリアスは全て移行済み）
  await db.execute(sql`
    DELETE FROM performers WHERE id = ${wrongPerformerId}
  `);

  return { productsMoved, aliasAdded };
}

/**
 * 仮名演者をマージする処理
 */
async function mergeFakePerformers(
  db: any,
  limit: number
): Promise<{
  fakePerformersFound: number;
  performersMerged: number;
  productsMoved: number;
  aliasesAdded: number;
  affectedPerformerIds: number[];
}> {
  let fakePerformersFound = 0;
  let performersMerged = 0;
  let productsMoved = 0;
  let aliasesAdded = 0;
  const affectedPerformerIds: number[] = [];

  // 仮名演者パターンにマッチする演者を取得（全ASP対象）
  // パターン: 「○○ N歳 職業」「モデル名非公開」「N歳」「○○（仮名）」等
  // 歳を含むパターンと非公開/仮名パターンの両方を検出
  const fakePerformers = await db.execute(sql`
    SELECT DISTINCT pf.id, pf.name
    FROM performers pf
    JOIN product_performers pp ON pf.id = pp.performer_id
    WHERE (
      (pf.name LIKE '%歳%' AND pf.name NOT LIKE '%千歳%' AND pf.name NOT LIKE '%万歳%')
      OR pf.name LIKE '%非公開%'
      OR pf.name LIKE '%仮名%'
      OR pf.name LIKE '%素人モデル%'
    )
    ORDER BY pf.id
    LIMIT ${limit}
  `);

  const fakePerformerRows = fakePerformers.rows as { id: number; name: string }[];
  fakePerformersFound = fakePerformerRows.length;

  if (fakePerformerRows.length === 0) {
    return { fakePerformersFound, performersMerged, productsMoved, aliasesAdded, affectedPerformerIds };
  }

  // バッチプリフェッチ: 全仮名演者の商品リンクを一括取得
  const fakeIds = fakePerformerRows.map(f => f.id);
  const fakeIdValues = sql.join(fakeIds.map(id => sql`${id}`), sql`, `);

  const allProductLinks = await db.execute(sql`
    SELECT DISTINCT ON (pp.performer_id)
      pp.performer_id,
      p.id as product_id,
      p.normalized_product_id
    FROM product_performers pp
    JOIN products p ON pp.product_id = p.id
    WHERE pp.performer_id IN (${fakeIdValues})
    ORDER BY pp.performer_id, p.id
  `);

  // performer_id → product情報のマップ
  const performerToProduct = new Map<number, { product_id: number; normalized_product_id: string }>();
  for (const row of allProductLinks.rows as Array<{
    performer_id: number;
    product_id: number;
    normalized_product_id: string;
  }>) {
    performerToProduct.set(row.performer_id, {
      product_id: row.product_id,
      normalized_product_id: row.normalized_product_id,
    });
  }

  // バッチプリフェッチ: 全仮名演者の品番を一括でwiki/FANZAから検索
  // N+1問題を回避: 個別クエリ(2N) → バッチクエリ(2)
  const productCodes = new Map<number, string>(); // performerId → productCode
  for (const fakePerformer of fakePerformerRows) {
    const product = performerToProduct.get(fakePerformer.id);
    if (!product) continue;
    const productCode = product.normalized_product_id.replace(/^[A-Z]+-/, '').toUpperCase();
    productCodes.set(fakePerformer.id, productCode);
  }

  // 1. 全品番のwiki検索バリアントを一括生成
  const allSearchCodes = new Set<string>();
  const codeToFakePerformerIds = new Map<string, number[]>(); // searchCode → performerIds
  for (const [performerId, productCode] of productCodes) {
    const searchCodes = normalizeProductCodeForSearch(productCode);
    for (const code of searchCodes) {
      const upper = code.toUpperCase();
      allSearchCodes.add(upper);
      const existing = codeToFakePerformerIds.get(upper) || [];
      existing.push(performerId);
      codeToFakePerformerIds.set(upper, existing);
    }
  }

  // 2. wiki_crawl_dataを一括検索（1クエリ）
  const wikiCodeToPerformers = new Map<string, string[]>();
  if (allSearchCodes.size > 0) {
    const searchCodeValues = sql.join(
      [...allSearchCodes].map(c => sql`${c}`), sql`, `
    );
    const wikiResult = await db.execute(sql`
      SELECT UPPER(product_code) as product_code, performer_name
      FROM wiki_crawl_data
      WHERE UPPER(product_code) IN (${searchCodeValues})
    `);
    for (const row of wikiResult.rows as Array<{ product_code: string; performer_name: string }>) {
      if (row.performer_name && !isFakePerformerName(row.performer_name)) {
        const existing = wikiCodeToPerformers.get(row.product_code) || [];
        if (!existing.includes(row.performer_name)) {
          existing.push(row.performer_name);
        }
        wikiCodeToPerformers.set(row.product_code, existing);
      }
    }
  }

  // 3. FANZA商品から一括検索（1クエリ）
  const fanzaCodeToPerformers = new Map<string, { id: number; name: string }[]>();
  if (allSearchCodes.size > 0) {
    const likeClauses = [...allSearchCodes].map(code =>
      sql`UPPER(p.normalized_product_id) LIKE ${'%' + code + '%'}`
    );
    const fanzaResult = await db.execute(sql`
      SELECT
        UPPER(p.normalized_product_id) as npid,
        pf.id,
        pf.name
      FROM products p
      JOIN product_performers pp ON p.id = pp.product_id
      JOIN performers pf ON pp.performer_id = pf.id
      WHERE p.normalized_product_id LIKE 'FANZA-%'
      AND (${sql.join(likeClauses, sql` OR `)})
      LIMIT 500
    `);
    for (const row of fanzaResult.rows as Array<{ npid: string; id: number; name: string }>) {
      if (isFakePerformerName(row.name)) continue;
      // どのsearchCodeにマッチするか逆引き
      for (const code of allSearchCodes) {
        if (row.npid.includes(code)) {
          const existing = fanzaCodeToPerformers.get(code) || [];
          if (!existing.some(e => e.id === row.id)) {
            existing.push({ id: row.id, name: row.name });
          }
          fanzaCodeToPerformers.set(code, existing);
        }
      }
    }
  }

  // 4. 各仮名演者を解決（バッチプリフェッチでN+1回避）
  // Step 4a: 全仮名演者の正しい名前を先にメモリ上で解決
  const fakeToCorrect = new Map<number, { name: string; id: number | null }>();
  const namesNeedingLookup = new Set<string>();

  for (const fakePerformer of fakePerformerRows) {
    const productCode = productCodes.get(fakePerformer.id);
    if (!productCode) continue;

    const searchCodes = normalizeProductCodeForSearch(productCode);
    let correctPerformerName: string | null = null;
    let correctPerformerId: number | null = null;

    // wikiバッチ結果から検索
    for (const code of searchCodes) {
      const wikiPerformers = wikiCodeToPerformers.get(code.toUpperCase());
      if (wikiPerformers && wikiPerformers.length > 0) {
        correctPerformerName = wikiPerformers[0]!;
        break;
      }
    }

    // wiki未ヒットならFANZAバッチ結果から検索
    if (!correctPerformerName) {
      for (const code of searchCodes) {
        const fanzaPerformers = fanzaCodeToPerformers.get(code.toUpperCase());
        if (fanzaPerformers && fanzaPerformers.length > 0) {
          correctPerformerName = fanzaPerformers[0]!.name;
          correctPerformerId = fanzaPerformers[0]!.id;
          break;
        }
      }
    }

    if (!correctPerformerName) continue;

    fakeToCorrect.set(fakePerformer.id, { name: correctPerformerName, id: correctPerformerId });
    if (!correctPerformerId) {
      namesNeedingLookup.add(correctPerformerName);
    }
  }

  // Step 4b: ID未解決の演者名を一括UPSERT（N回のSELECT/INSERT → 1回に集約）
  if (namesNeedingLookup.size > 0) {
    const performerData = [...namesNeedingLookup].map(name => ({ name }));
    const upserted = await batchUpsertPerformers(db, performerData);
    const nameToIdMap = new Map<string, number>();
    for (const p of upserted) {
      nameToIdMap.set(p.name, p.id);
    }
    // 解決済みIDをfakeToCorrectに反映
    for (const [fakeId, info] of fakeToCorrect) {
      if (!info.id) {
        info.id = nameToIdMap.get(info.name) ?? null;
      }
    }
  }

  // Step 4c: マージ実行
  const mergeStartTime = Date.now();
  const MERGE_TIME_LIMIT = 120_000;
  for (const fakePerformer of fakePerformerRows) {
    if (Date.now() - mergeStartTime > MERGE_TIME_LIMIT) {
      console.log(`    [mergeFakePerformers] Time limit reached, processed ${performersMerged}/${fakePerformerRows.length}`);
      break;
    }

    const correct = fakeToCorrect.get(fakePerformer.id);
    if (!correct?.id || correct.id === fakePerformer.id) continue;

    const mergeResult = await mergePerformerIntoCorrect(
      db,
      fakePerformer.id,
      fakePerformer.name,
      correct.id,
      correct.name
    );

    performersMerged++;
    productsMoved += mergeResult.productsMoved;
    if (mergeResult.aliasAdded) aliasesAdded++;
    affectedPerformerIds.push(correct.id);

    console.log(`    Merged: ${fakePerformer.name} → ${correct.name}`);
  }

  return { fakePerformersFound, performersMerged, productsMoved, aliasesAdded, affectedPerformerIds };
}

/**
 * 演者名重複排除
 *
 * 2段階で重複を検出・マージ:
 * 1. 正規化キーマッチ: カタカナ統一+スペース除去で同一と判定される演者をマージ
 *    例: 「はたの ゆい」「ハタノユイ」→ 同一キーなのでマージ
 * 2. pg_trgmファジーマッチ: 類似度85%以上かつ商品が重複する演者をマージ
 *    例: 「波多野結衣」「波多野 結衣」→ 類似度高でマージ
 */
async function deduplicatePerformers(
  db: any,
  limit: number
): Promise<{
  candidatesFound: number;
  performersMerged: number;
  productsMoved: number;
  fuzzyMerged: number;
  affectedPerformerIds: number[];
}> {
  let candidatesFound = 0;
  let performersMerged = 0;
  let productsMoved = 0;
  let fuzzyMerged = 0;
  const affectedPerformerIds: number[] = [];

  // =========================================
  // Step 1: 正規化キーベースの重複検出
  // =========================================

  // 商品紐付けがある演者を取得（releaseCountが多い順 = 正規名として残す優先度）
  const performers = await db.execute(sql`
    SELECT id, name, COALESCE(release_count, 0) as release_count
    FROM performers
    WHERE id IN (SELECT DISTINCT performer_id FROM product_performers)
    ORDER BY COALESCE(release_count, 0) DESC
    LIMIT ${limit * 5}
  `);

  const performerRows = performers.rows as Array<{
    id: number;
    name: string;
    release_count: number;
  }>;

  // 正規化キーでグループ化
  const keyToPerformers = new Map<string, Array<{ id: number; name: string; release_count: number }>>();
  for (const p of performerRows) {
    const key = generateNormalizedKey(p.name);
    const existing = keyToPerformers.get(key) || [];
    existing.push(p);
    keyToPerformers.set(key, existing);
  }

  // 重複グループ（2人以上同一キー）を処理
  const DEDUP_TIME_LIMIT = 60_000; // 60秒
  const dedupStart = Date.now();

  for (const [, group] of keyToPerformers) {
    if (group.length < 2) continue;
    if (Date.now() - dedupStart > DEDUP_TIME_LIMIT) {
      console.log(`    [dedup] Time limit reached`);
      break;
    }

    candidatesFound += group.length - 1;

    // release_countが最も多い演者を「正」とする（既にDESCソート済み）
    const primary = group[0]!;

    for (let i = 1; i < group.length; i++) {
      const duplicate = group[i]!;

      // マージ実行
      const result = await mergePerformerIntoCorrect(
        db,
        duplicate.id,
        duplicate.name,
        primary.id,
        primary.name,
        'dedup-normalization'
      );

      performersMerged++;
      productsMoved += result.productsMoved;
      affectedPerformerIds.push(primary.id);
      console.log(`    [dedup] Normalized merge: "${duplicate.name}" → "${primary.name}"`);
    }
  }

  // =========================================
  // Step 2: pg_trgm ファジーマッチ
  // =========================================
  // 正規化キーでは捕捉できない微妙な差異を検出
  // （例: 漢字の異字体、微妙な表記差）

  if (Date.now() - dedupStart < DEDUP_TIME_LIMIT) {
    const fuzzyDuplicates = await db.execute(sql`
      SELECT
        p1.id as id1, p1.name as name1, COALESCE(p1.release_count, 0) as rc1,
        p2.id as id2, p2.name as name2, COALESCE(p2.release_count, 0) as rc2,
        similarity(p1.name, p2.name) as sim
      FROM performers p1
      JOIN performers p2 ON p1.id < p2.id
      WHERE similarity(p1.name, p2.name) > 0.85
        AND p1.id IN (SELECT DISTINCT performer_id FROM product_performers)
        AND p2.id IN (SELECT DISTINCT performer_id FROM product_performers)
        AND length(p1.name) >= 3
        AND length(p2.name) >= 3
      ORDER BY similarity(p1.name, p2.name) DESC
      LIMIT ${limit}
    `);

    const fuzzyRows = fuzzyDuplicates.rows as Array<{
      id1: number; name1: string; rc1: number;
      id2: number; name2: string; rc2: number;
      sim: number;
    }>;

    // 既にマージ済みIDを追跡（マージ済みの演者を再マージしない）
    const mergedIds = new Set<number>();

    for (const row of fuzzyRows) {
      if (Date.now() - dedupStart > DEDUP_TIME_LIMIT) break;
      if (mergedIds.has(row.id1) || mergedIds.has(row.id2)) continue;

      // release_countが多い方を残す
      const [primaryId, primaryName, duplicateId, duplicateName] =
        row.rc1 >= row.rc2
          ? [row.id1, row.name1, row.id2, row.name2]
          : [row.id2, row.name2, row.id1, row.name1];

      const result = await mergePerformerIntoCorrect(
        db,
        duplicateId,
        duplicateName,
        primaryId,
        primaryName,
        'dedup-fuzzy'
      );

      mergedIds.add(duplicateId);
      fuzzyMerged++;
      performersMerged++;
      productsMoved += result.productsMoved;
      affectedPerformerIds.push(primaryId);
      console.log(`    [dedup] Fuzzy merge (${(row.sim * 100).toFixed(0)}%): "${duplicateName}" → "${primaryName}"`);
    }
  }

  return { candidatesFound, performersMerged, productsMoved, fuzzyMerged, affectedPerformerIds };
}

/**
 * Cross-ASP演者伝播
 *
 * product_identity_groupsを使って、同一商品グループ内で
 * 演者がリンクされている商品から演者がリンクされていない商品へ演者を伝播する。
 *
 * 例: FANZA版には演者がリンクされているが、MGS/DUGA版にはリンクされていない場合、
 *     同じグループなので演者を伝播する。
 */
async function propagatePerformersAcrossAsps(
  db: any,
  limit: number
): Promise<{ groupsProcessed: number; productsLinked: number; newLinks: number; affectedPerformerIds: number[]; affectedProductIds: number[] }> {
  let groupsProcessed = 0;
  let productsLinked = 0;
  let newLinks = 0;
  const affectedPerformerIds: number[] = [];
  const affectedProductIds: number[] = [];

  // 同一グループ内で「演者あり」と「演者なし」の両方が存在するグループを取得
  const groups = await db.execute(sql`
    SELECT
      pigm.group_id,
      array_agg(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN pigm.product_id END) FILTER (WHERE pp.product_id IS NOT NULL) as products_with_performers,
      array_agg(DISTINCT CASE WHEN pp.product_id IS NULL THEN pigm.product_id END) FILTER (WHERE pp.product_id IS NULL) as products_without_performers
    FROM product_identity_group_members pigm
    LEFT JOIN product_performers pp ON pigm.product_id = pp.product_id
    GROUP BY pigm.group_id
    HAVING
      COUNT(DISTINCT CASE WHEN pp.product_id IS NOT NULL THEN pigm.product_id END) > 0
      AND COUNT(DISTINCT CASE WHEN pp.product_id IS NULL THEN pigm.product_id END) > 0
    ORDER BY pigm.group_id
    LIMIT ${limit}
  `);

  const groupRows = groups.rows as Array<{
    group_id: number;
    products_with_performers: number[] | null;
    products_without_performers: number[] | null;
  }>;

  groupsProcessed = groupRows.length;

  if (groupRows.length === 0) {
    return { groupsProcessed, productsLinked, newLinks, affectedPerformerIds, affectedProductIds };
  }

  // 演者ありの全商品IDを収集
  const allSourceProductIds = new Set<number>();
  for (const group of groupRows) {
    if (group.products_with_performers) {
      for (const id of group.products_with_performers) {
        allSourceProductIds.add(id);
      }
    }
  }

  // ソース商品の演者を一括取得
  if (allSourceProductIds.size === 0) {
    return { groupsProcessed, productsLinked, newLinks, affectedPerformerIds, affectedProductIds };
  }

  const sourceIdValues = sql.join(
    [...allSourceProductIds].map(id => sql`${id}`), sql`, `
  );
  const performerLinks = await db.execute(sql`
    SELECT product_id, performer_id
    FROM product_performers
    WHERE product_id IN (${sourceIdValues})
  `);

  const productToPerformers = new Map<number, number[]>();
  for (const row of performerLinks.rows as Array<{ product_id: number; performer_id: number }>) {
    const existing = productToPerformers.get(row.product_id) || [];
    existing.push(row.performer_id);
    productToPerformers.set(row.product_id, existing);
  }

  // グループごとにリンクを生成
  const linksToInsert: { productId: number; performerId: number }[] = [];

  for (const group of groupRows) {
    if (!group.products_with_performers || !group.products_without_performers) continue;

    // グループ内のソース商品から全演者IDを収集
    const groupPerformerIds = new Set<number>();
    for (const sourceProductId of group.products_with_performers) {
      const performers = productToPerformers.get(sourceProductId);
      if (performers) {
        for (const pid of performers) {
          groupPerformerIds.add(pid);
        }
      }
    }

    // 演者なし商品に演者を伝播
    for (const targetProductId of group.products_without_performers) {
      for (const performerId of groupPerformerIds) {
        linksToInsert.push({ productId: targetProductId, performerId });
      }
      productsLinked++;
    }
  }

  // 一括INSERT (identity groups)
  if (linksToInsert.length > 0) {
    newLinks = await batchInsertProductPerformers(db, linksToInsert);
    for (const l of linksToInsert) {
      affectedPerformerIds.push(l.performerId);
      affectedProductIds.push(l.productId);
    }
    console.log(`    [crossAsp] Identity groups: inserted ${newLinks} performer links`);
  }

  // =========================================
  // Pass 2: maker_product_code ベースのクロスリンク
  // 同じ品番を持つが identity group に属していない商品間で演者を伝播
  // =========================================
  const codeBasedLinks = await db.execute(sql`
    SELECT
      p_with.maker_product_code,
      array_agg(DISTINCT p_without.id) as target_product_ids,
      array_agg(DISTINCT pp.performer_id) as performer_ids
    FROM products p_with
    JOIN product_performers pp ON p_with.id = pp.product_id
    JOIN products p_without ON p_with.maker_product_code = p_without.maker_product_code
      AND p_with.id != p_without.id
    LEFT JOIN product_performers pp2 ON p_without.id = pp2.product_id
    WHERE p_with.maker_product_code IS NOT NULL
      AND length(p_with.maker_product_code) >= 3
      AND pp2.product_id IS NULL
    GROUP BY p_with.maker_product_code
    LIMIT ${limit}
  `);

  const codeRows = codeBasedLinks.rows as Array<{
    maker_product_code: string;
    target_product_ids: number[];
    performer_ids: number[];
  }>;

  const codeLinks: { productId: number; performerId: number }[] = [];
  for (const row of codeRows) {
    for (const targetId of row.target_product_ids) {
      for (const performerId of row.performer_ids) {
        codeLinks.push({ productId: targetId, performerId });
      }
    }
    productsLinked += row.target_product_ids.length;
    groupsProcessed++;
  }

  if (codeLinks.length > 0) {
    const codeNewLinks = await batchInsertProductPerformers(db, codeLinks);
    newLinks += codeNewLinks;
    for (const l of codeLinks) {
      affectedPerformerIds.push(l.performerId);
      affectedProductIds.push(l.productId);
    }
    console.log(`    [crossAsp] Product code match: inserted ${codeNewLinks} performer links`);
  }

  return { groupsProcessed, productsLinked, newLinks, affectedPerformerIds, affectedProductIds };
}

/**
 * 演者統計を更新（latestReleaseDate, releaseCount）
 * トップページのソート順を正しく反映するために必要
 */
async function updatePerformerStats(
  db: any,
  scopedPerformerIds?: Set<number>
): Promise<{ performersUpdated: number }> {
  // スコープ限定: 変更があった演者のみ更新（大幅な高速化）
  const scopeFilter = scopedPerformerIds && scopedPerformerIds.size > 0
    ? sql`AND pp.performer_id IN (${sql.join([...scopedPerformerIds].map(id => sql`${id}`), sql`, `)})`
    : sql``;

  const result = await db.execute(sql`
    UPDATE performers p
    SET
      latest_release_date = sub.latest_date,
      release_count = sub.cnt
    FROM (
      SELECT
        pp.performer_id,
        MAX(pr.release_date) as latest_date,
        COUNT(DISTINCT pp.product_id) as cnt
      FROM product_performers pp
      INNER JOIN products pr ON pp.product_id = pr.id
      WHERE pr.release_date IS NOT NULL
      ${scopeFilter}
      GROUP BY pp.performer_id
    ) sub
    WHERE p.id = sub.performer_id
      AND (
        p.latest_release_date IS DISTINCT FROM sub.latest_date
        OR p.release_count IS DISTINCT FROM sub.cnt
      )
  `);

  const rowCount = result.rowCount || 0;

  return { performersUpdated: rowCount };
}

/**
 * 商品統計を更新（非正規化カラム同期）
 * performer_count, has_video, has_active_sale, min_price, best_rating, total_reviews
 * updatePerformerStatsと同じパターンで、変更があった行のみ更新
 */
async function updateProductStats(
  db: any,
  scopedProductIds?: Set<number>
): Promise<{ productsUpdated: number }> {
  // スコープ限定: 変更があった商品のみ更新（大幅な高速化）
  const scopeFilter = scopedProductIds && scopedProductIds.size > 0
    ? sql`WHERE p2.id IN (${sql.join([...scopedProductIds].map(id => sql`${id}`), sql`, `)})`
    : sql``;

  const result = await db.execute(sql`
    UPDATE products p
    SET
      performer_count = sub.pc,
      has_video = sub.hv,
      has_active_sale = sub.hs,
      min_price = sub.mp,
      best_rating = sub.br,
      total_reviews = sub.tr
    FROM (
      SELECT
        p2.id,
        COALESCE(pp_cnt.cnt, 0) as pc,
        COALESCE(vid.has, false) as hv,
        COALESCE(sale.has, false) as hs,
        price.mp as mp,
        rating.br as br,
        COALESCE(rating.tr, 0) as tr
      FROM products p2
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int as cnt
        FROM product_performers pp WHERE pp.product_id = p2.id
      ) pp_cnt ON true
      LEFT JOIN LATERAL (
        SELECT true as has
        FROM product_videos pv WHERE pv.product_id = p2.id LIMIT 1
      ) vid ON true
      LEFT JOIN LATERAL (
        SELECT true as has
        FROM product_sources ps
        JOIN product_sales psl ON psl.product_source_id = ps.id
        WHERE ps.product_id = p2.id AND psl.is_active = true
          AND (psl.end_at IS NULL OR psl.end_at > NOW())
        LIMIT 1
      ) sale ON true
      LEFT JOIN LATERAL (
        SELECT MIN(ps.price) as mp
        FROM product_sources ps
        WHERE ps.product_id = p2.id AND ps.price > 0
      ) price ON true
      LEFT JOIN LATERAL (
        SELECT MAX(prs.average_rating) as br, COALESCE(SUM(prs.total_reviews)::int, 0) as tr
        FROM product_rating_summary prs
        WHERE prs.product_id = p2.id
      ) rating ON true
      ${scopeFilter}
    ) sub
    WHERE p.id = sub.id
      AND (
        COALESCE(p.performer_count, -1) IS DISTINCT FROM sub.pc
        OR COALESCE(p.has_video, false) IS DISTINCT FROM sub.hv
        OR COALESCE(p.has_active_sale, false) IS DISTINCT FROM sub.hs
        OR p.min_price IS DISTINCT FROM sub.mp
        OR p.best_rating IS DISTINCT FROM sub.br
        OR COALESCE(p.total_reviews, -1) IS DISTINCT FROM sub.tr
      )
  `);

  const rowCount = result.rowCount || 0;
  return { productsUpdated: rowCount };
}

/**
 * デビュー年データを補完
 * debut_yearがnullの演者に対し、最も古い出演作品のリリース年をデビュー年として設定
 */
async function backfillDebutYears(
  db: any,
  limit: number
): Promise<{ performersChecked: number; debutYearsUpdated: number }> {
  let performersChecked = 0;
  let debutYearsUpdated = 0;

  // デビュー年が未設定で、作品がある演者を取得
  const performersToUpdate = await db.execute(sql`
    SELECT
      pf.id,
      pf.name,
      MIN(EXTRACT(YEAR FROM p.release_date))::int as earliest_year,
      COUNT(DISTINCT pp.product_id) as product_count
    FROM performers pf
    INNER JOIN product_performers pp ON pf.id = pp.performer_id
    INNER JOIN products p ON pp.product_id = p.id
    WHERE pf.debut_year IS NULL
      AND p.release_date IS NOT NULL
      AND EXTRACT(YEAR FROM p.release_date) >= 1980
      AND EXTRACT(YEAR FROM p.release_date) <= EXTRACT(YEAR FROM NOW())
    GROUP BY pf.id, pf.name
    HAVING COUNT(DISTINCT pp.product_id) >= 1
    ORDER BY COUNT(DISTINCT pp.product_id) DESC
    LIMIT ${limit}
  `);

  const rows = performersToUpdate.rows as Array<{
    id: number;
    name: string;
    earliest_year: number;
    product_count: string;
  }>;
  performersChecked = rows.length;

  // バッチUPDATE: 全件を1クエリで更新
  if (rows.length > 0) {
    const updates = rows.map(row => ({ id: row['id'], value: row.earliest_year }));
    debutYearsUpdated = await batchUpdateColumn(db, 'performers', 'id', 'debut_year', updates);
    console.log(`    Batch updated ${debutYearsUpdated} performers' debut years`);
  }

  return { performersChecked, debutYearsUpdated };
}
