import { getDb } from '../lib/db';
import { performers } from '../lib/db/schema';
import { asc } from 'drizzle-orm';

async function testQuery() {
  try {
    console.log('Testing actresses query...');

    const db = getDb();
    console.log('Database connection obtained');

    const results = await db
      .select()
      .from(performers)
      .orderBy(asc(performers.name))
      .limit(10);

    console.log(`✓ Successfully fetched ${results.length} actresses`);
    console.log('First result:', JSON.stringify(results[0], null, 2));

  } catch (error: any) {
    console.error('✗ Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error keys:', error ? Object.keys(error) : 'no keys');
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
  }

  process.exit(0);
}

testQuery();
