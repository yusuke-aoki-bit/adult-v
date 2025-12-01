import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';

const db = getDb();

async function checkRawPerformers() {
  console.log('=== raw_performers 調査 ===\n');

  // まず product_sources テーブルのカラム構造を確認
  console.log('【0】product_sources テーブル構造確認');
  const columns = await db.execute(sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'product_sources'
    ORDER BY ordinal_position
  `);
  console.table(columns.rows);

  // 商品285543と178179の基本情報を確認
  console.log('\n【1】商品285543と178179の情報確認');
  const targetProducts = await db.execute(sql`
    SELECT p.id, p.title, p.normalized_product_id, ps.asp_name, ps.original_product_id, ps.affiliate_url
    FROM products p
    LEFT JOIN product_sources ps ON p.id = ps.product_id
    WHERE p.id IN (285543, 178179)
  `);

  for (const row of targetProducts.rows as any[]) {
    console.log(`\nID: ${row.id}`);
    console.log(`Title: ${row.title}`);
    console.log(`normalized_product_id: ${row.normalized_product_id}`);
    console.log(`ASP: ${row.asp_name}`);
    console.log(`original_product_id: ${row.original_product_id}`);
    console.log(`affiliate_url: ${row.affiliate_url}`);
  }

  // raw_csv_dataに出演者情報があるか確認
  console.log('\n\n【2】raw_csv_data から出演者情報を確認');
  const rawCsvData = await db.execute(sql`
    SELECT source, product_id, raw_data
    FROM raw_csv_data
    WHERE product_id IN (
      SELECT original_product_id FROM product_sources WHERE product_id IN (285543, 178179)
    )
    OR product_id LIKE '%285543%' OR product_id LIKE '%178179%'
    LIMIT 10
  `);

  console.log(`raw_csv_data件数: ${rawCsvData.rows.length}`);
  for (const row of rawCsvData.rows as any[]) {
    console.log(`\nSource: ${row.source}, ProductID: ${row.product_id}`);
    if (row.raw_data) {
      const data = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data;
      console.log(`  performers/actress関連キー:`, Object.keys(data).filter(k =>
        k.toLowerCase().includes('performer') ||
        k.toLowerCase().includes('actress') ||
        k.toLowerCase().includes('出演')
      ));
      // 出演者関連のデータを表示
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().includes('performer') ||
            key.toLowerCase().includes('actress') ||
            key.toLowerCase().includes('出演')) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      }
    }
  }

  // raw_html_dataから出演者情報を確認（HTMLの内容を直接分析）
  console.log('\n\n【3】raw_html_data から出演者情報を確認');
  const rawHtmlData = await db.execute(sql`
    SELECT source, product_id, url, html_content
    FROM raw_html_data
    WHERE product_id IN (
      SELECT original_product_id FROM product_sources WHERE product_id IN (285543, 178179)
    )
    LIMIT 5
  `);

  console.log(`raw_html_data件数: ${rawHtmlData.rows.length}`);
  for (const row of rawHtmlData.rows as any[]) {
    console.log(`\n  Source: ${row.source}, ProductID: ${row.product_id}`);
    console.log(`  URL: ${row.url}`);

    const html = row.html_content || '';
    console.log(`  HTML length: ${html.length} chars`);

    // HEYZO形式の出演者情報を探す
    // movieInfoテーブルやactress情報を探す
    const actressPatterns = [
      // テーブル形式
      /<th[^>]*>出演[^<]*<\/th>\s*<td[^>]*>([^<]+)/gi,
      /<span[^>]*>出演[^<]*<\/span>\s*([^<]+)/gi,
      // クラス名でactress
      /class="[^"]*actress[^"]*"[^>]*>([^<]+)/gi,
      // href内にactress
      /<a[^>]*href="[^"]*\/actress\/[^"]*"[^>]*>([^<]+)/gi,
      // movieActress関連
      /movieActress[^>]*>([^<]+)/gi,
      // HEYZO特有: actor-name
      /actor-name[^>]*>([^<]+)/gi,
      // table > tr > td パターン
      /<td[^>]*class="[^"]*label[^"]*"[^>]*>[^<]*出演[^<]*<\/td>\s*<td[^>]*>([^<]+)/gi,
    ];

    let foundActress = false;
    for (const pattern of actressPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const name = match[1]?.trim();
        if (name && name.length > 1 && name.length < 50) {
          console.log(`    ✓ Found: "${name}" (pattern: ${pattern.source.substring(0, 30)}...)`);
          foundActress = true;
        }
      }
    }

    // 見つからなければHTML構造を確認
    if (!foundActress) {
      // 「出演」という文字列周辺を表示
      const idx = html.indexOf('出演');
      if (idx >= 0) {
        console.log(`    HTML around "出演": ${html.substring(Math.max(0, idx-50), idx+200).replace(/\s+/g, ' ')}`);
      }

      // 「actress」という文字列周辺を表示
      const actressIdx = html.toLowerCase().indexOf('actress');
      if (actressIdx >= 0) {
        console.log(`    HTML around "actress": ${html.substring(Math.max(0, actressIdx-30), actressIdx+150).replace(/\s+/g, ' ')}`);
      }
    }
  }

  // product_performers の状況
  console.log('\n\n【4】product_performers の紐づけ状況');
  const ppStatus = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      COUNT(pp.performer_id) as performer_count,
      STRING_AGG(perf.name, ', ') as performer_names
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers perf ON pp.performer_id = perf.id
    WHERE p.id IN (285543, 178179)
    GROUP BY p.id, p.title
  `);
  console.table(ppStatus.rows);

  // 出演者紐づけがない商品の統計
  console.log('\n\n【5】ASP別：出演者紐づけがない商品数');
  const byAsp = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT ps.product_id) as total_products,
      COUNT(DISTINCT CASE WHEN pp.product_id IS NULL THEN ps.product_id END) as no_performer_products
    FROM product_sources ps
    LEFT JOIN product_performers pp ON ps.product_id = pp.product_id
    GROUP BY ps.asp_name
    ORDER BY no_performer_products DESC
  `);
  console.table(byAsp.rows);

  process.exit(0);
}

checkRawPerformers().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
