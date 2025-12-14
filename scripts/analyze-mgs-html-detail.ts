import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS HTML詳細分析 ===\n');

  const mgsRawSamples = await db.execute(sql`
    SELECT product_id, html_content
    FROM raw_html_data
    WHERE source = 'MGS'
    AND html_content IS NOT NULL
    LIMIT 1
  `);

  if (mgsRawSamples.rows.length === 0) {
    console.log('No MGS HTML found');
    process.exit(0);
  }

  const row = mgsRawSamples.rows[0];
  const productId = row.product_id as string;
  const htmlContent = row.html_content as string;

  console.log(`Product ID: ${productId}\n`);

  // affsamplem関連のスクリプトを抽出
  console.log('=== affsamplem関連 ===');
  const affMatch = htmlContent.match(/var url_affmovie[^;]+;/);
  if (affMatch) {
    console.log(affMatch[0]);
  }

  // sample_movie_btn の親要素を探す
  console.log('\n=== sample_movie_btn 周辺 ===');
  const lines = htmlContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('sample_movie_btn')) {
      // 前後5行を表示
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        console.log(`${j}: ${lines[j].trim().slice(0, 150)}`);
      }
      console.log('---');
      break; // 最初の1つだけ
    }
  }

  // onclick="sampleMovie を探す
  console.log('\n=== sampleMovie関連 ===');
  const sampleMovieMatch = htmlContent.match(/onclick="[^"]*sample[^"]*"/gi);
  if (sampleMovieMatch) {
    for (const m of sampleMovieMatch.slice(0, 5)) {
      console.log(m);
    }
  } else {
    console.log('Not found');
  }

  // data-属性を探す
  console.log('\n=== data-*属性でsample/video/movie含む ===');
  const dataAttrMatch = htmlContent.match(/data-[a-z-]+="[^"]*"/gi);
  if (dataAttrMatch) {
    const filtered = dataAttrMatch.filter(m =>
      m.toLowerCase().includes('sample') ||
      m.toLowerCase().includes('video') ||
      m.toLowerCase().includes('movie')
    );
    for (const m of filtered.slice(0, 10)) {
      console.log(m);
    }
  }

  // JavaScriptのurl変数を探す
  console.log('\n=== JavaScript URL変数 ===');
  const urlVars = htmlContent.match(/var\s+url_[a-z_]+\s*=\s*['"][^'"]+['"]/gi);
  if (urlVars) {
    for (const v of urlVars) {
      console.log(v);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
