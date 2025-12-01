import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import {
  isValidPerformerName,
  normalizePerformerName,
  parsePerformerNames,
} from '../lib/performer-validation';

async function extract() {
  const db = getDb();

  // 商品285543の情報を確認
  console.log('=== 商品285543 (b10f) の出演者抽出 ===\n');

  // product_sources から original_product_id を取得
  const productInfo = await db.execute(sql`
    SELECT ps.original_product_id, ps.asp_name, p.title
    FROM product_sources ps
    JOIN products p ON p.id = ps.product_id
    WHERE ps.product_id = 285543
  `);

  if (productInfo.rows.length === 0) {
    console.log('Product 285543 not found');
    process.exit(1);
  }

  const info = productInfo.rows[0] as any;
  console.log(`original_product_id: ${info.original_product_id}`);
  console.log(`ASP: ${info.asp_name}`);
  console.log(`Title: ${info.title}`);

  // raw_csv_data から該当商品のデータを取得
  console.log('\n【1】raw_csv_data を確認');
  const csvData = await db.execute(sql`
    SELECT source, product_id, raw_data
    FROM raw_csv_data
    WHERE product_id = ${info.original_product_id}
       OR product_id LIKE ${'%' + info.original_product_id + '%'}
    LIMIT 5
  `);

  console.log(`raw_csv_data件数: ${csvData.rows.length}`);

  let performerNames: string[] = [];

  for (const row of csvData.rows as any[]) {
    console.log(`\nSource: ${row.source}, ProductID: ${row.product_id}`);

    if (row.raw_data) {
      const data =
        typeof row.raw_data === 'string'
          ? JSON.parse(row.raw_data)
          : row.raw_data;

      console.log('raw_data keys:', Object.keys(data));

      // 配列形式の場合、12番目（インデックス11）を確認
      if (Array.isArray(data)) {
        console.log(`Array length: ${data.length}`);
        if (data.length >= 12) {
          console.log(`Column 12 (index 11): "${data[11]}"`);
          const col12 = data[11];
          if (col12 && typeof col12 === 'string') {
            const names = parsePerformerNames(col12);
            console.log(`Parsed names: ${names.join(', ')}`);
            performerNames.push(...names);
          }
        }
        // すべてのカラムを表示
        data.forEach((val: any, idx: number) => {
          if (
            typeof val === 'string' &&
            val.length > 0 &&
            val.length < 50 &&
            !val.match(/^[\d\-\/\.:]+$/)
          ) {
            console.log(`  [${idx}]: ${val}`);
          }
        });
      } else if (typeof data === 'object') {
        // オブジェクト形式の場合、出演者関連のキーを探す
        for (const [key, value] of Object.entries(data)) {
          const keyLower = key.toLowerCase();
          if (
            keyLower.includes('performer') ||
            keyLower.includes('actress') ||
            keyLower.includes('出演') ||
            keyLower.includes('actor') ||
            key === '12' ||
            key === '11'
          ) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
            if (typeof value === 'string') {
              const names = parsePerformerNames(value);
              performerNames.push(...names);
            }
          }
        }
      }
    }
  }

  // タイトルからも出演者名を抽出（木下ひまり）
  console.log('\n【2】タイトルから出演者を抽出');
  const title = info.title as string;
  console.log(`Title: ${title}`);

  // "まるっと！木下ひまり　8時間2枚組 2/2" から "木下ひまり" を抽出
  // パターン: 「まるっと！XXX」や「XXX 8時間」など
  const titlePatterns = [
    /まるっと[！!]?\s*([^\s　]+)/,
    /^([^\s　]+(?:\s[^\s　]+)?)\s*[0-9]+時間/,
  ];

  for (const pattern of titlePatterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      console.log(`Matched pattern: "${name}"`);
      if (isValidPerformerName(name)) {
        performerNames.push(name);
      }
    }
  }

  // 重複を削除
  performerNames = [...new Set(performerNames)];
  console.log('\n=== 抽出した出演者 ===');
  console.log(performerNames);

  // 「木下ひまり」を手動で追加（タイトルから明らか）
  if (!performerNames.includes('木下ひまり')) {
    performerNames.push('木下ひまり');
    console.log('Added 木下ひまり from title');
  }

  // 商品285543に紐づける
  if (performerNames.length > 0) {
    console.log('\n=== 商品285543に出演者を紐づけ ===');
    for (const name of performerNames) {
      const normalized = normalizePerformerName(name);
      if (!normalized) {
        console.log(`Skipped invalid name: ${name}`);
        continue;
      }

      // performers テーブルにupsert
      const performerResult = await db.execute(sql`
        INSERT INTO performers (name)
        VALUES (${normalized})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `);
      const performerId = (performerResult.rows[0] as { id: number }).id;
      console.log(`Performer ${normalized}: id=${performerId}`);

      // product_performers テーブルにリンク (product_id = 285543)
      const linkResult = await db.execute(sql`
        INSERT INTO product_performers (product_id, performer_id)
        VALUES (285543, ${performerId})
        ON CONFLICT DO NOTHING
        RETURNING product_id
      `);

      if (linkResult.rowCount && linkResult.rowCount > 0) {
        console.log(`  Linked to product 285543`);
      } else {
        console.log(`  Already linked or conflict`);
      }
    }
  }

  // 確認
  console.log('\n=== 確認 ===');
  const check = await db.execute(sql`
    SELECT p.id, p.title, STRING_AGG(perf.name, ', ') as performers
    FROM products p
    LEFT JOIN product_performers pp ON p.id = pp.product_id
    LEFT JOIN performers perf ON pp.performer_id = perf.id
    WHERE p.id = 285543
    GROUP BY p.id, p.title
  `);
  console.table(check.rows);

  process.exit(0);
}

extract().catch((e) => {
  console.error(e);
  process.exit(1);
});
