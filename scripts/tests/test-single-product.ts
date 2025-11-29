/**
 * Test a single MGS product to see if it has images
 */

async function testProduct(productId: string) {
  const url = `https://www.mgstage.com/product/product_detail/${productId}/`;

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

    // Extract product-specific images (not sidebar recommendations)
    const imagePattern = new RegExp(`https?://image\\.mgstage\\.com/images/[^/]+/${productId.split('-')[0].toLowerCase()}/${productId.split('-')[1]}/[^\\s"'<>]+`, 'gi');
    const productImages = html.match(imagePattern) || [];

    console.log(`\n=== Found ${productImages.length} images for this specific product ===\n`);

    const uniqueUrls = [...new Set(productImages)];
    uniqueUrls.forEach((url, index) => {
      console.log(`[${index + 1}] ${url}`);
    });

    if (uniqueUrls.length === 0) {
      console.log('⚠️ No product-specific images found. This product may not have images on MGS.');
    }

  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

testProduct('CAWD-500')
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
