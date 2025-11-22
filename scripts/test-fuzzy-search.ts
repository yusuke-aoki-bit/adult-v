import { getActresses, getProducts } from '../lib/db/queries';

/**
 * Test script to verify fuzzy search functionality
 */
async function testFuzzySearch() {
  console.log('=== Testing Fuzzy Search Functionality ===\n');

  try {
    // Test 1: Test exact match for actress
    console.log('Test 1: Exact match for actress');
    const exactMatch = await getActresses({ query: '上原亜衣', limit: 5 });
    console.log(`Results: ${exactMatch.length} actresses found`);
    exactMatch.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (ID: ${a.id})`);
    });
    console.log('');

    // Test 2: Test fuzzy match with typo for actress
    console.log('Test 2: Fuzzy match with typo for actress');
    const fuzzyMatch = await getActresses({ query: '上原あい', limit: 5 });
    console.log(`Results: ${fuzzyMatch.length} actresses found`);
    fuzzyMatch.forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (ID: ${a.id})`);
    });
    console.log('');

    // Test 3: Test partial match for actress
    console.log('Test 3: Partial match for actress');
    const partialMatch = await getActresses({ query: '上原', limit: 10 });
    console.log(`Results: ${partialMatch.length} actresses found`);
    partialMatch.slice(0, 5).forEach((a, i) => {
      console.log(`  ${i + 1}. ${a.name} (ID: ${a.id})`);
    });
    if (partialMatch.length > 5) {
      console.log(`  ... and ${partialMatch.length - 5} more`);
    }
    console.log('');

    // Test 4: Test fuzzy search for products
    console.log('Test 4: Fuzzy search for products');
    const productSearch = await getProducts({ query: '素人', limit: 5 });
    console.log(`Results: ${productSearch.length} products found`);
    productSearch.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title.substring(0, 50)}... (ID: ${p.id})`);
    });
    console.log('');

    // Test 5: Test similar search for products with typo
    console.log('Test 5: Similar search for products (美少女 vs びしょうじょ)');
    const similarSearch = await getProducts({ query: 'びしょうじょ', limit: 5 });
    console.log(`Results: ${similarSearch.length} products found`);
    similarSearch.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title.substring(0, 50)}... (ID: ${p.id})`);
    });
    console.log('');

    console.log('✅ Fuzzy search tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during fuzzy search tests:', error);
    throw error;
  }
}

// Run the tests
testFuzzySearch()
  .then(() => {
    console.log('\nAll tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTests failed:', error);
    process.exit(1);
  });
