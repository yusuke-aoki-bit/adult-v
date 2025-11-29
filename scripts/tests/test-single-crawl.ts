/**
 * Test MGS image generation with a single known product
 */

function generateImageUrls(productId: string): string[] {
  const images: string[] = [];

  const match = productId.match(/^([A-Z0-9]+?)[\-\s]?(\d{3,})$/i);
  if (!match) {
    return [];
  }

  const series = match[1].toLowerCase();
  const number = match[2];

  const seriesMapping: Record<string, string> = {
    '300mium': 'prestigepremium',
    '300maan': 'prestigepremium',
    '300ntk': 'prestigepremium',
    'siro': 'shirouto',
    '259luxu': 'luxutv',
    'gni': 'prestige',
    '200gana': 'nanpatv',
    'mfcs': 'doc',
  };

  const directory = seriesMapping[series] || 'prestige';
  const baseUrl = `https://image.mgstage.com/images/${directory}/${series}/${number}`;

  // Package image
  images.push(`${baseUrl}/pb_e_${series}-${number}.jpg`);

  // Sample images (0-20)
  for (let i = 0; i <= 20; i++) {
    images.push(`${baseUrl}/cap_e_${i}_${series}-${number}.jpg`);
  }

  return images;
}

async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function testProduct(productId: string) {
  console.log(`Testing: ${productId}\n`);

  const urls = generateImageUrls(productId);
  console.log(`Generated ${urls.length} candidate URLs\n`);

  const validImages: string[] = [];

  for (const url of urls) {
    const exists = await checkImageExists(url);
    if (exists) {
      validImages.push(url);
      console.log(`✅ ${url}`);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`\n✅ Found ${validImages.length} valid images`);
}

testProduct('SIRO-4000')
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
