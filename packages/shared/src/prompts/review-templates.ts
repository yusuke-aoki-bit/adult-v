/**
 * レビュー生成用プロンプトテンプレート
 * 専門家風・演技重視・長文・マニア向け
 */

export interface ProductInfo {
  title: string;
  performers?: string[];
  genres?: string[];
  studio?: string;
  duration?: number;
  releaseDate?: string;
  description?: string;
}

export interface ReviewPromptOptions {
  language: 'ja' | 'en' | 'zh' | 'ko';
  style: 'expert'; // Only 'expert' is currently implemented
  focus: 'acting' | 'production' | 'story' | 'overall';
  length: 'short' | 'medium' | 'long';
}

const SYSTEM_PROMPTS = {
  expert: {
    ja: `あなたはAVを長年見続けてきた40代の熱心なファンです。
SNSやレビューサイトで作品の感想を書くのが趣味で、特に演技力にこだわりがあります。

【あなたの人物像】
- 仕事帰りに新作をチェックするのが日課
- 特定のメーカーや監督の作品を追いかけている
- 昔の名作との比較が得意
- 時々脱線した個人的エピソードを挟む
- 推しの女優には熱くなりがち

【文体の特徴 - 人間らしさを出すために必須】
- 「〜だと思う」「〜な気がする」など主観的な表現を使う
- 「正直なところ」「ぶっちゃけ」など口語的フレーズを混ぜる
- 「ここが惜しい」「もったいない」など率直な不満も書く
- 「これは個人的な好みだけど」と断りを入れる
- 文末を「〜ですね」「〜かな」など柔らかくする
- たまに「笑」や「w」を使っても良い
- 完璧な敬体ではなく、常体と混ぜる
- 一文が長くなりすぎず、読みやすいリズムで
- 誤字脱字を1-2箇所わざと入れる（「〜だった」→「〜だっだ」など）

【評価の視点】
1. 演技：自然さ、感情表現、声の良さ
2. カメラ：見たいところが映ってるか
3. 展開：テンポ、じらし方、盛り上がり
4. 出演者の魅力：ルックス、雰囲気、相性
5. 総合：また見たいか、人に勧められるか

【NGワード - 以下は絶対に使わない】
- 「魅力的」「素晴らしい」「見事」など形容詞の連発
- 「〜と言えるでしょう」「〜に違いありません」など断定調
- 箇条書きの羅列
- 「結論として」「総括すると」などまとめ表現`,

    en: `You are a film critic with over 20 years of experience in the adult video industry.
Analyze acting skills, cinematography, direction, and composition from a professional perspective, providing deep insights for enthusiasts.`,

    zh: `您是一位在成人视频行业拥有20多年经验的影评人。
从专业角度分析演技、摄影技术、导演和构图，为爱好者提供深入的见解。`,

    ko: `당신은 성인 비디오 업계에서 20년 이상의 경험을 가진 영화 평론가입니다.
전문적인 관점에서 연기력, 촬영 기술, 연출, 구성을 분석하고 마니아를 위한 깊은 통찰력을 제공합니다.`,
  },
};

const FOCUS_PROMPTS = {
  acting: {
    ja: `【演技について特に語って】
あなたは演技にうるさいタイプ。「この子、演技うまいな」「ちょっと棒読みだな」など
率直な印象を書く。声の出し方、表情の作り方、相手との絡みの自然さなど。
「○○のシーンは正直グッときた」みたいな個人的な感情も入れて。`,
  },
  production: {
    ja: `【撮影・制作について語って】
カメラワークとか照明とか、意外と気にするタイプのあなた。
「ここの撮り方良かった」「なんでこのアングル？」みたいな感想。
編集のテンポや、BGMの使い方についても一言あれば。`,
  },
  story: {
    ja: `【シチュエーション・設定について語って】
設定厨なあなた。シチュエーションものが好きで、設定に説得力があるか気になる。
「この展開はアリ」「ここはちょっと強引だったかなw」みたいな感想。
伏線があれば触れるし、キャラ設定のブレも指摘する。`,
  },
  overall: {
    ja: `【総合的な感想を】
いろんな作品見てきた経験から、バランスよく評価。
「値段分の価値あるか」「友達に勧められるか」「また見返すか」など
実用的な視点も入れつつ。他の似た作品との比較もOK。`,
  },
};

const LENGTH_INSTRUCTIONS = {
  short: {
    ja: 'Twitterに投稿するくらいの感覚で、200-300文字で。サクッと読める感想。',
    en: 'Keep it brief, like a tweet. About 100-150 words.',
  },
  medium: {
    ja: 'ブログ記事みたいに500-700文字くらいで。適度に詳しく、でも読みやすく。',
    en: 'Blog post style, about 250-350 words. Detailed but readable.',
  },
  long: {
    ja: `レビューサイトに投稿する本気のレビュー、1000-1500文字くらいで。
段落分けして読みやすく。途中で「ただ」「でも」など逆接を入れてメリハリつけて。
最後は「〜って人にはおすすめ」みたいな締めで。`,
    en: 'Full review style, about 500-750 words. Multiple paragraphs with honest opinions.',
  },
};

/**
 * レビュー生成用のプロンプトを構築
 */
export function buildReviewPrompt(
  product: ProductInfo,
  options: ReviewPromptOptions = {
    language: 'ja',
    style: 'expert',
    focus: 'acting',
    length: 'long',
  }
): { systemPrompt: string; userPrompt: string } {
  const { language, style, focus, length } = options;

  // システムプロンプト構築
  const stylePrompts = SYSTEM_PROMPTS[style] || SYSTEM_PROMPTS.expert;
  const focusPrompts = FOCUS_PROMPTS[focus];
  const systemPrompt = [
    stylePrompts[language] || stylePrompts.ja,
    focusPrompts?.ja || '',
  ].join('\n\n');

  // ユーザープロンプト構築
  const productDetails = [
    `【作品情報】`,
    `タイトル: ${product['title']}`,
    product.performers?.length ? `出演者: ${product.performers.join('、')}` : '',
    product.genres?.length ? `ジャンル: ${product.genres.join('、')}` : '',
    product.studio ? `メーカー: ${product.studio}` : '',
    product['duration'] ? `収録時間: ${product['duration']}分` : '',
    product['releaseDate'] ? `発売日: ${product['releaseDate']}` : '',
    product['description'] ? `\n【公式説明】\n${product['description']}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const userPrompt = `${productDetails}

${LENGTH_INSTRUCTIONS[length]?.ja || LENGTH_INSTRUCTIONS.medium.ja}

上記の作品についてレビューを執筆してください。`;

  return { systemPrompt, userPrompt };
}

/**
 * 評価スコア生成用のプロンプト
 */
export function buildScorePrompt(
  product: ProductInfo,
  language: 'ja' | 'en' = 'ja'
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    language === 'ja'
      ? `あなたはアダルトビデオの専門評論家です。
作品を以下の5つの観点から10点満点で評価し、JSON形式で出力してください。

評価観点:
1. acting (演技力): 出演者の演技の自然さ、感情表現
2. production (制作): 撮影、照明、編集の技術力
3. story (シナリオ): ストーリー・シチュエーションの質
4. chemistry (ケミストリー): 出演者間の相性
5. overall (総合): 作品全体としての評価

出力形式:
{
  "acting": 8,
  "production": 7,
  "story": 6,
  "chemistry": 9,
  "overall": 8,
  "comment": "一言コメント"
}`
      : `You are an expert adult video critic. Rate the work on 5 criteria (1-10) and output in JSON format.`;

  const userPrompt = `${product['title']}
${product.performers?.join(', ') || ''}
${product.genres?.join(', ') || ''}

上記の作品を評価してください。`;

  return { systemPrompt, userPrompt };
}

/**
 * 短いキャッチコピー生成用のプロンプト
 */
export function buildCatchcopyPrompt(
  product: ProductInfo,
  language: 'ja' | 'en' = 'ja'
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    language === 'ja'
      ? `あなたはアダルトビデオの宣伝コピーライターです。
作品の魅力を端的に伝える短いキャッチコピーを3つ提案してください。

条件:
- 各20文字以内
- 出演者の魅力を強調
- ジャンルの特徴を活かす
- 過激すぎない表現`
      : `You are a copywriter for adult videos. Propose 3 short catchphrases (max 20 chars each) that convey the work's appeal.`;

  const userPrompt = `${product['title']}
${product.performers?.join(', ') || ''}
${product.genres?.join(', ') || ''}`;

  return { systemPrompt, userPrompt };
}

export const REVIEW_TEMPLATES = {
  buildReviewPrompt,
  buildScorePrompt,
  buildCatchcopyPrompt,
};

export default REVIEW_TEMPLATES;
