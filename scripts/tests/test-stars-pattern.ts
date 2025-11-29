/**
 * Test STARS product with SOD Create pattern
 */

async function testStars() {
  // Test both STARS-492 page and the discovered image URL
  const productUrl = 'https://www.mgstage.com/product/product_detail/STARS-492/';
  const imageUrl = 'https://image.mgstage.com/images/sodcreate/107stars/492/pb_e_107stars-492.jpg';

  console.log('Testing image URL existence...');
  try {
    const imgResponse = await fetch(imageUrl, { method: 'HEAD' });
    const status = imgResponse.ok ? '✅' : '❌';
    console.log(`Image URL: ${status} ${imageUrl}`);
  } catch (error) {
    console.log(`❌ ${imageUrl} - ${error}`);
  }

  console.log('\nTesting product page...');
  try {
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': 'coc=1; adc=1',
      },
    });

    const html = await response.text();

    // Look for the actual pattern in HTML
    const imagePattern = /https?:\/\/image\.mgstage\.com\/images\/[^/]+\/107stars\/492\/[^\s"'<>]+/gi;
    const images = html.match(imagePattern) || [];

    console.log(`Found ${images.length} images with 107stars pattern`);
    images.slice(0, 5).forEach(url => console.log(`  ${url}`));
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

testStars().then(() => process.exit(0));
