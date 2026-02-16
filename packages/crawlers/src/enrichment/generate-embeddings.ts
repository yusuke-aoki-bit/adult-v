/**
 * Embedding生成バッチスクリプト
 * 商品・女優のembeddingを生成してDBに保存
 *
 * 使用方法:
 * npx tsx packages/crawlers/src/enrichment/generate-embeddings.ts --type=products --limit=100
 * npx tsx packages/crawlers/src/enrichment/generate-embeddings.ts --type=performers --limit=100
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import {
  generateEmbeddingBatch,
  buildProductEmbeddingText,
  buildPerformerEmbeddingText,
  generateTextHash,
} from '@adult-v/shared/lib/embedding-service';

// コマンドライン引数を解析
const args = process.argv.slice(2);
const typeArg = args.find((arg) => arg.startsWith('--type='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const forceArg = args.includes('--force');

const type = typeArg?.split('=')[1] || 'products';
const limit = parseInt(limitArg?.split('=')[1] || '100', 10);
const force = forceArg; // 既存のembeddingを上書き

// バッチサイズ（Gemini batchEmbedContents APIに合わせて調整）
const BATCH_SIZE = 20;
// リクエスト間の遅延（レート制限対策）
const DELAY_MS = 500;

interface ProductRow {
  id: number;
  title: string;
  description: string | null;
  embedding_text_hash: string | null;
  performers: string | null;
  tags: string | null;
  maker: string | null;
  series: string | null;
}

interface PerformerRow {
  id: number;
  name: string;
  name_kana: string | null;
  bio_ja: string | null;
  height: number | null;
  bust: number | null;
  cup: string | null;
  birthplace: string | null;
  hobbies: string | null;
  embedding_text_hash: string | null;
  genres: string | null;
}

async function generateProductEmbeddings() {
  const db = getDb();

  console.log(`[embedding] Fetching products without embeddings (limit: ${limit})...`);

  // embedding未生成またはテキスト変更のある商品を取得
  // makers/seriesはtagsテーブルにcategory='maker'/'series'として格納
  const baseSelect = sql`
    SELECT
      p.id,
      p.title,
      p.description,
      p.embedding_text_hash,
      (
        SELECT string_agg(pe.name, ', ')
        FROM product_performers ppr
        JOIN performers pe ON ppr.performer_id = pe.id
        WHERE ppr.product_id = p.id
      ) as performers,
      (
        SELECT string_agg(t.name, ', ')
        FROM product_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.product_id = p.id AND t.category NOT IN ('maker', 'label', 'series')
      ) as tags,
      (
        SELECT t.name
        FROM product_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.product_id = p.id AND t.category IN ('maker', 'label')
        LIMIT 1
      ) as maker,
      (
        SELECT t.name
        FROM product_tags pt
        JOIN tags t ON pt.tag_id = t.id
        WHERE pt.product_id = p.id AND t.category = 'series'
        LIMIT 1
      ) as series
    FROM products p
  `;

  const query = force
    ? sql`${baseSelect} ORDER BY p.id DESC LIMIT ${limit}`
    : sql`${baseSelect} WHERE p.embedding IS NULL ORDER BY p.id DESC LIMIT ${limit}`;

  const result = await db.execute(query);
  const products = result.rows as ProductRow[];

  console.log(`[embedding] Found ${products.length} products to process`);

  if (products.length === 0) {
    console.log('[embedding] No products to process');
    return;
  }

  // バッチ処理
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    // embedding用テキストを生成
    const textsWithIds = batch.map((product) => {
      const text = buildProductEmbeddingText({
        title: product.title,
        description: product.description,
        performers: product.performers?.split(', ') || [],
        tags: product.tags?.split(', ') || [],
        maker: product.maker,
        series: product.series,
      });
      const hash = generateTextHash(text);

      return {
        id: product.id,
        text,
        hash,
        skip: !force && product.embedding_text_hash === hash,
      };
    });

    // スキップするものを除外
    const toProcess = textsWithIds.filter((t) => !t.skip);
    skipped += textsWithIds.filter((t) => t.skip).length;

    if (toProcess.length === 0) {
      continue;
    }

    try {
      // バッチでembedding生成
      const embeddingResult = await generateEmbeddingBatch(
        toProcess.map((t) => t.text)
      );

      // DBに保存
      for (let j = 0; j < toProcess.length; j++) {
        const item = toProcess[j];
        const embedding = embeddingResult.embeddings[j];

        const embeddingString = `[${embedding.embedding.join(',')}]`;

        await db.execute(sql`
          UPDATE products
          SET
            embedding = ${embeddingString}::vector,
            embedding_text_hash = ${item.hash},
            embedding_updated_at = NOW()
          WHERE id = ${item.id}
        `);

        processed++;
      }

      console.log(
        `[embedding] Batch ${Math.floor(i / BATCH_SIZE) + 1}: processed ${toProcess.length}, ` +
          `tokens used: ${embeddingResult.usage.totalTokens}`
      );
    } catch (error) {
      console.error(`[embedding] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
      errors += batch.length;
    }

    // レート制限対策
    if (i + BATCH_SIZE < products.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[embedding] Completed: processed=${processed}, skipped=${skipped}, errors=${errors}`);
}

async function generatePerformerEmbeddings() {
  const db = getDb();

  console.log(`[embedding] Fetching performers without embeddings (limit: ${limit})...`);

  const query = force
    ? sql`
        SELECT
          pe.id,
          pe.name,
          pe.name_kana,
          pe.bio_ja,
          pe.height,
          pe.bust,
          pe.cup,
          pe.birthplace,
          pe.hobbies,
          pe.embedding_text_hash,
          (
            SELECT string_agg(DISTINCT t.name, ', ')
            FROM product_performers ppr
            JOIN product_tags pt ON ppr.product_id = pt.product_id
            JOIN tags t ON pt.tag_id = t.id
            WHERE ppr.performer_id = pe.id
            LIMIT 10
          ) as genres
        FROM performers pe
        ORDER BY pe.id
        LIMIT ${limit}
      `
    : sql`
        SELECT
          pe.id,
          pe.name,
          pe.name_kana,
          pe.bio_ja,
          pe.height,
          pe.bust,
          pe.cup,
          pe.birthplace,
          pe.hobbies,
          pe.embedding_text_hash,
          (
            SELECT string_agg(DISTINCT t.name, ', ')
            FROM product_performers ppr
            JOIN product_tags pt ON ppr.product_id = pt.product_id
            JOIN tags t ON pt.tag_id = t.id
            WHERE ppr.performer_id = pe.id
            LIMIT 10
          ) as genres
        FROM performers pe
        WHERE pe.embedding IS NULL
        ORDER BY pe.id
        LIMIT ${limit}
      `;

  const result = await db.execute(query);
  const performers = result.rows as PerformerRow[];

  console.log(`[embedding] Found ${performers.length} performers to process`);

  if (performers.length === 0) {
    console.log('[embedding] No performers to process');
    return;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < performers.length; i += BATCH_SIZE) {
    const batch = performers.slice(i, i + BATCH_SIZE);

    const textsWithIds = batch.map((performer) => {
      const text = buildPerformerEmbeddingText({
        name: performer.name,
        nameKana: performer.name_kana,
        bio: performer.bio_ja,
        height: performer.height,
        bust: performer.bust,
        cup: performer.cup,
        birthplace: performer.birthplace,
        hobbies: performer.hobbies,
        genres: performer.genres?.split(', ') || [],
      });
      const hash = generateTextHash(text);

      return {
        id: performer.id,
        text,
        hash,
        skip: !force && performer.embedding_text_hash === hash,
      };
    });

    const toProcess = textsWithIds.filter((t) => !t.skip);
    skipped += textsWithIds.filter((t) => t.skip).length;

    if (toProcess.length === 0) {
      continue;
    }

    try {
      const embeddingResult = await generateEmbeddingBatch(
        toProcess.map((t) => t.text)
      );

      for (let j = 0; j < toProcess.length; j++) {
        const item = toProcess[j];
        const embedding = embeddingResult.embeddings[j];

        const embeddingString = `[${embedding.embedding.join(',')}]`;

        await db.execute(sql`
          UPDATE performers
          SET
            embedding = ${embeddingString}::vector,
            embedding_text_hash = ${item.hash},
            embedding_updated_at = NOW()
          WHERE id = ${item.id}
        `);

        processed++;
      }

      console.log(
        `[embedding] Batch ${Math.floor(i / BATCH_SIZE) + 1}: processed ${toProcess.length}, ` +
          `tokens used: ${embeddingResult.usage.totalTokens}`
      );
    } catch (error) {
      console.error(`[embedding] Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
      errors += batch.length;
    }

    if (i + BATCH_SIZE < performers.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`[embedding] Completed: processed=${processed}, skipped=${skipped}, errors=${errors}`);
}

async function main() {
  console.log(`[embedding] Starting embedding generation...`);
  console.log(`[embedding] Type: ${type}, Limit: ${limit}, Force: ${force}`);

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error('[embedding] Error: GEMINI_API_KEY or GOOGLE_API_KEY is not set');
    process.exit(1);
  }

  try {
    if (type === 'products') {
      await generateProductEmbeddings();
    } else if (type === 'performers') {
      await generatePerformerEmbeddings();
    } else {
      console.error(`[embedding] Unknown type: ${type}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('[embedding] Fatal error:', error);
    process.exit(1);
  }

  console.log('[embedding] Done!');
  process.exit(0);
}

main();
