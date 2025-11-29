/**
 * Japanska HTMLを取得してタイトル抽出パターンを確認するスクリプト
 */

async function main() {
  // 複数のURLパターンを試す
  const urls = [
    'https://www.japanska-xxx.com/movie/detail_34500.html',
    'https://www.japanska-xxx.com/movie/34500.html',
    'https://www.japanska-xxx.com/movie/detail/34500.html',
    'https://www.japanska-xxx.com/movie/list.html?page=1',  // リストページ確認
  ];

  for (const url of urls) {
    console.log('\n\n======================================');
    console.log('Fetching:', url);
    console.log('======================================');

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      console.log('Status:', response.status);
      console.log('Final URL:', response.url);

      const html = await response.text();
      console.log('HTML Length:', html.length);

      // ページの種類を判定
      const isHomePage = html.includes('<!--home.html-->') || html.includes('高画質無修正アダルト動画ならJAPANSKA');
      console.log('Is home page redirect?:', isHomePage);

      // タイトルタグ
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) console.log('Title tag:', titleMatch[1].substring(0, 100));

      // detail ページの場合のタイトル候補
      if (!isHomePage) {
        console.log('\n--- Potential title patterns ---');

        // h1/h2タグ
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match) console.log('h1:', h1Match[1].substring(0, 100));

        const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        if (h2Match) console.log('h2:', h2Match[1].substring(0, 100));

        // og:title
        const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
        if (ogTitleMatch) console.log('og:title:', ogTitleMatch[1]);
      }

      // リストページの場合、商品リンクを確認
      if (url.includes('list')) {
        console.log('\n--- Movie links found ---');
        const movieLinks = html.matchAll(/href="([^"]*movie\/[^"]+\.html)"/gi);
        let linkCount = 0;
        for (const m of movieLinks) {
          console.log('Movie link:', m[1]);
          if (++linkCount > 10) break;
        }
      }

    } catch (error) {
      console.error('Error:', error);
    }
  }

  process.exit(0);
}

main();
