/**
 * 画像URL問題をデバッグするスクリプト
 * getProductsの結果でimageUrlがどうなっているか確認
 */
import { getDb } from "../packages/crawlers/src/lib/db";
import { products, productSources, productPerformers, productTags, productImages, productVideos, productSalesCache, tags, performers } from "../packages/crawlers/src/lib/db/schema";
import { sql, eq, and, desc, asc, count, inArray, isNotNull, isNull, or } from "drizzle-orm";

const db = getDb();

async function main() {
  console.log("=== 画像URLデバッグ ===\n");

  // 1. productsテーブルの最新10件のdefault_thumbnail_urlを確認
  console.log("--- products.default_thumbnail_url 最新10件 ---");
  const latestProducts = await db
    .select({
      id: products.id,
      title: sql<string>`substring(${products.title}, 1, 30)`,
      defaultThumbnailUrl: products.defaultThumbnailUrl,
    })
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(10);

  for (const p of latestProducts) {
    console.log(`ID: ${p.id}`);
    console.log(`  Title: ${p.title}...`);
    console.log(`  URL: ${p.defaultThumbnailUrl || 'NULL'}`);
    console.log('---');
  }

  // 2. FANZA商品のみ確認
  console.log("\n--- FANZA商品のdefault_thumbnail_url ---");
  const fanzaProducts = await db
    .select({
      id: products.id,
      title: sql<string>`substring(${products.title}, 1, 30)`,
      defaultThumbnailUrl: products.defaultThumbnailUrl,
      aspName: productSources.aspName,
    })
    .from(products)
    .innerJoin(productSources, eq(products.id, productSources.productId))
    .where(eq(productSources.aspName, 'FANZA'))
    .orderBy(desc(products.releaseDate))
    .limit(10);

  for (const p of fanzaProducts) {
    console.log(`ID: ${p.id}`);
    console.log(`  Title: ${p.title}...`);
    console.log(`  ASP: ${p.aspName}`);
    console.log(`  URL: ${p.defaultThumbnailUrl || 'NULL'}`);
    console.log('---');
  }

  // 3. 統計
  console.log("\n--- URL状態統計 ---");
  const stats = await db.execute(sql`
    SELECT
      CASE
        WHEN default_thumbnail_url IS NULL THEN 'NULL'
        WHEN default_thumbnail_url = '' THEN 'EMPTY'
        WHEN default_thumbnail_url LIKE '%awsimgsrc.dmm.co.jp%' THEN 'AWSIMGSRC'
        WHEN default_thumbnail_url LIKE '%pics.dmm.co.jp%' THEN 'PICS_DMM'
        WHEN default_thumbnail_url LIKE '%mgstage.com%' THEN 'MGS'
        WHEN default_thumbnail_url LIKE '%duga.jp%' THEN 'DUGA'
        WHEN default_thumbnail_url LIKE 'http%' THEN 'OTHER_VALID'
        ELSE 'INVALID'
      END as url_type,
      COUNT(*) as cnt
    FROM products
    GROUP BY 1
    ORDER BY cnt DESC
  `);

  for (const row of stats.rows as any[]) {
    console.log(`  ${row.url_type}: ${row.cnt}`);
  }

  // 4. product_imagesテーブルとの比較
  console.log("\n--- product_images vs products.default_thumbnail_url ---");
  const comparison = await db.execute(sql`
    SELECT
      CASE
        WHEN p.default_thumbnail_url IS NOT NULL THEN 'HAS_DEFAULT'
        ELSE 'NO_DEFAULT'
      END as default_status,
      CASE
        WHEN EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id) THEN 'HAS_IMAGES'
        ELSE 'NO_IMAGES'
      END as images_status,
      COUNT(*) as cnt
    FROM products p
    GROUP BY 1, 2
    ORDER BY cnt DESC
    LIMIT 10
  `);

  for (const row of comparison.rows as any[]) {
    console.log(`  ${row.default_status} + ${row.images_status}: ${row.cnt}`);
  }

  // 5. FANZAでdefault_thumbnail_urlがNULLの商品を確認
  console.log("\n--- FANZA商品でURL NULL/EMPTYの件数 ---");
  const fanzaNulls = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FANZA'
      AND (p.default_thumbnail_url IS NULL OR p.default_thumbnail_url = '')
  `);
  console.log(`  FANZA NULL/EMPTY: ${(fanzaNulls.rows[0] as any).cnt}`);

  const fanzaValid = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM products p
    INNER JOIN product_sources ps ON p.id = ps.product_id
    WHERE ps.asp_name = 'FANZA'
      AND p.default_thumbnail_url IS NOT NULL
      AND p.default_thumbnail_url != ''
  `);
  console.log(`  FANZA Valid: ${(fanzaValid.rows[0] as any).cnt}`);
}

async function detailedDomainAnalysis() {
  console.log("\n=== ドメイン別URL統計 ===");
  const domains = await db.execute(sql`
    SELECT
      CASE
        WHEN default_thumbnail_url LIKE '%pics.dmm.co.jp%' THEN 'pics.dmm.co.jp'
        WHEN default_thumbnail_url LIKE '%awsimgsrc.dmm.co.jp%' THEN 'awsimgsrc.dmm.co.jp'
        WHEN default_thumbnail_url LIKE '%duga.jp%' THEN 'duga.jp'
        WHEN default_thumbnail_url LIKE '%mgstage.com%' THEN 'mgstage.com'
        WHEN default_thumbnail_url LIKE '%sokmil.com%' THEN 'sokmil.com'
        WHEN default_thumbnail_url LIKE '%b10f.jp%' THEN 'b10f.jp'
        WHEN default_thumbnail_url LIKE '%caribbeancom%' THEN 'caribbeancom'
        WHEN default_thumbnail_url LIKE '%1pondo.tv%' THEN '1pondo'
        WHEN default_thumbnail_url LIKE '%heyzo.com%' THEN 'heyzo'
        WHEN default_thumbnail_url LIKE '%10musume%' THEN '10musume'
        WHEN default_thumbnail_url LIKE '%nyoshin%' THEN 'nyoshin'
        WHEN default_thumbnail_url LIKE '%unkotare%' THEN 'unkotare'
        WHEN default_thumbnail_url LIKE '%fc2.com%' THEN 'fc2'
        WHEN default_thumbnail_url LIKE '%pacopacomama%' THEN 'pacopacomama'
        WHEN default_thumbnail_url LIKE '%japanska%' THEN 'japanska'
        ELSE 'other'
      END as domain,
      COUNT(*) as cnt
    FROM products
    WHERE default_thumbnail_url IS NOT NULL
      AND default_thumbnail_url != ''
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT 20
  `);

  for (const row of domains.rows as any[]) {
    console.log(`  ${row.domain}: ${row.cnt}`);
  }

  // INVALIDの例を確認
  console.log("\n=== INVALID URLの例 ===");
  const invalids = await db.execute(sql`
    SELECT id, substring(default_thumbnail_url, 1, 100) as url
    FROM products
    WHERE default_thumbnail_url IS NOT NULL
      AND default_thumbnail_url != ''
      AND default_thumbnail_url NOT LIKE 'http%'
    LIMIT 5
  `);

  for (const row of invalids.rows as any[]) {
    console.log(`  ID ${row.id}: ${row.url}`);
  }
}

main()
  .then(() => detailedDomainAnalysis())
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
