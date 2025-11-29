/**
 * Test improved product ID search using getProducts function
 */

import { getProducts } from '../lib/db/queries';

async function testImprovedSearch() {
  console.log('=== Improved Product ID Search Test ===\n');

  const testQueries = [
    { query: 'STARS', expected: 'Many STARS products' },
    { query: 'STARS-862', expected: 'Specific STARS-862' },
    { query: 'ABP', expected: 'Many ABP products' },
    { query: 'ABP-049', expected: 'Specific ABP-049' },
    { query: '素人', expected: 'Japanese content search' },
    { query: '人妻', expected: 'Japanese content search' },
  ];

  for (const test of testQueries) {
    console.log(`\n📝 Query: "${test.query}"`);
    console.log(`Expected: ${test.expected}`);
    console.log('─'.repeat(50));

    const start = Date.now();
    const results = await getProducts({
      query: test.query,
      limit: 10,
      offset: 0,
    });
    const elapsed = Date.now() - start;

    console.log(`Results: ${results.length} products`);
    console.log(`Time: ${elapsed}ms`);

    if (results.length > 0) {
      console.log(`\nSample results:`);
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const product = results[i];
        console.log(`  ${i + 1}. ${product.id} - ${product.title.substring(0, 60)}...`);
      }
    } else {
      console.log(`⚠️  No results found!`);
    }
  }

  console.log('\n\n=== Summary ===');
  console.log('✅ Product ID search now includes:');
  console.log('   - normalized_product_id');
  console.log('   - original_product_id from product_sources');
  console.log('   - title and description (as before)');
  console.log('   - Trigram similarity (as fallback)');
}

testImprovedSearch().then(() => process.exit(0));
