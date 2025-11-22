import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';

const buffer = readFileSync('./data/apex.csv');
const content = iconv.decode(buffer, 'shift_jis');

console.log('First 500 characters of CSV:');
console.log(content.substring(0, 500));
console.log('\n---\n');

const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
});

console.log(`Total records: ${records.length}`);
console.log('\nFirst record:');
console.log(JSON.stringify(records[0], null, 2));
console.log('\nColumn names:');
console.log(Object.keys(records[0] as object));
