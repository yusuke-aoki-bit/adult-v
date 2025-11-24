import { getDb } from '../lib/db';
import { products, tags, productTags } from '../lib/db/schema';
import { sql, eq, and, notInArray } from 'drizzle-orm';

/**
 * タイトルから自動的にタグを付与
 * - キーワードベースのタグ付け
 * - 既存タグとの重複を避ける
 */

// タグ付けルール定義
interface TagRule {
  keywords: string[];
  tagName: string;
  category: 'genre' | 'series' | 'studio' | 'era';
}

const TAG_RULES: TagRule[] = [
  // ジャンルタグ
  { keywords: ['素人', 'しろうと'], tagName: '素人', category: 'genre' },
  { keywords: ['美少女', 'びしょうじょ'], tagName: '美少女', category: 'genre' },
  { keywords: ['巨乳', 'きょにゅう', '爆乳'], tagName: '巨乳', category: 'genre' },
  { keywords: ['中出し', 'なかだし'], tagName: '中出し', category: 'genre' },
  { keywords: ['痴漢', 'ちかん'], tagName: '痴漢', category: 'genre' },
  { keywords: ['制服', 'せいふく', 'JK', '女子校生'], tagName: '制服', category: 'genre' },
  { keywords: ['OL', 'オーエル', 'オフィス'], tagName: 'OL', category: 'genre' },
  { keywords: ['人妻', 'ひとづま'], tagName: '人妻', category: 'genre' },
  { keywords: ['若妻', 'わかづま'], tagName: '若妻', category: 'genre' },
  { keywords: ['熟女', 'じゅくじょ'], tagName: '熟女', category: 'genre' },
  { keywords: ['ナンパ', 'なんぱ'], tagName: 'ナンパ', category: 'genre' },
  { keywords: ['コスプレ', 'こすぷれ'], tagName: 'コスプレ', category: 'genre' },
  { keywords: ['3P', 'スリーピー'], tagName: '3P', category: 'genre' },
  { keywords: ['4P', 'フォーピー'], tagName: '4P', category: 'genre' },
  { keywords: ['乱交', 'らんこう'], tagName: '乱交', category: 'genre' },
  { keywords: ['アナル', 'あなる'], tagName: 'アナル', category: 'genre' },
  { keywords: ['SM', 'エスエム'], tagName: 'SM', category: 'genre' },
  { keywords: ['フェラ', 'ふぇら', 'フェラチオ'], tagName: 'フェラ', category: 'genre' },
  { keywords: ['潮吹き', 'しおふき'], tagName: '潮吹き', category: 'genre' },
  { keywords: ['ギャル', 'ぎゃる'], tagName: 'ギャル', category: 'genre' },
  { keywords: ['ロリ', 'ろり'], tagName: 'ロリ', category: 'genre' },
  { keywords: ['レズ', 'れず', 'レズビアン'], tagName: 'レズ', category: 'genre' },
  { keywords: ['近親', 'きんしん', '義母', '義妹'], tagName: '近親相姦', category: 'genre' },
  { keywords: ['痴女', 'ちじょ'], tagName: '痴女', category: 'genre' },
  { keywords: ['M男', 'エムおとこ'], tagName: 'M男', category: 'genre' },
  { keywords: ['縛り', 'しばり', '緊縛'], tagName: '縛り', category: 'genre' },
  { keywords: ['恥ずかしめ', 'はずかしめ'], tagName: '恥ずかしめ', category: 'genre' },
  { keywords: ['企画', 'きかく'], tagName: '企画', category: 'genre' },
  { keywords: ['アイドル', 'あいどる'], tagName: 'アイドル', category: 'genre' },
  { keywords: ['オナニー', 'おなにー', '自慰'], tagName: 'オナニー', category: 'genre' },
  { keywords: ['ハメ撮り', 'はめどり'], tagName: 'ハメ撮り', category: 'genre' },
  { keywords: ['盗撮', 'とうさつ'], tagName: '盗撮', category: 'genre' },
  { keywords: ['個人撮影', 'こじんさつえい'], tagName: '個人撮影', category: 'genre' },

  // シリーズタグ
  { keywords: ['ナンパJAPAN'], tagName: 'ナンパJAPAN', category: 'series' },
  { keywords: ['ラグジュTV'], tagName: 'ラグジュTV', category: 'series' },
  { keywords: ['シロウトTV'], tagName: 'シロウトTV', category: 'series' },
  { keywords: ['プレステージプレミアム'], tagName: 'プレステージプレミアム', category: 'series' },
  { keywords: ['エチケット'], tagName: 'エチケット', category: 'series' },

  // スタジオ/メーカータグ
  { keywords: ['プレステージ'], tagName: 'プレステージ', category: 'studio' },
  { keywords: ['ROOKIE'], tagName: 'ROOKIE', category: 'studio' },
  { keywords: ['S級素人'], tagName: 'S級素人', category: 'studio' },

  // 年代タグ（リリース日から判定するため、後で実装）
];

async function autoTagProducts() {
  const db = getDb();

  console.log('=== Auto-Tagging Products ===\n');

  // ステップ1: タグマスタを確認・作成
  console.log('📋 Checking and creating tags...\n');

  const tagMap = new Map<string, number>();

  for (const rule of TAG_RULES) {
    // 既存タグを確認
    let existingTag = await db.query.tags.findFirst({
      where: eq(tags.name, rule.tagName),
    });

    if (!existingTag) {
      // 新規タグを作成
      const [newTag] = await db.insert(tags).values({
        name: rule.tagName,
        category: rule.category,
      }).returning();

      existingTag = newTag;
      console.log(`  ✓ Created new tag: ${rule.tagName} (${rule.category})`);
    }

    tagMap.set(rule.tagName, existingTag.id);
  }

  console.log(`\n✓ Total tags ready: ${tagMap.size}\n`);

  // ステップ2: タグ付けされていない、またはタグが少ない作品を取得
  console.log('📊 Finding products to tag...\n');

  const productsToTag = await db.execute(sql`
    SELECT
      p.id,
      p.title,
      p.release_date,
      COUNT(pt.tag_id) as current_tag_count
    FROM products p
    LEFT JOIN product_tags pt ON p.id = pt.product_id
    GROUP BY p.id, p.title, p.release_date
    HAVING COUNT(pt.tag_id) < 3
    ORDER BY p.id
    LIMIT 10000
  `);

  console.log(`Found ${productsToTag.rows.length} products to process\n`);

  // ステップ3: タグ付け実行
  let processedCount = 0;
  let taggedCount = 0;
  let totalTagsAdded = 0;

  for (const row of productsToTag.rows as any[]) {
    processedCount++;

    if (processedCount % 1000 === 0) {
      console.log(`Progress: ${processedCount} / ${productsToTag.rows.length} (${Math.round(100 * processedCount / productsToTag.rows.length)}%)`);
    }

    const productId = row.id;
    const title = row.title || '';
    const releaseDate = row.release_date;

    // 既存タグIDを取得
    const existingTags = await db
      .select({ tagId: productTags.tagId })
      .from(productTags)
      .where(eq(productTags.productId, productId));

    const existingTagIds = new Set(existingTags.map(t => t.tagId));

    // マッチするタグを検出
    const matchedTags: number[] = [];

    for (const rule of TAG_RULES) {
      const tagId = tagMap.get(rule.tagName);
      if (!tagId || existingTagIds.has(tagId)) continue;

      // キーワードマッチング
      const matched = rule.keywords.some(keyword =>
        title.toLowerCase().includes(keyword.toLowerCase())
      );

      if (matched) {
        matchedTags.push(tagId);
      }
    }

    // 年代タグを追加（releaseDate から判定）
    if (releaseDate) {
      const year = new Date(releaseDate).getFullYear();
      const decadeTagName = `${Math.floor(year / 10) * 10}年代`;

      // 年代タグを作成または取得
      let decadeTag = await db.query.tags.findFirst({
        where: eq(tags.name, decadeTagName),
      });

      if (!decadeTag) {
        const [newTag] = await db.insert(tags).values({
          name: decadeTagName,
          category: 'era',
        }).returning();
        decadeTag = newTag;
      }

      if (!existingTagIds.has(decadeTag.id)) {
        matchedTags.push(decadeTag.id);
      }
    }

    // タグを追加
    if (matchedTags.length > 0) {
      for (const tagId of matchedTags) {
        try {
          await db.insert(productTags).values({
            productId,
            tagId,
          });
          totalTagsAdded++;
        } catch (error) {
          // 重複エラーは無視
        }
      }
      taggedCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total products processed: ${processedCount}`);
  console.log(`Products tagged: ${taggedCount}`);
  console.log(`Total tags added: ${totalTagsAdded}`);
  console.log(`Average tags per tagged product: ${(totalTagsAdded / taggedCount).toFixed(1)}`);

  // 最終統計
  const finalStats = await db.execute(sql`
    SELECT
      COUNT(DISTINCT p.id) as total_products,
      COUNT(pt.tag_id) as total_tags,
      ROUND(CAST(COUNT(pt.tag_id) AS FLOAT) / COUNT(DISTINCT p.id), 1) as avg_tags_per_product
    FROM products p
    LEFT JOIN product_tags pt ON p.id = pt.product_id
  `);

  console.log('\n=== Final Database Statistics ===');
  console.table(finalStats.rows);

  process.exit(0);
}

autoTagProducts().catch(console.error);
