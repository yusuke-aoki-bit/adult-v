import { getFullSizeImageUrl } from '../lib/image-utils';

// Test b10f
const b10fUrls = [
  'https://ads.b10f.jp/images/1-doks-423/1s.jpg',
  'https://ads.b10f.jp/images/3402-orst-00252/1s.jpg',
];

console.log('=== b10f URL conversion ===');
b10fUrls.forEach(url => {
  console.log('Original:', url);
  console.log('Full:', getFullSizeImageUrl(url));
  console.log('');
});

// Test duga
const dugaUrls = [
  'https://pic.duga.jp/unsecure/hibino/1671/noauth/240x180.jpg',
  'https://pic.duga.jp/unsecure/scocci/0200/noauth/240x180.jpg',
];

console.log('=== duga URL conversion ===');
dugaUrls.forEach(url => {
  console.log('Original:', url);
  console.log('Full:', getFullSizeImageUrl(url));
  console.log('');
});

// Test sokmil  
const sokmilUrls = [
  'https://img.sokmil.com/image/product/pef_tak1685_01_100x142_T1764298420.jpg',
  'https://img.sokmil.com/image/product/pef_sdv0749_01_100x142_T1764299953.jpg',
];

console.log('=== sokmil URL conversion ===');
sokmilUrls.forEach(url => {
  console.log('Original:', url);
  console.log('Full:', getFullSizeImageUrl(url));
  console.log('');
});
