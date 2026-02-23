/**
 * Shared translations for AI-related components
 */

import type { Locale } from './index';

export const actressAiReviewTranslations: Record<
  Locale | string,
  {
    profile: string;
    actingStyle: string;
    appealPoints: string;
    recommendedFor: string;
    lastUpdated: string;
  }
> = {
  ja: {
    profile: 'のプロフィール',
    actingStyle: '演技スタイル',
    appealPoints: '魅力ポイント',
    recommendedFor: 'こんな方におすすめ',
    lastUpdated: '最終更新:',
  },
  en: {
    profile: "'s Profile",
    actingStyle: 'Acting Style',
    appealPoints: 'Appeal Points',
    recommendedFor: 'Recommended For',
    lastUpdated: 'Last Updated:',
  },
  zh: {
    profile: '的简介',
    actingStyle: '表演风格',
    appealPoints: '魅力点',
    recommendedFor: '推荐给这样的您',
    lastUpdated: '最后更新:',
  },
  'zh-TW': {
    profile: '的簡介',
    actingStyle: '表演風格',
    appealPoints: '魅力點',
    recommendedFor: '推薦給這樣的您',
    lastUpdated: '最後更新:',
  },
  ko: {
    profile: '의 프로필',
    actingStyle: '연기 스타일',
    appealPoints: '매력 포인트',
    recommendedFor: '이런 분께 추천',
    lastUpdated: '최종 업데이트:',
  },
} as const;

export const aiProductDescriptionTranslations: Record<
  Locale | string,
  {
    title: string;
    loading: string;
    highlights: string;
    targetAudience: string;
    catchphrase: string;
  }
> = {
  ja: {
    title: 'AI作品紹介',
    loading: '読み込み中...',
    highlights: '見どころ',
    targetAudience: 'こんな方におすすめ',
    catchphrase: 'キャッチコピー',
  },
  en: {
    title: 'AI Description',
    loading: 'Loading...',
    highlights: 'Highlights',
    targetAudience: 'Recommended for',
    catchphrase: 'Catchphrase',
  },
  zh: {
    title: 'AI介绍',
    loading: '加载中...',
    highlights: '亮点',
    targetAudience: '推荐给',
    catchphrase: '宣传语',
  },
  'zh-TW': {
    title: 'AI介紹',
    loading: '載入中...',
    highlights: '亮點',
    targetAudience: '推薦給',
    catchphrase: '宣傳語',
  },
  ko: {
    title: 'AI 설명',
    loading: '로딩 중...',
    highlights: '하이라이트',
    targetAudience: '추천 대상',
    catchphrase: '캐치프레이즈',
  },
} as const;

export const aiActressProfileTranslations: Record<
  Locale | string,
  {
    title: string;
    loading: string;
    characteristics: string;
    popularGenres: string;
    careerSummary: string;
    recommendedFor: string;
  }
> = {
  ja: {
    title: 'AIプロフィール',
    loading: 'プロフィールを読み込み中...',
    characteristics: '特徴',
    popularGenres: '得意ジャンル',
    careerSummary: 'キャリア',
    recommendedFor: 'こんな方におすすめ',
  },
  en: {
    title: 'AI Profile',
    loading: 'Loading profile...',
    characteristics: 'Characteristics',
    popularGenres: 'Popular Genres',
    careerSummary: 'Career',
    recommendedFor: 'Recommended for',
  },
  zh: {
    title: 'AI简介',
    loading: '加载简介中...',
    characteristics: '特点',
    popularGenres: '擅长类型',
    careerSummary: '职业生涯',
    recommendedFor: '推荐给',
  },
  'zh-TW': {
    title: 'AI簡介',
    loading: '載入簡介中...',
    characteristics: '特點',
    popularGenres: '擅長類型',
    careerSummary: '職業生涯',
    recommendedFor: '推薦給',
  },
  ko: {
    title: 'AI 프로필',
    loading: '프로필 로딩 중...',
    characteristics: '특징',
    popularGenres: '인기 장르',
    careerSummary: '커리어',
    recommendedFor: '추천 대상',
  },
} as const;

export const aiSearchBarTranslations: Record<
  Locale | string,
  {
    placeholder: string;
    searching: string;
    analyzing: string;
    error: string;
    clear: string;
    aiPowered: string;
    examples: readonly string[];
  }
> = {
  ja: {
    placeholder: 'AIに聞く：「明るい雰囲気の巨乳作品」など自然な言葉で検索...',
    searching: '検索中...',
    analyzing: 'AIが解析中...',
    error: '検索に失敗しました',
    clear: 'クリア',
    aiPowered: 'AI検索',
    examples: ['人妻の寝取られ作品', 'ナチュラルな雰囲気のAV', '初めての人におすすめ'],
  },
  en: {
    placeholder: 'Ask AI: Search with natural language like "busty with bright atmosphere"...',
    searching: 'Searching...',
    analyzing: 'AI analyzing...',
    error: 'Search failed',
    clear: 'Clear',
    aiPowered: 'AI Search',
    examples: ['NTR with married woman', 'Natural atmosphere AV', 'Recommended for beginners'],
  },
  zh: {
    placeholder: '问AI：用自然语言搜索，如"氛围明亮的巨乳作品"...',
    searching: '搜索中...',
    analyzing: 'AI分析中...',
    error: '搜索失败',
    clear: '清除',
    aiPowered: 'AI搜索',
    examples: ['人妻被NTR作品', '自然氛围的AV', '推荐给初学者'],
  },
  'zh-TW': {
    placeholder: '問AI：用自然語言搜尋，如「氛圍明亮的巨乳作品」...',
    searching: '搜尋中...',
    analyzing: 'AI分析中...',
    error: '搜尋失敗',
    clear: '清除',
    aiPowered: 'AI搜尋',
    examples: ['人妻被NTR作品', '自然氛圍的AV', '推薦給初學者'],
  },
  ko: {
    placeholder: 'AI에게 물어보세요: "밝은 분위기의 거유 작품" 같은 자연어로 검색...',
    searching: '검색 중...',
    analyzing: 'AI 분석 중...',
    error: '검색 실패',
    clear: '지우기',
    aiPowered: 'AI 검색',
    examples: ['유부녀 NTR 작품', '자연스러운 분위기 AV', '초보자에게 추천'],
  },
} as const;

export const chatBotTranslations: Record<
  Locale | string,
  {
    title: string;
    placeholder: string;
    send: string;
    close: string;
    typing: string;
    error: string;
    greeting: string;
    searchResults: string;
  }
> = {
  ja: {
    title: 'AIアシスタント',
    placeholder: '作品を探すお手伝いをします...',
    send: '送信',
    close: '閉じる',
    typing: '入力中...',
    error: 'エラーが発生しました。もう一度お試しください。',
    greeting:
      'こんにちは！どんな作品をお探しですか？\n\n例えば：\n・「巨乳の人妻作品」\n・「癒し系の女優」\n・「オフィスもの」\nなど、お気軽にどうぞ！',
    searchResults: '検索結果を見る',
  },
  en: {
    title: 'AI Assistant',
    placeholder: 'Let me help you find content...',
    send: 'Send',
    close: 'Close',
    typing: 'Typing...',
    error: 'An error occurred. Please try again.',
    greeting:
      'Hello! What kind of content are you looking for?\n\nFor example:\n・"Busty mature women"\n・"Cute actresses"\n・"Office setting"\nFeel free to ask!',
    searchResults: 'View search results',
  },
  zh: {
    title: 'AI助手',
    placeholder: '让我帮您找到内容...',
    send: '发送',
    close: '关闭',
    typing: '输入中...',
    error: '发生错误。请重试。',
    greeting: '您好！您在找什么样的内容？\n\n例如：\n・"巨乳人妻"\n・"可爱的女优"\n・"办公室"\n随时问我！',
    searchResults: '查看搜索结果',
  },
  'zh-TW': {
    title: 'AI助手',
    placeholder: '讓我幫您找到內容...',
    send: '傳送',
    close: '關閉',
    typing: '輸入中...',
    error: '發生錯誤。請重試。',
    greeting: '您好！您在找什麼樣的內容？\n\n例如：\n・「巨乳人妻」\n・「可愛的女優」\n・「辦公室」\n隨時問我！',
    searchResults: '查看搜尋結果',
  },
  ko: {
    title: 'AI 어시스턴트',
    placeholder: '콘텐츠 찾기를 도와드릴게요...',
    send: '보내기',
    close: '닫기',
    typing: '입력 중...',
    error: '오류가 발생했습니다. 다시 시도해 주세요.',
    greeting:
      '안녕하세요! 어떤 콘텐츠를 찾고 계신가요?\n\n예를 들어:\n・"글래머 유부녀"\n・"귀여운 여배우"\n・"사무실 설정"\n편하게 물어보세요!',
    searchResults: '검색 결과 보기',
  },
} as const;

export const imageSearchTranslations: Record<
  Locale | string,
  {
    title: string;
    subtitle: string;
    paste: string;
    uploadHint: string;
    formats: string;
    analyzing: string;
    searchSimilar: string;
    analysisResult: string;
    keywords: string;
    genres: string;
    results: (n: number) => string;
    noResults: string;
    invalidFile: string;
    fileTooLarge: string;
    searchFailed: string;
    searchError: string;
  }
> = {
  ja: {
    title: '画像で検索',
    subtitle: '画像を貼り付け（Ctrl+V）またはドラッグ＆ドロップして類似作品を検索',
    paste: 'Ctrl+V で貼り付け',
    uploadHint: 'またはクリック・ドラッグ＆ドロップでアップロード',
    formats: 'JPEG, PNG, WebP, GIF (最大5MB)',
    analyzing: '分析中...',
    searchSimilar: '類似作品を検索',
    analysisResult: '画像分析結果',
    keywords: '検出キーワード:',
    genres: '推奨ジャンル:',
    results: (n: number) => `類似作品 (${n}件)`,
    noResults: '類似作品が見つかりませんでした',
    invalidFile: '画像ファイルを選択してください',
    fileTooLarge: 'ファイルサイズは5MB以下にしてください',
    searchFailed: '検索に失敗しました',
    searchError: '検索中にエラーが発生しました',
  },
  en: {
    title: 'Search by Image',
    subtitle: 'Paste (Ctrl+V) or drag & drop an image to find similar products',
    paste: 'Paste with Ctrl+V',
    uploadHint: 'Or click / drag & drop to upload',
    formats: 'JPEG, PNG, WebP, GIF (max 5MB)',
    analyzing: 'Analyzing...',
    searchSimilar: 'Search Similar',
    analysisResult: 'Image Analysis',
    keywords: 'Keywords:',
    genres: 'Suggested Genres:',
    results: (n: number) => `Similar Products (${n})`,
    noResults: 'No similar products found',
    invalidFile: 'Please select an image file',
    fileTooLarge: 'File size must be 5MB or less',
    searchFailed: 'Search failed',
    searchError: 'An error occurred during search',
  },
  'zh-TW': {
    title: '以圖搜尋',
    subtitle: '貼上（Ctrl+V）或拖放圖片來搜尋類似作品',
    paste: 'Ctrl+V 貼上',
    uploadHint: '或點擊、拖放上傳',
    formats: 'JPEG, PNG, WebP, GIF（最大5MB）',
    analyzing: '分析中...',
    searchSimilar: '搜尋類似作品',
    analysisResult: '圖片分析結果',
    keywords: '偵測關鍵字:',
    genres: '推薦類型:',
    results: (n: number) => `類似作品（${n}件）`,
    noResults: '未找到類似作品',
    invalidFile: '請選擇圖片檔案',
    fileTooLarge: '檔案大小請在5MB以下',
    searchFailed: '搜尋失敗',
    searchError: '搜尋時發生錯誤',
  },
};

export const trendAnalysisTranslations: Record<
  Locale | string,
  {
    fetchError: string;
    retrying: string;
    retry: string;
    loading: string;
    week: string;
    month: string;
    genres: string;
    actresses: string;
    releases: string;
    trendAnalysis: string;
  }
> = {
  ja: {
    fetchError: 'トレンドデータの取得に失敗しました',
    retrying: '再読み込み中...',
    retry: '再読み込み',
    loading: '読み込み中...',
    week: '週間',
    month: '月間',
    genres: 'ジャンル',
    actresses: '女優',
    releases: '作品',
    trendAnalysis: 'トレンド分析',
  },
  en: {
    fetchError: 'Failed to load trend data',
    retrying: 'Retrying...',
    retry: 'Try again',
    loading: 'Loading...',
    week: 'Week',
    month: 'Month',
    genres: 'Genres',
    actresses: 'Actresses',
    releases: 'releases',
    trendAnalysis: 'Trend Analysis',
  },
  'zh-TW': {
    fetchError: '無法取得趨勢資料',
    retrying: '重新載入中...',
    retry: '重新載入',
    loading: '載入中...',
    week: '週間',
    month: '月間',
    genres: '類型',
    actresses: '女優',
    releases: '作品',
    trendAnalysis: '趨勢分析',
  },
} as const;
