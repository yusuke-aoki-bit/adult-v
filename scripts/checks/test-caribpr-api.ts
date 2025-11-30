import iconv from 'iconv-lite';

async function main() {
  // カリビアンコムプレミアムの商品をテスト
  const productId = '100821_003';
  const url = `https://www.caribbeancompr.com/moviepages/${productId}/index.html`;

  console.log('=== カリビアンコムプレミアム テスト ===');
  console.log('URL:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('Status:', response.status);

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      // EUC-JPでデコード
      const html = iconv.decode(buffer, 'EUC-JP');

      console.log('HTML Length:', html.length);

      // 出演者パターンをテスト
      const actorPattern = /<span class="spec-title">出演:<\/span>\s*<span class="spec-content">([^<]+)<\/span>/;
      const match = html.match(actorPattern);

      if (match) {
        console.log('Matched!');
        console.log('Actors:', match[1]);
      } else {
        console.log('No match found');

        // HTMLから出演者っぽい部分を探す
        const specMatch = html.match(/出演[\s\S]{0,500}/);
        if (specMatch) {
          console.log('Near "出演":', specMatch[0].substring(0, 200));
        }
      }
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  // HEYZOもテスト
  console.log('\n=== HEYZO テスト ===');
  const heyzoId = '2777';  // HEYZOはID形式が違う可能性
  const heyzoUrl = `https://www.heyzo.com/moviepages/${heyzoId}/index.html`;
  console.log('URL:', heyzoUrl);

  try {
    const response = await fetch(heyzoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    console.log('Status:', response.status);

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const html = iconv.decode(buffer, 'EUC-JP');

      console.log('HTML Length:', html.length);

      const actorPattern = /<th>出演<\/th>\s*<td>([^<]+)<\/td>/;
      const match = html.match(actorPattern);

      if (match) {
        console.log('Matched!');
        console.log('Actors:', match[1]);
      } else {
        console.log('No match found');

        const specMatch = html.match(/出演[\s\S]{0,500}/);
        if (specMatch) {
          console.log('Near "出演":', specMatch[0].substring(0, 200));
        }
      }
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  process.exit(0);
}

main();
