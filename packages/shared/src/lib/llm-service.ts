/**
 * LLMサービス - Gemini APIを使用した各種AI機能
 *
 * 機能:
 * 1. 検索クエリ理解・拡張
 * 2. 商品説明の自動生成
 * 3. 類似作品レコメンド説明
 * 4. 女優プロフィール自動生成
 * 5. チャットボット（作品検索）
 */

const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message: string;
  };
}

/**
 * Gemini APIを呼び出す共通関数
 */
async function callGemini(
  prompt: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
  } = {}
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[LLM Service] GEMINI_API_KEY が未設定');
    return null;
  }

  const { temperature = 0.7, maxOutputTokens = 2048, systemInstruction } = options;

  try {
    const requestBody: Record<string, unknown> = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens,
      },
    };

    if (systemInstruction) {
      requestBody['systemInstruction'] = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[LLM Service] API Error: ${response.status}`);
      return null;
    }

    const data = await response.json() as GeminiResponse;

    if (data.error) {
      console.error(`[LLM Service] ${data.error.message}`);
      return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('[LLM Service] Error:', error);
    return null;
  }
}

/**
 * JSONレスポンスをパース
 */
function parseJsonResponse<T>(text: string | null): T | null {
  if (!text) return null;

  try {
    // ```json ... ``` を除去
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('[LLM Service] JSON parse error');
    return null;
  }
}

// =============================================================================
// 1. 検索クエリ理解・拡張
// =============================================================================

export interface SearchQueryAnalysis {
  // 抽出されたエンティティ
  performers: string[];      // 女優名
  genres: string[];          // ジャンル
  makers: string[];          // メーカー
  keywords: string[];        // その他キーワード

  // クエリの意図
  intent: 'search_product' | 'search_actress' | 'recommendation' | 'comparison' | 'unknown';

  // 拡張されたクエリ
  expandedQuery: string;

  // 類似・関連キーワード
  relatedTerms: string[];

  // フィルター提案
  suggestedFilters: {
    includeGenres?: string[];
    excludeGenres?: string[];
    hasReview?: boolean;
    onSale?: boolean;
    minRating?: number;       // 最低評価（例: 4.0）
    priceRange?: { min?: number; max?: number }; // 価格帯
    releaseDateRange?: { from?: string; to?: string }; // 発売日範囲（YYYY-MM-DD）
    sortBy?: 'releaseDateDesc' | 'ratingDesc' | 'priceAsc' | 'reviewCountDesc'; // ソート
  };
}

/**
 * 検索クエリを理解し、拡張する
 */
export async function analyzeSearchQuery(
  query: string,
  context?: {
    availableGenres?: string[];
    popularPerformers?: string[];
  }
): Promise<SearchQueryAnalysis | null> {
  const systemInstruction = `あなたはアダルトビデオ検索サイトの検索アシスタントです。
ユーザーの自然言語クエリを分析し、意図を理解して適切な検索条件に変換します。
複雑な条件指定（価格帯、評価、発売時期、ソート順など）も正確に解釈してください。

【利用可能なジャンル例】
${context?.availableGenres?.slice(0, 30).join('、') || '巨乳、人妻、熟女、OL、女子大生、コスプレ、SM、NTR、痴漢、素人、企画'}

【人気女優例】
${context?.popularPerformers?.slice(0, 20).join('、') || ''}`;

  const prompt = `ユーザーの検索クエリ: "${query}"

このクエリを分析し、以下のJSON形式で回答してください：

{
  "performers": ["抽出された女優名"],
  "genres": ["抽出されたジャンル"],
  "makers": ["抽出されたメーカー名"],
  "keywords": ["その他のキーワード"],
  "intent": "search_product|search_actress|recommendation|comparison|unknown",
  "expandedQuery": "拡張・正規化されたクエリ",
  "relatedTerms": ["関連する検索ワード（3-5個）"],
  "suggestedFilters": {
    "includeGenres": ["推奨ジャンルフィルター"],
    "excludeGenres": ["除外推奨ジャンル"],
    "hasReview": true/false,
    "onSale": true/false,
    "minRating": null or 数値（例: 4.0）,
    "priceRange": null or {"min": 数値, "max": 数値},
    "releaseDateRange": null or {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
    "sortBy": null or "releaseDateDesc|ratingDesc|priceAsc|reviewCountDesc"
  }
}

【分析のポイント】
- 曖昧な表現（「〇〇みたいな」「〇〇系」）を具体的なジャンルに変換
- 俗語・略語を正式名称に変換（例:「おっぱい」→「巨乳」、「NTR」→「寝取り・寝取られ」）
- 検索意図を正確に判定
- 価格表現を解析（「安い」→priceRange, 「セール」→onSale, 「1000円以下」→max:1000）
- 評価表現を解析（「高評価」→minRating:4.0, 「人気」→sortBy:reviewCountDesc）
- 時期表現を解析（「最新」→sortBy:releaseDateDesc, 「今月」→releaseDateRange, 「2024年」→releaseDateRange）
- ソート表現を解析（「おすすめ順」→ratingDesc, 「新着順」→releaseDateDesc）
- 関連する検索ワードを提案
- 不要なフィルターはnullにする（過剰なフィルターは結果を狭めすぎる）`;

  const response = await callGemini(prompt, {
    temperature: 0.3,
    maxOutputTokens: 1024,
    systemInstruction,
  });

  return parseJsonResponse<SearchQueryAnalysis>(response);
}

// =============================================================================
// 2. 商品説明の自動生成
// =============================================================================

export interface GeneratedProductDescription {
  shortDescription: string;   // 50-100文字
  longDescription: string;    // 200-400文字
  seoDescription: string;     // SEO用メタディスクリプション（120-160文字）
  catchphrase: string;        // キャッチコピー（20-40文字）
  highlights: string[];       // 見どころ（3-5個）
  targetAudience: string;     // ターゲット層の説明
}

/**
 * 商品説明を自動生成
 */
export async function generateProductDescription(params: {
  title: string;
  originalDescription?: string;
  performers?: string[];
  genres?: string[];
  maker?: string;
  duration?: number;
  releaseDate?: string;
  productCode?: string;
}): Promise<GeneratedProductDescription | null> {
  const { title, originalDescription, performers, genres, maker, duration, releaseDate, productCode } = params;

  const productInfo = [
    `タイトル: ${title}`,
    productCode ? `品番: ${productCode}` : null,
    performers?.length ? `出演者: ${performers.join('、')}` : null,
    genres?.length ? `ジャンル: ${genres.join('、')}` : null,
    maker ? `メーカー: ${maker}` : null,
    duration ? `収録時間: ${duration}分` : null,
    releaseDate ? `発売日: ${releaseDate}` : null,
    originalDescription ? `元の説明: ${originalDescription.substring(0, 500)}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `【商品情報】
${productInfo}

上記のアダルトビデオ商品について、魅力的な商品説明を生成してください。

【出力形式】JSON形式で回答：
{
  "shortDescription": "50-100文字の短い紹介文（SEOを意識）",
  "longDescription": "200-400文字の詳細説明（作品の魅力、見どころ、おすすめポイント）",
  "seoDescription": "120-160文字のSEO用メタディスクリプション（品番・女優名を含む）",
  "catchphrase": "20-40文字のキャッチコピー",
  "highlights": ["見どころ1", "見どころ2", "見どころ3"],
  "targetAudience": "この作品をおすすめしたい人の説明（30-50文字）"
}

【注意事項】
- 品番と女優名はSEO上重要なので必ず含める
- 過度に扇情的な表現は避ける
- ユニークで魅力的な文章にする`;

  const response = await callGemini(prompt, {
    temperature: 0.7,
    maxOutputTokens: 1024,
  });

  return parseJsonResponse<GeneratedProductDescription>(response);
}

// =============================================================================
// 3. 類似作品レコメンド説明
// =============================================================================

export interface RecommendationExplanation {
  reason: string;             // レコメンド理由（50-100文字）
  similarity: string;         // 類似点の説明（30-50文字）
  difference: string;         // この作品ならではの違い（30-50文字）
  matchScore: number;         // マッチ度（1-100）
}

/**
 * 類似作品のレコメンド理由を生成
 */
export async function generateRecommendationExplanation(params: {
  originalProduct: {
    title: string;
    performers?: string[];
    genres?: string[];
  };
  recommendedProduct: {
    title: string;
    performers?: string[];
    genres?: string[];
  };
}): Promise<RecommendationExplanation | null> {
  const { originalProduct, recommendedProduct } = params;

  const prompt = `【閲覧中の作品】
タイトル: ${originalProduct.title}
出演者: ${originalProduct.performers?.join('、') || '不明'}
ジャンル: ${originalProduct.genres?.join('、') || '不明'}

【おすすめ作品】
タイトル: ${recommendedProduct.title}
出演者: ${recommendedProduct.performers?.join('、') || '不明'}
ジャンル: ${recommendedProduct.genres?.join('、') || '不明'}

なぜこの作品をおすすめするのか、説明を生成してください。

【出力形式】JSON:
{
  "reason": "レコメンド理由（50-100文字、「〇〇が好きなら」形式）",
  "similarity": "類似点（30-50文字）",
  "difference": "この作品ならではの特徴（30-50文字）",
  "matchScore": 1-100の数値
}`;

  const response = await callGemini(prompt, {
    temperature: 0.5,
    maxOutputTokens: 512,
  });

  return parseJsonResponse<RecommendationExplanation>(response);
}

// =============================================================================
// 4. 女優プロフィール自動生成
// =============================================================================

export interface GeneratedActressProfile {
  introduction: string;        // 紹介文（100-200文字）
  characteristics: string[];   // 特徴（3-5個）
  popularGenres: string[];     // 得意ジャンル
  careerSummary: string;       // キャリア要約（50-100文字）
  recommendedFor: string;      // おすすめしたい人（30-50文字）
  seoDescription: string;      // SEO用（120-160文字）
}

/**
 * 女優プロフィールを自動生成
 */
export async function generateActressProfile(params: {
  name: string;
  aliases?: string[];
  totalWorks?: number;
  debutYear?: number;
  topGenres?: string[];
  topMakers?: string[];
  recentWorks?: string[];
  averageRating?: number;
}): Promise<GeneratedActressProfile | null> {
  const { name, aliases, totalWorks, debutYear, topGenres, topMakers, recentWorks, averageRating } = params;

  const actressInfo = [
    `女優名: ${name}`,
    aliases?.length ? `別名義: ${aliases.join('、')}` : null,
    totalWorks ? `出演作品数: ${totalWorks}本` : null,
    debutYear ? `データ上最古の作品: ${debutYear}年` : null,
    topGenres?.length ? `多いジャンル: ${topGenres.join('、')}` : null,
    topMakers?.length ? `主な出演メーカー: ${topMakers.join('、')}` : null,
    recentWorks?.length ? `最近の作品: ${recentWorks.slice(0, 3).join('、')}` : null,
    averageRating ? `平均評価: ${averageRating.toFixed(1)}点` : null,
  ].filter(Boolean).join('\n');

  const prompt = `【女優情報】
${actressInfo}

上記のAV女優のプロフィール紹介文を生成してください。

【出力形式】JSON:
{
  "introduction": "紹介文（100-200文字、魅力や特徴を伝える）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "popularGenres": ["得意ジャンル1", "得意ジャンル2"],
  "careerSummary": "キャリア要約（50-100文字）",
  "recommendedFor": "こんな人におすすめ（30-50文字）",
  "seoDescription": "SEO用説明文（120-160文字、女優名と出演作品数を含む）"
}

【注意事項】
- 客観的な情報に基づく
- 作品傾向から推測される魅力を記載
- 過度な美化は避け、事実ベースで`;

  const response = await callGemini(prompt, {
    temperature: 0.6,
    maxOutputTokens: 1024,
  });

  return parseJsonResponse<GeneratedActressProfile>(response);
}

// =============================================================================
// 5. チャットボット（作品検索）
// =============================================================================

export interface ChatResponse {
  message: string;            // ユーザーへの返答
  intent: 'search' | 'recommend' | 'info' | 'greeting' | 'unknown';
  searchParams?: {
    query?: string;
    genres?: string[];
    performers?: string[];
    onSale?: boolean;
    hasReview?: boolean;
  };
  followUpQuestions?: string[];  // フォローアップ質問の提案
}

/**
 * チャットボットの応答を生成
 */
export async function generateChatResponse(params: {
  userMessage: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context?: {
    availableGenres?: string[];
    popularPerformers?: string[];
  };
}): Promise<ChatResponse | null> {
  const { userMessage, conversationHistory, context } = params;

  const historyText = conversationHistory?.slice(-5).map(
    h => `${h.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${h.content}`
  ).join('\n') || '';

  const systemInstruction = `あなたはアダルトビデオ検索サイトのAIアシスタントです。
ユーザーの作品探しをサポートします。

【対応できること】
- 作品の検索（ジャンル、女優、シチュエーションなど）
- おすすめ作品の提案
- ジャンルや女優についての質問

【利用可能なジャンル例】
${context?.availableGenres?.slice(0, 20).join('、') || '巨乳、人妻、熟女、OL、女子大生'}

【人気女優例】
${context?.popularPerformers?.slice(0, 10).join('、') || ''}

【応答ルール】
- 丁寧だが堅すぎない口調
- 具体的な提案をする
- 検索条件を明確にする`;

  const prompt = `${historyText ? `【会話履歴】\n${historyText}\n\n` : ''}【ユーザーメッセージ】
${userMessage}

【出力形式】JSON:
{
  "message": "ユーザーへの返答（100-200文字）",
  "intent": "search|recommend|info|greeting|unknown",
  "searchParams": {
    "query": "検索クエリ（必要な場合）",
    "genres": ["フィルターするジャンル"],
    "performers": ["フィルターする女優名"],
    "onSale": true/false,
    "hasReview": true/false
  },
  "followUpQuestions": ["フォローアップ質問1", "フォローアップ質問2"]
}`;

  const response = await callGemini(prompt, {
    temperature: 0.7,
    maxOutputTokens: 1024,
    systemInstruction,
  });

  return parseJsonResponse<ChatResponse>(response);
}

// =============================================================================
// 6. 視聴履歴分析・パーソナライズレコメンド
// =============================================================================

export interface ViewingHistoryAnalysis {
  userPreferences: {
    favoriteGenres: string[];      // 好みのジャンル（頻度順）
    favoriteActresses: string[];   // よく見る女優
    preferredDuration: 'short' | 'medium' | 'long' | 'unknown';  // 好みの尺
    viewingPattern: string;        // 視聴パターンの説明
  };
  recommendations: {
    genres: string[];              // おすすめジャンル
    searchKeywords: string[];      // おすすめ検索キーワード
    reason: string;                // おすすめ理由
  };
  personalizedMessage: string;     // パーソナライズされたメッセージ
}

/**
 * 視聴履歴を分析してユーザーの好みを推定
 */
export async function analyzeViewingHistory(params: {
  recentProducts: Array<{
    title: string;
    genres?: string[];
    performers?: string[];
    duration?: number;
  }>;
  availableGenres?: string[];
}): Promise<ViewingHistoryAnalysis | null> {
  const { recentProducts, availableGenres } = params;

  if (recentProducts.length === 0) {
    return null;
  }

  const historyText = recentProducts.slice(0, 15).map((p, i) => {
    const parts = [`${i + 1}. ${p.title}`];
    if (p.genres?.length) parts.push(`ジャンル: ${p.genres.join('、')}`);
    if (p.performers?.length) parts.push(`出演: ${p.performers.join('、')}`);
    if (p.duration) parts.push(`${p.duration}分`);
    return parts.join(' / ');
  }).join('\n');

  const prompt = `【ユーザーの閲覧履歴（新しい順）】
${historyText}

${availableGenres?.length ? `【利用可能なジャンル】\n${availableGenres.slice(0, 50).join('、')}` : ''}

この視聴履歴からユーザーの好みを分析し、パーソナライズされたおすすめを生成してください。

【出力形式】JSON:
{
  "userPreferences": {
    "favoriteGenres": ["頻繁に見ているジャンル（最大5つ）"],
    "favoriteActresses": ["よく見ている女優（最大3名）"],
    "preferredDuration": "short(<60分)|medium(60-120分)|long(>120分)|unknown",
    "viewingPattern": "視聴パターンの説明（30-50文字）"
  },
  "recommendations": {
    "genres": ["まだ見ていないがおすすめのジャンル（2-3個）"],
    "searchKeywords": ["おすすめの検索キーワード（3-5個）"],
    "reason": "おすすめ理由（50-100文字）"
  },
  "personalizedMessage": "ユーザーへのパーソナライズメッセージ（80-120文字）"
}

【分析のポイント】
- 頻繁に見ているジャンルから好みを推定
- まだ見ていないが好みに合いそうなジャンルを提案
- 視聴パターン（企画もの好き、特定女優ファンなど）を分析`;

  const response = await callGemini(prompt, {
    temperature: 0.5,
    maxOutputTokens: 1024,
  });

  return parseJsonResponse<ViewingHistoryAnalysis>(response);
}

export interface PersonalizedRecommendation {
  matchReason: string;           // マッチ理由（50-80文字）
  highlights: string[];          // この作品のハイライト（2-3個）
  matchScore: number;            // マッチ度（1-100）
  recommendationType: 'similar' | 'explore' | 'trending' | 'hidden_gem';
}

/**
 * 視聴履歴に基づいて作品のおすすめ理由を生成
 */
export async function generatePersonalizedRecommendation(params: {
  userPreferences: {
    favoriteGenres: string[];
    favoriteActresses: string[];
  };
  product: {
    title: string;
    genres?: string[];
    performers?: string[];
    rating?: number;
    releaseDate?: string;
  };
}): Promise<PersonalizedRecommendation | null> {
  const { userPreferences, product } = params;

  const prompt = `【ユーザーの好み】
好みのジャンル: ${userPreferences.favoriteGenres.join('、') || '不明'}
好きな女優: ${userPreferences.favoriteActresses.join('、') || '不明'}

【おすすめ作品】
タイトル: ${product['title']}
ジャンル: ${product.genres?.join('、') || '不明'}
出演者: ${product.performers?.join('、') || '不明'}
評価: ${product['rating'] || '不明'}
発売日: ${product['releaseDate'] || '不明'}

この作品がなぜこのユーザーにおすすめなのか説明してください。

【出力形式】JSON:
{
  "matchReason": "マッチ理由（50-80文字、「あなたの〇〇好きに」形式）",
  "highlights": ["この作品のハイライト1", "ハイライト2"],
  "matchScore": 1-100の数値,
  "recommendationType": "similar(類似作品)|explore(新ジャンル開拓)|trending(話題作)|hidden_gem(隠れた名作)"
}`;

  const response = await callGemini(prompt, {
    temperature: 0.5,
    maxOutputTokens: 512,
  });

  return parseJsonResponse<PersonalizedRecommendation>(response);
}

// =============================================================================
// 7. ユーザー好みプロファイル生成
// =============================================================================

export interface UserPreferenceProfile {
  // 基本プロファイル
  profileType: 'casual' | 'explorer' | 'collector' | 'specialist';  // ユーザータイプ
  profileTitle: string;                   // プロファイルタイトル（例：「巨乳好きの探求者」）
  profileDescription: string;             // プロファイル説明（50-80文字）

  // 好みタグ
  primaryTags: string[];                  // 主要な好みタグ（3-5個）
  secondaryTags: string[];                // 副次的な好みタグ（2-3個）
  avoidTags: string[];                    // 避けている傾向のタグ（0-2個）

  // 傾向分析
  preferences: {
    actressPreference: 'specific' | 'variety' | 'mixed';  // 女優の好み傾向
    genreDepth: 'shallow' | 'medium' | 'deep';            // ジャンルの深さ
    newVsClassic: 'new' | 'classic' | 'balanced';         // 新作 vs 旧作
    contentStyle: string;                                  // コンテンツスタイル（20-30文字）
  };

  // おすすめアクション
  suggestedActions: string[];             // おすすめの検索・行動（2-3個）

  // スコア
  confidenceScore: number;                // プロファイル信頼度（1-100）
}

/**
 * 視聴履歴からユーザーの好みプロファイルを生成
 */
export async function generateUserPreferenceProfile(params: {
  recentProducts: Array<{
    title: string;
    genres?: string[];
    performers?: string[];
    releaseDate?: string;
    rating?: number;
  }>;
  viewingStats?: {
    totalViewed: number;
    uniquePerformers: number;
    uniqueGenres: number;
    avgRating?: number;
  };
  availableGenres?: string[];
}): Promise<UserPreferenceProfile | null> {
  const { recentProducts, viewingStats, availableGenres } = params;

  if (recentProducts.length < 5) {
    return null;
  }

  // 視聴履歴をテキスト化
  const historyText = recentProducts.slice(0, 20).map((p, i) => {
    const parts = [`${i + 1}. ${p.title}`];
    if (p.genres?.length) parts.push(`[${p.genres.slice(0, 3).join(', ')}]`);
    if (p.performers?.length) parts.push(`出演: ${p.performers.slice(0, 2).join(', ')}`);
    if (p.releaseDate) parts.push(`(${p.releaseDate.substring(0, 4)})`);
    return parts.join(' ');
  }).join('\n');

  // 統計情報
  const statsText = viewingStats
    ? `総閲覧数: ${viewingStats.totalViewed}件, ユニーク女優: ${viewingStats.uniquePerformers}名, ユニークジャンル: ${viewingStats.uniqueGenres}種類${viewingStats.avgRating ? `, 平均評価: ${viewingStats.avgRating.toFixed(1)}` : ''}`
    : '';

  const prompt = `【ユーザーの視聴履歴】
${historyText}

${statsText ? `【統計情報】\n${statsText}\n` : ''}
${availableGenres?.length ? `【利用可能なジャンル】\n${availableGenres.slice(0, 40).join('、')}` : ''}

この視聴履歴からユーザーの好みプロファイルを生成してください。

【出力形式】JSON:
{
  "profileType": "casual(気軽に楽しむ)|explorer(新しいジャンル開拓)|collector(特定女優収集)|specialist(特定ジャンル専門)",
  "profileTitle": "ユーザーを表すキャッチーなタイトル（10-20文字、例：「巨乳好きの探求者」）",
  "profileDescription": "プロファイルの説明（50-80文字）",
  "primaryTags": ["主要な好みタグ（3-5個）"],
  "secondaryTags": ["副次的な好みタグ（2-3個）"],
  "avoidTags": ["避けている傾向のタグ（0-2個、該当なければ空配列）"],
  "preferences": {
    "actressPreference": "specific(特定女優)|variety(多様)|mixed(混合)",
    "genreDepth": "shallow(浅く広く)|medium(バランス)|deep(深く狭く)",
    "newVsClassic": "new(新作重視)|classic(旧作好き)|balanced(バランス)",
    "contentStyle": "コンテンツスタイルの説明（20-30文字）"
  },
  "suggestedActions": ["おすすめの検索・行動（2-3個）"],
  "confidenceScore": 1-100の数値
}

【分析のポイント】
- 視聴傾向からユーザータイプを判定
- 頻出ジャンル・女優から好みタグを抽出
- 視聴していないジャンルから避けている傾向を推測
- 具体的で実行可能なおすすめアクションを提案`;

  const response = await callGemini(prompt, {
    temperature: 0.6,
    maxOutputTokens: 1024,
  });

  return parseJsonResponse<UserPreferenceProfile>(response);
}

// =============================================================================
// 9. 画像分析・類似検索
// =============================================================================

export interface ImageAnalysisResult {
  // 画像から抽出された特徴
  description: string;           // 画像の説明
  detectedFeatures: {
    performers?: string[];       // 検出された人物の特徴
    setting?: string;            // シチュエーション・場所
    clothing?: string[];         // 衣装・コスチューム
    mood?: string;               // 雰囲気
    actions?: string[];          // 行為・アクション
  };
  // 検索用キーワード
  searchKeywords: string[];      // 検索に使用するキーワード
  suggestedGenres: string[];     // 推奨ジャンル
  // マッチング用の特徴ベクトル（テキストベース）
  featureDescription: string;    // 特徴を要約したテキスト（類似検索用）
}

/**
 * Gemini Vision APIで画像を分析
 */
async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  options: {
    temperature?: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
  } = {}
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[LLM Service] GEMINI_API_KEY が未設定');
    return null;
  }

  const { temperature = 0.4, maxOutputTokens = 2048, systemInstruction } = options;

  try {
    const requestBody: Record<string, unknown> = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens,
      },
    };

    if (systemInstruction) {
      requestBody['systemInstruction'] = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`[LLM Service] Vision API Error: ${response.status}`);
      return null;
    }

    const data = await response.json() as GeminiResponse;

    if (data.error) {
      console.error(`[LLM Service] ${data.error.message}`);
      return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.error('[LLM Service] Vision Error:', error);
    return null;
  }
}

/**
 * 画像を分析して検索キーワードを抽出
 */
export async function analyzeImageForSearch(params: {
  imageBase64: string;
  mimeType: string;
  availableGenres?: string[];
}): Promise<ImageAnalysisResult | null> {
  const { imageBase64, mimeType, availableGenres } = params;

  const systemInstruction = `あなたはアダルトビデオ検索サイトの画像分析アシスタントです。
ユーザーがアップロードした画像を分析し、類似作品を検索するためのキーワードを抽出します。
プロフェッショナルかつ客観的に分析してください。`;

  const prompt = `この画像を分析し、類似するアダルトビデオを検索するための情報を抽出してください。

${availableGenres ? `【利用可能なジャンル】\n${availableGenres.slice(0, 50).join('、')}` : ''}

以下のJSON形式で回答してください：

{
  "description": "画像の客観的な説明（50-100文字）",
  "detectedFeatures": {
    "performers": ["人物の特徴（体型、髪型など）"],
    "setting": "シチュエーション・場所",
    "clothing": ["衣装・コスチューム"],
    "mood": "雰囲気（明るい、暗い、激しいなど）",
    "actions": ["行為・アクションの種類"]
  },
  "searchKeywords": ["検索に使うキーワード（5-10個）"],
  "suggestedGenres": ["推奨ジャンル（3-5個）"],
  "featureDescription": "この画像の特徴を50文字程度で要約（類似検索用）"
}

【分析のポイント】
- 視覚的な特徴を客観的に抽出
- 検索に有効なキーワードを優先
- 利用可能なジャンルから適切なものを選択`;

  const response = await callGeminiVision(imageBase64, mimeType, prompt, {
    temperature: 0.3,
    maxOutputTokens: 1024,
    systemInstruction,
  });

  return parseJsonResponse<ImageAnalysisResult>(response);
}

/**
 * 2つの画像/作品の類似度を計算するための特徴を抽出
 */
export async function extractImageFeatures(params: {
  imageBase64: string;
  mimeType: string;
}): Promise<{ featureText: string; keywords: string[] } | null> {
  const { imageBase64, mimeType } = params;

  const prompt = `この画像の視覚的特徴を抽出してください。

以下のJSON形式で回答してください：

{
  "featureText": "画像の特徴を詳細に記述（100-150文字）。人物の特徴、シチュエーション、衣装、雰囲気、構図などを含む",
  "keywords": ["特徴を表すキーワード（10-15個）"]
}

類似画像検索に使用するため、できるだけ具体的で識別可能な特徴を抽出してください。`;

  const response = await callGeminiVision(imageBase64, mimeType, prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
  });

  return parseJsonResponse<{ featureText: string; keywords: string[] }>(response);
}

/**
 * 画像とテキスト説明の類似度をスコアリング
 */
export async function calculateImageTextSimilarity(params: {
  imageBase64: string;
  mimeType: string;
  products: Array<{
    id: number;
    title: string;
    genres?: string[];
    description?: string;
  }>;
}): Promise<Array<{ id: number; score: number; reason: string }> | null> {
  const { imageBase64, mimeType, products } = params;

  const productsText = products.map((p, i) =>
    `${i + 1}. ID:${p.id} - ${p.title}${p.genres?.length ? ` [${p.genres.join(', ')}]` : ''}`
  ).join('\n');

  const prompt = `この画像と以下の作品リストを比較し、類似度をスコアリングしてください。

【作品リスト】
${productsText}

以下のJSON形式で回答してください：

{
  "results": [
    {
      "id": 作品ID,
      "score": 0-100の類似度スコア,
      "reason": "類似と判断した理由（20-40文字）"
    }
  ]
}

【スコアリング基準】
- 80-100: 非常に類似（同じシチュエーション・タイプ）
- 60-79: 類似（似たジャンル・雰囲気）
- 40-59: やや類似（一部の特徴が一致）
- 0-39: 類似度低い

上位5件のみ返してください（スコア40以上のもの）。`;

  const response = await callGeminiVision(imageBase64, mimeType, prompt, {
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  const parsed = parseJsonResponse<{ results: Array<{ id: number; score: number; reason: string }> }>(response);
  return parsed?.results || null;
}

// =============================================================================
// 10. 自動タグ生成
// =============================================================================

export interface AutoTagResult {
  suggestedTags: string[];
  categories: {
    genre: string[];
    situation: string[];
    attribute: string[];
    play: string[];
  };
  confidence: number;
}

/**
 * タイトルと説明文から自動でタグを生成
 */
export async function generateAutoTags(params: {
  title: string;
  description?: string;
  existingTags?: string[];
  availableTags?: string[];
}): Promise<AutoTagResult | null> {
  const { title, description, existingTags, availableTags } = params;

  const prompt = `【作品情報】
タイトル: ${title}
${description ? `説明: ${description}` : ''}
${existingTags?.length ? `既存タグ: ${existingTags.join(', ')}` : ''}

【利用可能なタグ例】
${availableTags?.slice(0, 50).join(', ') || 'なし'}

【タスク】
この作品に適切なタグを提案してください。

【出力形式】JSON:
{
  "suggestedTags": ["タグ1", "タグ2", "タグ3"],
  "categories": {
    "genre": ["ジャンルタグ"],
    "situation": ["シチュエーションタグ"],
    "attribute": ["属性タグ（外見など）"],
    "play": ["プレイタグ"]
  },
  "confidence": 0.8
}`;

  const response = await callGemini(prompt, {
    temperature: 0.3,
    maxOutputTokens: 512,
  });

  return parseJsonResponse<AutoTagResult>(response);
}

// =============================================================================
// 11. キーワード提案（SEO）
// =============================================================================

export interface KeywordSuggestion {
  primaryKeywords: string[];
  secondaryKeywords: string[];
  longTailKeywords: string[];
  relatedSearches: string[];
}

/**
 * SEO向けキーワード提案を生成
 */
export async function generateKeywordSuggestions(params: {
  title: string;
  performers?: string[];
  tags?: string[];
  description?: string;
}): Promise<KeywordSuggestion | null> {
  const { title, performers, tags, description } = params;

  const prompt = `【作品情報】
タイトル: ${title}
${performers?.length ? `出演者: ${performers.join(', ')}` : ''}
${tags?.length ? `タグ: ${tags.join(', ')}` : ''}
${description ? `説明: ${description.slice(0, 200)}` : ''}

【タスク】
この作品のSEO向けキーワードを提案してください。検索されやすいキーワードを考慮してください。

【出力形式】JSON:
{
  "primaryKeywords": ["主要キーワード1", "主要キーワード2"],
  "secondaryKeywords": ["補助キーワード1", "補助キーワード2"],
  "longTailKeywords": ["ロングテールキーワード1", "ロングテールキーワード2"],
  "relatedSearches": ["関連検索1", "関連検索2"]
}`;

  const response = await callGemini(prompt, {
    temperature: 0.4,
    maxOutputTokens: 512,
  });

  return parseJsonResponse<KeywordSuggestion>(response);
}

// =============================================================================
// 12. SNSサマリー生成
// =============================================================================

export interface SNSSummary {
  twitter: {
    text: string;
    hashtags: string[];
  };
  instagram: {
    caption: string;
    hashtags: string[];
  };
  shortDescription: string;
  catchphrase: string;
}

/**
 * SNS投稿用のサマリーを生成
 */
export async function generateSNSSummary(params: {
  title: string;
  performers?: string[];
  tags?: string[];
  description?: string;
  releaseDate?: string;
}): Promise<SNSSummary | null> {
  const { title, performers, tags, description, releaseDate } = params;

  const prompt = `【作品情報】
タイトル: ${title}
${performers?.length ? `出演者: ${performers.join(', ')}` : ''}
${tags?.length ? `タグ: ${tags.join(', ')}` : ''}
${releaseDate ? `発売日: ${releaseDate}` : ''}
${description ? `説明: ${description.slice(0, 300)}` : ''}

【タスク】
この作品のSNS投稿用テキストを生成してください。

【注意】
- 過激な表現は避ける
- 興味を引くキャッチーな文章
- ハッシュタグは日本語で

【出力形式】JSON:
{
  "twitter": {
    "text": "Twitter投稿文（100文字以内）",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2"]
  },
  "instagram": {
    "caption": "Instagram投稿文（200文字以内）",
    "hashtags": ["ハッシュタグ1", "ハッシュタグ2", "ハッシュタグ3"]
  },
  "shortDescription": "短い説明文（50文字以内）",
  "catchphrase": "キャッチコピー（20文字以内）"
}`;

  const response = await callGemini(prompt, {
    temperature: 0.7,
    maxOutputTokens: 1024,
  });

  return parseJsonResponse<SNSSummary>(response);
}

// =============================================================================
// 13. ユーザー投稿コンテンツのAI自動審査
// =============================================================================

/**
 * コンテンツ審査結果
 */
export interface ContentModerationResult {
  // 審査結果
  decision: 'approve' | 'reject' | 'review';  // 承認、拒否、人間によるレビュー必要
  confidence: number;                          // 信頼度（0-100）

  // 問題点の詳細
  issues: Array<{
    type: 'spam' | 'inappropriate' | 'offensive' | 'irrelevant' | 'low_quality' | 'personal_info' | 'promotion';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;

  // 審査理由
  reason: string;

  // 修正提案（rejectでない場合）
  suggestions?: string[];

  // スコア詳細
  scores: {
    relevance: number;      // 関連性（0-100）
    quality: number;        // 品質（0-100）
    appropriateness: number; // 適切さ（0-100）
  };
}

/**
 * レビュー投稿を審査
 */
export async function moderateUserReview(params: {
  productTitle: string;
  productGenres?: string[];
  reviewTitle?: string;
  reviewContent: string;
  rating: number;
}): Promise<ContentModerationResult | null> {
  const { productTitle, productGenres, reviewTitle, reviewContent, rating } = params;

  const systemInstruction = `あなたはアダルトビデオレビューサイトのコンテンツモデレーターです。
ユーザーが投稿したレビューを審査し、サイトに公開して問題ないか判断します。

【審査基準】
1. 関連性: レビューが対象作品に関連しているか
2. 品質: レビューとして有用な内容か（単なる感想の羅列でなく、具体的な情報があるか）
3. 適切さ: 不適切な内容（誹謗中傷、差別的表現、個人情報、宣伝等）がないか

【判定基準】
- approve: 問題なく公開可能
- reject: 明らかに問題があり公開不可
- review: 人間による確認が必要

【注意】
- アダルトコンテンツのレビューなので、性的な表現自体は許容
- しかし、出演者への誹謗中傷、差別的表現、個人情報の暴露は不可
- スパム、宣伝、関係のない内容も不可`;

  const prompt = `【審査対象レビュー】
対象作品: ${productTitle}
ジャンル: ${productGenres?.join(', ') || '不明'}
レビュータイトル: ${reviewTitle || 'なし'}
評価: ${rating}/5
レビュー本文:
${reviewContent}

【タスク】
このレビューを審査し、以下のJSON形式で結果を返してください。

{
  "decision": "approve|reject|review",
  "confidence": 0-100の数値,
  "issues": [
    {
      "type": "spam|inappropriate|offensive|irrelevant|low_quality|personal_info|promotion",
      "severity": "low|medium|high",
      "description": "問題点の説明"
    }
  ],
  "reason": "審査結果の理由（50-100文字）",
  "suggestions": ["修正提案（あれば）"],
  "scores": {
    "relevance": 0-100,
    "quality": 0-100,
    "appropriateness": 0-100
  }
}

【判定のポイント】
- 問題がなければapproveで承認
- 軽微な問題のみならapproveでissuesに記載
- 中程度の問題があればreviewで人間確認
- 明らかな違反はrejectで拒否`;

  const response = await callGemini(prompt, {
    temperature: 0.2, // 審査は一貫性が重要なので低めに
    maxOutputTokens: 1024,
    systemInstruction,
  });

  return parseJsonResponse<ContentModerationResult>(response);
}

/**
 * タグ提案を審査
 */
export async function moderateTagSuggestion(params: {
  productTitle: string;
  existingTags?: string[];
  suggestedTag: string;
  availableTags?: string[];
}): Promise<ContentModerationResult | null> {
  const { productTitle, existingTags, suggestedTag, availableTags } = params;

  const systemInstruction = `あなたはアダルトビデオサイトのタグモデレーターです。
ユーザーが提案したタグを審査し、作品に追加して問題ないか判断します。

【審査基準】
1. 関連性: タグが対象作品に関連しているか
2. 適切さ: タグ名として適切か（誹謗中傷、差別的表現でないか）
3. 有用性: 既存タグと重複していないか、検索に有用か

【判定基準】
- approve: 問題なく追加可能
- reject: 不適切で追加不可
- review: 人間による確認が必要`;

  const prompt = `【審査対象タグ提案】
対象作品: ${productTitle}
既存タグ: ${existingTags?.join(', ') || 'なし'}
提案されたタグ: ${suggestedTag}
${availableTags?.length ? `利用可能なタグ例: ${availableTags.slice(0, 30).join(', ')}` : ''}

【タスク】
このタグ提案を審査し、以下のJSON形式で結果を返してください。

{
  "decision": "approve|reject|review",
  "confidence": 0-100の数値,
  "issues": [
    {
      "type": "spam|inappropriate|offensive|irrelevant|low_quality|personal_info|promotion",
      "severity": "low|medium|high",
      "description": "問題点の説明"
    }
  ],
  "reason": "審査結果の理由（30-50文字）",
  "suggestions": ["修正提案（あれば）"],
  "scores": {
    "relevance": 0-100,
    "quality": 0-100,
    "appropriateness": 0-100
  }
}`;

  const response = await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
    systemInstruction,
  });

  return parseJsonResponse<ContentModerationResult>(response);
}

/**
 * 情報修正提案を審査
 */
export async function moderateCorrection(params: {
  targetType: 'product' | 'performer';
  targetName: string;
  fieldName: string;
  currentValue?: string;
  suggestedValue: string;
  reason?: string;
}): Promise<ContentModerationResult | null> {
  const { targetType, targetName, fieldName, currentValue, suggestedValue, reason } = params;

  const systemInstruction = `あなたはアダルトビデオサイトの情報修正モデレーターです。
ユーザーが提案した情報修正を審査し、反映して問題ないか判断します。

【審査基準】
1. 正確性: 修正内容が正確そうか（明らかな虚偽でないか）
2. 適切さ: 修正内容が適切か（誹謗中傷、個人情報でないか）
3. 有用性: 修正が有用か（より良い情報になっているか）

【判定基準】
- approve: 問題なく反映可能（明らかに正しい修正）
- reject: 不適切で反映不可
- review: 人間による確認が必要（ほとんどの場合これ）`;

  const prompt = `【審査対象の情報修正提案】
対象種別: ${targetType === 'product' ? '作品' : '演者'}
対象名: ${targetName}
修正フィールド: ${fieldName}
現在の値: ${currentValue || '（なし）'}
提案された値: ${suggestedValue}
修正理由: ${reason || '（なし）'}

【タスク】
この情報修正提案を審査し、以下のJSON形式で結果を返してください。

{
  "decision": "approve|reject|review",
  "confidence": 0-100の数値,
  "issues": [
    {
      "type": "spam|inappropriate|offensive|irrelevant|low_quality|personal_info|promotion",
      "severity": "low|medium|high",
      "description": "問題点の説明"
    }
  ],
  "reason": "審査結果の理由（50-80文字）",
  "suggestions": ["確認すべき点（あれば）"],
  "scores": {
    "relevance": 0-100,
    "quality": 0-100,
    "appropriateness": 0-100
  }
}

【判定のポイント】
- 明らかな誤字修正などはapproveで即承認
- 内容の大幅な変更はreviewで人間確認
- 誹謗中傷や個人情報はrejectで拒否`;

  const response = await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
    systemInstruction,
  });

  return parseJsonResponse<ContentModerationResult>(response);
}

/**
 * 公開リストのタイトル・説明を審査
 */
export async function moderatePublicList(params: {
  title: string;
  description?: string;
}): Promise<ContentModerationResult | null> {
  const { title, description } = params;

  const systemInstruction = `あなたはアダルトビデオサイトの公開リストモデレーターです。
ユーザーが作成した公開お気に入りリストのタイトルと説明を審査します。

【審査基準】
1. 適切さ: タイトル・説明が適切か（誹謗中傷、差別的表現でないか）
2. 品質: 意味のあるタイトル・説明か

【判定基準】
- approve: 問題なく公開可能
- reject: 不適切で公開不可
- review: 人間による確認が必要`;

  const prompt = `【審査対象の公開リスト】
タイトル: ${title}
説明: ${description || '（なし）'}

【タスク】
この公開リストを審査し、以下のJSON形式で結果を返してください。

{
  "decision": "approve|reject|review",
  "confidence": 0-100の数値,
  "issues": [
    {
      "type": "spam|inappropriate|offensive|irrelevant|low_quality|personal_info|promotion",
      "severity": "low|medium|high",
      "description": "問題点の説明"
    }
  ],
  "reason": "審査結果の理由（30-50文字）",
  "suggestions": ["修正提案（あれば）"],
  "scores": {
    "relevance": 0-100,
    "quality": 0-100,
    "appropriateness": 0-100
  }
}`;

  const response = await callGemini(prompt, {
    temperature: 0.2,
    maxOutputTokens: 512,
    systemInstruction,
  });

  return parseJsonResponse<ContentModerationResult>(response);
}

// =============================================================================
// エクスポート
// =============================================================================

export const LLMService = {
  // 既存機能
  analyzeSearchQuery,
  generateProductDescription,
  generateRecommendationExplanation,
  generateActressProfile,
  generateChatResponse,
  analyzeViewingHistory,
  generatePersonalizedRecommendation,
  generateUserPreferenceProfile,
  analyzeImageForSearch,
  extractImageFeatures,
  calculateImageTextSimilarity,
  generateAutoTags,
  generateKeywordSuggestions,
  generateSNSSummary,
  // AI自動審査機能
  moderateUserReview,
  moderateTagSuggestion,
  moderateCorrection,
  moderatePublicList,
};

export default LLMService;
