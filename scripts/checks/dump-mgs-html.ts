/**
 * MGS商品ページのHTMLを出力するスクリプト
 */

async function dumpHtml() {
  const url = 'https://www.mgstage.com/product/product_detail/SIRO-4000/';

  console.log(`Fetching: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}`);
      process.exit(1);
    }

    const html = await response.text();

    console.log('=== HTML Content (first 5000 chars) ===\n');
    console.log(html.substring(0, 5000));

    console.log('\n\n=== Search for image-related patterns ===\n');

    // 画像関連のパターンを検索
    const patterns = [
      'image.mgstage',
      'prestige',
      '<img',
      'detail_photo',
      'sample',
      'gallery',
      'thumbnail',
      'pb_e_',  // プレステージの画像命名パターン
    ];

    for (const pattern of patterns) {
      const count = (html.match(new RegExp(pattern, 'gi')) || []).length;
      console.log(`  "${pattern}": ${count} occurrences`);
    }

    console.log('\n\n=== HTML Size ===');
    console.log(`Total length: ${html.length} characters`);

  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

dumpHtml()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
