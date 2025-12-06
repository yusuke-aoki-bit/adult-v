import { db } from '../lib/db/index.js';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('=== DTI価格詳細調査 ===\n');

  // 価格帯別分布
  console.log('=== 価格帯別分布 ===');
  const priceBands = await db.execute(sql`
    SELECT
      CASE
        WHEN price = 0 THEN '¥0'
        WHEN price < 500 THEN '~¥500'
        WHEN price < 1000 THEN '¥500-1000'
        WHEN price < 2000 THEN '¥1000-2000'
        WHEN price < 3000 THEN '¥2000-3000'
        WHEN price < 5000 THEN '¥3000-5000'
        WHEN price < 7500 THEN '¥5000-7500'
        WHEN price < 10000 THEN '¥7500-10000'
        ELSE '¥10000+'
      END as price_band,
      COUNT(*) as count
    FROM product_sources
    WHERE asp_name = 'DTI'
      AND price IS NOT NULL
    GROUP BY 1
    ORDER BY MIN(price)
  `);

  for (const row of priceBands.rows as any[]) {
    console.log(`${row.price_band}: ${row.count}件`);
  }

  // URL別の価格統計
  console.log('\n=== URL別価格統計 ===');
  const urlStats = await db.execute(sql`
    SELECT
      CASE
        WHEN affiliate_url LIKE '%caribbeancom%' AND affiliate_url NOT LIKE '%caribbeancompr%' THEN 'caribbeancom'
        WHEN affiliate_url LIKE '%caribbeancompr%' THEN 'caribbeancompr'
        WHEN affiliate_url LIKE '%1pondo%' THEN '1pondo'
        WHEN affiliate_url LIKE '%heyzo%' THEN 'heyzo'
        WHEN affiliate_url LIKE '%10musume%' THEN '10musume'
        WHEN affiliate_url LIKE '%pacopacomama%' THEN 'pacopacomama'
        WHEN affiliate_url LIKE '%kin8tengoku%' THEN 'kin8tengoku'
        WHEN affiliate_url LIKE '%nyoshin%' THEN 'nyoshin'
        WHEN affiliate_url LIKE '%unkotare%' THEN 'unkotare'
        WHEN affiliate_url LIKE '%hitozuma-giri%' THEN 'hitozuma-giri'
        WHEN affiliate_url LIKE '%av-e-body%' OR affiliate_url LIKE '%e-body%' THEN 'av-e-body'
        WHEN affiliate_url LIKE '%av-4610%' OR affiliate_url LIKE '%4610%' THEN 'av-4610'
        WHEN affiliate_url LIKE '%av-0230%' OR affiliate_url LIKE '%0230%' THEN 'av-0230'
        WHEN affiliate_url LIKE '%av-0930%' OR affiliate_url LIKE '%0930%' THEN 'av-0930'
        ELSE 'other'
      END as site_name,
      COUNT(*) as count,
      MIN(price) as min_price,
      MAX(price) as max_price,
      ROUND(AVG(price)) as avg_price
    FROM product_sources
    WHERE asp_name = 'DTI'
      AND price IS NOT NULL
    GROUP BY 1
    ORDER BY count DESC
  `);

  for (const row of urlStats.rows as any[]) {
    console.log(`${row.site_name}: ${row.count}件 | ¥${row.min_price}〜¥${row.max_price} (平均: ¥${row.avg_price})`);
  }

  // サンプルを見る：価格が月額相当（$30-50 = ¥4,500-7,500）のもの
  console.log('\n=== 月額相当価格（¥4,500-7,500）のサンプル ===');
  const monthlySamples = await db.execute(sql`
    SELECT
      ps.price,
      ps.affiliate_url,
      p.title
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
      AND ps.price BETWEEN 4500 AND 7500
    ORDER BY ps.id DESC
    LIMIT 10
  `);

  for (const row of monthlySamples.rows as any[]) {
    console.log(`¥${Number(row.price).toLocaleString()}: ${(row.title as string)?.substring(0, 50)}`);
    console.log(`  URL: ${(row.affiliate_url as string)?.substring(0, 80)}`);
  }

  // 低価格（単品PPV相当）のサンプル
  console.log('\n=== 低価格（¥0-3000）のサンプル ===');
  const ppvSamples = await db.execute(sql`
    SELECT
      ps.price,
      ps.affiliate_url,
      p.title
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.asp_name = 'DTI'
      AND ps.price BETWEEN 0 AND 3000
    ORDER BY ps.id DESC
    LIMIT 10
  `);

  for (const row of ppvSamples.rows as any[]) {
    console.log(`¥${Number(row.price).toLocaleString()}: ${(row.title as string)?.substring(0, 50)}`);
    console.log(`  URL: ${(row.affiliate_url as string)?.substring(0, 80)}`);
  }
}

check().catch(console.error);
