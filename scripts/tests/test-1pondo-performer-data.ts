/**
 * Test script to investigate 1pondo JSON API structure for performer images
 * This will help us understand how to extract performer profile images
 */

async function test1pondoPerformerData() {
  console.log('=== Testing 1pondo JSON API for Performer Data ===\n');

  // Test with a recent product ID
  const testProductId = '010124_001';
  const jsonUrl = `https://www.1pondo.tv/dyn/phpauto/movie_details/movie_id/${testProductId}.json`;

  console.log(`Fetching: ${jsonUrl}\n`);

  try {
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      return;
    }

    const jsonData = await response.json();

    console.log('=== Full JSON Response ===');
    console.log(JSON.stringify(jsonData, null, 2));

    console.log('\n=== Actress Information ===');
    console.log('ActressesJa:', jsonData.ActressesJa);
    console.log('Actresses:', jsonData.Actresses);

    // Check if there are any image URLs in the response
    console.log('\n=== Searching for Image URLs ===');
    const jsonStr = JSON.stringify(jsonData);
    const imagePatterns = [
      /https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)/gi,
      /actress.*image/i,
      /performer.*image/i,
      /profile.*image/i,
    ];

    imagePatterns.forEach((pattern, i) => {
      const matches = jsonStr.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`Pattern ${i + 1} matches:`, matches.slice(0, 5)); // Show first 5 matches
      }
    });

    // Check for actress/performer ID fields
    console.log('\n=== Looking for Performer IDs ===');
    Object.keys(jsonData).forEach(key => {
      if (key.toLowerCase().includes('actress') ||
          key.toLowerCase().includes('performer') ||
          key.toLowerCase().includes('actor')) {
        console.log(`${key}:`, jsonData[key]);
      }
    });

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

test1pondoPerformerData()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
