/**
 * Google API テストスクリプト
 */

import { checkGoogleApiConfig, customSearch, searchActressReading } from '../lib/google-apis';

async function main() {
  console.log('=== Google API テスト ===\n');

  // 設定確認
  const config = checkGoogleApiConfig();
  console.log('API設定状況:');
  console.log(`  Custom Search: ${config.customSearch ? '✅' : '❌'}`);
  console.log(`  Natural Language: ${config.naturalLanguage ? '✅' : '❌'}`);
  console.log(`  Vision: ${config.vision ? '✅' : '❌'}`);
  console.log(`  Translation: ${config.translation ? '✅' : '❌'}`);
  console.log(`  YouTube: ${config.youtube ? '✅' : '❌'}`);

  if (!config.customSearch) {
    console.error('\n❌ Custom Search APIが設定されていません');
    process.exit(1);
  }

  // Custom Search テスト
  console.log('\n--- Custom Search API テスト ---');
  console.log('検索クエリ: 三上悠亜 AV女優 読み方\n');

  const result = await customSearch('三上悠亜 AV女優 読み方', {
    num: 3,
    language: 'lang_ja',
  });

  if (result && result.items) {
    console.log(`検索結果: ${result.items.length}件`);
    for (const item of result.items) {
      console.log(`\n  タイトル: ${item.title}`);
      console.log(`  URL: ${item.link}`);
      console.log(`  スニペット: ${item.snippet.substring(0, 100)}...`);
    }
  } else {
    console.log('検索結果なし');
  }

  // 読み仮名取得テスト
  console.log('\n--- 読み仮名取得テスト ---');
  const testNames = ['三上悠亜', '橋本ありな', '深田えいみ'];

  for (const name of testNames) {
    console.log(`\n${name}:`);
    const reading = await searchActressReading(name);
    console.log(`  → ${reading || '取得できず'}`);
  }

  console.log('\n=== テスト完了 ===');
}

main().catch(console.error);
