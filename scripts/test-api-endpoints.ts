import http from 'http';

interface TestResult {
  endpoint: string;
  port: number;
  status: number | string;
  method: string;
}

async function testAPI(port: number, endpoint: string, method: string = 'GET', body?: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const url = new URL(`http://localhost:${port}${endpoint}`);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      resolve({ endpoint, port, status: res.statusCode || 0, method });
    });
    req.on('error', (e) => resolve({ endpoint, port, status: 'ERROR: ' + e.message, method }));
    req.on('timeout', () => { req.destroy(); resolve({ endpoint, port, status: 'TIMEOUT', method }); });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== APIエンドポイントテスト ===\n');

  // Common APIs for both apps
  const commonAPIs = [
    // Products
    { endpoint: '/api/products', method: 'GET' },
    { endpoint: '/api/products?ids=1', method: 'GET' },
    { endpoint: '/api/products?limit=30&offset=0', method: 'GET' },
    { endpoint: '/api/products/search?q=test', method: 'GET' },

    // Actresses
    { endpoint: '/api/actresses', method: 'GET' },
    { endpoint: '/api/actresses?ids=1', method: 'GET' },
    { endpoint: '/api/ranking/actresses', method: 'GET' },

    // Stats
    { endpoint: '/api/stats/asp', method: 'GET' },
    { endpoint: '/api/stats/sales', method: 'GET' },
    { endpoint: '/api/weekly-highlights', method: 'GET' },

    // Other
    { endpoint: '/api/search/autocomplete?q=a', method: 'GET' },
    { endpoint: '/api/discover', method: 'GET' },
    { endpoint: '/api/makers', method: 'GET' },

    // POST APIs
    { endpoint: '/api/age-verify', method: 'POST', body: JSON.stringify({ verified: true }) },
    { endpoint: '/api/recommendations', method: 'POST', body: JSON.stringify({ productIds: ['1'] }) },
  ];

  // Footer actresses (now available in both apps)
  const footerActressAPI = { endpoint: '/api/footer-actresses', method: 'GET' };

  const results: TestResult[] = [];

  console.log('--- 共通API (両サイト) ---\n');
  for (const api of commonAPIs) {
    const [r3000, r3001] = await Promise.all([
      testAPI(3000, api.endpoint, api.method, (api as any).body),
      testAPI(3001, api.endpoint, api.method, (api as any).body)
    ]);
    results.push(r3000, r3001);

    const s3000 = r3000.status === 200 ? '✓' : `✗ ${r3000.status}`;
    const s3001 = r3001.status === 200 ? '✓' : `✗ ${r3001.status}`;
    console.log(`${api.method.padEnd(5)} ${api.endpoint.padEnd(40)} | web: ${s3000.padEnd(10)} | fanza: ${s3001}`);
  }

  console.log('\n--- Footer Actresses API ---\n');
  const [rFooter3000, rFooter3001] = await Promise.all([
    testAPI(3000, footerActressAPI.endpoint, footerActressAPI.method),
    testAPI(3001, footerActressAPI.endpoint, footerActressAPI.method)
  ]);
  results.push(rFooter3000, rFooter3001);
  const sFooter3000 = rFooter3000.status === 200 ? '✓' : `✗ ${rFooter3000.status}`;
  const sFooter3001 = rFooter3001.status === 200 ? '✓' : `✗ ${rFooter3001.status}`;
  console.log(`${footerActressAPI.method.padEnd(5)} ${footerActressAPI.endpoint.padEnd(40)} | web: ${sFooter3000.padEnd(10)} | fanza: ${sFooter3001}`);

  // Summary
  const failed = results.filter(r => {
    const status = typeof r.status === 'number' ? r.status : 0;
    return status !== 200 && status !== 201;
  });

  console.log(`\n合計: ${results.length}テスト, 失敗: ${failed.length}`);
  if (failed.length > 0) {
    console.log('\n失敗詳細:');
    failed.forEach(f => console.log(`  - ${f.method} ${f.endpoint} (port ${f.port}): ${f.status}`));
  }
}

runTests();
