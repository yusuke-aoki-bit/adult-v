/**
 * Comprehensive crawler testing script
 * Tests all crawlers to ensure they are functioning correctly
 */

import { getDb } from '../lib/db';
import { sql } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  crawler: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  details: string;
  error?: string;
}

const testResults: TestResult[] = [];

async function runTest(
  crawler: string,
  command: string,
  timeout: number = 60000
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🧪 Testing: ${crawler}`);
    console.log(`   Command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres'
      }
    });

    const duration = Date.now() - startTime;

    // Check for common error patterns
    if (stderr && stderr.toLowerCase().includes('error')) {
      return {
        crawler,
        status: 'fail',
        duration,
        details: stdout.substring(stdout.length - 200),
        error: stderr.substring(0, 500)
      };
    }

    return {
      crawler,
      status: 'pass',
      duration,
      details: stdout.substring(stdout.length - 200)
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      crawler,
      status: 'fail',
      duration,
      details: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testDTISitesCrawler() {
  const sites = ['1pondo', 'caribbeancom', 'heyzo', '10musume', 'pacopacomama'];

  for (const site of sites) {
    const result = await runTest(
      `DTI Sites - ${site}`,
      `cd "C:\\Users\\yuuku\\cursor\\adult-v" && npx tsx scripts/crawlers/crawl-dti-sites.ts --site ${site} --limit 2`,
      300000 // Increased to 5 minutes
    );
    testResults.push(result);
  }
}

async function testDUGACrawler() {
  const result = await runTest(
    'DUGA API',
    'cd "C:\\Users\\yuuku\\cursor\\adult-v" && npx tsx scripts/crawlers/crawl-duga-api.ts --limit 5',
    120000
  );
  testResults.push(result);
}

async function testMGSCrawler() {
  // Skip actual MGS test as it requires specific URLs
  testResults.push({
    crawler: 'MGS',
    status: 'skip',
    duration: 0,
    details: 'MGS crawler requires specific product URLs to test'
  });
}

async function testSOKMILCrawler() {
  const result = await runTest(
    'SOKMIL API',
    'cd "C:\\Users\\yuuku\\cursor\\adult-v" && npx tsx scripts/crawlers/crawl-sokmil-api.ts --limit 5',
    120000
  );
  testResults.push(result);
}

async function testB10FCrawler() {
  testResults.push({
    crawler: 'B10F CSV',
    status: 'skip',
    duration: 0,
    details: 'B10F CSV crawler requires CSV file to test'
  });
}

async function testNakinyAnalyzer() {
  testResults.push({
    crawler: 'Nakiny Analyzer',
    status: 'skip',
    duration: 0,
    details: 'Nakiny analyzer is a specialized tool, not a regular crawler'
  });
}

async function verifyDatabaseCounts() {
  console.log('\n📊 Verifying database counts...\n');

  const db = getDb();

  // Regular products
  const regularProducts = await db.execute(sql`
    SELECT
      ps.asp_name,
      COUNT(DISTINCT p.id) as products,
      COUNT(DISTINCT CASE WHEN p.default_thumbnail_url IS NOT NULL THEN p.id END) as with_thumb
    FROM products p
    JOIN product_sources ps ON p.id = ps.product_id
    GROUP BY ps.asp_name
    ORDER BY products DESC
  `);

  console.log('=== Products by ASP ===');
  console.table(regularProducts.rows);

  // Images
  const images = await db.execute(sql`
    SELECT
      asp_name,
      COUNT(DISTINCT product_id) as products_with_images,
      COUNT(*) as total_images
    FROM product_images
    GROUP BY asp_name
    ORDER BY total_images DESC
  `);

  console.log('\n=== Product Images ===');
  console.table(images.rows);

  // Performers
  const performers = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(image_url) as with_image
    FROM performers
  `);

  console.log('\n=== Performers ===');
  console.table(performers.rows);
}

async function printTestReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CRAWLER TEST REPORT');
  console.log('='.repeat(80) + '\n');

  const passed = testResults.filter(r => r.status === 'pass').length;
  const failed = testResults.filter(r => r.status === 'fail').length;
  const skipped = testResults.filter(r => r.status === 'skip').length;

  console.log(`Total Tests: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log();

  // Detailed results
  console.log('Detailed Results:');
  console.log('-'.repeat(80));

  for (const result of testResults) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    const duration = result.duration > 0 ? `(${(result.duration / 1000).toFixed(2)}s)` : '';

    console.log(`${icon} ${result.crawler} ${duration}`);

    if (result.details) {
      console.log(`   Details: ${result.details.substring(0, 150)}...`);
    }

    if (result.error) {
      console.log(`   Error: ${result.error.substring(0, 200)}...`);
    }

    console.log();
  }

  console.log('='.repeat(80));
}

async function main() {
  console.log('🚀 Starting comprehensive crawler tests...\n');
  console.log(`Start Time: ${new Date().toISOString()}\n`);

  try {
    // Test each crawler
    await testDTISitesCrawler();
    await testDUGACrawler();
    await testMGSCrawler();
    await testSOKMILCrawler();
    await testB10FCrawler();
    await testNakinyAnalyzer();

    // Print test report
    await printTestReport();

    // Verify database counts
    await verifyDatabaseCounts();

    console.log(`\nEnd Time: ${new Date().toISOString()}`);

    // Exit with appropriate code
    const hasFailed = testResults.some(r => r.status === 'fail');
    process.exit(hasFailed ? 1 : 0);

  } catch (error) {
    console.error('Fatal error during testing:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
