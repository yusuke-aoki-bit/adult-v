import { fetchActressWikiData } from '../lib/wiki-client';

/**
 * Wiki APIのテスト
 */

async function testWikiFetch() {
  console.log('=== Testing Wiki Fetch ===\n');

  // テスト用の女優名
  const testActresses = [
    '椎名ななみ',
    '椎月叶実',
    '北野未奈',
  ];

  for (const actressName of testActresses) {
    console.log(`\n━━━ Testing: ${actressName} ━━━`);

    try {
      const wikiData = await fetchActressWikiData(actressName);

      if (!wikiData) {
        console.log(`❌ No data found for ${actressName}\n`);
        continue;
      }

      console.log(`\n✓ Found data for ${actressName}:`);
      console.log(`  Source: ${wikiData.source}`);
      console.log(`  Canonical Name: ${wikiData.canonicalName}`);
      console.log(`  Aliases (${wikiData.aliases.length}):`);
      wikiData.aliases.slice(0, 5).forEach(alias => {
        console.log(`    - ${alias}`);
      });
      if (wikiData.aliases.length > 5) {
        console.log(`    ... and ${wikiData.aliases.length - 5} more`);
      }

      console.log(`  Products (${wikiData.products.length}):`);
      wikiData.products.slice(0, 10).forEach(productId => {
        console.log(`    - ${productId}`);
      });
      if (wikiData.products.length > 10) {
        console.log(`    ... and ${wikiData.products.length - 10} more`);
      }

      if (wikiData.profileImageUrl) {
        console.log(`  Profile Image: ${wikiData.profileImageUrl.substring(0, 60)}...`);
      }

      console.log('');

    } catch (error) {
      console.error(`❌ Error fetching ${actressName}:`, error);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testWikiFetch().catch(console.error);
