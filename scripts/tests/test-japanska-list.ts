/**
 * Japanska 一覧ページからリンクを取得テスト
 */

async function main() {
  const url = 'https://www.japanska-xxx.com/category/list_0.html';
  console.log('Fetching:', url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'ja',
    }
  });

  console.log('Status:', response.status);
  const html = await response.text();
  console.log('HTML Length:', html.length);

  // 詳細ページへのリンクを探す
  const detailLinks = html.matchAll(/href=['"]([^'"]*movie\/detail_(\d+)\.html)['"]/gi);
  const links: string[] = [];
  for (const m of detailLinks) {
    if (!links.includes(m[2])) {
      links.push(m[2]);
    }
  }
  console.log('\nFound detail links:', links.length);
  console.log('Sample IDs:', links.slice(0, 20));

  // ページネーション
  const pageLinks = html.matchAll(/href=['"]([^'"]*list_0\.html\?page=(\d+))['"]/gi);
  const pages: string[] = [];
  for (const m of pageLinks) {
    if (!pages.includes(m[2])) {
      pages.push(m[2]);
    }
  }
  console.log('\nPage numbers found:', pages);

  // 1つ目の詳細ページにアクセスしてタイトルが取れるか確認
  if (links.length > 0) {
    const detailUrl = `https://www.japanska-xxx.com/movie/detail_${links[0]}.html`;
    console.log('\n--- Testing detail page via list ---');
    console.log('URL:', detailUrl);

    const detailResponse = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'ja',
        'Referer': url,  // 一覧ページからのリファラー
      }
    });

    const detailHtml = await detailResponse.text();
    const movieTtlMatch = detailHtml.match(/<div[^>]*class="movie_ttl"[^>]*>\s*<p>([^<]+)<\/p>/i);
    if (movieTtlMatch) {
      console.log('✓ Title found:', movieTtlMatch[1]);
    } else {
      console.log('✗ Title NOT found');
      console.log('Is home page:', detailHtml.includes('<!--home.html-->'));
    }
  }

  process.exit(0);
}

main().catch(console.error);
