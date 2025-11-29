/**
 * Japanska ページ取得テスト
 */

async function main() {
  const url = 'https://www.japanska-xxx.com/movie/detail_35623.html';
  console.log('Fetching:', url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    }
  });

  console.log('Status:', response.status);
  console.log('Final URL:', response.url);

  const html = await response.text();
  console.log('HTML Length:', html.length);

  // タイトル
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) console.log('Title tag:', titleMatch[1]);

  // h1
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/is);
  if (h1Match) console.log('h1:', h1Match[1].trim().substring(0, 100));

  // og:title
  const ogMatch = html.match(/property=['"]og:title['"][^>]*content=['"]([^'"]+)['"]/i) ||
                  html.match(/content=['"]([^'"]+)['"][^>]*property=['"]og:title['"]/i);
  if (ogMatch) console.log('og:title:', ogMatch[1]);

  // ホームページ判定
  const isHome = html.includes('<!--home.html-->');
  console.log('Is home redirect:', isHome);

  // movie-title クラス
  const movieTitleMatch = html.match(/class=['"]movie-title['"][^>]*>([^<]+)/i);
  if (movieTitleMatch) console.log('movie-title:', movieTitleMatch[1]);

  // 出演者セクションを探す
  const actressMatch = html.match(/出演[：:]\s*([^<\n]+)/i);
  if (actressMatch) console.log('出演:', actressMatch[1]);

  console.log('\n=== HTML snippet (first 5000 chars) ===');
  console.log(html.substring(0, 5000));

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
