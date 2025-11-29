import { generateImageUrls } from './test-pattern-generation';

// Copy the updated function
function generateImageUrls(productId: string): string[] {
  const images: string[] = [];
  const match = productId.match(/^([A-Z0-9]+?)[\-\s]?(\d{3,})$/i);
  if (!match) return [];
  
  const series = match[1].toLowerCase();
  const number = match[2];
  
  const seriesMapping: Record<string, { directory: string; seriesPrefix?: string }> = {
    'siro': { directory: 'shirouto' },
    'stars': { directory: 'sodcreate', seriesPrefix: '107stars' },
    'cawd': { directory: 'sodcreate', seriesPrefix: '406cawd' },
  };
  
  const mapping = seriesMapping[series] || { directory: 'prestige' };
  const directory = mapping.directory;
  const actualSeries = mapping.seriesPrefix || series;
  
  const baseUrl = `https://image.mgstage.com/images/${directory}/${actualSeries}/${number}`;
  images.push(`${baseUrl}/pb_e_${actualSeries}-${number}.jpg`);
  
  for (let i = 0; i <= 5; i++) {
    images.push(`${baseUrl}/cap_e_${i}_${actualSeries}-${number}.jpg`);
  }
  
  return images;
}

async function testStars() {
  const urls = generateImageUrls('STARS-492');
  console.log('Generated URLs for STARS-492:\n');
  
  for (const url of urls.slice(0, 3)) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const status = response.ok ? '✅' : '❌';
      console.log(`${status} ${url}`);
    } catch (error) {
      console.log(`❌ ${url}`);
    }
  }
}

testStars().then(() => process.exit(0));
