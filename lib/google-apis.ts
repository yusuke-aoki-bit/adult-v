/**
 * Google APIs 統合ライブラリ
 *
 * 利用するAPI:
 * - Custom Search API: 女優読み仮名取得
 * - Cloud Natural Language API: コンテンツ分析
 * - Cloud Vision API: 画像分析
 * - Cloud Translation API: 多言語翻訳
 * - Indexing API: SEO即時インデックス
 * - Analytics Data API: アクセス解析
 * - YouTube Data API: 動画連携
 */

// =============================================================================
// 環境変数
// =============================================================================

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GOOGLE_CUSTOM_SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || '';
const GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
// サービスアカウントキーはファイルパスで指定
const GOOGLE_SERVICE_ACCOUNT_KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '';

// =============================================================================
// Custom Search API - 女優読み仮名取得
// =============================================================================

export interface CustomSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface CustomSearchResponse {
  items: CustomSearchResult[];
  searchInformation: {
    totalResults: string;
    searchTime: number;
  };
}

/**
 * Google Custom Search APIで検索を実行
 * @param query 検索クエリ
 * @param options オプション
 * @returns 検索結果
 */
export async function customSearch(
  query: string,
  options?: {
    num?: number; // 結果数 (1-10)
    start?: number; // 開始位置
    siteSearch?: string; // 特定サイトに限定
    language?: string; // 言語 (lang_ja等)
  }
): Promise<CustomSearchResponse | null> {
  if (!GOOGLE_API_KEY || !GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
    console.warn('[Google Custom Search] API Key または Search Engine ID が未設定');
    return null;
  }

  const params = new URLSearchParams({
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
    q: query,
    num: String(options?.num || 10),
    ...(options?.start && { start: String(options.start) }),
    ...(options?.siteSearch && { siteSearch: options.siteSearch }),
    ...(options?.language && { lr: options.language }),
  });

  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Google Custom Search] Error:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[Google Custom Search] Request failed:', error);
    return null;
  }
}

/**
 * 女優名から読み仮名を検索
 * @param actressName 女優名（漢字）
 * @returns 読み仮名（ひらがな）または null
 */
export async function searchActressReading(actressName: string): Promise<string | null> {
  // 既にひらがな・カタカナの場合はひらがなに変換して返す
  if (/^[ぁ-ゖァ-ヺー\s]+$/.test(actressName)) {
    return katakanaToHiragana(actressName.replace(/\s+/g, ''));
  }

  // 検索クエリのバリエーションを試す
  const queries = [
    `${actressName} AV女優 読み方`,
    `${actressName} 女優 よみがな`,
    `${actressName} グラビア 読み`,
  ];

  for (const query of queries) {
    // Wikipedia日本語版で検索
    const result = await customSearch(query, {
      num: 5,
      siteSearch: 'ja.wikipedia.org',
      language: 'lang_ja',
    });

    if (result && result.items && result.items.length > 0) {
      const reading = extractReadingFromResults(actressName, result.items);
      if (reading) return reading;
    }

    // 一般検索も試す
    const generalResult = await customSearch(query, {
      num: 5,
      language: 'lang_ja',
    });

    if (generalResult && generalResult.items && generalResult.items.length > 0) {
      const reading = extractReadingFromResults(actressName, generalResult.items);
      if (reading) return reading;
    }
  }

  return null;
}

/**
 * 検索結果から読み仮名を抽出
 */
function extractReadingFromResults(actressName: string, items: CustomSearchResult[]): string | null {
  for (const item of items) {
    const text = `${item.title} ${item.snippet}`;

    // パターン1: Wikipedia形式「名前（ひらがな ひらがな、...）」- スペース含むフルネーム
    // 例: 三上 悠亜（みかみ ゆあ、本名：...）
    const wikiFullMatch = text.match(/[（(]([ぁ-ゖー]+\s+[ぁ-ゖー]+)[、,）)]/);
    if (wikiFullMatch) {
      // スペースを除去して返す
      return wikiFullMatch[1].replace(/\s+/g, '');
    }

    // パターン2: 「名前（ひらがな）」形式（スペースなし）
    const parenMatch = text.match(new RegExp(`${escapeRegExp(actressName)}[（(]([ぁ-ゖー]+)[）)]`));
    if (parenMatch && parenMatch[1].length >= 4) {
      return parenMatch[1];
    }

    // パターン3: 「名前、ひらがな」形式
    const commaMatch = text.match(new RegExp(`${escapeRegExp(actressName)}[、,]\\s*([ぁ-ゖー]+)`));
    if (commaMatch && commaMatch[1].length >= 4) {
      return commaMatch[1];
    }

    // パターン4: Wikipediaスニペットから「ひらがな ひらがな」形式を抽出
    if (item.link.includes('wikipedia')) {
      // 「姓 名（せい めい」パターン
      const snippetFullMatch = item.snippet.match(/[（(]([ぁ-ゖー]+)\s+([ぁ-ゖー]+)/);
      if (snippetFullMatch) {
        return snippetFullMatch[1] + snippetFullMatch[2];
      }
    }

    // パターン5: 名前の近くにあるひらがな（フルネーム長を期待）
    const nameIndex = text.indexOf(actressName);
    if (nameIndex !== -1) {
      const nearbyText = text.substring(nameIndex, nameIndex + actressName.length + 50);
      // 4文字以上のひらがな（フルネーム）を優先
      const hiraganaMatch = nearbyText.match(/[ぁ-ゖー]{4,}/);
      if (hiraganaMatch) {
        return hiraganaMatch[0];
      }
    }
  }

  return null;
}

/**
 * 正規表現のエスケープ
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * カタカナをひらがなに変換
 */
function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

// =============================================================================
// Cloud Natural Language API - コンテンツ分析
// =============================================================================

export interface EntityAnalysis {
  name: string;
  type: string;
  salience: number;
  metadata?: Record<string, string>;
}

export interface SentimentAnalysis {
  score: number; // -1.0 to 1.0
  magnitude: number;
}

/**
 * テキストからエンティティ（人名、組織名等）を抽出
 * @param text 分析対象テキスト
 * @returns エンティティのリスト
 */
export async function analyzeEntities(text: string): Promise<EntityAnalysis[]> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Natural Language API] API Key が未設定');
    return [];
  }

  try {
    const response = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeEntities?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            type: 'PLAIN_TEXT',
            content: text,
            language: 'ja',
          },
          encodingType: 'UTF8',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Natural Language API] Error:', error);
      return [];
    }

    const data = await response.json();
    return (data.entities || []).map((e: any) => ({
      name: e.name,
      type: e.type,
      salience: e.salience,
      metadata: e.metadata,
    }));
  } catch (error) {
    console.error('[Natural Language API] Request failed:', error);
    return [];
  }
}

/**
 * テキストの感情分析
 * @param text 分析対象テキスト
 * @returns 感情スコア
 */
export async function analyzeSentiment(text: string): Promise<SentimentAnalysis | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Natural Language API] API Key が未設定');
    return null;
  }

  try {
    const response = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            type: 'PLAIN_TEXT',
            content: text,
            language: 'ja',
          },
          encodingType: 'UTF8',
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      score: data.documentSentiment?.score || 0,
      magnitude: data.documentSentiment?.magnitude || 0,
    };
  } catch (error) {
    console.error('[Natural Language API] Request failed:', error);
    return null;
  }
}

/**
 * 商品タイトルから人名（出演者名）を抽出
 * @param title 商品タイトル
 * @returns 抽出された人名のリスト
 */
export async function extractPerformerNames(title: string): Promise<string[]> {
  const entities = await analyzeEntities(title);
  return entities
    .filter((e) => e.type === 'PERSON' && e.salience > 0.1)
    .map((e) => e.name);
}

// =============================================================================
// Cloud Vision API - 画像分析
// =============================================================================

export interface FaceAnnotation {
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LabelAnnotation {
  description: string;
  score: number;
}

/**
 * 画像から顔を検出
 * @param imageUrl 画像URL
 * @returns 顔検出結果
 */
export async function detectFaces(imageUrl: string): Promise<FaceAnnotation[]> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Vision API] API Key が未設定');
    return [];
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'FACE_DETECTION', maxResults: 10 }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const faces = data.responses?.[0]?.faceAnnotations || [];
    return faces.map((f: any) => ({
      confidence: f.detectionConfidence,
      boundingBox: {
        x: f.boundingPoly?.vertices?.[0]?.x || 0,
        y: f.boundingPoly?.vertices?.[0]?.y || 0,
        width:
          (f.boundingPoly?.vertices?.[2]?.x || 0) -
          (f.boundingPoly?.vertices?.[0]?.x || 0),
        height:
          (f.boundingPoly?.vertices?.[2]?.y || 0) -
          (f.boundingPoly?.vertices?.[0]?.y || 0),
      },
    }));
  } catch (error) {
    console.error('[Vision API] Request failed:', error);
    return [];
  }
}

/**
 * 画像にラベル（タグ）を付与
 * @param imageUrl 画像URL
 * @returns ラベルのリスト
 */
export async function labelImage(imageUrl: string): Promise<LabelAnnotation[]> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Vision API] API Key が未設定');
    return [];
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [{ type: 'LABEL_DETECTION', maxResults: 20 }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const labels = data.responses?.[0]?.labelAnnotations || [];
    return labels.map((l: any) => ({
      description: l.description,
      score: l.score,
    }));
  } catch (error) {
    console.error('[Vision API] Request failed:', error);
    return [];
  }
}

// =============================================================================
// Cloud Translation API - 多言語翻訳
// =============================================================================

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

/**
 * テキストを翻訳
 * @param text 翻訳対象テキスト
 * @param targetLanguage 翻訳先言語コード (en, zh, ko等)
 * @param sourceLanguage 翻訳元言語コード（省略時は自動検出）
 * @returns 翻訳結果
 */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Translation API] API Key が未設定');
    return null;
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          ...(sourceLanguage && { source: sourceLanguage }),
          format: 'text',
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const translation = data.data?.translations?.[0];
    if (!translation) return null;

    return {
      translatedText: translation.translatedText,
      detectedSourceLanguage: translation.detectedSourceLanguage,
    };
  } catch (error) {
    console.error('[Translation API] Request failed:', error);
    return null;
  }
}

/**
 * 商品情報を複数言語に翻訳
 * @param title タイトル
 * @param description 説明
 * @returns 翻訳結果 { en, zh, ko }
 */
export async function translateProduct(
  title: string,
  description?: string
): Promise<{
  en: { title: string; description?: string };
  zh: { title: string; description?: string };
  ko: { title: string; description?: string };
} | null> {
  const languages = ['en', 'zh', 'ko'] as const;
  const result: any = {};

  for (const lang of languages) {
    const titleTrans = await translateText(title, lang, 'ja');
    if (titleTrans) {
      result[lang] = { title: titleTrans.translatedText };
      if (description) {
        const descTrans = await translateText(description, lang, 'ja');
        if (descTrans) {
          result[lang].description = descTrans.translatedText;
        }
      }
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// =============================================================================
// Indexing API - SEO即時インデックス
// =============================================================================

/**
 * URLをGoogleにインデックス登録リクエスト
 * 注意: サービスアカウント認証が必要
 * @param url インデックス登録するURL
 * @param type 'URL_UPDATED' | 'URL_DELETED'
 * @returns 成功したかどうか
 */
export async function requestIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<boolean> {
  // Indexing APIはサービスアカウント認証が必要
  // 簡易的なAPI Key認証では使用不可
  console.log(`[Indexing API] ${type}: ${url}`);
  console.warn('[Indexing API] サービスアカウント認証が必要です');
  return false;
}

// =============================================================================
// Analytics Data API - アクセス解析
// =============================================================================

export interface AnalyticsReport {
  rows: Array<{
    dimensions: string[];
    metrics: number[];
  }>;
}

/**
 * Google Analytics 4のレポートを取得
 * 注意: サービスアカウント認証が必要
 * @param propertyId GA4プロパティID
 * @param dimensions ディメンション (pagePath等)
 * @param metrics メトリクス (screenPageViews等)
 * @param startDate 開始日 (YYYY-MM-DD)
 * @param endDate 終了日 (YYYY-MM-DD)
 * @returns レポートデータ
 */
export async function getAnalyticsReport(
  propertyId: string,
  dimensions: string[],
  metrics: string[],
  startDate: string,
  endDate: string
): Promise<AnalyticsReport | null> {
  console.warn('[Analytics API] サービスアカウント認証が必要です');
  return null;
}

// =============================================================================
// YouTube Data API - 動画連携
// =============================================================================

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  channelTitle: string;
  viewCount?: number;
}

/**
 * YouTubeで動画を検索
 * @param query 検索クエリ
 * @param maxResults 最大結果数
 * @returns 動画リスト
 */
export async function searchYouTubeVideos(
  query: string,
  maxResults: number = 10
): Promise<YouTubeVideo[]> {
  if (!GOOGLE_API_KEY) {
    console.warn('[YouTube API] API Key が未設定');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_API_KEY,
      q: query,
      part: 'snippet',
      type: 'video',
      maxResults: String(maxResults),
      relevanceLanguage: 'ja',
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      description: item.snippet?.description,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url,
      publishedAt: item.snippet?.publishedAt,
      channelTitle: item.snippet?.channelTitle,
    }));
  } catch (error) {
    console.error('[YouTube API] Request failed:', error);
    return [];
  }
}

/**
 * YouTube動画の詳細情報を取得
 * @param videoId 動画ID
 * @returns 動画詳細
 */
export async function getYouTubeVideoDetails(
  videoId: string
): Promise<YouTubeVideo | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[YouTube API] API Key が未設定');
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: GOOGLE_API_KEY,
      id: videoId,
      part: 'snippet,statistics',
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      id: item.id,
      title: item.snippet?.title,
      description: item.snippet?.description,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url,
      publishedAt: item.snippet?.publishedAt,
      channelTitle: item.snippet?.channelTitle,
      viewCount: parseInt(item.statistics?.viewCount || '0', 10),
    };
  } catch (error) {
    console.error('[YouTube API] Request failed:', error);
    return null;
  }
}

// =============================================================================
// API設定確認
// =============================================================================

export function checkGoogleApiConfig(): {
  customSearch: boolean;
  naturalLanguage: boolean;
  vision: boolean;
  translation: boolean;
  indexing: boolean;
  analytics: boolean;
  youtube: boolean;
} {
  return {
    customSearch: !!(GOOGLE_API_KEY && GOOGLE_CUSTOM_SEARCH_ENGINE_ID),
    naturalLanguage: !!GOOGLE_API_KEY,
    vision: !!GOOGLE_API_KEY,
    translation: !!GOOGLE_API_KEY,
    indexing: !!GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    analytics: !!GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    youtube: !!GOOGLE_API_KEY,
  };
}
