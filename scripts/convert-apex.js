/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One-off script to convert the provided APEX affiliate CSV into a UTF-8 JSON file.
 * Usage: node scripts/convert-apex.js
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const iconv = require('iconv-lite');

const INPUT = path.join(process.cwd(), 'data', 'apex.csv');
const OUTPUT = path.join(process.cwd(), 'data', 'apex.json');
const LIMIT = Number(process.env.APEX_LIMIT || '400');

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`[convert-apex] CSV not found: ${INPUT}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(INPUT);
  const decoded = iconv.decode(buffer, 'shift_jis');

  const parsed = Papa.parse(decoded, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    console.error('[convert-apex] CSV parse errors:', parsed.errors.slice(0, 5));
    process.exit(1);
  }

  const rows = parsed.data.filter((row) => row['商品ID'] && row['タイトル']);
  const trimmed = rows.slice(0, LIMIT);

  const simplified = trimmed.map((row) => ({
    id: row['商品ID']?.trim(),
    title: row['タイトル']?.trim(),
    description: row['紹介文']?.trim(),
    label: row['レーベル']?.trim(),
    maker: row['メーカー']?.trim(),
    category: row['カテゴリ']?.trim(),
    price: row['価格']?.trim(),
    sellType: row['販売種別']?.trim(),
    actress: row['女優']?.trim(),
    releaseDate: row['配信開始日']?.trim(),
    url: row['商品URL']?.trim(),
  }));

  fs.writeFileSync(OUTPUT, JSON.stringify(simplified, null, 2), 'utf8');
  console.log(`[convert-apex] Wrote ${simplified.length} entries to ${OUTPUT}`);
}

main();

