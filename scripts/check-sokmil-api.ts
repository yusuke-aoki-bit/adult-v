import { getSokmilClient } from '../lib/providers/sokmil-client';

async function main() {
  const client = getSokmilClient();

  console.log('=== SOKMIL API Response Check ===\n');

  const response = await client.searchItems({ hits: 3, offset: 1, sort: '-price' });

  console.log('Status:', response.status);
  console.log('Total:', response.totalCount);

  if (response.data && response.data.length > 0) {
    console.log('\nFirst item keys:', Object.keys(response.data[0]));
    console.log('\nFirst item:');
    console.log(JSON.stringify(response.data[0], null, 2));
  }

  process.exit(0);
}

main().catch(console.error);
