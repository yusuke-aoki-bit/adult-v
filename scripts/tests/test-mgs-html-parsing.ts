/**
 * MGS商品ページのHTML構造を解析するスクリプト
 */

import * as cheerio from 'cheerio';

async function testHtmlParsing() {
  // テスト用のURL（いくつかのパターンをテスト）
  const testUrls = [
    'https://www.mgstage.com/product/product_detail/SIRO-4000/',
    'https://www.mgstage.com/product/product_detail/300MIUM-1150/',
    'https://www.mgstage.com/product/product_detail/STARS-001/',
  ];

  for (const url of testUrls) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log('='.repeat(80));

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      console.log('\n📦 Checking current selectors from script:');

      // 現在のスクリプトで使用されているセレクタ
      console.log('\n1. Sample images: .detail_photo_new li a');
      const sampleImages: string[] = [];
      $('.detail_photo_new li a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
          sampleImages.push(href);
        }
      });
      console.log(`   Found: ${sampleImages.length} images`);
      if (sampleImages.length > 0) {
        console.log(`   Examples:`);
        sampleImages.slice(0, 3).forEach(img => console.log(`     - ${img}`));
      }

      console.log('\n2. Package image: .detail_photo img');
      const packageImage = $('.detail_photo img').attr('src');
      console.log(`   Found: ${packageImage ? 'Yes' : 'No'}`);
      if (packageImage) {
        console.log(`   URL: ${packageImage}`);
      }

      // 他の可能性のあるセレクタを探す
      console.log('\n\n🔍 Exploring alternative selectors:');

      // 画像を含む要素を探す
      const allImages: string[] = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && (src.includes('image.mgstage') || src.includes('prestige'))) {
          allImages.push(src);
        }
      });
      console.log(`\n3. All img tags with mgstage/prestige URLs: ${allImages.length}`);
      if (allImages.length > 0) {
        console.log(`   Examples:`);
        allImages.slice(0, 5).forEach(img => console.log(`     - ${img}`));
      }

      // aタグのhref属性で画像リンクを探す
      const imageLinks: string[] = [];
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && (href.includes('image.mgstage') || href.includes('prestige'))) {
          imageLinks.push(href);
        }
      });
      console.log(`\n4. All a tags with image URLs: ${imageLinks.length}`);
      if (imageLinks.length > 0) {
        console.log(`   Examples:`);
        imageLinks.slice(0, 5).forEach(link => console.log(`     - ${link}`));
      }

      // 特定のクラスや属性を探す
      console.log(`\n5. Elements with 'photo' in class name:`);
      $('[class*="photo"]').each((_, el) => {
        const className = $(el).attr('class');
        const tagName = el.tagName;
        console.log(`   <${tagName} class="${className}">`);
      });

      // サンプル画像ギャラリーの可能性
      console.log(`\n6. Elements with 'sample' in class name:`);
      $('[class*="sample"]').each((_, el) => {
        const className = $(el).attr('class');
        const tagName = el.tagName;
        console.log(`   <${tagName} class="${className}">`);
      });

      // divやsection内の画像パターン
      console.log(`\n7. Elements with 'gallery' in class name:`);
      $('[class*="gallery"]').each((_, el) => {
        const className = $(el).attr('class');
        const tagName = el.tagName;
        console.log(`   <${tagName} class="${className}">`);
      });

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }

  console.log('\n\n✅ HTML parsing test completed');
}

testHtmlParsing()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
