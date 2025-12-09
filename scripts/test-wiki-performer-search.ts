/**
 * Wiki出演者検索機能のテスト
 */

import {
  searchPerformerByName,
  searchPerformerByMakerAndTitle,
  detectPerformerFromTitle,
} from '../lib/wiki-performer-search';

async function main() {
  console.log('=== Wiki出演者検索テスト ===\n');

  // テスト1: 名前で検索（ひらがな）
  console.log('--- テスト1: 名前で検索（ひらがな）---');
  const test1 = await searchPerformerByName('まゆみ');
  console.log(`「まゆみ」で検索: ${test1.length}件`);
  for (const r of test1) {
    console.log(`  - ${r.performerName} (${r.maker}) romaji: ${r.performerNameRomaji || 'N/A'}`);
  }

  // テスト2: 名前で検索（ローマ字）
  console.log('\n--- テスト2: 名前で検索（ローマ字）---');
  const test2 = await searchPerformerByName('MAYUMI');
  console.log(`「MAYUMI」で検索: ${test2.length}件`);
  for (const r of test2) {
    console.log(`  - ${r.performerName} (${r.maker}) romaji: ${r.performerNameRomaji || 'N/A'}`);
  }

  // テスト3: メーカー＋タイトルで検索
  console.log('\n--- テスト3: メーカー＋タイトルで検索 ---');
  const test3 = await searchPerformerByMakerAndTitle('tokyo247', 'さやか');
  console.log(`tokyo247 + 「さやか」で検索: ${test3.length}件`);
  for (const r of test3) {
    console.log(`  - ${r.performerName} (${r.maker}) confidence: ${r.confidence}`);
  }

  // テスト4: タイトルから出演者を自動検出
  console.log('\n--- テスト4: タイトルから出演者を自動検出 ---');
  const titles = [
    'Tokyo247 まゆみ',
    'G-AREA みく',
    'S-Cute あずみ',
  ];
  for (const title of titles) {
    const result = await detectPerformerFromTitle(title);
    if (result) {
      console.log(`「${title}」→ ${result.performerName} (${result.maker})`);
    } else {
      console.log(`「${title}」→ 該当なし`);
    }
  }

  // テスト5: 保存されているデータの確認
  console.log('\n--- テスト5: 全データ検索 ---');
  const allData = await searchPerformerByName('');
  console.log(`総データ数: ${allData.length}件`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
