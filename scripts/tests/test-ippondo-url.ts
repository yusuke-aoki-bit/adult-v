import fetch from 'node-fetch';

async function testIppondoUrl() {
  // Test a few URLs from different time periods
  const testUrls = [
    { id: '031222_001', url: 'https://www.1pondo.tv/movies/031222_001/', desc: 'March 2022 (found in DB)' },
    { id: '112024_001', url: 'https://www.1pondo.tv/movies/112024_001/', desc: 'Nov 2024 (config startId)' },
    { id: '112024_100', url: 'https://www.1pondo.tv/movies/112024_100/', desc: 'Nov 2024 #100' },
    { id: '111724_001', url: 'https://www.1pondo.tv/movies/111724_001/', desc: 'Nov 17, 2024' },
  ];

  for (const test of testUrls) {
    console.log(`\nTesting: ${test.desc}`);
    console.log(`ID: ${test.id}`);
    console.log(`URL: ${test.url}`);

    try {
      const response = await fetch(test.url);
      console.log(`Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const html = await response.text();
        console.log(`HTML Length: ${html.length} bytes`);

        // Check if it's the homepage or a real product page
        if (html.includes('<title>一本道 | 美を追求する高画質アダルト動画サイト</title>')) {
          console.log('⚠️  THIS IS THE HOMEPAGE (not a product page)');
        } else {
          const titleMatch = html.match(/<title>(.*?)<\/title>/);
          console.log(`✓ Product page title: ${titleMatch ? titleMatch[1] : 'NOT FOUND'}`);
        }
      }
    } catch (error) {
      console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('---');
  }
}

testIppondoUrl()
  .then(() => {
    console.log('\nTest complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
