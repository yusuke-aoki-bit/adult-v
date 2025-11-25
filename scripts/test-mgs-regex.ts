/**
 * Test MGS product ID regex parsing
 */

function testRegex(productId: string) {
  const match = productId.match(/^([A-Z0-9]+?)[\-\s]?(\d{3,})$/i);
  if (!match) {
    console.log(`❌ ${productId}: NO MATCH`);
    return;
  }

  const series = match[1].toLowerCase();
  const number = match[2];
  const generatedUrl = `https://image.mgstage.com/images/.../${series}/${number}/pb_e_${series}-${number}.jpg`;

  console.log(`✅ ${productId}:`);
  console.log(`   series="${series}", number="${number}"`);
  console.log(`   URL: ${generatedUrl}`);
}

console.log('=== Testing MGS Product ID Regex ===\n');

// With hyphens
testRegex('300MIUM-1150');
testRegex('SIRO-4000');
testRegex('ABP-862');

console.log('\n--- Without hyphens ---\n');

// Without hyphens
testRegex('300MIUM1320');
testRegex('SIRO4944');
testRegex('ABP862');

console.log('\n--- Edge cases ---\n');

// Edge cases
testRegex('259LUXU1006');
testRegex('STARS-862');
testRegex('CAWD-500');
