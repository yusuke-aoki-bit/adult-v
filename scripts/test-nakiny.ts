import * as cheerio from 'cheerio';

async function testNakiny() {
  const url = 'https://nakiny.com/search-actress';
  console.log(`Testing: ${url}\n`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      },
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      console.error(`Failed with status ${response.status}`);
      return;
    }

    const html = await response.text();
    console.log(`\nHTML length: ${html.length} characters`);
    console.log(`\nFirst 1000 characters:`);
    console.log(html.substring(0, 1000));

    const $ = cheerio.load(html);
    console.log(`\nPage title: ${$('title').text()}`);
    console.log(`H1 tags:`, $('h1').map((_, el) => $(el).text()).get());
    console.log(`\nAll unique classes found in first 50 elements:`);

    const classes = new Set<string>();
    $('*').slice(0, 100).each((_, el) => {
      const cls = $(el).attr('class');
      if (cls) {
        cls.split(' ').forEach(c => classes.add(c));
      }
    });
    console.log(Array.from(classes).sort().join(', '));

  } catch (error) {
    console.error('Error:', error);
  }
}

testNakiny();
