/**
 * 翻訳 API ユーティリティ
 *
 * 優先順位:
 * 1. Google Cloud Translation API（ADC認証 - Cloud Run環境で自動認証）
 * 2. DeepL API（DEEPL_API_KEY環境変数が設定されている場合）
 * 3. Lingva Translate（オープンソースプロキシ - フォールバック）
 */

import { GoogleAuth } from 'google-auth-library';

// Google Cloud Translation API設定
const GOOGLE_PROJECT_ID = process.env['GOOGLE_CLOUD_PROJECT'] || process.env['GCP_PROJECT'] || 'adult-v';

// DeepL API設定
const DEEPL_API_KEY = process.env['DEEPL_API_KEY'] || '';
const DEEPL_API_URL = DEEPL_API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

// Lingvaインスタンス（フォールバック用に複数用意）
const LINGVA_INSTANCES = [
  'https://lingva.ml',
  'https://lingva.lunar.icu',
  'https://translate.plausibility.cloud',
];

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
  targetLang: string
): Promise<string | null> {
  const source = LINGVA_LANG_MAP[sourceLang] || sourceLang;
  const target = LINGVA_LANG_MAP[targetLang] || targetLang;
  const url = `${instance}/api/v1/${source}/${target}/${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
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
  sourceLang: string = 'ja'
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
  sourceLang: string = 'ja'
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

// =============================================================================
// google-apis.ts互換インターフェース
// =============================================================================

export interface ProductTranslationItem {
  title: string;
  description?: string;
}

export interface ProductTranslation {
  en?: ProductTranslationItem;
  zh?: ProductTranslationItem;
  ko?: ProductTranslationItem;
}

// =============================================================================
// Google Cloud Translation API (ADC認証)
// =============================================================================

let googleAuth: GoogleAuth | null = null;

/**
 * Google Auth クライアントを取得（シングルトン）
 */
function getGoogleAuth(): GoogleAuth {
  if (!googleAuth) {
    googleAuth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-translation'],
    });
  }
  return googleAuth;
}

/**
 * Google Cloud Translation APIで翻訳（ADC認証）
 */
async function translateWithGoogleCloud(
  texts: string[],
  targetLang: string,
  sourceLang: string = 'ja'
): Promise<string[] | null> {
  try {
    const auth = getGoogleAuth();
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken.token) {
      console.warn('[Google Cloud] Failed to get access token');
      return null;
    }

    const response = await fetch(
      `https://translation.googleapis.com/v3/projects/${GOOGLE_PROJECT_ID}:translateText`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: texts,
          sourceLanguageCode: sourceLang,
          targetLanguageCode: targetLang,
          mimeType: 'text/plain',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response['text']();
      console.error(`[Google Cloud] API error: ${response['status']} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const translations = data.translations || [];
    return translations.map((t: { translatedText: string }) => t.translatedText);
  } catch (error) {
    console.error('[Google Cloud] Translation error:', error);
    return null;
  }
}

/**
 * Google Cloud Translation APIで商品を翻訳
 */
async function translateProductGoogleCloud(
  title: string,
  description?: string
): Promise<ProductTranslation | null> {
  const result: ProductTranslation = {};
  const languages = [
    { key: 'en' as const, code: 'en' },
    { key: 'zh' as const, code: 'zh-CN' },
    { key: 'ko' as const, code: 'ko' },
  ];

  const texts = [title];
  if (description && description.trim()) {
    texts.push(description);
  }

  try {
    for (const lang of languages) {
      const translations = await translateWithGoogleCloud(texts, lang.code, 'ja');
      if (translations && translations.length > 0 && translations[0]) {
        result[lang.key] = {
          title: translations[0],
          ...(translations[1] && { description: translations[1] }),
        };
      }
      await delay(50); // レート制限対策
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('[Google Cloud] Translation failed:', error);
    return null;
  }
}

// =============================================================================
// DeepL API
// =============================================================================

/**
 * DeepL APIで翻訳
 */
async function translateWithDeepL(
  text: string,
  targetLang: string,
  sourceLang: string = 'JA'
): Promise<string | null> {
  if (!DEEPL_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang,
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      const errorText = await response['text']();
      console.error(`[DeepL] API error: ${response['status']} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data.translations?.[0]?.text || null;
  } catch (error) {
    console.error('[DeepL] Translation error:', error);
    return null;
  }
}

/**
 * DeepL APIで商品を翻訳
 */
async function translateProductDeepL(
  title: string,
  description?: string
): Promise<ProductTranslation | null> {
  const result: ProductTranslation = {};
  const languages = [
    { key: 'en' as const, deepl: 'EN' },
    { key: 'zh' as const, deepl: 'ZH' },
    { key: 'ko' as const, deepl: 'KO' },
  ];

  try {
    for (const lang of languages) {
      const translatedTitle = await translateWithDeepL(title, lang.deepl, 'JA');
      if (translatedTitle) {
        let translatedDesc: string | undefined;
        if (description && description.trim()) {
          translatedDesc = await translateWithDeepL(description, lang.deepl, 'JA') || undefined;
        }

        result[lang.key] = {
          title: translatedTitle,
          ...(translatedDesc && { description: translatedDesc }),
        };
      }
      await delay(50); // レート制限対策
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('[DeepL] Translation failed:', error);
    return null;
  }
}

/**
 * 商品情報を複数言語に翻訳
 * 優先順位:
 * 1. Google Cloud Translation API（ADC認証 - Cloud Run環境で自動認証）
 * 2. DeepL API（DEEPL_API_KEY環境変数が設定されている場合）
 * 3. Lingva Translate（オープンソースプロキシ - フォールバック）
 *
 * @param title タイトル
 * @param description 説明
 * @returns 翻訳結果 { en, zh, ko }
 */
export async function translateProductLingva(
  title: string,
  description?: string
): Promise<ProductTranslation | null> {
  if (!title || title.trim() === '') {
    return null;
  }

  // 1. Google Cloud Translation API（ADC認証）を試行
  try {
    console.log('  [Google Cloud] 翻訳を実行中...');
    const result = await translateProductGoogleCloud(title, description);
    if (result && Object.keys(result).length > 0) {
      return result;
    }
    console.warn('  [Google Cloud] 翻訳結果が空、次のプロバイダーを試行...');
  } catch (error) {
    console.warn('  [Google Cloud] 翻訳失敗、次のプロバイダーを試行...', error);
  }

  // 2. DeepL APIを試行
  if (DEEPL_API_KEY) {
    try {
      console.log('  [DeepL] 翻訳を実行中...');
      const result = await translateProductDeepL(title, description);
      if (result && Object.keys(result).length > 0) {
        return result;
      }
      console.warn('  [DeepL] 翻訳結果が空、次のプロバイダーを試行...');
    } catch (error) {
      console.warn('  [DeepL] 翻訳失敗、次のプロバイダーを試行...', error);
    }
  }

  // 3. フォールバック: Lingvaを使用
  console.log('  [Lingva] 翻訳を実行中...');
  const result: ProductTranslation = {};
  const languages = ['en', 'zh', 'ko'] as const;

  try {
    for (const lang of languages) {
      try {
        const translatedTitle = await translateText(title, lang, 'ja');
        let translatedDesc: string | undefined;

        if (description && description.trim()) {
          translatedDesc = await translateText(description, lang, 'ja');
          await delay(100);
        }

        result[lang] = {
          title: translatedTitle,
          ...(translatedDesc && { description: translatedDesc }),
        };

        await delay(100);
      } catch (error) {
        console.warn(`[Lingva] ${lang} translation failed:`, error);
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('[Lingva] Translation failed:', error);
    return null;
  }
}

