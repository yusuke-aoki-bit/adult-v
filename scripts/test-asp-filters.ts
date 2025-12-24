import http from 'http';

const ASP_LIST = [
  'SOKMIL', 'DUGA', 'FANZA', 'b10f', 'MGS',
  'caribbeancompr', 'heyzo', 'FC2', '1pondo', 'caribbeancom',
  'heydouga', 'x1x', 'Japanska', 'enkou55', 'urekko', 'tokyohot'
];

interface TestResult {
  asp?: string;
  name?: string;
  port: number;
  status: number | string;
}

async function testURL(port: number, path: string, maxRedirects = 3): Promise<TestResult> {
  return new Promise((resolve) => {
    const doRequest = (currentPath: string, redirectCount: number) => {
      const url = `http://localhost:${port}${currentPath}`;
      const req = http.get(url, { timeout: 10000 }, (res) => {
        // Follow redirects
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location && redirectCount < maxRedirects) {
          const location = res.headers.location;
          // Handle relative and absolute URLs
          const newPath = location.startsWith('http') ? new URL(location).pathname + new URL(location).search : location;
          doRequest(newPath, redirectCount + 1);
        } else {
          resolve({ port, status: res.statusCode || 0 });
        }
      });
      req.on('error', (e) => resolve({ port, status: 'ERROR: ' + e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ port, status: 'TIMEOUT' }); });
    };
    doRequest(path, 0);
  });
}

async function runTests() {
  console.log('=== ASPバッジフィルターテスト ===\n');

  const results: TestResult[] = [];
  for (const asp of ASP_LIST) {
    const path = `/ja/products?includeAsp=${asp}`;
    const [r3000, r3001] = await Promise.all([
      testURL(3000, path),
      testURL(3001, path)
    ]);
    results.push({ ...r3000, asp }, { ...r3001, asp });
    const s3000 = r3000.status === 200 ? '✓' : '✗ ' + r3000.status;
    const s3001 = r3001.status === 200 ? '✓' : '✗ ' + r3001.status;
    console.log(`${asp.padEnd(16)} | web: ${s3000.padEnd(8)} | fanza: ${s3001}`);
  }

  console.log('\n=== 複合フィルターテスト ===\n');
  const compoundTests = [
    { name: '複数ASP', path: '/ja/products?includeAsp=SOKMIL,DUGA' },
    { name: 'ASP+セール', path: '/ja/products?includeAsp=SOKMIL&onSale=true' },
    { name: 'ASP+ソート', path: '/ja/products?includeAsp=DUGA&sort=priceAsc' },
    { name: '除外ASP', path: '/ja/products?excludeAsp=FANZA' },
    { name: '新規DTI複合', path: '/ja/products?includeAsp=heydouga,x1x,enkou55' }
  ];

  for (const test of compoundTests) {
    const [r3000, r3001] = await Promise.all([
      testURL(3000, test.path),
      testURL(3001, test.path)
    ]);
    const s3000 = r3000.status === 200 ? '✓' : '✗ ' + r3000.status;
    const s3001 = r3001.status === 200 ? '✓' : '✗ ' + r3001.status;
    console.log(`${test.name.padEnd(16)} | web: ${s3000.padEnd(8)} | fanza: ${s3001}`);
  }

  const failed = results.filter(r => r.status !== 200);
  console.log(`\n合計: ${results.length}テスト, 失敗: ${failed.length}`);
  if (failed.length > 0) {
    console.log('失敗詳細:');
    failed.forEach(f => console.log(`  - ${f.asp} (port ${f.port}): ${f.status}`));
  }
}

runTests();
