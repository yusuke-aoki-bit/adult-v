/**
 * DB Seed Script for Local Development
 *
 * Usage:
 *   pnpm db:seed            # Insert sample data
 *   pnpm db:seed -- --clean  # Truncate tables first, then insert
 *
 * Prerequisites:
 *   - docker compose up -d (PostgreSQL running on localhost:5432)
 *   - pnpm db:push          (schema applied to database)
 *
 * Environment:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/adult_v_dev
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import {
  products,
  productSources,
  productPrices,
  productSales,
  productImages,
  productPerformers,
  productTags,
  productReviews,
  productRatingSummary,
  performers,
  performerAliases,
  performerImages,
  tags,
  priceHistory,
} from '../packages/database/src/schema';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/adult_v_dev';
const isClean = process.argv.includes('--clean');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a date string N days ago from today */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function now(): Date {
  return new Date();
}

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

const MAKERS = [
  { name: 'テストスタジオA', category: 'maker' as const, nameEn: 'Test Studio A' },
  { name: 'テストスタジオB', category: 'maker' as const, nameEn: 'Test Studio B' },
  { name: 'テストスタジオC', category: 'maker' as const, nameEn: 'Test Studio C' },
];

const GENRES = [
  { name: 'テストジャンル1', category: 'genre' as const, nameEn: 'Test Genre 1' },
  { name: 'テストジャンル2', category: 'genre' as const, nameEn: 'Test Genre 2' },
  { name: 'テストジャンル3', category: 'genre' as const, nameEn: 'Test Genre 3' },
  { name: 'テストジャンル4', category: 'genre' as const, nameEn: 'Test Genre 4' },
  { name: 'テストジャンル5', category: 'genre' as const, nameEn: 'Test Genre 5' },
];

const SERIES = [
  { name: 'テストシリーズ1', category: 'series' as const, nameEn: 'Test Series 1' },
  { name: 'テストシリーズ2', category: 'series' as const, nameEn: 'Test Series 2' },
];

const PERFORMERS_DATA = [
  {
    name: 'テスト女優あい',
    nameKana: 'てすとじょゆうあい',
    nameEn: 'Test Actress Ai',
    height: 158,
    bust: 88,
    waist: 58,
    hip: 86,
    cup: 'F',
    birthday: '1998-03-15',
    bloodType: 'A',
    birthplace: '東京都',
    debutYear: 2020,
    releaseCount: 45,
  },
  {
    name: 'テスト女優みく',
    nameKana: 'てすとじょゆうみく',
    nameEn: 'Test Actress Miku',
    height: 165,
    bust: 84,
    waist: 56,
    hip: 84,
    cup: 'D',
    birthday: '1999-07-22',
    bloodType: 'O',
    birthplace: '大阪府',
    debutYear: 2021,
    releaseCount: 30,
  },
  {
    name: 'テスト女優さくら',
    nameKana: 'てすとじょゆうさくら',
    nameEn: 'Test Actress Sakura',
    height: 155,
    bust: 92,
    waist: 60,
    hip: 88,
    cup: 'G',
    birthday: '1997-12-01',
    bloodType: 'B',
    birthplace: '愛知県',
    debutYear: 2019,
    releaseCount: 60,
  },
  {
    name: 'テスト女優りん',
    nameKana: 'てすとじょゆうりん',
    nameEn: 'Test Actress Rin',
    height: 162,
    bust: 80,
    waist: 55,
    hip: 82,
    cup: 'C',
    birthday: '2000-05-10',
    bloodType: 'AB',
    birthplace: '福岡県',
    debutYear: 2022,
    releaseCount: 15,
  },
  {
    name: 'テスト女優ゆい',
    nameKana: 'てすとじょゆうゆい',
    nameEn: 'Test Actress Yui',
    height: 160,
    bust: 86,
    waist: 57,
    hip: 85,
    cup: 'E',
    birthday: '2001-09-28',
    bloodType: 'A',
    birthplace: '神奈川県',
    debutYear: 2023,
    releaseCount: 8,
  },
];

const PRODUCTS_DATA = [
  {
    normalizedProductId: 'TEST-001',
    makerProductCode: 'TSTA-001',
    title: 'テスト作品001 初めての撮影',
    titleEn: 'Test Product 001 First Shoot',
    releaseDate: daysAgo(30),
    duration: 120,
    description: 'テスト作品の説明文です。開発環境用のサンプルデータ。',
    performerCount: 1,
    bestRating: '4.50',
    totalReviews: 15,
    minPrice: 1980,
  },
  {
    normalizedProductId: 'TEST-002',
    makerProductCode: 'TSTA-002',
    title: 'テスト作品002 特別編',
    titleEn: 'Test Product 002 Special Edition',
    releaseDate: daysAgo(25),
    duration: 150,
    description: 'テスト作品002の説明文です。特別編。',
    performerCount: 2,
    bestRating: '4.20',
    totalReviews: 8,
    minPrice: 2480,
  },
  {
    normalizedProductId: 'TEST-003',
    makerProductCode: 'TSTB-001',
    title: 'テスト作品003 完全版',
    titleEn: 'Test Product 003 Complete Edition',
    releaseDate: daysAgo(20),
    duration: 180,
    description: 'テスト作品003の説明文です。完全版。',
    performerCount: 1,
    bestRating: '4.80',
    totalReviews: 22,
    minPrice: 2980,
  },
  {
    normalizedProductId: 'TEST-004',
    makerProductCode: 'TSTB-002',
    title: 'テスト作品004 デビュー記念',
    titleEn: 'Test Product 004 Debut Anniversary',
    releaseDate: daysAgo(15),
    duration: 130,
    description: 'テスト作品004の説明文です。デビュー記念作品。',
    performerCount: 1,
    bestRating: '3.80',
    totalReviews: 5,
    minPrice: 1480,
  },
  {
    normalizedProductId: 'TEST-005',
    makerProductCode: 'TSTB-003',
    title: 'テスト作品005 セール対象',
    titleEn: 'Test Product 005 On Sale',
    releaseDate: daysAgo(60),
    duration: 110,
    description: 'テスト作品005の説明文です。セール対象作品。',
    performerCount: 1,
    hasActiveSale: true,
    bestRating: '4.00',
    totalReviews: 12,
    minPrice: 980,
  },
  {
    normalizedProductId: 'TEST-006',
    makerProductCode: 'TSTC-001',
    title: 'テスト作品006 人気シリーズ第1弾',
    titleEn: 'Test Product 006 Popular Series Vol.1',
    releaseDate: daysAgo(90),
    duration: 140,
    description: 'テスト作品006の説明文です。人気シリーズ第1弾。',
    performerCount: 3,
    bestRating: '4.60',
    totalReviews: 35,
    minPrice: 3480,
  },
  {
    normalizedProductId: 'TEST-007',
    makerProductCode: 'TSTC-002',
    title: 'テスト作品007 人気シリーズ第2弾',
    titleEn: 'Test Product 007 Popular Series Vol.2',
    releaseDate: daysAgo(45),
    duration: 145,
    description: 'テスト作品007の説明文です。人気シリーズ第2弾。',
    performerCount: 2,
    bestRating: '4.70',
    totalReviews: 28,
    minPrice: 3480,
  },
  {
    normalizedProductId: 'TEST-008',
    makerProductCode: 'TSTA-003',
    title: 'テスト作品008 新人限定',
    titleEn: 'Test Product 008 Newcomers Only',
    releaseDate: daysAgo(10),
    duration: 100,
    description: 'テスト作品008の説明文です。新人限定。',
    performerCount: 1,
    bestRating: '3.50',
    totalReviews: 3,
    minPrice: 1280,
  },
  {
    normalizedProductId: 'TEST-009',
    makerProductCode: 'TSTA-004',
    title: 'テスト作品009 4K対応',
    titleEn: 'Test Product 009 4K Supported',
    releaseDate: daysAgo(5),
    duration: 160,
    description: 'テスト作品009の説明文です。4K対応の高画質作品。',
    performerCount: 1,
    hasVideo: true,
    bestRating: '4.90',
    totalReviews: 2,
    minPrice: 3980,
  },
  {
    normalizedProductId: 'TEST-010',
    makerProductCode: 'TSTC-003',
    title: 'テスト作品010 豪華共演',
    titleEn: 'Test Product 010 All-Star Cast',
    releaseDate: daysAgo(2),
    duration: 240,
    description: 'テスト作品010の説明文です。豪華メンバーによる共演作品。',
    performerCount: 5,
    bestRating: '4.95',
    totalReviews: 1,
    minPrice: 4980,
  },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Connecting to database...');
  console.log(`  DATABASE_URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool);

  try {
    // ------------------------------------------------------------------
    // Clean mode: truncate tables
    // ------------------------------------------------------------------
    if (isClean) {
      console.log('\n[CLEAN] Truncating tables...');
      await db.execute(sql`
        TRUNCATE TABLE
          price_history,
          product_sales,
          product_prices,
          product_reviews,
          product_rating_summary,
          product_images,
          product_videos,
          product_translations,
          product_tags,
          product_performers,
          product_sources,
          performer_aliases,
          performer_images,
          performer_external_ids,
          performer_tags,
          products,
          performers,
          tags
        CASCADE
      `);
      console.log('[CLEAN] Tables truncated.');
    }

    // ------------------------------------------------------------------
    // 1. Tags (makers, genres, series)
    // ------------------------------------------------------------------
    console.log('\n[1/7] Seeding tags (makers, genres, series)...');
    const allTagData = [...MAKERS, ...GENRES, ...SERIES];
    const insertedTags = await db
      .insert(tags)
      .values(
        allTagData.map((t) => ({
          name: t.name,
          category: t.category,
          nameEn: t.nameEn,
          createdAt: now(),
        })),
      )
      .onConflictDoNothing()
      .returning();
    console.log(`  Inserted ${insertedTags.length} tags.`);

    // Build lookup maps
    const makerTagIds = insertedTags.filter((t) => t.category === 'maker').map((t) => t.id);
    const genreTagIds = insertedTags.filter((t) => t.category === 'genre').map((t) => t.id);
    const seriesTagIds = insertedTags.filter((t) => t.category === 'series').map((t) => t.id);

    // ------------------------------------------------------------------
    // 2. Performers
    // ------------------------------------------------------------------
    console.log('[2/7] Seeding performers...');
    const insertedPerformers = await db
      .insert(performers)
      .values(
        PERFORMERS_DATA.map((p) => ({
          name: p.name,
          nameKana: p.nameKana,
          nameEn: p.nameEn,
          height: p.height,
          bust: p.bust,
          waist: p.waist,
          hip: p.hip,
          cup: p.cup,
          birthday: p.birthday,
          bloodType: p.bloodType,
          birthplace: p.birthplace,
          debutYear: p.debutYear,
          releaseCount: p.releaseCount,
          latestReleaseDate: daysAgo(Math.floor(Math.random() * 30)),
          createdAt: now(),
        })),
      )
      .onConflictDoNothing()
      .returning();
    console.log(`  Inserted ${insertedPerformers.length} performers.`);

    // Performer aliases
    if (insertedPerformers.length > 0) {
      const aliasData = insertedPerformers.flatMap((p) => [
        {
          performerId: p.id,
          aliasName: `${p.name}（別名）`,
          source: 'manual',
          isPrimary: false,
          createdAt: now(),
        },
      ]);
      const insertedAliases = await db
        .insert(performerAliases)
        .values(aliasData)
        .onConflictDoNothing()
        .returning();
      console.log(`  Inserted ${insertedAliases.length} performer aliases.`);

      // Performer images (placeholder URLs)
      const performerImageData = insertedPerformers.map((p) => ({
        performerId: p.id,
        imageUrl: `https://placehold.co/300x400?text=${encodeURIComponent(p.name)}`,
        imageType: 'profile',
        width: 300,
        height: 400,
        source: 'seed',
        isPrimary: true,
        createdAt: now(),
      }));
      const insertedPerfImages = await db
        .insert(performerImages)
        .values(performerImageData)
        .onConflictDoNothing()
        .returning();
      console.log(`  Inserted ${insertedPerfImages.length} performer images.`);
    }

    // ------------------------------------------------------------------
    // 3. Products
    // ------------------------------------------------------------------
    console.log('[3/7] Seeding products...');
    const insertedProducts = await db
      .insert(products)
      .values(
        PRODUCTS_DATA.map((p) => ({
          normalizedProductId: p.normalizedProductId,
          makerProductCode: p.makerProductCode,
          title: p.title,
          titleEn: p.titleEn,
          releaseDate: p.releaseDate,
          duration: p.duration,
          description: p.description,
          performerCount: p.performerCount ?? 0,
          hasVideo: p.hasVideo ?? false,
          hasActiveSale: p.hasActiveSale ?? false,
          bestRating: p.bestRating,
          totalReviews: p.totalReviews ?? 0,
          minPrice: p.minPrice,
          createdAt: now(),
          updatedAt: now(),
        })),
      )
      .onConflictDoNothing()
      .returning();
    console.log(`  Inserted ${insertedProducts.length} products.`);

    // ------------------------------------------------------------------
    // 4. Product Sources & Prices
    // ------------------------------------------------------------------
    console.log('[4/7] Seeding product sources, prices & sales...');
    let totalSources = 0;
    let totalPrices = 0;
    let totalSales = 0;

    for (const product of insertedProducts) {
      // Each product gets 1-2 ASP sources
      const aspEntries: Array<{ aspName: string; price: number }> = [
        { aspName: 'DMM', price: product.minPrice ?? 1980 },
      ];
      // Half the products also have an MGS source
      if (Math.random() > 0.5) {
        aspEntries.push({ aspName: 'MGS', price: (product.minPrice ?? 1980) + 200 });
      }

      for (const asp of aspEntries) {
        const [source] = await db
          .insert(productSources)
          .values({
            productId: product.id,
            aspName: asp.aspName,
            originalProductId: `${asp.aspName.toLowerCase()}_${product.normalizedProductId}`,
            affiliateUrl: `https://example.com/${asp.aspName.toLowerCase()}/${product.normalizedProductId}`,
            price: asp.price,
            currency: 'JPY',
            productType: 'haishin',
            dataSource: 'API',
            lastUpdated: now(),
          })
          .onConflictDoNothing()
          .returning();
        totalSources++;

        if (!source) continue;

        // Prices (download + streaming)
        const priceEntries = [
          {
            productSourceId: source.id,
            priceType: 'download',
            price: asp.price,
            currency: 'JPY',
            isDefault: true,
            displayOrder: 0,
            createdAt: now(),
            updatedAt: now(),
          },
          {
            productSourceId: source.id,
            priceType: 'streaming',
            price: Math.round(asp.price * 0.8),
            currency: 'JPY',
            isDefault: false,
            displayOrder: 1,
            createdAt: now(),
            updatedAt: now(),
          },
        ];
        const insertedPrices = await db
          .insert(productPrices)
          .values(priceEntries)
          .onConflictDoNothing()
          .returning();
        totalPrices += insertedPrices.length;

        // Sale for products flagged as on sale
        if (product.hasActiveSale) {
          const saleData = {
            productSourceId: source.id,
            regularPrice: asp.price,
            salePrice: Math.round(asp.price * 0.5),
            discountPercent: 50,
            saleType: 'campaign',
            saleName: 'テスト半額キャンペーン',
            startAt: new Date(daysAgo(7)),
            endAt: new Date(daysAgo(-7)), // 7 days from now
            isActive: true,
            fetchedAt: now(),
            createdAt: now(),
            updatedAt: now(),
          };
          const insertedSales = await db
            .insert(productSales)
            .values(saleData)
            .onConflictDoNothing()
            .returning();
          totalSales += insertedSales.length;
        }

        // Price history (last 30 days, weekly snapshots)
        const historyEntries = [];
        for (let dayOffset = 28; dayOffset >= 0; dayOffset -= 7) {
          historyEntries.push({
            productSourceId: source.id,
            price: asp.price,
            salePrice: product.hasActiveSale ? Math.round(asp.price * 0.5) : null,
            discountPercent: product.hasActiveSale ? 50 : null,
            recordedAt: new Date(daysAgo(dayOffset)),
          });
        }
        await db.insert(priceHistory).values(historyEntries).onConflictDoNothing();
      }
    }
    console.log(`  Inserted ${totalSources} product sources.`);
    console.log(`  Inserted ${totalPrices} product prices.`);
    console.log(`  Inserted ${totalSales} product sales.`);

    // ------------------------------------------------------------------
    // 5. Product-Performer relations
    // ------------------------------------------------------------------
    console.log('[5/7] Seeding product-performer relations...');
    const ppData: Array<{ productId: number; performerId: number }> = [];
    for (const product of insertedProducts) {
      // Assign 1-3 performers per product (based on performerCount)
      const count = Math.min(product.performerCount ?? 1, insertedPerformers.length);
      const shuffled = [...insertedPerformers].sort(() => Math.random() - 0.5);
      for (let i = 0; i < count; i++) {
        ppData.push({ productId: product.id, performerId: shuffled[i]!.id });
      }
    }
    // Deduplicate
    const uniquePP = [
      ...new Map(ppData.map((x) => [`${x.productId}-${x.performerId}`, x])).values(),
    ];
    if (uniquePP.length > 0) {
      const insertedPP = await db
        .insert(productPerformers)
        .values(uniquePP)
        .onConflictDoNothing()
        .returning();
      console.log(`  Inserted ${insertedPP.length} product-performer relations.`);
    }

    // ------------------------------------------------------------------
    // 6. Product-Tag relations
    // ------------------------------------------------------------------
    console.log('[6/7] Seeding product-tag relations...');
    const ptData: Array<{ productId: number; tagId: number }> = [];
    for (const product of insertedProducts) {
      // Assign maker tag based on product code prefix
      const code = product.makerProductCode ?? '';
      let makerIdx = 0;
      if (code.startsWith('TSTB')) makerIdx = 1;
      else if (code.startsWith('TSTC')) makerIdx = 2;
      if (makerTagIds[makerIdx]) {
        ptData.push({ productId: product.id, tagId: makerTagIds[makerIdx]! });
      }

      // Assign 2-3 random genre tags
      const shuffledGenres = [...genreTagIds].sort(() => Math.random() - 0.5);
      const genreCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < genreCount && i < shuffledGenres.length; i++) {
        ptData.push({ productId: product.id, tagId: shuffledGenres[i]! });
      }

      // Some products get a series tag
      if (product.title.includes('シリーズ') && seriesTagIds.length > 0) {
        ptData.push({ productId: product.id, tagId: seriesTagIds[0]! });
      }
    }
    const uniquePT = [
      ...new Map(ptData.map((x) => [`${x.productId}-${x.tagId}`, x])).values(),
    ];
    if (uniquePT.length > 0) {
      const insertedPT = await db
        .insert(productTags)
        .values(uniquePT)
        .onConflictDoNothing()
        .returning();
      console.log(`  Inserted ${insertedPT.length} product-tag relations.`);
    }

    // ------------------------------------------------------------------
    // 7. Product images, reviews, rating summaries
    // ------------------------------------------------------------------
    console.log('[7/7] Seeding product images, reviews & rating summaries...');
    let totalImages = 0;
    let totalReviews = 0;
    let totalRatingSummaries = 0;

    for (const product of insertedProducts) {
      // Product images (thumbnail + 2 samples)
      const imageData = [
        {
          productId: product.id,
          imageUrl: `https://placehold.co/800x538?text=${encodeURIComponent(product.title.slice(0, 10))}`,
          imageType: 'thumbnail',
          width: 800,
          height: 538,
          aspName: 'DMM',
          displayOrder: 0,
          createdAt: now(),
        },
        {
          productId: product.id,
          imageUrl: `https://placehold.co/800x538?text=Sample1`,
          imageType: 'sample',
          width: 800,
          height: 538,
          aspName: 'DMM',
          displayOrder: 1,
          createdAt: now(),
        },
        {
          productId: product.id,
          imageUrl: `https://placehold.co/800x538?text=Sample2`,
          imageType: 'sample',
          width: 800,
          height: 538,
          aspName: 'DMM',
          displayOrder: 2,
          createdAt: now(),
        },
      ];
      const insertedImages = await db
        .insert(productImages)
        .values(imageData)
        .onConflictDoNothing()
        .returning();
      totalImages += insertedImages.length;

      // Reviews (1-3 per product)
      const reviewCount = 1 + Math.floor(Math.random() * 3);
      const reviewData = [];
      for (let i = 0; i < reviewCount; i++) {
        const rating = (3 + Math.random() * 2).toFixed(1); // 3.0 ~ 5.0
        reviewData.push({
          productId: product.id,
          aspName: 'DMM',
          reviewerName: `テストレビュワー${i + 1}`,
          rating,
          maxRating: '5',
          title: `テストレビュー${i + 1}`,
          content: `テスト用のレビュー本文です。この作品は素晴らしい内容でした。評価: ${rating}/5`,
          reviewDate: new Date(daysAgo(Math.floor(Math.random() * 30))),
          helpful: Math.floor(Math.random() * 20),
          sourceReviewId: `test_review_${product.id}_${i}`,
          createdAt: now(),
          updatedAt: now(),
        });
      }
      const insertedReviews = await db
        .insert(productReviews)
        .values(reviewData)
        .onConflictDoNothing()
        .returning();
      totalReviews += insertedReviews.length;

      // Rating summary
      const avgRating = product.bestRating ?? '4.00';
      const ratingDist = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 8 };
      const summaryData = {
        productId: product.id,
        aspName: 'DMM',
        averageRating: avgRating,
        maxRating: '5',
        totalReviews: product.totalReviews ?? 0,
        ratingDistribution: ratingDist,
        lastUpdated: now(),
      };
      const insertedSummary = await db
        .insert(productRatingSummary)
        .values(summaryData)
        .onConflictDoNothing()
        .returning();
      totalRatingSummaries += insertedSummary.length;
    }
    console.log(`  Inserted ${totalImages} product images.`);
    console.log(`  Inserted ${totalReviews} product reviews.`);
    console.log(`  Inserted ${totalRatingSummaries} rating summaries.`);

    // ------------------------------------------------------------------
    // Done
    // ------------------------------------------------------------------
    console.log('\n=== Seed complete ===');
    console.log(`  Tags:               ${insertedTags.length}`);
    console.log(`  Performers:         ${insertedPerformers.length}`);
    console.log(`  Products:           ${insertedProducts.length}`);
    console.log(`  Product Sources:    ${totalSources}`);
    console.log(`  Product Prices:     ${totalPrices}`);
    console.log(`  Product Sales:      ${totalSales}`);
    console.log(`  Product Images:     ${totalImages}`);
    console.log(`  Product Reviews:    ${totalReviews}`);
    console.log(`  Rating Summaries:   ${totalRatingSummaries}`);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
