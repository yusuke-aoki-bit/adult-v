/**
 * DeepL Translate API ユーティリティ
 *
 * DeepL APIを使用した翻訳機能
 * 高品質な翻訳を提供
 *
 * API: https://api-free.deepl.com/v2/translate (Free版)
 *      https://api.deepl.com/v2/translate (Pro版)
 */

// DeepL API設定
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';

// 言語コードマッピング（DeepLの言語コードに変換）
const DEEPL_LANG_MAP: Record<string, string> = {
  ja: 'JA',
  en: 'EN',
  zh: 'ZH', // 簡体字中国語
  ko: 'KO',
};

/**
 * DeepL APIで翻訳を実行
 */
async function translateWithDeepL(
  texts: string[],
  sourceLang: string,
  targetLang: string
): Promise<string[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPL_API_KEY environment variable is not set');
  }

  const source = DEEPL_LANG_MAP[sourceLang] || sourceLang.toUpperCase();
  const target = DEEPL_LANG_MAP[targetLang] || targetLang.toUpperCase();

  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        source_lang: source,
        target_lang: target,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.translations.map((t: { text: string }) => t.text);
  } catch (error) {
    console.error('[DeepL] Translation failed:', error);
    throw error;
  }
}

/**
 * テキストを翻訳する
 * @param text 翻訳するテキスト
 * @param targetLang 翻訳先の言語コード ('en', 'zh', 'ko')
 * @param sourceLang 翻訳元の言語コード (デフォルト: 'ja')
 * @returns 翻訳されたテキスト
 */
export async function translateText(
  text: string,
  targetLang: 'en' | 'zh' | 'ko',
  sourceLang: string = 'ja'
): Promise<string> {
  if (!text || text.trim() === '') {
    return '';
  }

  const results = await translateWithDeepL([text], sourceLang, targetLang);
  return results[0] || '';
}

/**
 * 複数のテキストを一度に翻訳する
 * DeepLはバッチ翻訳をサポートしているため効率的に処理
 * @param texts 翻訳するテキストの配列
 * @param targetLang 翻訳先の言語コード
 * @param sourceLang 翻訳元の言語コード (デフォルト: 'ja')
 * @returns 翻訳されたテキストの配列
 */
export async function translateBatch(
  texts: string[],
  targetLang: 'en' | 'zh' | 'ko',
  sourceLang: string = 'ja'
): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  // 空文字のインデックスを記録
  const emptyIndices = new Set<number>();
  const nonEmptyTexts: string[] = [];
  const indexMap: number[] = [];

  texts.forEach((text, i) => {
    if (!text || text.trim() === '') {
      emptyIndices.add(i);
    } else {
      nonEmptyTexts.push(text);
      indexMap.push(i);
    }
  });

  if (nonEmptyTexts.length === 0) {
    return texts.map(() => '');
  }

  // DeepLは一度に最大50テキストまで
  const BATCH_SIZE = 50;
  const results: string[] = new Array(texts.length).fill('');

  for (let i = 0; i < nonEmptyTexts.length; i += BATCH_SIZE) {
    const batch = nonEmptyTexts.slice(i, i + BATCH_SIZE);
    const batchIndices = indexMap.slice(i, i + BATCH_SIZE);

    try {
      const translated = await translateWithDeepL(batch, sourceLang, targetLang);
      translated.forEach((text, j) => {
        results[batchIndices[j]] = text;
      });
    } catch (error) {
      console.error(`[DeepL] Batch translation failed:`, error);
      // エラー時は空文字列のまま
    }

    // レート制限を避けるため少し待機
    if (i + BATCH_SIZE < nonEmptyTexts.length) {
      await delay(200);
    }
  }

  return results;
}

/**
 * 翻訳結果をオブジェクトとして返す
 * @param text 翻訳するテキスト
 * @param sourceLang 翻訳元の言語コード (デフォルト: 'ja')
 * @returns 各言語の翻訳結果
 */
export async function translateToAll(
  text: string,
  sourceLang: string = 'ja'
): Promise<{
  en: string;
  zh: string;
  ko: string;
}> {
  if (!text || text.trim() === '') {
    return { en: '', zh: '', ko: '' };
  }

  try {
    // 並列で翻訳を実行
    const [en, zh, ko] = await Promise.all([
      translateText(text, 'en', sourceLang),
      translateText(text, 'zh', sourceLang),
      translateText(text, 'ko', sourceLang),
    ]);

    return { en, zh, ko };
  } catch (error) {
    console.error('[DeepL] Translation to all languages failed:', error);
    throw error;
  }
}

/**
 * レート制限を考慮して遅延を入れる
 * @param ms 待機するミリ秒
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * バッチ処理用のチャンク分割
 * @param array 分割する配列
 * @param size チャンクサイズ
 * @returns チャンク化された配列
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
