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
// サービスアカウントキー（JSON文字列として環境変数に設定）
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';

// サービスアカウントの認証情報をパース
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

let serviceAccountCredentials: ServiceAccountCredentials | null = null;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  if (serviceAccountCredentials) return serviceAccountCredentials;

  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    return null;
  }

  try {
    serviceAccountCredentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    return serviceAccountCredentials;
  } catch (error) {
    console.error('[Google APIs] Failed to parse service account key:', error);
    return null;
  }
}

/**
 * サービスアカウントでアクセストークンを取得
 * JWT Bearer Grant を使用
 */
async function getAccessToken(): Promise<string | null> {
  // キャッシュされたトークンがまだ有効かチェック
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) {
    return cachedAccessToken.token;
  }

  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  try {
    // JWTを作成
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/indexing https://www.googleapis.com/auth/analytics.readonly',
      aud: credentials.token_uri,
      exp: now + 3600,
      iat: now,
    };

    // Base64URL エンコード
    const base64UrlEncode = (obj: object) => {
      const json = JSON.stringify(obj);
      const base64 = Buffer.from(json).toString('base64');
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    // 署名を作成
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(credentials.private_key, 'base64');
    const signatureEncoded = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signatureInput}.${signatureEncoded}`;

    // トークンをリクエスト
    const response = await fetch(credentials.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Google APIs] Token request failed:', error);
      return null;
    }

    const data = await response.json();
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  } catch (error) {
    console.error('[Google APIs] Failed to get access token:', error);
    return null;
  }
}

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
 * 商品コードから女優名を検索
 * @param productCode 商品コード (例: "SIRO-5000", "259LUXU-1010")
 * @returns 抽出された女優名のリスト
 */
export async function searchPerformerByProductCode(
  productCode: string
): Promise<string[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
    console.warn('[Google Custom Search] API Key または Search Engine ID が未設定');
    return [];
  }

  // 商品コードで検索
  const result = await customSearch(`${productCode} 女優`, {
    num: 10,
    language: 'lang_ja',
  });

  if (!result || !result.items || result.items.length === 0) {
    return [];
  }

  const performers = extractPerformersFromSearchResults(result.items);
  return performers;
}

/**
 * 検索結果から女優名を抽出
 */
function extractPerformersFromSearchResults(items: CustomSearchResult[]): string[] {
  const performers: string[] = [];
  const seenNames = new Set<string>();

  for (const item of items) {
    const text = `${item.title} ${item.snippet}`;

    // パターン1: 「出演：○○」「出演者：○○」
    const castMatch = text.match(/出演[者]?[：:]\s*([^。\n,、]+)/g);
    if (castMatch) {
      for (const match of castMatch) {
        const names = match.replace(/出演[者]?[：:]\s*/, '').split(/[、,\/]/);
        for (const name of names) {
          const cleaned = cleanPerformerName(name.trim());
          if (cleaned && !seenNames.has(cleaned)) {
            seenNames.add(cleaned);
            performers.push(cleaned);
          }
        }
      }
    }

    // パターン2: 「女優名：○○」「AV女優：○○」
    const actressMatch = text.match(/(?:AV)?女優[名]?[：:]\s*([^。\n,、]+)/g);
    if (actressMatch) {
      for (const match of actressMatch) {
        const names = match.replace(/(?:AV)?女優[名]?[：:]\s*/, '').split(/[、,\/]/);
        for (const name of names) {
          const cleaned = cleanPerformerName(name.trim());
          if (cleaned && !seenNames.has(cleaned)) {
            seenNames.add(cleaned);
            performers.push(cleaned);
          }
        }
      }
    }

    // パターン3: タイトル内の人名パターン「○○ 作品名」
    // Wikipediaやプロフィールページのタイトル形式
    const titleNameMatch = item.title.match(/^([ぁ-んァ-ヶー一-龯]+(?:\s[ぁ-んァ-ヶー一-龯]+)?)\s*[-–—|]|^([ぁ-んァ-ヶー一-龯]+(?:\s[ぁ-んァ-ヶー一-龯]+)?)\s*\(/);
    if (titleNameMatch) {
      const name = (titleNameMatch[1] || titleNameMatch[2])?.trim();
      const cleaned = cleanPerformerName(name);
      if (cleaned && !seenNames.has(cleaned)) {
        seenNames.add(cleaned);
        performers.push(cleaned);
      }
    }

    // パターン4: スニペット内の「○○の」で始まるパターン（プロフィール紹介）
    const profileMatch = text.match(/([ぁ-んァ-ヶー一-龯]{2,}(?:\s[ぁ-んァ-ヶー一-龯]{2,})?)[のは](?:AV女優|女優|グラビア|セクシー女優)/);
    if (profileMatch) {
      const cleaned = cleanPerformerName(profileMatch[1].trim());
      if (cleaned && !seenNames.has(cleaned)) {
        seenNames.add(cleaned);
        performers.push(cleaned);
      }
    }

    // パターン5: Wiki形式「○○（よみがな）」
    const wikiMatch = text.match(/([ぁ-んァ-ヶー一-龯]{2,}(?:\s[ぁ-んァ-ヶー一-龯]{2,})?)[（(][ぁ-ん\s]+[）)]/g);
    if (wikiMatch) {
      for (const match of wikiMatch) {
        const name = match.replace(/[（(][^）)]+[）)]/, '').trim();
        const cleaned = cleanPerformerName(name);
        if (cleaned && !seenNames.has(cleaned)) {
          seenNames.add(cleaned);
          performers.push(cleaned);
        }
      }
    }
  }

  return performers;
}

/**
 * 女優名をクリーンアップ
 */
function cleanPerformerName(name: string | undefined): string | null {
  if (!name) return null;

  let cleaned = name.trim();

  // 余分な記号を削除
  cleaned = cleaned.replace(/[【】「」『』（）()［］\[\]]/g, '');

  // 「他」「など」「ほか」を削除
  cleaned = cleaned.replace(/[、,]?\s*(他|など|ほか|他多数).*$/, '');

  // 年齢表記を削除（例: 「○○(25)」）
  cleaned = cleaned.replace(/\s*\(\d+\)\s*$/, '');

  // 前後の空白削除
  cleaned = cleaned.trim();

  // 無効な名前のチェック
  const invalidNames = [
    '素人', '企画', '他', '---', '...', '名無し', '匿名', '不明',
    '出演者', '女優', '男優', 'AV女優', '複数', '多数',
    '熟女', '人妻', 'ギャル', '巨乳', '美女', 'OL',
  ];
  if (invalidNames.includes(cleaned)) return null;

  // 2文字未満は無効
  if (cleaned.length < 2) return null;

  // 数字のみは無効
  if (/^\d+$/.test(cleaned)) return null;

  // 記号のみは無効
  if (/^[!@#$%^&*()_+=\-\[\]{}|\\:";'<>?,./]+$/.test(cleaned)) return null;

  return cleaned;
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

/**
 * テキスト分類（カテゴリ分類）
 * @param text 分析対象テキスト
 * @returns カテゴリのリスト
 */
export async function classifyText(text: string): Promise<Array<{ name: string; confidence: number }>> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Natural Language API] API Key が未設定');
    return [];
  }

  try {
    const response = await fetch(
      `https://language.googleapis.com/v1/documents:classifyText?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            type: 'PLAIN_TEXT',
            content: text,
            language: 'ja',
          },
        }),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.categories || []).map((c: any) => ({
      name: c.name,
      confidence: c.confidence,
    }));
  } catch (error) {
    console.error('[Natural Language API] classifyText failed:', error);
    return [];
  }
}

/**
 * 商品説明からタグ・カテゴリを自動抽出
 * @param title タイトル
 * @param description 説明文
 * @returns 抽出されたタグのリスト
 */
export async function extractProductTags(
  title: string,
  description?: string
): Promise<{
  genres: string[];
  attributes: string[];
  plays: string[];
  situations: string[];
}> {
  const text = `${title} ${description || ''}`.trim();

  // エンティティ分析でキーワード抽出（結果は分析に使用、ログ出力用）
  await analyzeEntities(text);

  // カテゴリマッピング
  const genres: string[] = [];
  const attributes: string[] = [];
  const plays: string[] = [];
  const situations: string[] = [];

  // ジャンルキーワード
  const genreKeywords: Record<string, string[]> = {
    '素人': ['素人', 'シロウト', 'amateur'],
    '熟女': ['熟女', '人妻', '三十路', '四十路', '五十路', 'マダム'],
    'ギャル': ['ギャル', 'GAL', 'ヤンキー'],
    'OL': ['OL', 'オフィス', '会社員', '受付嬢'],
    '女子大生': ['女子大生', 'JD', '大学生'],
    'ナース': ['ナース', '看護師', '看護婦'],
    'メイド': ['メイド', 'maid'],
    'コスプレ': ['コスプレ', 'コス', 'cosplay'],
    'アイドル': ['アイドル', 'idol', 'グラビア'],
  };

  // 属性キーワード
  const attributeKeywords: Record<string, string[]> = {
    '巨乳': ['巨乳', '爆乳', 'Gカップ', 'Hカップ', 'Iカップ', 'Jカップ', 'Kカップ'],
    '美乳': ['美乳', '美しい胸'],
    '貧乳': ['貧乳', '微乳', 'ちっぱい', 'Aカップ'],
    'スレンダー': ['スレンダー', 'スリム', '細身'],
    'ぽっちゃり': ['ぽっちゃり', 'むっちり', 'ぽちゃ'],
    '色白': ['色白', '美白'],
    '美脚': ['美脚', '脚線美'],
    'パイパン': ['パイパン', '無毛'],
  };

  // プレイキーワード
  const playKeywords: Record<string, string[]> = {
    '中出し': ['中出し', '生中', 'なかだし', 'creampie'],
    '顔射': ['顔射', 'ぶっかけ'],
    'フェラ': ['フェラ', 'フェラチオ', 'blowjob'],
    'パイズリ': ['パイズリ', 'titfuck'],
    '手コキ': ['手コキ', 'handjob'],
    '潮吹き': ['潮吹き', '噴射'],
    '3P': ['3P', '乱交', '複数プレイ'],
    'SM': ['SM', '調教', '緊縛', 'ボンデージ'],
    'アナル': ['アナル', 'anal', '肛門'],
    'レズ': ['レズ', 'レズビアン', 'lesbian'],
  };

  // シチュエーションキーワード
  const situationKeywords: Record<string, string[]> = {
    'ナンパ': ['ナンパ', 'ハメ撮り', '素人ナンパ'],
    '温泉': ['温泉', '旅館', '混浴'],
    'マッサージ': ['マッサージ', 'エステ', 'オイル'],
    '痴漢': ['痴漢', '電車', '満員電車'],
    '不倫': ['不倫', '浮気', 'NTR'],
    '盗撮': ['盗撮', '隠し撮り', '隠撮'],
    '露出': ['露出', '野外', '屋外'],
  };

  // テキストからキーワードマッチング
  const matchKeywords = (keywords: Record<string, string[]>, results: string[]) => {
    for (const [category, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (text.includes(word) && !results.includes(category)) {
          results.push(category);
          break;
        }
      }
    }
  };

  matchKeywords(genreKeywords, genres);
  matchKeywords(attributeKeywords, attributes);
  matchKeywords(playKeywords, plays);
  matchKeywords(situationKeywords, situations);

  return { genres, attributes, plays, situations };
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

export interface SafeSearchAnnotation {
  adult: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
  spoof: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
  medical: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
  violence: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
  racy: 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
}

export interface ImageAnalysisResult {
  faces: FaceAnnotation[];
  labels: LabelAnnotation[];
  safeSearch?: SafeSearchAnnotation;
  hasFace: boolean;
  faceCount: number;
  isValid: boolean;
  invalidReason?: string;
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
      const error = await response.text();
      console.error('[Vision API] HTTP error:', response.status, error);
      return [];
    }

    const data = await response.json();

    // Vision API returns errors inside responses array
    if (data.responses?.[0]?.error) {
      console.error('[Vision API] Response error:', data.responses[0].error);
      return [];
    }

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
      const error = await response.text();
      console.error('[Vision API] HTTP error:', response.status, error);
      return [];
    }

    const data = await response.json();

    // Vision API returns errors inside responses array
    if (data.responses?.[0]?.error) {
      console.error('[Vision API] Response error:', data.responses[0].error);
      return [];
    }

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

/**
 * 画像のSafe Search判定
 * @param imageUrl 画像URL
 * @returns Safe Search結果
 */
export async function detectSafeSearch(imageUrl: string): Promise<SafeSearchAnnotation | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Vision API] API Key が未設定');
    return null;
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
              features: [{ type: 'SAFE_SEARCH_DETECTION' }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.responses?.[0]?.error) {
      console.error('[Vision API] Safe Search error:', data.responses[0].error);
      return null;
    }

    const ss = data.responses?.[0]?.safeSearchAnnotation;
    if (!ss) return null;

    return {
      adult: ss.adult || 'UNKNOWN',
      spoof: ss.spoof || 'UNKNOWN',
      medical: ss.medical || 'UNKNOWN',
      violence: ss.violence || 'UNKNOWN',
      racy: ss.racy || 'UNKNOWN',
    };
  } catch (error) {
    console.error('[Vision API] Safe Search failed:', error);
    return null;
  }
}

/**
 * 画像を総合分析（顔検出 + ラベル + Safe Search）
 * @param imageUrl 画像URL
 * @returns 総合分析結果
 */
export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Vision API] API Key が未設定');
    return {
      faces: [],
      labels: [],
      hasFace: false,
      faceCount: 0,
      isValid: false,
      invalidReason: 'API Key未設定',
    };
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
              features: [
                { type: 'FACE_DETECTION', maxResults: 10 },
                { type: 'LABEL_DETECTION', maxResults: 20 },
                { type: 'SAFE_SEARCH_DETECTION' },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        faces: [],
        labels: [],
        hasFace: false,
        faceCount: 0,
        isValid: false,
        invalidReason: `HTTP ${response.status}: ${error}`,
      };
    }

    const data = await response.json();
    const result = data.responses?.[0];

    if (result?.error) {
      return {
        faces: [],
        labels: [],
        hasFace: false,
        faceCount: 0,
        isValid: false,
        invalidReason: result.error.message || 'Vision API Error',
      };
    }

    // 顔検出結果
    const faces: FaceAnnotation[] = (result?.faceAnnotations || []).map((f: any) => ({
      confidence: f.detectionConfidence,
      boundingBox: {
        x: f.boundingPoly?.vertices?.[0]?.x || 0,
        y: f.boundingPoly?.vertices?.[0]?.y || 0,
        width: (f.boundingPoly?.vertices?.[2]?.x || 0) - (f.boundingPoly?.vertices?.[0]?.x || 0),
        height: (f.boundingPoly?.vertices?.[2]?.y || 0) - (f.boundingPoly?.vertices?.[0]?.y || 0),
      },
    }));

    // ラベル結果
    const labels: LabelAnnotation[] = (result?.labelAnnotations || []).map((l: any) => ({
      description: l.description,
      score: l.score,
    }));

    // Safe Search結果
    const ss = result?.safeSearchAnnotation;
    const safeSearch: SafeSearchAnnotation | undefined = ss ? {
      adult: ss.adult || 'UNKNOWN',
      spoof: ss.spoof || 'UNKNOWN',
      medical: ss.medical || 'UNKNOWN',
      violence: ss.violence || 'UNKNOWN',
      racy: ss.racy || 'UNKNOWN',
    } : undefined;

    // 画像の有効性判定
    let isValid = true;
    let invalidReason: string | undefined;

    // スプーフィング（偽画像）チェック
    if (safeSearch?.spoof === 'VERY_LIKELY' || safeSearch?.spoof === 'LIKELY') {
      isValid = false;
      invalidReason = 'スプーフィング画像の可能性';
    }

    return {
      faces,
      labels,
      safeSearch,
      hasFace: faces.length > 0,
      faceCount: faces.length,
      isValid,
      invalidReason,
    };
  } catch (error) {
    console.error('[Vision API] analyzeImage failed:', error);
    return {
      faces: [],
      labels: [],
      hasFace: false,
      faceCount: 0,
      isValid: false,
      invalidReason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Cloud Translation API - 多言語翻訳
// =============================================================================

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

export interface BatchTranslationResult {
  translations: TranslationResult[];
}

export interface PerformerTranslation {
  en?: { name: string; profile?: string };
  zh?: { name: string; profile?: string };
  ko?: { name: string; profile?: string };
}

export interface ProductTranslation {
  en?: { title: string; description?: string };
  zh?: { title: string; description?: string };
  ko?: { title: string; description?: string };
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
 * 複数テキストを一括翻訳（バッチ処理）
 * Google Translation APIはリクエストあたり最大128テキストまで対応
 * @param texts 翻訳対象テキスト配列
 * @param targetLanguage 翻訳先言語コード
 * @param sourceLanguage 翻訳元言語コード（省略時は自動検出）
 * @returns 翻訳結果配列
 */
export async function translateBatch(
  texts: string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult[] | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Translation API] API Key が未設定');
    return null;
  }

  if (texts.length === 0) return [];

  // 空文字列やnullをフィルタリング
  const validTexts = texts.filter(t => t && t.trim().length > 0);
  if (validTexts.length === 0) return [];

  // Google APIの制限: 最大128テキスト/リクエスト
  const BATCH_SIZE = 128;
  const results: TranslationResult[] = [];

  try {
    for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
      const batch = validTexts.slice(i, i + BATCH_SIZE);

      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: batch,
            target: targetLanguage,
            ...(sourceLanguage && { source: sourceLanguage }),
            format: 'text',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Translation API] Batch request failed:', errorData);
        return null;
      }

      const data = await response.json();
      const translations = data.data?.translations || [];

      for (const translation of translations) {
        results.push({
          translatedText: translation.translatedText,
          detectedSourceLanguage: translation.detectedSourceLanguage,
        });
      }

      // レート制限対策: バッチ間で少し待機
      if (i + BATCH_SIZE < validTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  } catch (error) {
    console.error('[Translation API] Batch request failed:', error);
    return null;
  }
}

/**
 * 演者情報を複数言語に翻訳
 * @param name 演者名（日本語）
 * @param profile プロフィール文（日本語、オプション）
 * @returns 翻訳結果 { en, zh, ko }
 */
export async function translatePerformer(
  name: string,
  profile?: string
): Promise<PerformerTranslation | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Translation API] API Key が未設定');
    return null;
  }

  const languages = ['en', 'zh', 'ko'] as const;
  const result: PerformerTranslation = {};

  // 名前とプロフィールをまとめて翻訳（API呼び出し回数削減）
  const textsToTranslate = [name];
  if (profile && profile.trim()) {
    textsToTranslate.push(profile);
  }

  for (const lang of languages) {
    const translations = await translateBatch(textsToTranslate, lang, 'ja');
    if (translations && translations.length > 0) {
      result[lang] = {
        name: translations[0].translatedText,
        ...(translations[1] && { profile: translations[1].translatedText }),
      };
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * 複数演者を一括翻訳
 * @param performers 演者情報の配列
 * @returns 翻訳結果の配列
 */
export async function translatePerformersBatch(
  performers: Array<{ name: string; profile?: string }>
): Promise<Array<PerformerTranslation | null>> {
  if (!GOOGLE_API_KEY || performers.length === 0) {
    return performers.map(() => null);
  }

  const languages = ['en', 'zh', 'ko'] as const;
  const results: Array<PerformerTranslation | null> = performers.map(() => ({}));

  // 全テキストを1つの配列にまとめる
  const allTexts: string[] = [];
  const indexMap: Array<{ performerIndex: number; field: 'name' | 'profile' }> = [];

  for (let i = 0; i < performers.length; i++) {
    const p = performers[i];
    allTexts.push(p.name);
    indexMap.push({ performerIndex: i, field: 'name' });

    if (p.profile && p.profile.trim()) {
      allTexts.push(p.profile);
      indexMap.push({ performerIndex: i, field: 'profile' });
    }
  }

  // 各言語で一括翻訳
  for (const lang of languages) {
    const translations = await translateBatch(allTexts, lang, 'ja');
    if (translations) {
      for (let i = 0; i < translations.length && i < indexMap.length; i++) {
        const { performerIndex, field } = indexMap[i];
        const result = results[performerIndex] as PerformerTranslation;

        if (!result[lang]) {
          result[lang] = { name: '' };
        }

        if (field === 'name') {
          result[lang]!.name = translations[i].translatedText;
        } else {
          result[lang]!.profile = translations[i].translatedText;
        }
      }
    }
  }

  return results.map(r => (r && Object.keys(r).length > 0 ? r : null));
}

/**
 * 商品情報を複数言語に翻訳（バッチ処理対応版）
 * @param title タイトル
 * @param description 説明
 * @returns 翻訳結果 { en, zh, ko }
 */
export async function translateProduct(
  title: string,
  description?: string
): Promise<ProductTranslation | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[Translation API] API Key が未設定');
    return null;
  }

  const languages = ['en', 'zh', 'ko'] as const;
  const result: ProductTranslation = {};

  // タイトルと説明をまとめて翻訳（API呼び出し回数削減）
  const textsToTranslate = [title];
  if (description && description.trim()) {
    textsToTranslate.push(description);
  }

  for (const lang of languages) {
    const translations = await translateBatch(textsToTranslate, lang, 'ja');
    if (translations && translations.length > 0) {
      result[lang] = {
        title: translations[0].translatedText,
        ...(translations[1] && { description: translations[1].translatedText }),
      };
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * 複数商品を一括翻訳
 * @param products 商品情報の配列
 * @returns 翻訳結果の配列
 */
export async function translateProductsBatch(
  products: Array<{ title: string; description?: string }>
): Promise<Array<ProductTranslation | null>> {
  if (!GOOGLE_API_KEY || products.length === 0) {
    return products.map(() => null);
  }

  const languages = ['en', 'zh', 'ko'] as const;
  const results: Array<ProductTranslation | null> = products.map(() => ({}));

  // 全テキストを1つの配列にまとめる
  const allTexts: string[] = [];
  const indexMap: Array<{ productIndex: number; field: 'title' | 'description' }> = [];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    allTexts.push(p.title);
    indexMap.push({ productIndex: i, field: 'title' });

    if (p.description && p.description.trim()) {
      allTexts.push(p.description);
      indexMap.push({ productIndex: i, field: 'description' });
    }
  }

  // 各言語で一括翻訳
  for (const lang of languages) {
    const translations = await translateBatch(allTexts, lang, 'ja');
    if (translations) {
      for (let i = 0; i < translations.length && i < indexMap.length; i++) {
        const { productIndex, field } = indexMap[i];
        const result = results[productIndex] as ProductTranslation;

        if (!result[lang]) {
          result[lang] = { title: '' };
        }

        if (field === 'title') {
          result[lang]!.title = translations[i].translatedText;
        } else {
          result[lang]!.description = translations[i].translatedText;
        }
      }
    }
  }

  return results.map(r => (r && Object.keys(r).length > 0 ? r : null));
}

// =============================================================================
// Indexing API - SEO即時インデックス
// =============================================================================

export interface IndexingResult {
  success: boolean;
  error?: string;
  errorCode?: number;
  requiresOwnershipVerification?: boolean;
}

/**
 * URLをGoogleにインデックス登録リクエスト
 * サービスアカウント認証を使用
 * @param url インデックス登録するURL
 * @param type 'URL_UPDATED' | 'URL_DELETED'
 * @returns インデックス登録結果
 */
export async function requestIndexing(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED'
): Promise<IndexingResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[Indexing API] サービスアカウント認証が必要です');
    return { success: false, error: 'Service account not configured' };
  }

  try {
    const response = await fetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          url,
          type,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Indexing API] Error:', error);

      const errorMessage = error?.error?.message || 'Unknown error';
      const errorCode = error?.error?.code || response.status;

      // URL所有権確認エラーの検出
      const requiresOwnershipVerification =
        errorCode === 403 &&
        errorMessage.includes('Failed to verify the URL ownership');

      if (requiresOwnershipVerification) {
        console.warn('[Indexing API] URL所有権確認が必要です。Google Search Consoleでサービスアカウントを所有者として追加してください。');
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
        requiresOwnershipVerification,
      };
    }

    const data = await response.json();
    console.log(`[Indexing API] Success: ${url}`, data);
    return { success: true };
  } catch (error) {
    console.error('[Indexing API] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
    };
  }
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
 * サービスアカウント認証を使用
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
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[Analytics API] サービスアカウント認証が必要です');
    return null;
  }

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          limit: 100,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[Analytics API] Error:', error);
      return null;
    }

    const data = await response.json();
    return {
      rows: (data.rows || []).map((row: any) => ({
        dimensions: (row.dimensionValues || []).map((d: any) => d.value),
        metrics: (row.metricValues || []).map((m: any) => parseFloat(m.value)),
      })),
    };
  } catch (error) {
    console.error('[Analytics API] Request failed:', error);
    return null;
  }
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
// Gemini API - AI商品説明生成
// =============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || GOOGLE_API_KEY;

export interface GeneratedDescription {
  shortDescription: string;  // 短い紹介文（50-100文字）
  longDescription: string;   // 詳細説明文（200-400文字）
  catchphrase: string;       // キャッチコピー（20-40文字）
  highlights: string[];      // 見どころポイント（3-5個）
  reviewSummary?: string;    // レビュー要約（あれば）
}

/**
 * AI商品説明生成（Gemini API使用）
 * 商品情報とレビューからサイト独自の説明文を生成
 *
 * @param params 商品情報
 * @returns 生成された説明文
 */
export async function generateProductDescription(params: {
  title: string;
  originalDescription?: string;
  performers?: string[];
  genres?: string[];
  maker?: string;
  releaseDate?: string;
  reviews?: Array<{
    rating?: number;
    comment: string;
  }>;
}): Promise<GeneratedDescription | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini API] API Key が未設定');
    return null;
  }

  const { title, originalDescription, performers, genres, maker, releaseDate, reviews } = params;

  // プロンプト構築
  const productInfo = [
    `タイトル: ${title}`,
    originalDescription ? `元の説明: ${originalDescription}` : null,
    performers?.length ? `出演者: ${performers.join('、')}` : null,
    genres?.length ? `ジャンル: ${genres.join('、')}` : null,
    maker ? `メーカー: ${maker}` : null,
    releaseDate ? `発売日: ${releaseDate}` : null,
  ].filter(Boolean).join('\n');

  const reviewInfo = reviews?.length
    ? `\n\nユーザーレビュー:\n${reviews.slice(0, 5).map((r, i) =>
        `${i + 1}. ${r.rating ? `★${r.rating} ` : ''}${r.comment.substring(0, 200)}`
      ).join('\n')}`
    : '';

  const prompt = `
あなたはアダルトビデオ販売サイトの商品説明ライターです。
以下の商品情報とレビューを参考に、魅力的な商品説明を生成してください。

【商品情報】
${productInfo}
${reviewInfo}

【出力形式】
以下のJSON形式で回答してください。日本語で記述し、過度に扇情的な表現は避けつつも魅力が伝わる文章にしてください。

{
  "shortDescription": "50-100文字の短い紹介文",
  "longDescription": "200-400文字の詳細な説明文。作品の見どころ、出演者の魅力、おすすめポイントを含む",
  "catchphrase": "20-40文字のキャッチコピー",
  "highlights": ["見どころ1", "見どころ2", "見どころ3"],
  "reviewSummary": "レビューがある場合、50-100文字でユーザー評価の要約"
}

【注意事項】
- 元の説明文をそのままコピーせず、リライトしてください
- 出演者名は正確に記載してください
- JSON形式のみで回答してください
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini API] HTTP error:', response.status, error);
      return null;
    }

    const data = await response.json();

    // レスポンスからテキスト抽出
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini API] No text in response:', data);
      return null;
    }

    // JSONをパース（コードブロックを除去）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Gemini API] No JSON found in response:', text);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as GeneratedDescription;

    // バリデーション
    if (!result.shortDescription || !result.longDescription || !result.catchphrase) {
      console.error('[Gemini API] Invalid response structure:', result);
      return null;
    }

    return result;
  } catch (error) {
    console.error('[Gemini API] Request failed:', error);
    return null;
  }
}

/**
 * レビューから感情分析とサマリーを生成
 *
 * @param reviews レビューのリスト
 * @returns 分析結果
 */
export async function analyzeReviews(reviews: Array<{
  rating?: number;
  comment: string;
}>): Promise<{
  averageSentiment: number;  // -1.0 to 1.0
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
} | null> {
  if (!GEMINI_API_KEY || reviews.length === 0) {
    return null;
  }

  const reviewTexts = reviews.slice(0, 10).map((r, i) =>
    `${i + 1}. ${r.rating ? `★${r.rating} ` : ''}${r.comment.substring(0, 300)}`
  ).join('\n');

  const prompt = `
以下のアダルトビデオ商品のユーザーレビューを分析してください。

【レビュー】
${reviewTexts}

【出力形式】
以下のJSON形式で回答してください。

{
  "averageSentiment": 0.5,  // -1.0（非常に否定的）から1.0（非常に肯定的）のスコア
  "summary": "100文字以内のレビュー総評",
  "positivePoints": ["良い点1", "良い点2"],
  "negativePoints": ["悪い点1"]
}

JSON形式のみで回答してください。
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 512,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[Gemini API] analyzeReviews failed:', error);
    return null;
  }
}

/**
 * 複数商品のバッチ説明生成（効率的なバッチ処理）
 *
 * @param products 商品のリスト
 * @param options オプション
 * @returns 生成結果のマップ
 */
export async function batchGenerateDescriptions(
  products: Array<{
    id: string | number;
    title: string;
    originalDescription?: string;
    performers?: string[];
    genres?: string[];
  }>,
  options?: {
    concurrency?: number;  // 同時処理数（デフォルト: 3）
    delayMs?: number;      // リクエスト間隔（デフォルト: 500ms）
  }
): Promise<Map<string | number, GeneratedDescription>> {
  const { concurrency = 3, delayMs = 500 } = options || {};
  const results = new Map<string | number, GeneratedDescription>();

  // バッチ処理
  for (let i = 0; i < products.length; i += concurrency) {
    const batch = products.slice(i, i + concurrency);

    const promises = batch.map(async (product) => {
      const result = await generateProductDescription({
        title: product.title,
        originalDescription: product.originalDescription,
        performers: product.performers,
        genres: product.genres,
      });

      if (result) {
        results.set(product.id, result);
      }

      return result;
    });

    await Promise.all(promises);

    // レート制限対策
    if (i + concurrency < products.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// =============================================================================
// Gemini API - AI演者レビュー生成
// =============================================================================

export interface GeneratedPerformerReview {
  overview: string;           // 演者の総合的な紹介（100-200文字）
  style: string;              // 演技スタイル・特徴（50-100文字）
  appeal: string;             // 魅力ポイント（50-100文字）
  recommendation: string;     // おすすめコメント（50-100文字）
  keywords: string[];         // 検索キーワード（3-5個）
}

/**
 * AI演者レビュー生成（Gemini API使用）
 * 演者の出演作品情報から独自のレビューを生成
 *
 * @param params 演者情報
 * @returns 生成されたレビュー
 */
export async function generatePerformerReview(params: {
  performerName: string;
  aliases?: string[];          // 別名・旧芸名
  productTitles?: string[];    // 出演作品タイトル
  productDescriptions?: string[]; // 出演作品の説明
  genres?: string[];           // 関連ジャンル
  productCount?: number;       // 出演作品数
  existingReview?: string;     // 既存のレビュー（更新時）
}): Promise<GeneratedPerformerReview | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini API] API Key が未設定');
    return null;
  }

  const {
    performerName,
    aliases,
    productTitles,
    productDescriptions,
    genres,
    productCount,
    existingReview,
  } = params;

  // プロンプト構築
  const performerInfo = [
    `名前: ${performerName}`,
    aliases?.length ? `別名: ${aliases.join('、')}` : null,
    productCount ? `出演作品数: ${productCount}本` : null,
    genres?.length ? `関連ジャンル: ${genres.slice(0, 10).join('、')}` : null,
  ].filter(Boolean).join('\n');

  const worksInfo = productTitles?.length
    ? `\n\n代表作品:\n${productTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}`
    : '';

  const descriptionsInfo = productDescriptions?.length
    ? `\n\n作品の特徴:\n${productDescriptions.slice(0, 5).map((d) => `- ${d.substring(0, 150)}`).join('\n')}`
    : '';

  const existingInfo = existingReview
    ? `\n\n参考（既存レビュー）:\n${existingReview.substring(0, 500)}`
    : '';

  const prompt = `
あなたはアダルトビデオ情報サイトの演者レビューライターです。
以下の演者情報を参考に、魅力的で独自性のある演者紹介文を生成してください。

【演者情報】
${performerInfo}
${worksInfo}
${descriptionsInfo}
${existingInfo}

【出力形式】
以下のJSON形式で回答してください。日本語で記述し、敬意を持った表現で魅力が伝わる文章にしてください。

{
  "overview": "100-200文字の総合的な演者紹介。経歴や活動概要、人気の理由などを含む",
  "style": "50-100文字の演技スタイル・特徴の説明",
  "appeal": "50-100文字の魅力ポイント。ファンに支持される理由",
  "recommendation": "50-100文字のおすすめコメント。どんな視聴者におすすめか",
  "keywords": ["検索キーワード1", "キーワード2", "キーワード3"]
}

【注意事項】
- 演者名は正確に記載してください
- 過度に扇情的な表現は避けてください
- 既存レビューがある場合は、内容を発展させつつリライトしてください
- 事実に基づかない誇張は避けてください
- JSON形式のみで回答してください
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Gemini API] generatePerformerReview HTTP error:', response.status, error);
      return null;
    }

    const data = await response.json();

    // レスポンスからテキスト抽出
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini API] No text in response:', data);
      return null;
    }

    // JSONをパース（コードブロックを除去）
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Gemini API] No JSON found in response:', text);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as GeneratedPerformerReview;

    // バリデーション
    if (!result.overview || !result.style || !result.appeal) {
      console.error('[Gemini API] Invalid response structure:', result);
      return null;
    }

    return result;
  } catch (error) {
    console.error('[Gemini API] generatePerformerReview failed:', error);
    return null;
  }
}

/**
 * 複数演者のバッチレビュー生成（効率的なバッチ処理）
 *
 * @param performers 演者のリスト
 * @param options オプション
 * @returns 生成結果のマップ
 */
export async function batchGeneratePerformerReviews(
  performers: Array<{
    id: string | number;
    name: string;
    aliases?: string[];
    productTitles?: string[];
    genres?: string[];
    productCount?: number;
    existingReview?: string;
  }>,
  options?: {
    concurrency?: number;  // 同時処理数（デフォルト: 2）
    delayMs?: number;      // リクエスト間隔（デフォルト: 1000ms）
  }
): Promise<Map<string | number, GeneratedPerformerReview>> {
  const { concurrency = 2, delayMs = 1000 } = options || {};
  const results = new Map<string | number, GeneratedPerformerReview>();

  // バッチ処理
  for (let i = 0; i < performers.length; i += concurrency) {
    const batch = performers.slice(i, i + concurrency);

    const promises = batch.map(async (performer) => {
      const result = await generatePerformerReview({
        performerName: performer.name,
        aliases: performer.aliases,
        productTitles: performer.productTitles,
        genres: performer.genres,
        productCount: performer.productCount,
        existingReview: performer.existingReview,
      });

      if (result) {
        results.set(performer.id, result);
      }

      return result;
    });

    await Promise.all(promises);

    // レート制限対策（演者レビューはより長いので長めの間隔）
    if (i + concurrency < performers.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
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
  gemini: boolean;
  cloudStorage: boolean;
} {
  const hasServiceAccount = !!getServiceAccountCredentials();
  return {
    customSearch: !!(GOOGLE_API_KEY && GOOGLE_CUSTOM_SEARCH_ENGINE_ID),
    naturalLanguage: !!GOOGLE_API_KEY,
    vision: !!GOOGLE_API_KEY,
    translation: !!GOOGLE_API_KEY,
    indexing: hasServiceAccount,
    analytics: hasServiceAccount,
    youtube: !!GOOGLE_API_KEY,
    gemini: !!GEMINI_API_KEY,
    cloudStorage: hasServiceAccount,
  };
}

// =============================================================================
// Cloud Storage API - 大容量データ保存
// =============================================================================

const GCS_BUCKET_NAME = process.env.GCS_RAW_DATA_BUCKET || 'adult-v-raw-data';

export interface GcsUploadResult {
  success: boolean;
  gcsUrl: string;
  size: number;
  contentType: string;
}

/**
 * Cloud Storage用のアクセストークンを取得（storage scope付き）
 */
async function getStorageAccessToken(): Promise<string | null> {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/devstorage.read_write',
      aud: credentials.token_uri,
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (obj: object) => {
      const json = JSON.stringify(obj);
      const base64 = Buffer.from(json).toString('base64');
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(credentials.private_key, 'base64');
    const signatureEncoded = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${signatureInput}.${signatureEncoded}`;

    const tokenResponse = await fetch(credentials.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      console.error('[GCS] Token request failed:', await tokenResponse.text());
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('[GCS] Failed to get access token:', error);
    return null;
  }
}

/**
 * データをCloud Storageにアップロード
 * @param objectPath オブジェクトパス（例: "html/mgs/product-123.html.gz"）
 * @param data データ（文字列またはBuffer）
 * @param contentType MIMEタイプ
 * @param compress gzip圧縮するかどうか（デフォルト: true）
 */
export async function uploadToGcs(
  objectPath: string,
  data: string | Buffer,
  contentType: string = 'text/html',
  compress: boolean = true
): Promise<GcsUploadResult | null> {
  const token = await getStorageAccessToken();
  if (!token) {
    console.warn('[GCS] No access token available');
    return null;
  }

  try {
    let uploadData: Buffer;
    const finalContentType = contentType;
    let finalPath = objectPath;

    if (compress) {
      const zlib = await import('zlib');
      const inputBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      uploadData = zlib.gzipSync(inputBuffer);
      finalPath = objectPath.endsWith('.gz') ? objectPath : `${objectPath}.gz`;
      // Content-Encodingはgzipだが、Content-Typeは元のまま
    } else {
      uploadData = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    }

    const url = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(finalPath)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': finalContentType,
        'Content-Length': uploadData.length.toString(),
        ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
      },
      body: new Uint8Array(uploadData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GCS] Upload failed:', response.status, errorText);
      return null;
    }

    await response.json(); // Confirm upload succeeded
    const gcsUrl = `gs://${GCS_BUCKET_NAME}/${finalPath}`;

    return {
      success: true,
      gcsUrl,
      size: uploadData.length,
      contentType: finalContentType,
    };
  } catch (error) {
    console.error('[GCS] Upload error:', error);
    return null;
  }
}

/**
 * Cloud Storageからデータをダウンロード
 * @param gcsUrl GCS URL（例: "gs://bucket/path/to/file.html.gz"）
 */
export async function downloadFromGcs(gcsUrl: string): Promise<string | null> {
  const token = await getStorageAccessToken();
  if (!token) {
    console.warn('[GCS] No access token available');
    return null;
  }

  try {
    // gs://bucket/path 形式をパース
    const match = gcsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      console.error('[GCS] Invalid GCS URL:', gcsUrl);
      return null;
    }

    const [, bucket, objectPath] = match;
    const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error('[GCS] Download failed:', response.status);
      return null;
    }

    // gzip圧縮されている場合は解凍
    const buffer = Buffer.from(await response.arrayBuffer());
    if (objectPath.endsWith('.gz')) {
      const zlib = await import('zlib');
      const decompressed = zlib.gunzipSync(buffer);
      return decompressed.toString('utf-8');
    }

    return buffer.toString('utf-8');
  } catch (error) {
    console.error('[GCS] Download error:', error);
    return null;
  }
}

/**
 * HTMLデータをGCSに保存（クローラー用ヘルパー）
 * @param source ソース名（例: "mgs", "dti"）
 * @param productId 商品ID
 * @param html HTMLコンテンツ
 */
export async function saveHtmlToGcs(
  source: string,
  productId: string,
  html: string
): Promise<string | null> {
  const objectPath = `html/${source}/${productId}.html`;
  const result = await uploadToGcs(objectPath, html, 'text/html', true);
  return result?.gcsUrl || null;
}

/**
 * JSONデータをGCSに保存（クローラー用ヘルパー）
 * @param source ソース名
 * @param productId 商品ID
 * @param data JSONデータ
 */
export async function saveJsonToGcs(
  source: string,
  productId: string,
  data: object
): Promise<string | null> {
  const objectPath = `json/${source}/${productId}.json`;
  const jsonStr = JSON.stringify(data, null, 2);
  const result = await uploadToGcs(objectPath, jsonStr, 'application/json', true);
  return result?.gcsUrl || null;
}

/**
 * CSVデータをGCSに保存
 * @param source ソース名
 * @param filename ファイル名
 * @param csvContent CSVコンテンツ
 */
export async function saveCsvToGcs(
  source: string,
  filename: string,
  csvContent: string
): Promise<string | null> {
  const objectPath = `csv/${source}/${filename}`;
  const result = await uploadToGcs(objectPath, csvContent, 'text/csv', true);
  return result?.gcsUrl || null;
}
