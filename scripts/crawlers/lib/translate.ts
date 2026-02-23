/**
 * Lingva Translate API ユーティリティ
 *
 * Lingva TranslateはGoogle Translateのオープンソースプロキシ
 * APIキー不要で、コンテンツポリシーでブロックされない
 *
 * 公式インスタンス: https://lingva.ml
 * API: https://lingva.ml/api/v1/{source}/{target}/{text}
 */

// Lingvaインスタンス（フォールバック用に複数用意）
const LINGVA_INSTANCES = ['https://lingva.ml', 'https://lingva.lunar.icu', 'https://translate.plausibility.cloud'];

// 言語コードマッピング（Lingvaは小文字を使用）
const LINGVA_LANG_MAP: Record<string, string> = {
  ja: 'ja',
  en: 'en',
  zh: 'zh', // 簡体字中国語
  ko: 'ko',
};

/**
 * 単一のLingvaインスタンスで翻訳を試行
 */
async function tryTranslateWithInstance(
  instance: string,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  const source = LINGVA_LANG_MAP[sourceLang] || sourceLang;
  const target = LINGVA_LANG_MAP[targetLang] || targetLang;
  const url = `${instance}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.translation || null;
  } catch {
    return null;
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
  sourceLang: string = 'ja',
): Promise<string> {
  if (!text || text.trim() === '') {
    return '';
  }

  // 各インスタンスを順番に試す
  for (const instance of LINGVA_INSTANCES) {
    const result = await tryTranslateWithInstance(instance, text, sourceLang, targetLang);
    if (result) {
      return result;
    }
    console.warn(`[Lingva] Instance ${instance} failed, trying next...`);
  }

  throw new Error('All Lingva instances failed');
}

/**
 * 複数のテキストを一度に翻訳する
 * Lingvaはバッチ翻訳をサポートしていないため、順次翻訳する
 * @param texts 翻訳するテキストの配列
 * @param targetLang 翻訳先の言語コード
 * @param sourceLang 翻訳元の言語コード (デフォルト: 'ja')
 * @returns 翻訳されたテキストの配列
 */
export async function translateBatch(
  texts: string[],
  targetLang: 'en' | 'zh' | 'ko',
  sourceLang: string = 'ja',
): Promise<string[]> {
  if (texts.length === 0) {
    return [];
  }

  const results: string[] = [];
  for (const text of texts) {
    if (!text || text.trim() === '') {
      results.push('');
    } else {
      try {
        const translated = await translateText(text, targetLang, sourceLang);
        results.push(translated);
        // レート制限を避けるため少し待機
        await delay(100);
      } catch {
        results.push('');
      }
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
  sourceLang: string = 'ja',
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
    console.error('[Lingva] Translation to all languages failed:', error);
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
