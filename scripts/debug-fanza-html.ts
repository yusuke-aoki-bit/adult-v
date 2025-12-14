/**
 * FANZAのHTMLパターンを確認するデバッグスクリプト
 */
import { db } from '../packages/crawlers/src/lib/db';
import { rawHtmlData } from '../packages/crawlers/src/lib/db/schema';
import { eq, desc, isNotNull, and } from 'drizzle-orm';

async function main() {
  // FANZAの最新raw_html_dataを取得
  const result = await db
    .select({ productId: rawHtmlData.productId, htmlContent: rawHtmlData.htmlContent })
    .from(rawHtmlData)
    .where(and(eq(rawHtmlData.source, 'FANZA'), isNotNull(rawHtmlData.htmlContent)))
    .orderBy(desc(rawHtmlData.crawledAt))
    .limit(1);

  if (result.length === 0) {
    console.log('No FANZA raw HTML found');
    process.exit(1);
  }

  const html = result[0].htmlContent || '';
  console.log('Product ID:', result[0].productId);
  console.log('HTML length:', html.length);

  // 収録時間のパターンを検索（コンテキスト付き）
  console.log('\n=== 収録時間を含む行 ===');
  const lines = html.split('\n');
  for (const line of lines) {
    if (line.includes('収録時間')) {
      console.log(line.trim().substring(0, 200));
    }
  }

  // 「○分」の前後のコンテキストを確認
  console.log('\n=== 「○分」のコンテキスト ===');
  const minContextMatches = html.match(/.{0,50}\d{2,3}分.{0,50}/g) || [];
  for (const match of minContextMatches.slice(0, 10)) {
    console.log(match.replace(/\s+/g, ' ').substring(0, 120));
  }

  // JSON-LDデータを確認
  console.log('\n=== JSON-LD データ ===');
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      console.log('duration:', jsonLd.duration);
      console.log('offers:', jsonLd.offers);
    } catch (e) {
      console.log('JSON-LD parse error');
    }
  } else {
    console.log('No JSON-LD found');
  }

  // 分のパターンを全て抽出
  console.log('\n=== 「○分」パターン（ユニーク） ===');
  const minMatches = html.match(/\d+分/g) || [];
  const uniqueMins = [...new Set(minMatches)];
  console.log(uniqueMins.slice(0, 20));

  // 価格パターンを全て抽出
  console.log('\n=== 価格パターン（ユニーク） ===');
  const priceMatches = html.match(/\d{1,3}(?:,\d{3})*円/g) || [];
  const uniquePrices = [...new Set(priceMatches)];
  console.log(uniquePrices);

  // 月額表示を確認
  console.log('\n=== 月額関連の文字列 ===');
  for (const line of lines) {
    if (line.includes('月額') || line.includes('見放題')) {
      console.log(line.trim().substring(0, 150));
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
