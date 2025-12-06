import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function analyze() {
  console.log('=== DTI系の価格データ分析 ===\n');

  // 1. DTIのURLパターン別価格分布
  const urlPriceStats = await db.execute(sql`
    SELECT
      CASE
        WHEN ps.affiliate_url LIKE '%caribbeancom%' THEN 'caribbeancom'
        WHEN ps.affiliate_url LIKE '%1pondo%' THEN '1pondo'
        WHEN ps.affiliate_url LIKE '%heyzo%' THEN 'heyzo'
        WHEN ps.affiliate_url LIKE '%10musume%' THEN '10musume'
        WHEN ps.affiliate_url LIKE '%pacopacomama%' THEN 'pacopacomama'
        WHEN ps.affiliate_url LIKE '%kin8tengoku%' THEN 'kin8tengoku'
        WHEN ps.affiliate_url LIKE '%nyoshin%' THEN 'nyoshin'
        WHEN ps.affiliate_url LIKE '%unkotare%' THEN 'unkotare'
        WHEN ps.affiliate_url LIKE '%hitozuma-giri%' THEN 'hitozuma-giri'
        WHEN ps.affiliate_url LIKE '%av-e-body%' THEN 'av-e-body'
        WHEN ps.affiliate_url LIKE '%av-4610%' THEN 'av-4610'
        WHEN ps.affiliate_url LIKE '%av-0230%' THEN 'av-0230'
        ELSE 'other'
      END as site_name,
      COUNT(*) as count,
      MIN(ps.price) as min_price,
      MAX(ps.price) as max_price,
      ROUND(AVG(ps.price)) as avg_price,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ps.price)) as median_price
    FROM product_sources ps
    WHERE ps.asp_name = 'dti'
      AND ps.price IS NOT NULL
      AND ps.price > 0
    GROUP BY 1
    ORDER BY count DESC
  `);

  console.log('サイト別価格統計 (単位: 円換算):');
  console.log('-'.repeat(80));
  console.log(String('Site').padEnd(20) +
    String('Count').padStart(8) +
    String('Min').padStart(10) +
    String('Max').padStart(10) +
    String('Avg').padStart(10) +
    String('Median').padStart(10));
  console.log('-'.repeat(80));

  for (const row of urlPriceStats.rows as any[]) {
    console.log(
      String(row.site_name).padEnd(20) +
      String(row.count).padStart(8) +
      String(`¥${Number(row.min_price).toLocaleString()}`).padStart(10) +
      String(`¥${Number(row.max_price).toLocaleString()}`).padStart(10) +
      String(`¥${Number(row.avg_price).toLocaleString()}`).padStart(10) +
      String(`¥${Number(row.median_price).toLocaleString()}`).padStart(10)
    );
  }

  // 2. 価格帯分布を調べる（月額サイトか単品か判断するため）
  console.log('\n\n=== 価格帯別分布 ===');
  const priceBands = await db.execute(sql`
    SELECT
      CASE
        WHEN ps.price < 500 THEN '~¥500 (USD ~$3.3)'
        WHEN ps.price < 1000 THEN '¥500-1000 (USD $3.3-6.6)'
        WHEN ps.price < 2000 THEN '¥1000-2000 (USD $6.6-13)'
        WHEN ps.price < 3000 THEN '¥2000-3000 (USD $13-20)'
        WHEN ps.price < 5000 THEN '¥3000-5000 (USD $20-33)'
        WHEN ps.price < 7500 THEN '¥5000-7500 (USD $33-50)'
        WHEN ps.price < 10000 THEN '¥7500-10000 (USD $50-66)'
        ELSE '¥10000+ (USD $66+)'
      END as price_band,
      COUNT(*) as count,
      array_agg(DISTINCT
        CASE
          WHEN ps.affiliate_url LIKE '%caribbeancom%' THEN 'caribbeancom'
          WHEN ps.affiliate_url LIKE '%1pondo%' THEN '1pondo'
          WHEN ps.affiliate_url LIKE '%heyzo%' THEN 'heyzo'
          ELSE 'other'
        END
      ) as sites
    FROM product_sources ps
    WHERE ps.asp_name = 'dti'
      AND ps.price IS NOT NULL
      AND ps.price > 0
    GROUP BY 1
    ORDER BY MIN(ps.price)
  `);

  for (const row of priceBands.rows as any[]) {
    console.log(`${row.price_band}: ${row.count}件 (${(row.sites as string[]).join(', ')})`);
  }

  // 3. サンプル表示：典型的な価格帯のデータ
  console.log('\n\n=== サンプルデータ ===');
  const samples = await db.execute(sql`
    SELECT
      ps.price,
      ps.affiliate_url,
      p.title,
      ps.original_product_id
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'dti'
      AND ps.price IS NOT NULL
    ORDER BY ps.id DESC
    LIMIT 15
  `);

  for (const row of samples.rows as any[]) {
    console.log(`¥${Number(row.price).toLocaleString()} | ${row.original_product_id}`);
    console.log(`  Title: ${(row.title as string)?.substring(0, 60)}...`);
    console.log(`  URL: ${(row.affiliate_url as string)?.substring(0, 80)}...`);
    console.log('');
  }

  // 4. $50前後（月額料金っぽい価格）の商品を調べる
  console.log('\n=== 月額料金相当（¥7,000-8,000 = $47-53）の商品 ===');
  const monthlyPriced = await db.execute(sql`
    SELECT
      ps.price,
      ps.affiliate_url,
      p.title,
      ps.original_product_id
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'dti'
      AND ps.price BETWEEN 7000 AND 8000
    LIMIT 10
  `);

  for (const row of monthlyPriced.rows as any[]) {
    console.log(`¥${Number(row.price).toLocaleString()} | ${row.original_product_id}`);
    console.log(`  Title: ${(row.title as string)?.substring(0, 60)}...`);
    console.log('');
  }
}

analyze().catch(console.error);
