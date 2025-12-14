import { db } from '../packages/crawlers/src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== MGS HTML分析 ===\n');

  // raw_html_dataからMGSのHTMLを取得
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

  console.log(`Product ID: ${productId}`);
  console.log(`HTML length: ${htmlContent.length}`);

  // サンプル動画関連のキーワードを検索
  const keywords = [
    'sample',
    'movie',
    'video',
    'play',
    'player',
    'mp4',
    'm3u8',
    'streaming',
    'modal',
  ];

  console.log('\n=== キーワード検索 ===');
  for (const keyword of keywords) {
    const regex = new RegExp(keyword, 'gi');
    const matches = htmlContent.match(regex);
    console.log(`${keyword}: ${matches?.length || 0} matches`);
  }

  // サンプル動画ボタン/リンクを探す
  console.log('\n=== サンプル動画関連のHTML抜粋 ===');

  // sample_movieを含む行を抽出
  const lines = htmlContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('sample') || line.includes('Sample') || line.includes('SAMPLE')) {
      if (line.includes('movie') || line.includes('Movie') || line.includes('video') || line.includes('Video')) {
        console.log(`Line ${i}: ${line.slice(0, 200)}...`);
      }
    }
  }

  // モーダル関連を探す
  console.log('\n=== モーダル関連 ===');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('modal') && (line.includes('sample') || line.includes('video'))) {
      console.log(`Line ${i}: ${line.slice(0, 200)}...`);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
