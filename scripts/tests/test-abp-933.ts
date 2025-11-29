/**
 * Test ABP-933 product for images
 */

async function testProduct() {
  const url = 'https://www.mgstage.com/product/product_detail/ABP-933/';
  
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
    
    // Extract product-specific ABP-933 images
    const imagePattern = /https?:\/\/image\.mgstage\.com\/images\/[^/]+\/abp\/933\/[^\s"'<>]+/gi;
    const productImages = html.match(imagePattern) || [];
    
    console.log(`\n=== Found ${productImages.length} ABP-933 specific images ===\n`);
    
    const uniqueUrls = [...new Set(productImages)];
    uniqueUrls.forEach((url, index) => {
      console.log(`[${index + 1}] ${url}`);
    });
    
    if (uniqueUrls.length === 0) {
      console.log('❌ No product-specific images found.');
      
      // Check if the product page exists and shows content
      if (html.includes('ABP-933') || html.includes('abp-933')) {
        console.log('✅ Product page exists, but images not hosted on MGS');
      }
    } else {
      console.log(`\n✅ Found ${uniqueUrls.length} valid image URLs`);
    }
    
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

testProduct()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
