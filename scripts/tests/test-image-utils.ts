import { normalizeImageUrl } from '../lib/image-utils';

// Test with broken Japanska URL
const brokenUrl = 'https://www.japanska-xxx.com/<img src="https://img01.japanska-xxx.com/img/movie/k5772/00.jpg"';
console.log('=== Test: Broken Japanska URL ===');
console.log('Input:', brokenUrl);
console.log('Output:', normalizeImageUrl(brokenUrl));
console.log();

// Test with normal URL
const normalUrl = 'https://example.com/image.jpg';
console.log('=== Test: Normal URL ===');
console.log('Input:', normalUrl);
console.log('Output:', normalizeImageUrl(normalUrl));
console.log();

// Test with null
console.log('=== Test: Null ===');
console.log('Input:', null);
console.log('Output:', normalizeImageUrl(null));
console.log();

// Test with protocol-relative URL
console.log('=== Test: Protocol-relative URL ===');
console.log('Input:', '//example.com/image.jpg');
console.log('Output:', normalizeImageUrl('//example.com/image.jpg'));
