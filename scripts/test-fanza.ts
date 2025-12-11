import puppeteer from 'puppeteer';

async function test() {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  await page.setCookie(
    { name: 'age_check_done', value: '1', domain: '.dmm.co.jp' },
    { name: 'cklg', value: 'ja', domain: '.dmm.co.jp' }
  );

  const url = 'https://video.dmm.co.jp/av/list/?sort=date&page=1';
  console.log('Navigating to:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Check if we got redirected to age check
  if (currentUrl.includes('age_check')) {
    console.log('Got redirected to age check!');
    const html = await page.content();
    console.log('HTML snippet:', html.substring(0, 500));
  } else {
    // スクロール
    await page.evaluate(() => {
      window.scrollTo(0, 1500);
    });
    await new Promise((r) => setTimeout(r, 3000));

    // 商品を探す
    const cids = await page.evaluate(() => {
      const cidSet = new Set<string>();

      document.querySelectorAll('img[src]').forEach((img) => {
        const src = img.getAttribute('src') || '';
        const match = src.match(/\/video\/([a-z0-9]+)\//i);
        if (match && match[1]) {
          cidSet.add(match[1]);
        }
      });

      document.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const detailMatch = href.match(/\/av\/detail\/([a-z0-9]+)/i);
        if (detailMatch && detailMatch[1]) {
          cidSet.add(detailMatch[1]);
        }
        const cidMatch = href.match(/cid=([a-z0-9]+)/i);
        if (cidMatch && cidMatch[1]) {
          cidSet.add(cidMatch[1]);
        }
      });

      return Array.from(cidSet);
    });

    console.log('Found CIDs:', cids.length);
    console.log('Sample:', cids.slice(0, 5));

    if (cids.length === 0) {
      const html = await page.content();
      console.log('HTML length:', html.length);
      console.log('Contains video tag:', html.includes('video'));

      // Find all links
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .slice(0, 20)
          .map((a) => a.href);
      });
      console.log('Sample links:', links);
    }
  }

  await browser.close();
  console.log('Done');
}

test().catch(console.error);
