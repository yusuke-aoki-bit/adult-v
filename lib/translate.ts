/**
 * Google Cloud Translation API ユーティリティ
 *
 * 使用方法:
 * 1. Google Cloud Consoleで Translation APIを有効化
 * 2. サービスアカウントキーを作成してダウンロード
 * 3. 環境変数 GOOGLE_APPLICATION_CREDENTIALS にキーファイルのパスを設定
 *    または GOOGLE_CLOUD_PROJECT_ID と GOOGLE_CLOUD_PRIVATE_KEY を設定
 */

import { v2 } from '@google-cloud/translate';

// Translation APIクライアントのシングルトンインスタンス
let translateClient: v2.Translate | null = null;

/**
 * Translation APIクライアントを取得
 */
function getTranslateClient(): v2.Translate {
  if (!translateClient) {
    // 環境変数から認証情報を取得
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

    if (projectId && privateKey) {
      // 環境変数から直接認証
      translateClient = new v2.Translate({
        projectId,
        credentials: {
          private_key: privateKey.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || '',
        },
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // キーファイルから認証
      translateClient = new v2.Translate();
    } else {
      throw new Error(
        'Google Cloud Translation API credentials not found. ' +
          'Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT_ID/GOOGLE_CLOUD_PRIVATE_KEY environment variables.'
      );
    }
  }

  return translateClient;
}

/**
 * テキストを翻訳する
 * @param text 翻訳するテキスト
 * @param targetLang 翻訳先の言語コード ('en', 'zh-CN', 'ko')
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

  try {
    const client = getTranslateClient();

    // zh を zh-CN に変換 (簡体字中国語)
    const targetLanguage = targetLang === 'zh' ? 'zh-CN' : targetLang;

    const [translation] = await client.translate(text, {
      from: sourceLang,
      to: targetLanguage,
    });

    return translation;
  } catch (error) {
    console.error(`Translation error (${sourceLang} -> ${targetLang}):`, error);
    throw error;
  }
}

/**
 * 複数のテキストを一度に翻訳する(API呼び出し回数を削減)
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

  try {
    const client = getTranslateClient();

    // zh を zh-CN に変換
    const targetLanguage = targetLang === 'zh' ? 'zh-CN' : targetLang;

    const [translations] = await client.translate(texts, {
      from: sourceLang,
      to: targetLanguage,
    });

    // translationsは文字列または文字列配列
    return Array.isArray(translations) ? translations : [translations];
  } catch (error) {
    console.error(`Batch translation error (${sourceLang} -> ${targetLang}):`, error);
    throw error;
  }
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
    console.error('Translation to all languages failed:', error);
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
