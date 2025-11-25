async function verifyImages() {
  const testUrls = [
    'https://image.mgstage.com/images/prestige/abp/933/pb_e_abp-933.jpg',
    'https://image.mgstage.com/images/prestige/abp/933/cap_e_0_abp-933.jpg',
    'https://image.mgstage.com/images/prestige/abp/933/cap_e_5_abp-933.jpg',
  ];

  for (const url of testUrls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const status = response.ok ? '✅' : '❌';
      console.log(`${status} ${url}`);
    } catch (error) {
      console.log(`❌ ${url} - ${error}`);
    }
  }
}

verifyImages().then(() => process.exit(0));
