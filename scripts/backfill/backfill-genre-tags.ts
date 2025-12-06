/**
 * ジャンルタグバックフィル スクリプト
 *
 * 商品タイトル/説明からジャンルキーワードを抽出してタグを作成
 * Usage: DATABASE_URL="..." npx tsx scripts/backfill-genre-tags.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ジャンルキーワードとタグ名の対応
const GENRE_KEYWORDS: { keyword: RegExp; tagName: string }[] = [
  // 女優タイプ
  { keyword: /熟女/i, tagName: '熟女' },
  { keyword: /人妻/i, tagName: '人妻' },
  { keyword: /素人/i, tagName: '素人' },
  { keyword: /美少女/i, tagName: '美少女' },
  { keyword: /お姉さん|OL/i, tagName: 'OL・お姉さん' },
  { keyword: /ギャル/i, tagName: 'ギャル' },
  { keyword: /女子校生|JK|制服/i, tagName: '制服・女子校生' },

  // プレイ内容
  { keyword: /中出し|なかだし/i, tagName: '中出し' },
  { keyword: /巨乳|爆乳/i, tagName: '巨乳' },
  { keyword: /痴漢/i, tagName: '痴漢' },
  { keyword: /レイプ|凌辱|陵辱/i, tagName: 'レイプ・凌辱' },
  { keyword: /NTR|寝取|ネトラレ/i, tagName: 'NTR' },
  { keyword: /アナル|肛門/i, tagName: 'アナル' },
  { keyword: /3P|乱交|複数/i, tagName: '3P・乱交' },
  { keyword: /潮吹き/i, tagName: '潮吹き' },
  { keyword: /フェラ|口内/i, tagName: 'フェラ' },
  { keyword: /パイズリ/i, tagName: 'パイズリ' },
  { keyword: /手コキ/i, tagName: '手コキ' },
  { keyword: /足コキ/i, tagName: '足コキ' },
  { keyword: /顔射/i, tagName: '顔射' },
  { keyword: /ごっくん|飲精/i, tagName: 'ごっくん' },
  { keyword: /露出/i, tagName: '露出' },
  { keyword: /調教/i, tagName: '調教' },
  { keyword: /緊縛|縛り/i, tagName: '緊縛' },
  { keyword: /スカトロ/i, tagName: 'スカトロ' },
  { keyword: /放尿|おしっこ/i, tagName: '放尿' },

  // シチュエーション
  { keyword: /ナンパ/i, tagName: 'ナンパ' },
  { keyword: /コスプレ/i, tagName: 'コスプレ' },
  { keyword: /マッサージ|エステ/i, tagName: 'マッサージ' },
  { keyword: /風俗|デリヘル|ソープ/i, tagName: '風俗' },
  { keyword: /近親|義母|義父|義姉|義妹|義兄|義弟/i, tagName: '近親相姦' },
  { keyword: /温泉|混浴/i, tagName: '温泉' },
  { keyword: /オフィス|会社/i, tagName: 'オフィス' },
  { keyword: /学校|教室/i, tagName: '学園' },
  { keyword: /病院|ナース|看護/i, tagName: '病院・ナース' },

  // 作品形式
  { keyword: /VR/i, tagName: 'VR' },
  { keyword: /ハメ撮り|POV/i, tagName: 'ハメ撮り' },
  { keyword: /個人撮影/i, tagName: '個人撮影' },
  { keyword: /無修正/i, tagName: '無修正' },
  { keyword: /4K|高画質/i, tagName: '高画質' },
  { keyword: /独占/i, tagName: '独占配信' },

  // その他
  { keyword: /黒人/i, tagName: '黒人' },
  { keyword: /外国人|洋物/i, tagName: '外国人' },
  { keyword: /企画/i, tagName: '企画' },
  { keyword: /ドラマ/i, tagName: 'ドラマ' },
  { keyword: /デビュー/i, tagName: 'デビュー' },
  { keyword: /引退/i, tagName: '引退作品' },
];

async function ensureTagExists(client: any, tagName: string): Promise<number> {
  const existing = await client.query(
    `SELECT id FROM tags WHERE name = $1`,
    [tagName]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO tags (name, category, created_at) VALUES ($1, 'genre', NOW()) RETURNING id`,
    [tagName]
  );

  console.log(`Created genre tag: ${tagName}`);
  return inserted.rows[0].id;
}

async function backfillGenreTags() {
  const client = await pool.connect();

  try {
    console.log('=== Genre Tag Backfill Started ===\n');

    // まず全ジャンルタグを作成
    const tagIds: Map<string, number> = new Map();
    for (const { tagName } of GENRE_KEYWORDS) {
      if (!tagIds.has(tagName)) {
        const id = await ensureTagExists(client, tagName);
        tagIds.set(tagName, id);
      }
    }
    console.log(`\nPrepared ${tagIds.size} genre tags\n`);

    // 商品を取得してタグを付与
    const batchSize = 1000;
    let offset = 0;
    let totalTagged = 0;

    while (true) {
      const products = await client.query(`
        SELECT id, title, description
        FROM products
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      if (products.rows.length === 0) break;

      console.log(`Processing batch ${offset / batchSize + 1} (${products.rows.length} products)...`);

      for (const product of products.rows) {
        const text = `${product.title || ''} ${product.description || ''}`;
        const matchedTags: Set<number> = new Set();

        for (const { keyword, tagName } of GENRE_KEYWORDS) {
          if (keyword.test(text)) {
            const tagId = tagIds.get(tagName);
            if (tagId) matchedTags.add(tagId);
          }
        }

        if (matchedTags.size > 0) {
          // バルクINSERT
          const values = Array.from(matchedTags)
            .map((tagId, i) => `($1, $${i + 2})`)
            .join(', ');
          const params = [product.id, ...Array.from(matchedTags)];

          await client.query(`
            INSERT INTO product_tags (product_id, tag_id)
            VALUES ${values}
            ON CONFLICT DO NOTHING
          `, params);

          totalTagged++;
        }
      }

      offset += batchSize;
      console.log(`  Tagged ${totalTagged} products so far...`);
    }

    // 結果を表示
    console.log('\n=== Genre Tag Statistics ===');
    const stats = await client.query(`
      SELECT t.name, COUNT(pt.product_id) as count
      FROM tags t
      LEFT JOIN product_tags pt ON t.id = pt.tag_id
      WHERE t.category = 'genre'
      GROUP BY t.id, t.name
      ORDER BY count DESC
    `);

    for (const row of stats.rows) {
      console.log(`  ${row.name}: ${row.count} products`);
    }

    console.log('\n=== Genre Tag Backfill Completed ===');

  } finally {
    client.release();
    await pool.end();
  }
}

backfillGenreTags().catch(console.error);
