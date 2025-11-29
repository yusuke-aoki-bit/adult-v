/**
 * Test search performance with different queries
 */

import { getProducts } from '../lib/db/queries';

async function testSearch() {
  console.log('=== Search Performance Test ===\n');

  // Test 1: Simple search query (no filters)
  console.log('Test 1: Simple search - "女優"');
  const start1 = Date.now();
  try {
    const results1 = await getProducts({
      query: '女優',
      limit: 50,
      offset: 0,
    });
    const elapsed1 = Date.now() - start1;
    console.log(`  Results: ${results1.length} products`);
    console.log(`  Time: ${elapsed1}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  // Test 2: Search with provider filter
  console.log('Test 2: Search with provider filter - "女優" + provider=dmm');
  const start2 = Date.now();
  try {
    const results2 = await getProducts({
      query: '女優',
      provider: 'dmm',
      limit: 50,
      offset: 0,
    });
    const elapsed2 = Date.now() - start2;
    console.log(`  Results: ${results2.length} products`);
    console.log(`  Time: ${elapsed2}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  // Test 3: Simple title search
  console.log('Test 3: Title search - "素人"');
  const start3 = Date.now();
  try {
    const results3 = await getProducts({
      query: '素人',
      limit: 50,
      offset: 0,
    });
    const elapsed3 = Date.now() - start3;
    console.log(`  Results: ${results3.length} products`);
    console.log(`  Time: ${elapsed3}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  // Test 4: No query, just list with filters
  console.log('Test 4: List without search - provider=duga');
  const start4 = Date.now();
  try {
    const results4 = await getProducts({
      provider: 'duga',
      limit: 50,
      offset: 0,
    });
    const elapsed4 = Date.now() - start4;
    console.log(`  Results: ${results4.length} products`);
    console.log(`  Time: ${elapsed4}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  // Test 5: No query, no filters (just list)
  console.log('Test 5: Simple list - no filters');
  const start5 = Date.now();
  try {
    const results5 = await getProducts({
      limit: 50,
      offset: 0,
    });
    const elapsed5 = Date.now() - start5;
    console.log(`  Results: ${results5.length} products`);
    console.log(`  Time: ${elapsed5}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  // Test 6: Search with multiple filters
  console.log('Test 6: Complex search - "人妻" + provider=dmm + price filter');
  const start6 = Date.now();
  try {
    const results6 = await getProducts({
      query: '人妻',
      provider: 'dmm',
      minPrice: 1000,
      maxPrice: 3000,
      limit: 50,
      offset: 0,
    });
    const elapsed6 = Date.now() - start6;
    console.log(`  Results: ${results6.length} products`);
    console.log(`  Time: ${elapsed6}ms\n`);
  } catch (error) {
    console.error(`  Error: ${error}\n`);
  }

  console.log('=== Test Complete ===');
}

testSearch().then(() => process.exit(0));
