import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import {
  isValidPerformerName,
  normalizePerformerName,
} from '../lib/performer-validation';

async function extract() {
  const db = getDb();

  // product_id 2517 の HTMLを取得
  const result = await db.execute(sql`
    SELECT id, source, product_id, html_content
    FROM raw_html_data
    WHERE product_id = '2517' AND source = 'HEYZO'
  `);

  if (result.rows.length === 0) {
    console.log('No HEYZO data found for product_id 2517');
    process.exit(1);
  }

  const row = result.rows[0] as any;
  const $ = cheerio.load(row.html_content);

  console.log('=== HTML解析 ===');

  // 出演情報を探す
  console.log('\n【1】tr.table-actor から抽出');
  $('tr.table-actor').each((_, elem) => {
    const text = $(elem).text().replace(/\s+/g, ' ').trim();
    console.log('  Found row:', text.substring(0, 100));

    // spanを探す
    $(elem)
      .find('span')
      .each((_, span) => {
        const name = $(span).text().trim();
        console.log('    Span:', name);
      });

    // aタグを探す
    $(elem)
      .find('a')
      .each((_, a) => {
        const name = $(a).text().trim();
        const href = $(a).attr('href');
        console.log('    A:', name, '- href:', href);
      });
  });

  console.log('\n【2】td:contains("出演") から抽出');
  $('td:contains("出演")').each((_, elem) => {
    const text = $(elem).text().trim();
    console.log('  Found td:', text);
    const nextTd = $(elem).next('td');
    console.log('  Next td:', nextTd.text().trim());
    nextTd.find('a').each((_, a) => {
      const name = $(a).text().trim();
      console.log('    A in next td:', name);
    });
  });

  console.log('\n【3】class*="actor" から抽出');
  $('[class*="actor"]').each((_, elem) => {
    const text = $(elem).text().replace(/\s+/g, ' ').trim().substring(0, 200);
    console.log('  Found element:', text);
  });

  console.log('\n【4】href*="/actress/" から抽出');
  $('a[href*="/actress/"]').each((_, elem) => {
    const name = $(elem).text().trim();
    const href = $(elem).attr('href');
    console.log('  Found:', name, '- href:', href);
  });

  // 直接HTMLの一部を表示
  console.log('\n【5】HTMLの"出演"周辺');
  const html = row.html_content;
  const idx = html.indexOf('出演');
  if (idx >= 0) {
    console.log(
      html.substring(Math.max(0, idx - 50), idx + 300).replace(/\s+/g, ' ')
    );
  }

  // 正しい出演者を抽出
  console.log('\n=== 出演者抽出 ===');
  const performerNames: string[] = [];

  // パターン: tr.table-actor 内の a > span
  $('tr.table-actor a span').each((_, elem) => {
    const name = $(elem).text().trim();
    if (name && name.length > 1 && name.length < 30) {
      console.log('Found performer:', name);
      performerNames.push(name);
    }
  });

  // フォールバック: 任意のtable-actor内のリンク
  if (performerNames.length === 0) {
    $('.table-actor a').each((_, elem) => {
      const name = $(elem).text().trim();
      if (name && name.length > 1 && name.length < 30) {
        console.log('Found performer (fallback):', name);
        performerNames.push(name);
      }
    });
  }

  // 有効な出演者名をフィルタ
  const validNames = performerNames.filter((name) => {
    const normalized = normalizePerformerName(name);
    return normalized && isValidPerformerName(normalized);
  });

  console.log('\n=== 有効な出演者 ===');
  console.log(validNames);

  // 商品178179に紐づける
  if (validNames.length > 0) {
    console.log('\n=== 商品178179に出演者を紐づけ ===');
    for (const name of validNames) {
      const normalized = normalizePerformerName(name);
      if (!normalized) continue;

      // performers テーブルにupsert
      const performerResult = await db.execute(sql`
        INSERT INTO performers (name)
        VALUES (${normalized})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `);
      const performerId = (performerResult.rows[0] as { id: number }).id;
      console.log(`Performer ${normalized}: id=${performerId}`);

      // product_performers テーブルにリンク (product_id = 178179)
      const linkResult = await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (178179, ${performerId})
        ON CONFLICT DO NOTHING
        RETURNING product_id
      `);

      if (linkResult.rowCount && linkResult.rowCount > 0) {
        console.log(`  Linked to product 178179`);
      } else {
        console.log(`  Already linked or error`);
      }
    }
  }

  process.exit(0);
}

extract().catch((e) => {
  console.error(e);
  process.exit(1);
});
