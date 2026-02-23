/**
 * Shared translations for performer-related components
 */

import type { Locale } from './index';

export const actressCareerTimelineTranslations: Record<
  Locale | string,
  {
    title: string;
    debut: string;
    latest: string;
    peakYear: string;
    totalProducts: string;
    avgPerYear: string;
    products: string;
    active: string;
    inactive: string;
    monthsAgo: string;
    lastRelease: string;
    showTimeline: string;
    hideTimeline: string;
    yearLabel: string;
    viewProduct: string;
  }
> = {
  ja: {
    title: 'キャリア分析',
    debut: '最も古い作品',
    latest: '最新作',
    peakYear: '全盛期',
    totalProducts: '総作品数',
    avgPerYear: '年平均',
    products: '作品',
    active: '現役',
    inactive: '活動休止中',
    monthsAgo: 'ヶ月前',
    lastRelease: '最終リリース',
    showTimeline: 'タイムラインを表示',
    hideTimeline: 'タイムラインを非表示',
    yearLabel: '年',
    viewProduct: '詳細',
  },
  en: {
    title: 'Career Analysis',
    debut: 'Earliest',
    latest: 'Latest',
    peakYear: 'Peak Year',
    totalProducts: 'Total Products',
    avgPerYear: 'Avg/Year',
    products: 'products',
    active: 'Active',
    inactive: 'Inactive',
    monthsAgo: 'months ago',
    lastRelease: 'Last Release',
    showTimeline: 'Show Timeline',
    hideTimeline: 'Hide Timeline',
    yearLabel: '',
    viewProduct: 'View',
  },
  zh: {
    title: '职业生涯分析',
    debut: '最早作品',
    latest: '最新作',
    peakYear: '巅峰期',
    totalProducts: '总作品数',
    avgPerYear: '年均',
    products: '部作品',
    active: '现役',
    inactive: '休止中',
    monthsAgo: '个月前',
    lastRelease: '最后发布',
    showTimeline: '显示时间线',
    hideTimeline: '隐藏时间线',
    yearLabel: '年',
    viewProduct: '查看',
  },
  'zh-TW': {
    title: '職業生涯分析',
    debut: '最早作品',
    latest: '最新作',
    peakYear: '巔峰期',
    totalProducts: '總作品數',
    avgPerYear: '年均',
    products: '部作品',
    active: '現役',
    inactive: '休止中',
    monthsAgo: '個月前',
    lastRelease: '最後發佈',
    showTimeline: '顯示時間線',
    hideTimeline: '隱藏時間線',
    yearLabel: '年',
    viewProduct: '查看',
  },
  ko: {
    title: '커리어 분석',
    debut: '가장 오래된 작품',
    latest: '최신작',
    peakYear: '전성기',
    totalProducts: '총 작품 수',
    avgPerYear: '연평균',
    products: '작품',
    active: '현역',
    inactive: '활동 휴지',
    monthsAgo: '개월 전',
    lastRelease: '마지막 발매',
    showTimeline: '타임라인 보기',
    hideTimeline: '타임라인 숨기기',
    yearLabel: '년',
    viewProduct: '보기',
  },
} as const;

export const actressCardTranslations: Record<
  Locale | string,
  {
    releaseCount: string;
    videos: string;
    trend: string;
    fanScore: string;
  }
> = {
  ja: {
    releaseCount: '出演数',
    videos: '本',
    trend: 'トレンド',
    fanScore: 'ファン度',
  },
  en: {
    releaseCount: 'Releases',
    videos: '',
    trend: 'Trend',
    fanScore: 'Fan Score',
  },
  zh: {
    releaseCount: '出演数',
    videos: '部',
    trend: '趋势',
    fanScore: '粉丝分',
  },
  'zh-TW': {
    releaseCount: '出演數',
    videos: '部',
    trend: '趨勢',
    fanScore: '粉絲分',
  },
  ko: {
    releaseCount: '출연작',
    videos: '편',
    trend: '트렌드',
    fanScore: '팬점수',
  },
} as const;

export const adultContentNoticeTranslations: Record<Locale | string, string> = {
  ja: '【PR・広告】このサイトはアフィリエイト広告を含みます。成人向けコンテンツです。表示価格は税込みで、販売サイトにより異なる場合があります。',
  en: '[AD] This site contains affiliate advertising. Adult content. Prices shown include tax and may vary by seller.',
  zh: '【广告】本网站包含联盟广告。成人内容。显示价格含税，不同销售网站可能有所不同。',
  'zh-TW': '【廣告】本網站包含聯盟廣告。成人內容。顯示價格含稅，不同銷售網站可能有所不同。',
  ko: '【광고】이 사이트는 제휴 광고를 포함합니다. 성인 콘텐츠입니다. 표시 가격은 세금 포함이며, 판매 사이트에 따라 다를 수 있습니다.',
} as const;

export const fanzaSiteBannerTranslations: Record<
  Locale | string,
  {
    title: string;
    description: string;
    cta: string;
    badge: string;
  }
> = {
  ja: {
    title: 'FANZA専門サイト',
    description: 'FANZAの最新作品・セール情報をチェック',
    cta: 'FANZAサイトへ',
    badge: 'FANZA専門',
  },
  en: {
    title: 'FANZA Dedicated Site',
    description: 'Check latest FANZA releases and sales',
    cta: 'Visit FANZA Site',
    badge: 'FANZA Only',
  },
  zh: {
    title: 'FANZA专门网站',
    description: '查看FANZA最新作品和促销信息',
    cta: '访问FANZA网站',
    badge: 'FANZA专属',
  },
  'zh-TW': {
    title: 'FANZA專門網站',
    description: '查看FANZA最新作品和促銷資訊',
    cta: '訪問FANZA網站',
    badge: 'FANZA專屬',
  },
  ko: {
    title: 'FANZA 전문 사이트',
    description: 'FANZA 최신 작품 및 세일 정보 확인',
    cta: 'FANZA 사이트로',
    badge: 'FANZA 전용',
  },
} as const;

export const makerAnalysisTranslations: Record<
  Locale | string,
  {
    title: string;
    subtitle: string;
    topMakers: string;
    topLabels: string;
    viewCount: string;
    avgRating: string;
    viewMore: string;
    noData: string;
    noDataDesc: string;
    matchRate: string;
    works: string;
  }
> = {
  ja: {
    title: 'メーカー傾向分析',
    subtitle: 'あなたの視聴履歴から分析',
    topMakers: 'よく見るメーカー',
    topLabels: 'よく見るレーベル',
    viewCount: '視聴数',
    avgRating: '平均評価',
    viewMore: 'もっと見る',
    noData: 'データがありません',
    noDataDesc: '作品を視聴すると傾向が分析されます',
    matchRate: '一致率',
    works: '作品',
  },
  en: {
    title: 'Maker Analysis',
    subtitle: 'Based on your viewing history',
    topMakers: 'Top Makers',
    topLabels: 'Top Labels',
    viewCount: 'Views',
    avgRating: 'Avg Rating',
    viewMore: 'View More',
    noData: 'No data',
    noDataDesc: 'Watch more to see analysis',
    matchRate: 'Match',
    works: 'works',
  },
  zh: {
    title: '厂商偏好分析',
    subtitle: '基于您的观看历史',
    topMakers: '常看厂商',
    topLabels: '常看品牌',
    viewCount: '观看数',
    avgRating: '平均评分',
    viewMore: '查看更多',
    noData: '暂无数据',
    noDataDesc: '观看更多后可查看分析',
    matchRate: '匹配度',
    works: '部',
  },
  'zh-TW': {
    title: '製作商偏好分析',
    subtitle: '基於您的觀看歷史',
    topMakers: '常看製作商',
    topLabels: '常看品牌',
    viewCount: '觀看數',
    avgRating: '平均評分',
    viewMore: '查看更多',
    noData: '暫無資料',
    noDataDesc: '觀看更多後可查看分析',
    matchRate: '匹配度',
    works: '部',
  },
  ko: {
    title: '메이커 분석',
    subtitle: '시청 기록 기반 분석',
    topMakers: '자주 보는 메이커',
    topLabels: '자주 보는 레이블',
    viewCount: '시청 수',
    avgRating: '평균 평점',
    viewMore: '더 보기',
    noData: '데이터 없음',
    noDataDesc: '더 많이 시청하면 분석이 표시됩니다',
    matchRate: '일치율',
    works: '작품',
  },
} as const;

export const performerCompareFloatingBarTranslations: Record<
  Locale | string,
  {
    compare: string;
    clearAll: string;
    performers: string;
    hint: string;
  }
> = {
  ja: {
    compare: '比較する',
    clearAll: 'クリア',
    performers: '名',
    hint: '「比較する」ボタンで比較ページへ',
  },
  en: {
    compare: 'Compare',
    clearAll: 'Clear',
    performers: 'performers',
    hint: 'Click "Compare" to view comparison',
  },
  'zh-TW': {
    compare: '比較',
    clearAll: '清除',
    performers: '名',
    hint: '點擊「比較」前往比較頁面',
  },
} as const;

export const retirementAlertTranslations: Record<
  Locale | string,
  {
    retirementAlert: string;
    lastRelease: string;
    monthsAgo: string;
    noNewRelease: string;
    warning3Months: string;
    warning6Months: string;
    warning12Months: string;
    checkNow: string;
    activityDecline: string;
    peakComparison: string;
    decline: string;
  }
> = {
  ja: {
    retirementAlert: '活動休止の可能性',
    lastRelease: '最終リリース',
    monthsAgo: 'ヶ月前',
    noNewRelease: '新作リリースなし',
    warning3Months: '3ヶ月以上新作がありません',
    warning6Months: '6ヶ月以上新作がありません',
    warning12Months: '1年以上新作がありません',
    checkNow: '未視聴作品をチェック',
    activityDecline: 'リリース頻度が低下',
    peakComparison: '全盛期（{year}年）と比較して',
    decline: '減少',
  },
  en: {
    retirementAlert: 'Possible Retirement',
    lastRelease: 'Last Release',
    monthsAgo: 'months ago',
    noNewRelease: 'No new releases',
    warning3Months: 'No new releases for 3+ months',
    warning6Months: 'No new releases for 6+ months',
    warning12Months: 'No new releases for 1+ year',
    checkNow: 'Check unwatched products',
    activityDecline: 'Release frequency declining',
    peakComparison: 'Compared to peak ({year})',
    decline: 'decline',
  },
  zh: {
    retirementAlert: '可能已引退',
    lastRelease: '最后发布',
    monthsAgo: '个月前',
    noNewRelease: '无新作',
    warning3Months: '3个月以上无新作',
    warning6Months: '6个月以上无新作',
    warning12Months: '1年以上无新作',
    checkNow: '查看未观看的作品',
    activityDecline: '发布频率下降',
    peakComparison: '与巅峰期（{year}年）相比',
    decline: '减少',
  },
  'zh-TW': {
    retirementAlert: '可能已引退',
    lastRelease: '最後發佈',
    monthsAgo: '個月前',
    noNewRelease: '無新作',
    warning3Months: '3個月以上無新作',
    warning6Months: '6個月以上無新作',
    warning12Months: '1年以上無新作',
    checkNow: '查看未觀看的作品',
    activityDecline: '發佈頻率下降',
    peakComparison: '與巔峰期（{year}年）相比',
    decline: '減少',
  },
  ko: {
    retirementAlert: '은퇴 가능성',
    lastRelease: '마지막 발매',
    monthsAgo: '개월 전',
    noNewRelease: '신작 없음',
    warning3Months: '3개월 이상 신작이 없습니다',
    warning6Months: '6개월 이상 신작이 없습니다',
    warning12Months: '1년 이상 신작이 없습니다',
    checkNow: '미시청 작품 확인',
    activityDecline: '발매 빈도 감소',
    peakComparison: '전성기({year}년)와 비교하여',
    decline: '감소',
  },
} as const;

export const actressSectionNavTranslations: Record<
  Locale | string,
  {
    profile: string;
    career: string;
    aiReview: string;
    topProducts: string;
    onSale: string;
    filmography: string;
    costars: string;
    similar: string;
  }
> = {
  ja: {
    profile: 'プロフィール',
    career: 'キャリア分析',
    aiReview: 'AIレビュー',
    topProducts: '人気作品',
    onSale: 'セール中',
    filmography: '全作品',
    costars: '共演者',
    similar: '類似女優',
  },
  en: {
    profile: 'Profile',
    career: 'Career',
    aiReview: 'AI Review',
    topProducts: 'Top Works',
    onSale: 'On Sale',
    filmography: 'Filmography',
    costars: 'Costars',
    similar: 'Similar',
  },
  'zh-TW': {
    profile: '個人檔案',
    career: '職業生涯分析',
    aiReview: 'AI評論',
    topProducts: '人氣作品',
    onSale: '特價中',
    filmography: '全部作品',
    costars: '共演者',
    similar: '類似女優',
  },
} as const;

export const similarPerformerMapTranslations: Record<
  Locale | string,
  {
    analyzing: string;
    networkTitle: string;
    networkSubtitle: string;
    listView: string;
    networkView: string;
    makerSimilar: string;
    profileSimilar: string;
    genreSimilar: string;
  }
> = {
  ja: {
    analyzing: '類似女優を分析中...',
    networkTitle: '似た女優ネットワーク',
    networkSubtitle: '2ホップまでの類似関係',
    listView: 'リスト表示',
    networkView: 'ネットワーク図',
    makerSimilar: 'メーカー類似',
    profileSimilar: 'プロフィール類似',
    genreSimilar: 'ジャンル類似',
  },
  en: {
    analyzing: 'Analyzing similar performers...',
    networkTitle: 'Similar Performers Network',
    networkSubtitle: 'Up to 2 hops',
    listView: 'List view',
    networkView: 'Network view',
    makerSimilar: 'Maker Similar',
    profileSimilar: 'Profile Similar',
    genreSimilar: 'Genre Similar',
  },
  'zh-TW': {
    analyzing: '正在分析類似女優...',
    networkTitle: '類似女優網路',
    networkSubtitle: '最多2層關係',
    listView: '清單檢視',
    networkView: '網路圖',
    makerSimilar: '製作商類似',
    profileSimilar: '個人檔案類似',
    genreSimilar: '類型類似',
  },
} as const;

export const performerRelationMapTranslations: Record<
  Locale | string,
  {
    loading: string;
    costarNetwork: string;
    upToHops: string;
    listView: string;
    networkView: string;
    firstHop: string;
    secondHop: string;
    directCostars: string;
    secondHopLabel: string;
    works: string;
    costars: string;
  }
> = {
  ja: {
    loading: '読み込み中...',
    costarNetwork: '共演者ネットワーク',
    upToHops: '2ホップまでの関係',
    listView: 'リスト表示',
    networkView: 'ネットワーク図',
    firstHop: '直接共演',
    secondHop: '2ホップ',
    directCostars: '直接共演者',
    secondHopLabel: '2ホップ目',
    works: '作品',
    costars: '作品共演',
  },
  en: {
    loading: 'Loading...',
    costarNetwork: 'Costar Network',
    upToHops: 'Up to 2 hops',
    listView: 'List view',
    networkView: 'Network view',
    firstHop: '1st hop',
    secondHop: '2nd hop',
    directCostars: 'Direct Costars',
    secondHopLabel: '2nd Hop',
    works: ' works',
    costars: ' costars',
  },
  'zh-TW': {
    loading: '載入中...',
    costarNetwork: '共演者網路',
    upToHops: '最多2層關係',
    listView: '清單檢視',
    networkView: '網路圖',
    firstHop: '直接共演',
    secondHop: '第2層',
    directCostars: '直接共演者',
    secondHopLabel: '第2層',
    works: '部作品',
    costars: '位共演',
  },
} as const;

export const performerListWithSelectionTranslations: Record<
  Locale | string,
  {
    selectToCompare: string;
    exitSelection: string;
    selected: string;
    maxReachedPrefix: string;
    maxReachedSuffix: string;
    loading: string;
  }
> = {
  ja: {
    selectToCompare: '比較選択モード',
    exitSelection: '選択終了',
    selected: '選択中',
    maxReachedPrefix: '最大',
    maxReachedSuffix: '名まで選択可能',
    loading: '読み込み中...',
  },
  en: {
    selectToCompare: 'Select to Compare',
    exitSelection: 'Exit Selection',
    selected: 'Selected',
    maxReachedPrefix: 'Max ',
    maxReachedSuffix: ' performers',
    loading: 'Loading...',
  },
  zh: {
    selectToCompare: '比较选择模式',
    exitSelection: '结束选择',
    selected: '已选择',
    maxReachedPrefix: '最多',
    maxReachedSuffix: '人可选',
    loading: '加载中...',
  },
  'zh-TW': {
    selectToCompare: '比較選擇模式',
    exitSelection: '結束選擇',
    selected: '已選擇',
    maxReachedPrefix: '最多',
    maxReachedSuffix: '人可選',
    loading: '載入中...',
  },
  ko: {
    selectToCompare: '비교 선택 모드',
    exitSelection: '선택 종료',
    selected: '선택 중',
    maxReachedPrefix: '최대 ',
    maxReachedSuffix: '명까지 선택 가능',
    loading: '로딩 중...',
  },
} as const;

export const performerCompareTranslations: Record<
  Locale | string,
  {
    emptyTitle: string;
    emptyDescription: string;
    loading: string;
    mostReleases: string;
    mostTrending: string;
    mostPopular: string;
    releases: string;
    trending: string;
    fanScore: string;
    height: string;
    cup: string;
    debut: string;
    measurements: string;
    services: string;
    tags: string;
    viewDetails: string;
    comparisonChart: string;
    radarChart: string;
    barComparison: string;
    commonFeatures: string;
  }
> = {
  ja: {
    emptyTitle: '女優を比較しましょう',
    emptyDescription: '女優を選択すると比較できます',
    loading: '女優情報を読み込み中...',
    mostReleases: '出演数No.1',
    mostTrending: '注目度No.1',
    mostPopular: '人気No.1',
    releases: '出演数',
    trending: '注目度',
    fanScore: '人気度',
    height: '身長',
    cup: 'カップ',
    debut: 'デビュー',
    measurements: 'スリーサイズ',
    services: '配信サイト',
    tags: 'タグ',
    viewDetails: '詳細を見る',
    comparisonChart: '比較グラフ',
    radarChart: 'レーダーチャート',
    barComparison: '棒グラフ比較',
    commonFeatures: '共通点',
  },
  en: {
    emptyTitle: 'Compare Performers',
    emptyDescription: 'Select performers to compare',
    loading: 'Loading performers...',
    mostReleases: 'Most Releases',
    mostTrending: 'Most Trending',
    mostPopular: 'Most Popular',
    releases: 'Releases',
    trending: 'Trending',
    fanScore: 'Fan Score',
    height: 'Height',
    cup: 'Cup',
    debut: 'Debut',
    measurements: 'Measurements',
    services: 'Services',
    tags: 'Tags',
    viewDetails: 'View Details',
    comparisonChart: 'Comparison Chart',
    radarChart: 'Radar Chart',
    barComparison: 'Bar Comparison',
    commonFeatures: 'Common Features',
  },
  'zh-TW': {
    emptyTitle: '比較女優',
    emptyDescription: '選擇女優即可比較',
    loading: '正在載入女優資訊...',
    mostReleases: '出演數No.1',
    mostTrending: '注目度No.1',
    mostPopular: '人氣No.1',
    releases: '出演數',
    trending: '注目度',
    fanScore: '人氣度',
    height: '身高',
    cup: '罩杯',
    debut: '出道',
    measurements: '三圍',
    services: '配信網站',
    tags: '標籤',
    viewDetails: '查看詳情',
    comparisonChart: '比較圖表',
    radarChart: '雷達圖',
    barComparison: '長條圖比較',
    commonFeatures: '共通點',
  },
} as const;
