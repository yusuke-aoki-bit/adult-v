/**
 * Direct test of database encoding
 */

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://adult-v:AdultV2024!Secure@34.27.234.120:5432/postgres';
}

import { Pool } from 'pg';

async function testEncoding() {
  const testString = 'ナースコスでイカせてア・ゲ・ル！ 村上ことの';
  console.log('Test string:', testString);
  console.log('Test string length:', testString.length);
  console.log('Test string bytes:', Buffer.from(testString, 'utf-8').length);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  // Set client encoding on connect
  pool.on('connect', (client) => {
    client.query('SET CLIENT_ENCODING TO UTF8', (err) => {
      if (err) {
        console.error('Failed to set encoding:', err);
      } else {
        console.log('✓ Set client_encoding to UTF8');
      }
    });
  });

  try {
    // Check current encoding
    const encodingResult = await pool.query('SHOW CLIENT_ENCODING');
    console.log('Current client_encoding:', encodingResult.rows[0].client_encoding);

    // Create temp table
    await pool.query(`
      CREATE TEMP TABLE encoding_test (
        id SERIAL PRIMARY KEY,
        test_text TEXT
      )
    `);
    console.log('✓ Created temp table');

    // Insert test string
    await pool.query('INSERT INTO encoding_test (test_text) VALUES ($1)', [testString]);
    console.log('✓ Inserted test string');

    // Read back
    const result = await pool.query('SELECT test_text FROM encoding_test LIMIT 1');
    const retrieved = result.rows[0].test_text;

    console.log('\nRetrieved string:', retrieved);
    console.log('Match:', testString === retrieved);

    if (testString !== retrieved) {
      console.log('\n❌ MISMATCH DETECTED!');
      console.log('Expected bytes:', Buffer.from(testString, 'utf-8'));
      console.log('Retrieved bytes:', Buffer.from(retrieved, 'utf-8'));
    } else {
      console.log('\n✅ Encoding test PASSED');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testEncoding();
