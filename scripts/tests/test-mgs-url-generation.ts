/**
 * Test MGS URL generation logic
 */

function generateImageUrls(productId: string): string[] {
  const images: string[] = [];

  const match = productId.match(/^([A-Z0-9]+?)[\-\s]?(\d{3,})$/i);
  if (!match) {
    console.log(`❌ No match for: ${productId}`);
    return [];
  }

  const series = match[1].toLowerCase();
  const number = match[2];

  console.log(`Product ID: ${productId}`);
  console.log(`  Series: ${series}`);
  console.log(`  Number: ${number}`);

  const seriesMapping: Record<string, string> = {
    '300mium': 'prestigepremium',
    '300maan': 'prestigepremium',
    '300ntk': 'prestigepremium',
    'siro': 'shirouto',
    '259luxu': 'luxutv',
    'gni': 'prestige',
    'abp': 'prestige',
    'abw': 'prestige',
    'abf': 'prestige',
    '200gana': 'nanpatv',
    'mfcs': 'doc',
    'ddh': 'doc',
    '812mmc': 'momoco',
    '107stars': 'sodcreate',
    '107sdhs': 'sodcreate',
    '107sdde': 'sodcreate',
    '107sdmu': 'sodcreate',
    '107hunbl': 'sodcreate',
    '107hunta': 'sodcreate',
    '107hunt': 'sodcreate',
    '107sdmm': 'sodcreate',
    '107sdth': 'sodcreate',
    '406cawd': 'sodcreate',
    '406mmus': 'sodcreate',
  };

  const directory = seriesMapping[series] || 'prestige';
  const actualSeries = series;

  console.log(`  Directory: ${directory}`);
  console.log(`  Actual series: ${actualSeries}`);

  const baseUrl = `https://image.mgstage.com/images/${directory}/${actualSeries}/${number}`;

  const thumbnailUrl = `${baseUrl}/pb_e_${actualSeries}-${number}.jpg`;
  console.log(`  Thumbnail URL: ${thumbnailUrl}\n`);

  images.push(thumbnailUrl);

  for (let i = 0; i <= 2; i++) {
    images.push(`${baseUrl}/cap_e_${i}_${actualSeries}-${number}.jpg`);
  }

  return images;
}

// Test cases from database
const testIds = [
  '300MIUM1000',
  'STARS-1000',
  'ABW-484',
  'MFCS-188',
  '812MMC-020',
  'DDH-362',
  '107SDHS-044',
];

console.log('=== Testing MGS URL Generation ===\n');

for (const id of testIds) {
  const urls = generateImageUrls(id);
  if (urls.length > 0) {
    console.log(`✅ Generated ${urls.length} URLs\n`);
  } else {
    console.log('❌ Failed to generate URLs\n');
  }
}
