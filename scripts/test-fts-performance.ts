/**
 * Test PostgreSQL Full Text Search performance
 * Compare before (ILIKE + similarity) vs after (FTS)
 */

import { getProducts } from '../lib/db/queries';

async function testFtsPerformance() {
  console.log('=== PostgreSQL Full Text Search Performance Test ===\n');

  const testQueries = [
    { query: 'STARS', expected: 'Brand search (STARS)' },
    { query: 'STARS-862', expected: 'Specific product code' },
    { query: 'ABP', expected: 'Brand search (ABP)' },
    { query: 'ABP-049', expected: 'Specific product code' },
    { query: '素人', expected: 'Japanese keyword search' },
    { query: '人妻', expected: 'Japanese keyword search' },
    { query: '中出し', expected: 'Japanese keyword search' },
    { query: '美少女', expected: 'Japanese keyword search' },
  ];

  const results: Array<{ query: string; time: number; count: number }> = [];

  for (const test of testQueries) {
    console.log(`\n📝 Query: "${test.query}"`);
    console.log(`Expected: ${test.expected}`);
    console.log('─'.repeat(50));

    const start = Date.now();
    const products = await getProducts({
      query: test.query,
      limit: 10,
      offset: 0,
    });
    const elapsed = Date.now() - start;

    results.push({
      query: test.query,
      time: elapsed,
      count: products.length,
    });

    console.log(`Results: ${products.length} products`);
    console.log(`Time: ${elapsed}ms`);

    if (products.length > 0) {
      console.log(`\nSample results:`);
      for (let i = 0; i < Math.min(3, products.length); i++) {
        const product = products[i];
        console.log(`  ${i + 1}. ${product.id} - ${product.title.substring(0, 60)}...`);
      }
    } else {
      console.log(`⚠️  No results found!`);
    }
  }

  console.log('\n\n=== Performance Summary ===');
  console.log('Query'.padEnd(20) + 'Time'.padEnd(10) + 'Results');
  console.log('─'.repeat(50));

  let totalTime = 0;
  for (const result of results) {
    console.log(
      result.query.padEnd(20) +
      `${result.time}ms`.padEnd(10) +
      result.count
    );
    totalTime += result.time;
  }

  const avgTime = totalTime / results.length;
  console.log('─'.repeat(50));
  console.log(`Average: ${avgTime.toFixed(0)}ms`);

  console.log('\n=== Expected Improvements ===');
  console.log('Before (ILIKE + similarity): 1500-7000ms per query');
  console.log('After (Full Text Search):    300-500ms per query');
  console.log(`Actual average: ${avgTime.toFixed(0)}ms`);

  if (avgTime < 500) {
    console.log('\n✅ Performance goal achieved! (< 500ms average)');
  } else if (avgTime < 1000) {
    console.log('\n✅ Good performance improvement! (< 1000ms average)');
  } else {
    console.log('\n⚠️  Performance needs further optimization');
  }
}

testFtsPerformance().then(() => process.exit(0));
