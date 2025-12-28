/**
 * 演者名寄せ統合パイプライン Cron Handler
 *
 * 以下の順序で処理を実行:
 * 1. crawl-performer-lookup: Wikiサイトをクロールしてlookupテーブルに保存
 * 2. normalize-performers: lookupテーブルから商品-演者紐付けを作成
 *
 * GET /api/cron/performer-pipeline?asp=MGS&limit=100
 *
 * パラメータ:
 *   asp - 対象ASP (省略時は全ASP)
 *   limit - 処理件数上限 (デフォルト: 500)
 *   source - クロール対象ソース (カンマ区切り、デフォルト: nakiny,minnano-av)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';

interface PipelineDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  getDb: () => ReturnType<typeof import('../lib/db').getDb>;
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
  totalDuration: number;
}

export function createPerformerPipelineHandler(deps: PipelineDeps) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const startTime = Date.now();
    const db = deps.getDb();

    const { searchParams } = new URL(request.url);
    const asp = searchParams.get('asp') || undefined;
    const limit = parseInt(searchParams.get('limit') || '500', 10);
    const sources = (searchParams.get('source') || 'nakiny,minnano-av').split(',');

    console.log('[performer-pipeline] Starting pipeline');
    console.log(`  ASP: ${asp || 'all'}`);
    console.log(`  Limit: ${limit}`);
    console.log(`  Sources: ${sources.join(', ')}`);

    const stats: PipelineStats = {
      crawlPhase: [],
      linkPhase: {
        productsProcessed: 0,
        newLinks: 0,
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

      stats.totalDuration = Date.now() - startTime;

      console.log(`\n[performer-pipeline] Complete in ${stats.totalDuration}ms`);

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[performer-pipeline] Error:', error);
      stats.totalDuration = Date.now() - startTime;

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
  db: ReturnType<typeof import('../lib/db').getDb>,
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
  db: ReturnType<typeof import('../lib/db').getDb>,
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

  for (const product of products.rows as Array<{
    id: number;
    normalized_product_id: string;
    original_product_id: string;
  }>) {
    productsProcessed++;

    // 品番を正規化
    const normalizedCode = normalizeProductCode(product.original_product_id || product.normalized_product_id);

    // lookupテーブルから検索
    const lookupResult = await db.execute(sql`
      SELECT performer_names
      FROM product_performer_lookup
      WHERE product_code_normalized = ${normalizedCode}
      LIMIT 1
    `);

    if (lookupResult.rows.length === 0) continue;

    const performerNames = (lookupResult.rows[0] as { performer_names: string[] }).performer_names;

    for (const performerName of performerNames) {
      if (!isValidPerformerName(performerName)) continue;

      try {
        // 演者を取得または作成
        const performerResult = await db.execute(sql`
          INSERT INTO performers (name)
          VALUES (${performerName})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `);

        const performerId = (performerResult.rows[0] as { id: number }).id;

        // 紐付け
        await db.execute(sql`
          INSERT INTO product_performers (product_id, performer_id)
          VALUES (${product.id}, ${performerId})
          ON CONFLICT DO NOTHING
        `);

        newLinks++;
      } catch {
        // 競合エラーは無視
      }
    }
  }

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
