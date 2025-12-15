/**
 * Shared translations for section components
 */

export const recentlyViewedTranslations = {
  ja: {
    title: '最近見た作品',
    clearAll: 'すべて削除',
    removeFromHistory: '履歴から削除',
  },
  en: {
    title: 'Recently Viewed',
    clearAll: 'Clear all',
    removeFromHistory: 'Remove from history',
  },
  zh: {
    title: '最近浏览',
    clearAll: '全部删除',
    removeFromHistory: '从历史记录中删除',
  },
  'zh-TW': {
    title: '最近瀏覽',
    clearAll: '全部刪除',
    removeFromHistory: '從記錄中刪除',
  },
  ko: {
    title: '최근 본 작품',
    clearAll: '전체 삭제',
    removeFromHistory: '기록에서 삭제',
  },
} as const;

export const forYouTranslations = {
  ja: {
    title: 'あなたへのおすすめ',
    basedOn: '閲覧履歴に基づくおすすめ',
  },
  en: {
    title: 'Recommended for You',
    basedOn: 'Based on your viewing history',
  },
  zh: {
    title: '为您推荐',
    basedOn: '基于您的浏览历史',
  },
  'zh-TW': {
    title: '為您推薦',
    basedOn: '基於您的瀏覽歷史',
  },
  ko: {
    title: '맞춤 추천',
    basedOn: '조회 기록을 기반으로 한 추천',
  },
} as const;

export const salesTranslations = {
  ja: {
    title: 'セール中',
    viewAll: '全てのセール商品を見る',
  },
  en: {
    title: 'On Sale',
    viewAll: 'View all sale products',
  },
  zh: {
    title: '特价中',
    viewAll: '查看所有特价商品',
  },
  'zh-TW': {
    title: '特價中',
    viewAll: '查看所有特價商品',
  },
  ko: {
    title: '세일 중',
    viewAll: '모든 세일 상품 보기',
  },
} as const;

export const weeklyHighlightsTranslations = {
  ja: {
    title: '今週の注目',
    subtitle: '閲覧データに基づく自動キュレーション',
    trendingActresses: '急上昇女優',
    hotNewReleases: '話題の新作',
    rediscoveredClassics: '再評価作品',
    viewsUp: '閲覧 +',
    products: '作品',
    rating: '評価',
    views: '閲覧',
    yearsAgo: '年前',
    loading: '読み込み中...',
    noData: 'データがありません',
  },
  en: {
    title: "This Week's Highlights",
    subtitle: 'Auto-curated based on viewing data',
    trendingActresses: 'Trending Actresses',
    hotNewReleases: 'Hot New Releases',
    rediscoveredClassics: 'Rediscovered Classics',
    viewsUp: 'Views +',
    products: 'works',
    rating: 'Rating',
    views: 'views',
    yearsAgo: 'years ago',
    loading: 'Loading...',
    noData: 'No data available',
  },
  zh: {
    title: '本周热门',
    subtitle: '基于浏览数据自动推荐',
    trendingActresses: '人气上升女优',
    hotNewReleases: '热门新作',
    rediscoveredClassics: '经典重温',
    viewsUp: '浏览 +',
    products: '作品',
    rating: '评分',
    views: '次浏览',
    yearsAgo: '年前',
    loading: '加载中...',
    noData: '暂无数据',
  },
  'zh-TW': {
    title: '本週熱門',
    subtitle: '基於瀏覽數據自動推薦',
    trendingActresses: '人氣上升女優',
    hotNewReleases: '熱門新作',
    rediscoveredClassics: '經典重溫',
    viewsUp: '瀏覽 +',
    products: '作品',
    rating: '評分',
    views: '次瀏覽',
    yearsAgo: '年前',
    loading: '載入中...',
    noData: '暫無數據',
  },
  ko: {
    title: '이번 주 주목',
    subtitle: '조회 데이터 기반 자동 큐레이션',
    trendingActresses: '인기 상승 여배우',
    hotNewReleases: '화제의 신작',
    rediscoveredClassics: '재발견 작품',
    viewsUp: '조회 +',
    products: '작품',
    rating: '평점',
    views: '조회',
    yearsAgo: '년 전',
    loading: '로딩 중...',
    noData: '데이터 없음',
  },
} as const;

export type Locale = 'ja' | 'en' | 'zh' | 'zh-TW' | 'ko';

export function getTranslation<T extends Record<string, unknown>>(
  translations: Record<Locale | string, T>,
  locale: string
): T {
  return (translations[locale as Locale] || translations.ja) as T;
}
