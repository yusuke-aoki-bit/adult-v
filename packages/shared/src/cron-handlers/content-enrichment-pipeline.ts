/**
 * コンテンツエンリッチメント統合パイプライン Cron Handler
 *
 * クロール後の後処理を一元化:
 * 1. Translation: 翻訳バックフィル
 * 2. SEO Enhancement: インデックス登録リクエスト
 * 3. Performer Linking: 演者紐付け
 *
 * GET /api/cron/content-enrichment-pipeline?limit=100
 *
 * パラメータ:
 *   limit - 各フェーズの処理件数上限 (デフォルト: 100)
 *   phases - 実行フェーズ (カンマ区切り、デフォルト: translation,seo,performer)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@adult-v/database';
import pLimit from 'p-limit';
import {
  batchUpsertPerformers,
  batchInsertProductPerformers,
} from '../utils/batch-db';

interface PipelineDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  // Translation deps (optional)
  translateText?: (text: string, targetLang: string) => Promise<string | null>;
  // SEO deps (optional)
  requestIndexing?: (url: string, type?: 'URL_UPDATED' | 'URL_DELETED') => Promise<{ success: boolean; error?: string }>;
  siteBaseUrl?: string;
}

interface PhaseResult {
  phase: string;
  processed: number;
  success: number;
  errors: number;
  skipped: number;
  duration: number;
}

interface PipelineStats {
  phases: PhaseResult[];
  totalDuration: number;
}

export function createContentEnrichmentPipelineHandler(deps: PipelineDeps) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const startTime = Date.now();
    const db = deps.getDb();

    const { searchParams } = new URL(request['url']);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const phasesParam = searchParams.get('phases') || 'translation,seo,performer';
    const phases = phasesParam.split(',').map(p => p.trim());

    console.log('[content-enrichment-pipeline] Starting pipeline');
    console.log(`  Limit: ${limit}`);
    console.log(`  Phases: ${phases.join(', ')}`);

    const stats: PipelineStats = {
      phases: [],
      totalDuration: 0,
    };

    try {
      // Phase 1: Translation
      if (phases.includes('translation')) {
        console.log('\n[Phase 1] Translation backfill...');
        const phaseStart = Date.now();
        const result = await runTranslationPhase(db, limit, deps);
        result['duration'] = Date.now() - phaseStart;
        stats.phases.push(result);
        console.log(`  Processed: ${result.processed}, Success: ${result.success}, Errors: ${result.errors}`);
      }

      // Phase 2: SEO Enhancement
      if (phases.includes('seo')) {
        console.log('\n[Phase 2] SEO indexing...');
        const phaseStart = Date.now();
        const result = await runSeoPhase(db, limit, deps);
        result['duration'] = Date.now() - phaseStart;
        stats.phases.push(result);
        console.log(`  Processed: ${result.processed}, Success: ${result.success}, Skipped: ${result.skipped}`);
      }

      // Phase 3: Performer Linking
      if (phases.includes('performer')) {
        console.log('\n[Phase 3] Performer linking...');
        const phaseStart = Date.now();
        const result = await runPerformerPhase(db, limit);
        result['duration'] = Date.now() - phaseStart;
        stats.phases.push(result);
        console.log(`  Processed: ${result.processed}, New links: ${result.success}`);
      }

      stats['totalDuration'] = Date.now() - startTime;

      console.log(`\n[content-enrichment-pipeline] Complete in ${stats['totalDuration']}ms`);

      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[content-enrichment-pipeline] Error:', error);
      stats['totalDuration'] = Date.now() - startTime;

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      }, { status: 500 });
    }
  };
}

// 対応言語とDeepL言語コードのマッピング
const TRANSLATION_LANGUAGES = [
  { code: 'en', deeplCode: 'EN', name: 'English' },
  { code: 'zh', deeplCode: 'ZH', name: 'Chinese (Simplified)' },
  { code: 'ko', deeplCode: 'KO', name: 'Korean' },
] as const;

/**
 * 翻訳バックフィルフェーズ（多言語対応）
 */
async function runTranslationPhase(
  db: any,
  limit: number,
  deps: PipelineDeps
): Promise<PhaseResult> {
  const result: PhaseResult = {
    phase: 'translation',
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    duration: 0,
  };

  if (!deps.translateText) {
    console.log('  Translation API not configured, skipping...');
    result.skipped = 1;
    return result;
  }

  // 各言語について未翻訳の商品を処理
  for (const lang of TRANSLATION_LANGUAGES) {
    console.log(`  Processing ${lang.name} translations...`);

    // 未翻訳の商品を取得
    const products = await db.execute(sql`
      SELECT p.id, p.title, p.description
      FROM products p
      LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.language = ${lang.code}
      WHERE pt.id IS NULL
        AND p.title IS NOT NULL
        AND p.title != ''
      ORDER BY p.created_at DESC
      LIMIT ${Math.floor(limit / TRANSLATION_LANGUAGES.length)}
    `);

    const productRows = products.rows as Array<{
      id: number;
      title: string;
      description: string | null;
    }>;

    const concurrencyLimit = pLimit(3);

    await Promise.all(productRows.map(product => concurrencyLimit(async () => {
      result.processed++;

      try {
        // 翻訳実行
        const translatedTitle = await deps.translateText!(product['title'], lang.deeplCode);
        if (!translatedTitle) {
          result.skipped++;
          return;
        }

        const translatedDescription = product['description']
          ? await deps.translateText!(product['description'], lang.deeplCode)
          : null;

        // 翻訳を保存
        await db.execute(sql`
          INSERT INTO product_translations (product_id, language, title, description)
          VALUES (${product['id']}, ${lang.code}, ${translatedTitle}, ${translatedDescription})
          ON CONFLICT (product_id, language) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            updated_at = NOW()
        `);

        // productsテーブルの多言語カラムも更新
        if (lang.code === 'en') {
          await db.execute(sql`
            UPDATE products
            SET title_en = ${translatedTitle},
                description_en = ${translatedDescription}
            WHERE id = ${product['id']}
          `);
        } else if (lang.code === 'zh') {
          await db.execute(sql`
            UPDATE products
            SET title_zh = ${translatedTitle},
                description_zh = ${translatedDescription}
            WHERE id = ${product['id']}
          `);
        } else if (lang.code === 'ko') {
          await db.execute(sql`
            UPDATE products
            SET title_ko = ${translatedTitle},
                description_ko = ${translatedDescription}
            WHERE id = ${product['id']}
          `);
        }

        result.success++;

        // レート制限対策
        await new Promise(r => setTimeout(r, 50));
      } catch (error) {
        console.error(`  Translation error for product ${product['id']} (${lang.code}):`, error);
        result.errors++;
      }
    })));
  }

  return result;
}

/**
 * SEOインデックス登録フェーズ
 */
async function runSeoPhase(
  db: any,
  limit: number,
  deps: PipelineDeps
): Promise<PhaseResult> {
  const result: PhaseResult = {
    phase: 'seo',
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    duration: 0,
  };

  if (!deps.requestIndexing) {
    console.log('  Indexing API not configured, skipping...');
    result.skipped = 1;
    return result;
  }

  const siteBaseUrl = deps.siteBaseUrl || process.env['NEXT_PUBLIC_SITE_URL'] || 'https://adult-v.com';

  // インデックス未登録の商品を取得
  const products = await db.execute(sql`
    SELECT p.id, p.normalized_product_id
    FROM products p
    LEFT JOIN seo_indexing_status sis ON p.id = sis.product_id
    WHERE sis.product_id IS NULL
       OR (sis.status = 'pending' AND sis.last_requested_at < NOW() - INTERVAL '7 days')
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `);

  const productRows = products.rows as Array<{
    id: number;
    normalized_product_id: string;
  }>;

  const concurrencyLimit = pLimit(3);

  await Promise.all(productRows.map(product => concurrencyLimit(async () => {
    result.processed++;

    const productUrl = `${siteBaseUrl}/products/${product.normalized_product_id}`;

    try {
      const indexResult = await deps.requestIndexing!(productUrl, 'URL_UPDATED');

      if (indexResult.success) {
        await db.execute(sql`
          INSERT INTO seo_indexing_status (url, product_id, status, last_requested_at)
          VALUES (${productUrl}, ${product['id']}, 'requested', NOW())
          ON CONFLICT (url) DO UPDATE SET
            status = 'requested',
            last_requested_at = NOW()
        `);
        result.success++;
      } else {
        result.skipped++;
      }

      // レート制限対策
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.error(`  Indexing error for product ${product['id']}:`, error);
      result.errors++;
    }
  })));

  return result;
}

/**
 * 演者紐付けフェーズ
 */
async function runPerformerPhase(
  db: any,
  limit: number
): Promise<PhaseResult> {
  const result: PhaseResult = {
    phase: 'performer',
    processed: 0,
    success: 0,
    errors: 0,
    skipped: 0,
    duration: 0,
  };

  // 未紐付け商品を取得
  const products = await db.execute(sql`
    SELECT DISTINCT ON (p.id)
      p.id,
      p.normalized_product_id,
      ps.original_product_id
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    WHERE pp.product_id IS NULL
    ORDER BY p.id
    LIMIT ${limit}
  `);

  const productRows = products.rows as Array<{
    id: number;
    normalized_product_id: string;
    original_product_id: string;
  }>;
  result.processed = productRows.length;

  if (productRows.length === 0) {
    return result;
  }

  // 1. 全商品の正規化品番を一括計算
  const codeToProducts = new Map<string, number[]>();
  for (const product of productRows) {
    const normalizedCode = (product.original_product_id || product.normalized_product_id)
      .toUpperCase()
      .replace(/[-_\s]/g, '');
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
    result.skipped = productRows.length;
    return result;
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

  result.success = await batchInsertProductPerformers(db, links);
  result.skipped = productRows.length - result.success;

  return result;
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
