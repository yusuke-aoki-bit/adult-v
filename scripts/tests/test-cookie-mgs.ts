/**
 * Cookie付きでMGSページにアクセスしてHTMLを確認
 */

async function testWithCookie() {
  const url = 'https://www.mgstage.com/product/product_detail/GNI-007/';

  console.log(`Testing: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'coc=1; adc=1',
      },
    });

    console.log(`Status: ${response.status}`);
    const html = await response.text();

    console.log(`\nHTML length: ${html.length}`);

    // 年齢認証ページかどうかチェック
    if (html.includes('年齢認証') || html.includes('18歳以上ですか')) {
      console.log('\n❌ Still showing age verification page');
    } else {
      console.log('\n✅ Passed age verification');
    }

    // 画像関連のパターンを検索
    console.log('\n=== Image patterns ===');
    const patterns = ['image.mgstage', 'prestige', '<img', 'detail_photo', 'sample', 'pb_e_'];
    for (const pattern of patterns) {
      const count = (html.match(new RegExp(pattern, 'gi')) || []).length;
      console.log(`  "${pattern}": ${count} occurrences`);
    }

    // HTMLの一部を出力
    console.log('\n=== HTML snippet (chars 1000-2000) ===');
    console.log(html.substring(1000, 2000));

  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

testWithCookie()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
