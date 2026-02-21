/**
 * AI演者分類 Cron ハンドラー
 *
 * Gemini AIを使用して演者の特徴タグを推定
 * GET /api/cron/classify-performers-ai?limit=50
 */

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@adult-v/database';
import { batchInsertPerformerTags, batchGetOrCreateTags } from '../utils/batch-db';
import type { PerformerClassificationResult } from '../lib/llm-service';

interface ClassifyPerformersAiDeps {
  verifyCronRequest: (request: NextRequest) => boolean;
  unauthorizedResponse: () => NextResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDb: () => any;
  classifyPerformerByProducts: (params: {
    performerName: string;
    productTitles: string[];
    existingGenres: string[];
    existingTraits?: string[];
    availableTraitTags?: string[];
  }) => Promise<PerformerClassificationResult | null>;
}

export function createClassifyPerformersAiHandler(deps: ClassifyPerformersAiDeps) {
  return async function GET(request: NextRequest) {
    if (!deps.verifyCronRequest(request)) {
      return deps.unauthorizedResponse();
    }

    const db = deps.getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const startTime = Date.now();
    const TIME_LIMIT = 240_000; // 240秒
    let processed = 0;
    let totalTagsAssigned = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`[classify-performers-ai] Starting with limit=${limit}`);

    // Step 1: 対象演者を取得（AI分類未済、作品数≥3）
    const performersResult = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        COUNT(DISTINCT pp.product_id) as product_count
      FROM performers p
      INNER JOIN product_performers pp ON p.id = pp.performer_id
      WHERE NOT EXISTS (
        SELECT 1 FROM performer_tags pt
        WHERE pt.performer_id = p.id AND pt.source = 'ai-gemini'
      )
      GROUP BY p.id, p.name
      HAVING COUNT(DISTINCT pp.product_id) >= 3
      ORDER BY COUNT(DISTINCT pp.product_id) DESC
      LIMIT ${limit}
    `);

    const performers = performersResult.rows as Array<{
      id: number;
      name: string;
      product_count: number;
    }>;

    console.log(`  Found ${performers.length} performers to classify`);

    if (performers.length === 0) {
      return NextResponse.json({
        success: true,
        stats: { performersProcessed: 0, tagsAssigned: 0, skipped: 0, errors: 0, duration: Date.now() - startTime },
      });
    }

    // Step 2: 利用可能な特徴タグを取得
    const availableTagsResult = await db.execute(sql`
      SELECT name FROM tags WHERE category = 'performer_trait' ORDER BY name
    `);
    const availableTraitTags = (availableTagsResult.rows as Array<{ name: string }>)
      .map(r => r.name);

    console.log(`  Available trait tags: ${availableTraitTags.length}`);

    // Step 3: 各演者を処理
    let consecutiveErrors = 0;

    for (const performer of performers) {
      if (Date.now() - startTime > TIME_LIMIT) {
        console.log('  Time limit reached');
        break;
      }

      if (consecutiveErrors > 10) {
        console.error('  Too many consecutive errors, aborting');
        break;
      }

      try {
        // 演者の作品タイトルとジャンルを取得
        const productsResult = await db.execute(sql`
          SELECT
            p.title,
            array_agg(DISTINCT t.name) FILTER (WHERE t.category = 'genre') as genres
          FROM product_performers pp
          INNER JOIN products p ON pp.product_id = p.id
          LEFT JOIN product_tags pt ON p.id = pt.product_id
          LEFT JOIN tags t ON pt.tag_id = t.id
          WHERE pp.performer_id = ${performer.id}
          GROUP BY p.id, p.title
          ORDER BY p.release_date DESC NULLS LAST
          LIMIT 20
        `);

        const products = productsResult.rows as Array<{
          title: string;
          genres: string[] | null;
        }>;

        const productTitles = products.map(p => p.title).filter(Boolean);
        const existingGenres = [...new Set(
          products.flatMap(p => p.genres || []).filter(Boolean)
        )];

        if (productTitles.length === 0) {
          skipped++;
          continue;
        }

        // 既存の特徴タグを取得
        const existingTraitsResult = await db.execute(sql`
          SELECT t.name
          FROM performer_tags pt
          INNER JOIN tags t ON pt.tag_id = t.id
          WHERE pt.performer_id = ${performer.id}
        `);
        const existingTraits = (existingTraitsResult.rows as Array<{ name: string }>)
          .map(r => r.name);

        // Gemini呼び出し
        const classification = await deps.classifyPerformerByProducts({
          performerName: performer.name,
          productTitles,
          existingGenres,
          existingTraits,
          availableTraitTags,
        });

        if (classification && classification.confidence >= 30 && classification.traits.length > 0) {
          // すべてのタグ名をIDに解決
          const allTagNames = [
            ...classification.traits,
            ...(classification.bodyType ? [classification.bodyType] : []),
            ...classification.style,
          ];

          const tagMap = await batchGetOrCreateTags(db, allTagNames, 'performer_trait');

          const links = allTagNames
            .filter(name => tagMap.has(name))
            .map(name => ({
              performerId: performer.id,
              tagId: tagMap.get(name)!,
              source: 'ai-gemini',
            }));

          const inserted = await batchInsertPerformerTags(db, links);
          totalTagsAssigned += inserted;
          console.log(`  [${processed + 1}] ${performer.name}: ${inserted} tags (confidence: ${classification.confidence})`);
          consecutiveErrors = 0;
        } else {
          const reason = !classification ? 'API error' : `low confidence (${classification.confidence})`;
          console.log(`  [${processed + 1}] ${performer.name}: skipped (${reason})`);
          skipped++;
        }

        processed++;

        // Rate limiting: 1秒待機
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        errors++;
        consecutiveErrors++;
        console.error(`  [${processed + 1}] Error for ${performer.name}:`, e);
      }
    }

    const stats = {
      performersProcessed: processed,
      tagsAssigned: totalTagsAssigned,
      skipped,
      errors,
      duration: Date.now() - startTime,
    };

    console.log(`[classify-performers-ai] Done: ${JSON.stringify(stats)}`);

    return NextResponse.json({ success: true, stats });
  };
}
