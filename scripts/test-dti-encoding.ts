/**
 * DTIサイトのエンコーディングをテストするスクリプト
 */
import iconv from 'iconv-lite';

async function test() {
  const url = 'https://www.caribbeancompr.com/moviepages/010125_001/index.html';
  console.log('Fetching:', url);

  try {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    console.log('Buffer length:', buffer.length);

    // 最初の500バイトを確認
    const head = buffer.slice(0, 500).toString('latin1');
    console.log('\nRaw head (latin1):');
    console.log(head.substring(0, 200));

    // EUC-JPでデコード
    const decoded = iconv.decode(buffer, 'EUC-JP');
    console.log('\nDecoded (EUC-JP):');
    console.log(decoded.substring(0, 500));

    // titleを抽出
    const titleMatch = decoded.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      console.log('\nTitle:', titleMatch[1]);
    }

    // UTF-8で直接デコード（間違った方法）
    const wrongDecoded = buffer.toString('utf-8');
    console.log('\nWrong decode (UTF-8):');
    console.log(wrongDecoded.substring(0, 300));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
