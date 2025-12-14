/**
 * raw_html_dataに保存されたav-wikiのHTMLの状態を確認
 */
import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  // サンプルHTMLを取得
  const sample = await db.execute(sql`
    SELECT id, product_id, url, html_content
    FROM raw_html_data
    WHERE source = 'WIKI-AV-WIKI'
      AND html_content IS NOT NULL
    LIMIT 1
  `);

  if (sample.rows.length === 0) {
    console.log('No av-wiki HTML found');
    process.exit(1);
  }

  const row = sample.rows[0] as any;
  const html = row.html_content as string;

  console.log('=== raw_html_data サンプル ===');
  console.log(`ID: ${row.id}`);
  console.log(`Product ID: ${row.product_id}`);
  console.log(`URL: ${row.url}`);
  console.log(`HTML Length: ${html.length}`);

  // 日本語が含まれているか
  const japaneseChars = html.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g) || [];
  console.log(`\n日本語文字列の例（最初の20件）:`);
  for (const char of japaneseChars.slice(0, 20)) {
    console.log(`  ${char}`);
  }

  // 文字化けパターンがあるか
  const mojibakePattern = /[\uFFFD]|�|絽�|罘�|膀/g;
  const mojibakeMatches = html.match(mojibakePattern) || [];
  console.log(`\n文字化けパターン検出: ${mojibakeMatches.length}件`);

  // titleタグを確認
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    console.log(`\nページタイトル: ${titleMatch[1]}`);
  }

  // 女優名らしき要素を探す
  console.log('\n=== 女優名の検出パターン ===');

  // パターン1: classにactress/performerを含むリンク
  const actressLinks = html.match(/<a[^>]*class="[^"]*(?:actress|performer)[^"]*"[^>]*>([^<]+)<\/a>/gi) || [];
  console.log(`actress/performerクラスのリンク: ${actressLinks.length}件`);
  for (const link of actressLinks.slice(0, 5)) {
    console.log(`  ${link.replace(/<[^>]+>/g, '')}`);
  }

  // パターン2: 出演者を含む行
  const castLines = html.split('\n').filter(line =>
    line.includes('出演者') || line.includes('女優') || line.includes('キャスト')
  );
  console.log(`\n出演者関連の行: ${castLines.length}件`);
  for (const line of castLines.slice(0, 3)) {
    console.log(`  ${line.trim().substring(0, 150)}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
