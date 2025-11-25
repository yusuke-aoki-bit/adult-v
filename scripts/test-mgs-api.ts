/**
 * MGSアフィリエイトAPIのテスト
 */

async function testMgsApi() {
  // テスト用のSKU
  const testSkus = ['SIRO-4000', '300MIUM-1150', 'STARS-001'];
  const pid = '09955e55-25f1-40f7-8268-d2b94a30f873'; // アフィリエイトID

  for (const sku of testSkus) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing SKU: ${sku}`);
    console.log('='.repeat(80));

    const apiUrl = `https://www.mgstage.com/affiliate_exp/affiliate_exp_link_tool.php?sku=${sku}&pid=${pid}&type=ppv&sample=true`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      console.log(`\nStatus: ${response.status}`);

      if (!response.ok) {
        console.log(`❌ HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      console.log('\nResponse length:', html.length);
      console.log('\nFirst 2000 chars:');
      console.log(html.substring(0, 2000));

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }

  console.log('\n\n✅ API test completed');
}

testMgsApi()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
