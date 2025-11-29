/**
 * Test script to investigate 1pondo actor profile page structure
 * Using actor IDs from JSON API to fetch profile images
 */

import * as cheerio from 'cheerio';

async function test1pondoActorProfile() {
  console.log('=== Testing 1pondo Actor Profile Pages ===\n');

  // Test with actor IDs from previous test
  const testActorIds = [
    { id: '1941', name: '江波りゅう' },
    { id: '6873', name: 'りおん' },
  ];

  for (const actor of testActorIds) {
    console.log(`\n--- Testing Actor: ${actor.name} (ID: ${actor.id}) ---`);

    // Try different URL patterns for actor profile
    const urlPatterns = [
      `https://www.1pondo.tv/dyn/phpauto/search_act/&actor_id=${actor.id}`,
      `https://www.1pondo.tv/actor/${actor.id}`,
      `https://www.1pondo.tv/actresses/${actor.id}`,
      `https://www.1pondo.tv/search_actor/?actor_id=${actor.id}`,
    ];

    for (const url of urlPatterns) {
      try {
        console.log(`  Trying: ${url}`);

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'follow'
        });

        console.log(`  Status: ${response.status}`);

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // Look for image tags
          const images: string[] = [];
          $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            if (src && (
              src.includes('actress') ||
              src.includes('actor') ||
              src.includes('profile') ||
              src.includes('performer')
            )) {
              images.push(src);
            }
          });

          if (images.length > 0) {
            console.log(`  ✅ Found ${images.length} potential images:`);
            images.forEach(img => console.log(`    - ${img}`));
            break; // Found images, no need to try other patterns
          } else {
            console.log(`  ⚠️  No performer images found`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('\n=== Test Complete ===');
}

test1pondoActorProfile()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
