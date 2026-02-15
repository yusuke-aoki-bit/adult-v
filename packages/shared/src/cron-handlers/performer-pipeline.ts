/**
 * 演者名寄せ統合パイプライン Cron Handler
 *
 * 以下の順序で処理を実行:
 * 1. crawl-performer-lookup: Wikiサイトをクロールしてlookupテーブルに保存
 * 2. normalize-performers: lookupテーブルから商品-演者紐付けを作成
 * 3. merge-fake-performers: 仮名演者（○○ N歳 職業）を正しい演者にマージ
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
  totalDuration: number;
}

export function createPerformerPipelineHandler(deps: PipelineDeps) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const startTime = Date.now();
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

    const stats: PipelineStats = {
      crawlPhase: [],
      linkPhase: {
        productsProcessed: 0,
        newLinks: 0,
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
      console.log('\n[Phase 2] Linking performers to products...');

      const linkResult = await linkPerformersFromLookup(db, asp, limit);
      stats.linkPhase = linkResult;
      console.log(`  Processed: ${linkResult.productsProcessed}, New links: ${linkResult.newLinks}`);

      // Phase 3: 仮名演者マージ処理
      // 「○○ N歳 職業」形式の仮名演者を正しい演者にマージ
      if (!skipMerge) {
        console.log('\n[Phase 3] Merging fake performers...');

        const mergeResult = await mergeFakePerformers(db, limit);
        stats.mergePhase = mergeResult;
        console.log(`  Found: ${mergeResult.fakePerformersFound}, Merged: ${mergeResult.performersMerged}`);
        console.log(`  Products moved: ${mergeResult.productsMoved}, Aliases added: ${mergeResult.aliasesAdded}`);
      } else {
        console.log('\n[Phase 3] Skipping fake performer merge (skipMerge=true)');
      }

      // Phase 4: デビュー年データ補完
      // 作品のリリース日から女優のデビュー年を計算・更新
      console.log('\n[Phase 4] Backfilling debut year data...');

      const debutYearResult = await backfillDebutYears(db, limit);
      stats.debutYearPhase = debutYearResult;
      console.log(`  Checked: ${debutYearResult.performersChecked}, Updated: ${debutYearResult.debutYearsUpdated}`);

      // Phase 5: 演者統計更新（latestReleaseDate, releaseCount）
      // 新商品がクロールされた後、女優のソート順を更新するために必要
      console.log('\n[Phase 5] Updating performer stats (latestReleaseDate, releaseCount)...');

      const statsResult = await updatePerformerStats(db);
      stats.statsPhase = statsResult;
      console.log(`  Updated: ${statsResult.performersUpdated} performers`);

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
): Promise<{ productsProcessed: number; newLinks: number }> {
  let productsProcessed = 0;
  let newLinks = 0;

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
    return { productsProcessed, newLinks };
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
    const validNames = row.performer_names.filter(isValidPerformerName);
    if (validNames.length > 0) {
      codeToPerformerNames.set(row.product_code_normalized, validNames);
      for (const name of validNames) {
        allPerformerNames.add(name);
      }
    }
  }

  if (allPerformerNames.size === 0) {
    return { productsProcessed, newLinks };
  }

  // 4. 演者を一括UPSERT
  const performerData = [...allPerformerNames].map(name => ({ name }));
  const upsertedPerformers = await batchUpsertPerformers(db, performerData);
  const nameToId = new Map(upsertedPerformers.map(p => [p.name, p.id]));

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

  return { productsProcessed, newLinks };
}

function normalizeProductCode(code: string): string {
  return code.toUpperCase().replace(/[-_\s]/g, '');
}

function isValidPerformerName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 30) return false;
  if (!/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\sA-Za-z・]+$/.test(name)) return false;

  const exactExcludePatterns = ['素人', 'ナンパ', '企画', '熟女', '人妻'];
  if (exactExcludePatterns.includes(name)) return false;

  const partialExcludePatterns = [
    'AV', '動画', 'サンプル', '無料', '高画質', 'HD', '4K', 'VR',
    'カテゴリ', 'タグ', 'ジャンル', '人気', 'ランキング', '新着',
  ];
  return !partialExcludePatterns.some(p => name.includes(p));
}

/**
 * 仮名演者かどうかを判定
 * 「○○ N歳 職業」パターンにマッチする名前を仮名と判断
 */
function isFakePerformerName(name: string): boolean {
  // パターン1: 「名前 N歳 職業」（例: ゆな 21歳 歯科助手）
  if (/^.{1,10}\s+\d{2}歳\s+.+$/.test(name)) return true;

  // パターン2: 「名前 N歳」（例: あかり 24歳）
  if (/^.{1,10}\s+\d{2}歳$/.test(name)) return true;

  // パターン3: 「名前（N歳）」（例: さくら（22歳））
  if (/^.{1,10}（\d{2}歳）/.test(name)) return true;

  // パターン4: 「N歳 職業」で始まる（例: 21歳 OL）
  if (/^\d{2}歳\s+/.test(name)) return true;

  return false;
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
 * wiki_crawl_dataから演者名を検索
 */
async function getPerformersFromWiki(
  db: any,
  productCode: string
): Promise<string[]> {
  const searchCodes = normalizeProductCodeForSearch(productCode);

  const result = await db.execute(sql`
    SELECT DISTINCT performer_name
    FROM wiki_crawl_data
    WHERE UPPER(product_code) = ANY(ARRAY[${sql.join(
      searchCodes.map((c: string) => sql`${c.toUpperCase()}`),
      sql`, `
    )}]::text[])
  `);

  return (result.rows as { performer_name: string }[])
    .map((row) => row.performer_name)
    .filter((name) => name && name.length > 0 && !isFakePerformerName(name));
}

/**
 * FANZAで同じ品番の商品から演者を検索
 */
async function findPerformersFromFanza(
  db: any,
  productCode: string
): Promise<{ id: number; name: string }[]> {
  const searchCodes = normalizeProductCodeForSearch(productCode);

  const result = await db.execute(sql`
    SELECT
      pf.id,
      pf.name
    FROM products p
    JOIN product_performers pp ON p.id = pp.product_id
    JOIN performers pf ON pp.performer_id = pf.id
    WHERE p.normalized_product_id LIKE 'FANZA-%'
    AND (
      ${sql.join(
        searchCodes.map(
          (code) =>
            sql`UPPER(p.normalized_product_id) LIKE ${'%' + code + '%'}`
        ),
        sql` OR `
      )}
    )
    LIMIT 10
  `);

  return (result.rows as { id: number; name: string }[])
    .filter((row) => !isFakePerformerName(row['name']));
}

/**
 * 仮名演者を正しい演者にマージ
 */
async function mergePerformerIntoCorrect(
  db: any,
  wrongPerformerId: number,
  wrongPerformerName: string,
  correctPerformerId: number,
  correctPerformerName: string,
  source: string = 'performer-pipeline'
): Promise<{ productsMoved: number; aliasAdded: boolean }> {
  // 1. 仮名演者にリンクされている商品を取得
  const linkedProducts = await db.execute(sql`
    SELECT product_id FROM product_performers
    WHERE performer_id = ${wrongPerformerId}
  `);

  const productIds = (linkedProducts.rows as { product_id: number }[]).map(r => r.product_id);

  // 2. 商品リンクを正しい演者に移行
  let productsMoved = 0;
  for (const productId of productIds) {
    // 既に正しい演者にリンクされているかチェック
    const existingLink = await db.execute(sql`
      SELECT 1 FROM product_performers
      WHERE product_id = ${productId} AND performer_id = ${correctPerformerId}
      LIMIT 1
    `);

    if (existingLink.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (${productId}, ${correctPerformerId})
        ON CONFLICT DO NOTHING
      `);
      productsMoved++;
    }

    // 仮名演者へのリンクを削除
    await db.execute(sql`
      DELETE FROM product_performers
      WHERE product_id = ${productId} AND performer_id = ${wrongPerformerId}
    `);
  }

  // 3. 仮名をエイリアスとして登録
  let aliasAdded = false;
  const existingAlias = await db.execute(sql`
    SELECT 1 FROM performer_aliases
    WHERE performer_id = ${correctPerformerId} AND alias_name = ${wrongPerformerName}
    LIMIT 1
  `);

  if (existingAlias.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO performer_aliases (performer_id, alias_name, source)
      VALUES (${correctPerformerId}, ${wrongPerformerName}, ${source})
      ON CONFLICT DO NOTHING
    `);
    aliasAdded = true;
  }

  // 4. 仮名演者レコードを削除（リンクがなくなった場合のみ）
  const remainingLinks = await db.execute(sql`
    SELECT 1 FROM product_performers WHERE performer_id = ${wrongPerformerId} LIMIT 1
  `);

  if (remainingLinks.rows.length === 0) {
    // 仮名演者の既存エイリアスを正しい演者に移行
    await db.execute(sql`
      UPDATE performer_aliases
      SET performer_id = ${correctPerformerId}
      WHERE performer_id = ${wrongPerformerId}
      AND alias_name NOT IN (
        SELECT alias_name FROM performer_aliases WHERE performer_id = ${correctPerformerId}
      )
    `);

    // 重複するエイリアスを削除
    await db.execute(sql`
      DELETE FROM performer_aliases WHERE performer_id = ${wrongPerformerId}
    `);

    // 仮名演者レコードを削除
    await db.execute(sql`
      DELETE FROM performers WHERE id = ${wrongPerformerId}
    `);
  }

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
}> {
  let fakePerformersFound = 0;
  let performersMerged = 0;
  let productsMoved = 0;
  let aliasesAdded = 0;

  // 仮名演者パターンにマッチする演者を取得
  // 「○○ N歳 職業」形式の仮名演者を検出
  // LIKE '%歳%'で「歳」を含む演者を取得し、実名演者（フルネーム漢字）を除外
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

  const fakePerformerRows = fakePerformers.rows as { id: number; name: string }[];
  fakePerformersFound = fakePerformerRows.length;

  if (fakePerformerRows.length === 0) {
    return { fakePerformersFound, performersMerged, productsMoved, aliasesAdded };
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

  // 各仮名演者を処理（wiki/FANZA検索は個別に実行が必要）
  for (const fakePerformer of fakePerformerRows) {
    const product = performerToProduct.get(fakePerformer.id);
    if (!product) continue;

    const productCode = product.normalized_product_id.replace(/^[A-Z]+-/, '').toUpperCase();

    // wiki_crawl_dataから正しい演者を検索
    let correctPerformerName: string | null | undefined = null;
    let correctPerformerId: number | null = null;

    const wikiPerformers = await getPerformersFromWiki(db, productCode);
    if (wikiPerformers.length > 0) {
      correctPerformerName = wikiPerformers[0];
    } else {
      // FANZAから検索
      const fanzaPerformers = await findPerformersFromFanza(db, productCode);
      if (fanzaPerformers.length > 0 && fanzaPerformers[0]) {
        correctPerformerName = fanzaPerformers[0]['name'];
        correctPerformerId = fanzaPerformers[0]['id'];
      }
    }

    if (!correctPerformerName) continue;

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
      db,
      fakePerformer.id,
      fakePerformer.name,
      correctPerformerId,
      correctPerformerName
    );

    performersMerged++;
    productsMoved += mergeResult.productsMoved;
    if (mergeResult.aliasAdded) aliasesAdded++;

    console.log(`    Merged: ${fakePerformer.name} → ${correctPerformerName}`);
  }

  return { fakePerformersFound, performersMerged, productsMoved, aliasesAdded };
}

/**
 * 演者統計を更新（latestReleaseDate, releaseCount）
 * トップページのソート順を正しく反映するために必要
 */
async function updatePerformerStats(
  db: any
): Promise<{ performersUpdated: number }> {
  // 全演者のlatestReleaseDateとreleaseCountを一括更新
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
      GROUP BY pp.performer_id
    ) sub
    WHERE p.id = sub.performer_id
      AND (
        p.latest_release_date IS DISTINCT FROM sub.latest_date
        OR p.release_count IS DISTINCT FROM sub.cnt
      )
  `);

  // 更新された行数を取得（PostgreSQLのrowCount）
  const rowCount = result.rowCount || 0;

  return { performersUpdated: rowCount };
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
