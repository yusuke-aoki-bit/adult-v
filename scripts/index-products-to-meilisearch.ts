/**
 * PostgreSQLからMeilisearchへ商品データをインデックス
 *
 * Usage:
 *   # 全商品をインデックス
 *   DATABASE_URL="..." MEILISEARCH_HOST="..." npx tsx scripts/index-products-to-meilisearch.ts
 *
 *   # テスト（100件のみ）
 *   DATABASE_URL="..." MEILISEARCH_HOST="..." npx tsx scripts/index-products-to-meilisearch.ts --limit 100
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import {
  getMeilisearchClient,
  PRODUCTS_INDEX,
  initializeProductsIndex,
  type MeilisearchProduct,
} from '../lib/meilisearch';

interface ProductRow {
  id: number;
  normalized_product_id: string;
  title: string;
  title_en: string | null;
  title_ko: string | null;
  title_zh: string | null;
  description: string | null;
  release_date: string | null;
  default_thumbnail_url: string | null;
  rating: number | null;
}

interface PerformerRow {
  product_id: number;
  performer_id: number;
  performer_name: string;
}

interface TagRow {
  product_id: number;
  tag_id: number;
  tag_name: string;
}

interface SourceRow {
  product_id: number;
  asp_name: string;
  original_product_id: string;
  price: number | null;
}

async function indexProductsToMeilisearch() {
  console.log('🚀 Starting Meilisearch indexing...\n');

  // コマンドライン引数をパース
  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  const db = getDb();
  const client = getMeilisearchClient();

  // インデックスを初期化
  console.log('📝 Initializing Meilisearch index...');
  await initializeProductsIndex();
  console.log('✅ Index initialized\n');

  // 商品データを取得（DTI除外）
  console.log(`📦 Fetching products from PostgreSQL${limit ? ` (limit: ${limit})` : ''}...`);
  const productsQuery = sql`
    SELECT DISTINCT
      p.id,
      p.normalized_product_id,
      p.title,
      p.title_en,
      p.title_ko,
      p.title_zh,
      p.description,
      p.release_date,
      p.default_thumbnail_url,
      p.rating
    FROM products p
    WHERE NOT EXISTS (
      SELECT 1 FROM product_sources ps
      WHERE ps.product_id = p.id
      AND ps.asp_name = 'DTI'
    )
    ORDER BY p.id
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `;

  const products = (await db.execute(productsQuery)).rows as ProductRow[];
  console.log(`✅ Found ${products.length} products\n`);

  if (products.length === 0) {
    console.log('⚠️  No products to index');
    return;
  }

  // 商品IDのリストを取得
  const productIds = products.map((p) => p.id);

  // 関連データを一括取得
  console.log('👥 Fetching performers...');
  const performersResult = await db.execute(sql`
    SELECT
      pp.product_id,
      pp.performer_id,
      pe.name as performer_name
    FROM product_performers pp
    JOIN performers pe ON pp.performer_id = pe.id
    WHERE pp.product_id = ANY(${productIds}::int[])
  `);
  const performers = performersResult.rows as PerformerRow[];
  console.log(`✅ Found ${performers.length} performer associations\n`);

  console.log('🏷️  Fetching tags...');
  const tagsResult = await db.execute(sql`
    SELECT
      pt.product_id,
      pt.tag_id,
      t.name as tag_name
    FROM product_tags pt
    JOIN tags t ON pt.tag_id = t.id
    WHERE pt.product_id = ANY(${productIds}::int[])
  `);
  const tags = tagsResult.rows as TagRow[];
  console.log(`✅ Found ${tags.length} tag associations\n`);

  console.log('🏪 Fetching sources...');
  const sourcesResult = await db.execute(sql`
    SELECT
      ps.product_id,
      ps.asp_name,
      ps.original_product_id,
      ps.price
    FROM product_sources ps
    WHERE ps.product_id = ANY(${productIds}::int[])
      AND ps.asp_name != 'DTI'
  `);
  const sources = sourcesResult.rows as SourceRow[];
  console.log(`✅ Found ${sources.length} source associations\n`);

  // データをマップに整理
  const performersMap = new Map<number, PerformerRow[]>();
  for (const p of performers) {
    if (!performersMap.has(p.product_id)) performersMap.set(p.product_id, []);
    performersMap.get(p.product_id)!.push(p);
  }

  const tagsMap = new Map<number, TagRow[]>();
  for (const t of tags) {
    if (!tagsMap.has(t.product_id)) tagsMap.set(t.product_id, []);
    tagsMap.get(t.product_id)!.push(t);
  }

  const sourcesMap = new Map<number, SourceRow[]>();
  for (const s of sources) {
    if (!sourcesMap.has(s.product_id)) sourcesMap.set(s.product_id, []);
    sourcesMap.get(s.product_id)!.push(s);
  }

  // Meilisearch用のドキュメントを作成
  console.log('🔨 Building Meilisearch documents...');
  const documents: MeilisearchProduct[] = products.map((product) => {
    const productPerformers = performersMap.get(product.id) || [];
    const productTags = tagsMap.get(product.id) || [];
    const productSources = sourcesMap.get(product.id) || [];

    // すべてのoriginal_product_idを収集
    const originalProductIds = productSources.map((s) => s.original_product_id);

    // ユニークなプロバイダーリスト
    const providers = Array.from(new Set(productSources.map((s) => s.asp_name)));

    // 最低価格を取得
    const prices = productSources.map((s) => s.price).filter((p): p is number => p !== null);
    const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;

    return {
      id: product.id,
      normalizedProductId: product.normalized_product_id,
      originalProductIds,
      title: product.title,
      titleEn: product.title_en || undefined,
      titleKo: product.title_ko || undefined,
      titleZh: product.title_zh || undefined,
      description: product.description || undefined,
      releaseDate: product.release_date || undefined,
      thumbnailUrl: product.default_thumbnail_url || undefined,
      performers: productPerformers.map((p) => p.performer_name),
      performerIds: productPerformers.map((p) => p.performer_id),
      tags: productTags.map((t) => t.tag_name),
      tagIds: productTags.map((t) => t.tag_id),
      providers,
      price: minPrice,
      rating: product.rating || undefined,
    };
  });

  console.log(`✅ Built ${documents.length} documents\n`);

  // Meilisearchにインデックス（バッチ処理）
  console.log('⬆️  Uploading to Meilisearch...');
  const index = client.index(PRODUCTS_INDEX);
  const batchSize = 1000;
  let indexed = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const task = await index.addDocuments(batch);
    console.log(`   Batch ${Math.floor(i / batchSize) + 1}: Task ${task.taskUid} enqueued (${batch.length} documents)`);
    indexed += batch.length;
  }

  console.log(`\n✅ Successfully indexed ${indexed} products to Meilisearch!`);
  console.log('\n📊 Summary:');
  console.log(`   Products: ${products.length}`);
  console.log(`   Performers: ${performers.length} associations`);
  console.log(`   Tags: ${tags.length} associations`);
  console.log(`   Sources: ${sources.length}`);
  console.log(`\n🎉 Indexing complete!`);
}

indexProductsToMeilisearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
