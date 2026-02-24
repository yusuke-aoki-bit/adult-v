/**
 * Shared translations for product-related components
 */

import type { Locale } from './index';

export const alsoViewedTranslations: Record<
  Locale | string,
  {
    title: string;
    alsoViewed: string;
    viewedBy: string;
    loading: string;
    error: string;
    noData: string;
  }
> = {
  ja: {
    title: 'この作品を見た人は',
    alsoViewed: 'こちらも見ています',
    viewedBy: 'の人が閲覧',
    loading: '読み込み中...',
    error: '取得に失敗しました',
    noData: 'データがありません',
  },
  en: {
    title: 'People who viewed this',
    alsoViewed: 'also viewed',
    viewedBy: 'of viewers',
    loading: 'Loading...',
    error: 'Failed to load',
    noData: 'No data available',
  },
  'zh-TW': {
    title: '看過這部作品的人',
    alsoViewed: '也看了這些',
    viewedBy: '的人瀏覽過',
    loading: '載入中...',
    error: '載入失敗',
    noData: '暫無資料',
  },
} as const;

export const costPerformanceTranslations: Record<
  Locale | string,
  {
    costPerformance: string;
    pricePerMin: string;
    currentPrice: string;
    duration: string;
    comparison: string;
    vsActress: string;
    vsGenre: string;
    belowAvg: string;
    aboveAvg: string;
    average: string;
    excellent: string;
    good: string;
    expensive: string;
    minutes: string;
    yen: string;
    noDuration: string;
    cheaper: string;
    moreExpensive: string;
  }
> = {
  ja: {
    costPerformance: 'コスパ分析',
    pricePerMin: '価格/分',
    currentPrice: '現在価格',
    duration: '収録時間',
    comparison: '比較',
    vsActress: 'この女優の平均',
    vsGenre: 'このジャンル平均',
    belowAvg: '平均以下',
    aboveAvg: '平均以上',
    average: '平均的',
    excellent: 'お得',
    good: 'まあまあ',
    expensive: '割高',
    minutes: '分',
    yen: '円',
    noDuration: '時間情報なし',
    cheaper: '安い',
    moreExpensive: '高い',
  },
  en: {
    costPerformance: 'Cost Performance',
    pricePerMin: 'Price/min',
    currentPrice: 'Current Price',
    duration: 'Duration',
    comparison: 'Comparison',
    vsActress: 'Actress avg',
    vsGenre: 'Genre avg',
    belowAvg: 'Below avg',
    aboveAvg: 'Above avg',
    average: 'Average',
    excellent: 'Great value',
    good: 'Fair',
    expensive: 'Pricey',
    minutes: 'min',
    yen: 'JPY',
    noDuration: 'No duration info',
    cheaper: 'cheaper',
    moreExpensive: 'more expensive',
  },
  zh: {
    costPerformance: '性价比分析',
    pricePerMin: '价格/分钟',
    currentPrice: '当前价格',
    duration: '时长',
    comparison: '比较',
    vsActress: '该女优平均',
    vsGenre: '该类型平均',
    belowAvg: '低于平均',
    aboveAvg: '高于平均',
    average: '平均',
    excellent: '超值',
    good: '一般',
    expensive: '偏贵',
    minutes: '分钟',
    yen: '日元',
    noDuration: '无时长信息',
    cheaper: '便宜',
    moreExpensive: '贵',
  },
  'zh-TW': {
    costPerformance: '性價比分析',
    pricePerMin: '價格/分鐘',
    currentPrice: '目前價格',
    duration: '時長',
    comparison: '比較',
    vsActress: '該女優平均',
    vsGenre: '該類型平均',
    belowAvg: '低於平均',
    aboveAvg: '高於平均',
    average: '平均',
    excellent: '超值',
    good: '一般',
    expensive: '偏貴',
    minutes: '分鐘',
    yen: '日圓',
    noDuration: '無時長資訊',
    cheaper: '便宜',
    moreExpensive: '貴',
  },
  ko: {
    costPerformance: '가성비 분석',
    pricePerMin: '가격/분',
    currentPrice: '현재 가격',
    duration: '재생 시간',
    comparison: '비교',
    vsActress: '이 배우 평균',
    vsGenre: '이 장르 평균',
    belowAvg: '평균 이하',
    aboveAvg: '평균 이상',
    average: '평균',
    excellent: '알뜰',
    good: '보통',
    expensive: '비쌈',
    minutes: '분',
    yen: '엔',
    noDuration: '시간 정보 없음',
    cheaper: '저렴',
    moreExpensive: '비쌈',
  },
} as const;

export const crossAspInfoTranslations: Record<
  Locale | string,
  {
    crossAspTitle: string;
    aliases: string;
    primary: string;
    aspDistribution: string;
    total: string;
    works: string;
    showMore: string;
    showLess: string;
    searchOnAsp: string;
  }
> = {
  ja: {
    crossAspTitle: 'クロスASP情報',
    aliases: '別名義',
    primary: 'メイン',
    aspDistribution: 'ASP別作品数',
    total: '合計',
    works: '作品',
    showMore: 'もっと見る',
    showLess: '閉じる',
    searchOnAsp: 'で検索',
  },
  en: {
    crossAspTitle: 'Cross-ASP Info',
    aliases: 'Aliases',
    primary: 'Primary',
    aspDistribution: 'Works by ASP',
    total: 'Total',
    works: 'works',
    showMore: 'Show more',
    showLess: 'Show less',
    searchOnAsp: 'Search on',
  },
  zh: {
    crossAspTitle: '跨ASP信息',
    aliases: '别名',
    primary: '主要',
    aspDistribution: '按ASP的作品数',
    total: '总计',
    works: '部',
    showMore: '显示更多',
    showLess: '收起',
    searchOnAsp: '在此搜索',
  },
  'zh-TW': {
    crossAspTitle: '跨ASP資訊',
    aliases: '別名',
    primary: '主要',
    aspDistribution: '按ASP的作品數',
    total: '總計',
    works: '部',
    showMore: '顯示更多',
    showLess: '收起',
    searchOnAsp: '在此搜尋',
  },
  ko: {
    crossAspTitle: '크로스 ASP 정보',
    aliases: '별명',
    primary: '메인',
    aspDistribution: 'ASP별 작품 수',
    total: '총',
    works: '작품',
    showMore: '더 보기',
    showLess: '접기',
    searchOnAsp: '에서 검색',
  },
} as const;

export const fanzaNewReleasesTranslations: Record<
  Locale | string,
  {
    title: string;
    viewMore: string;
    sale: string;
    new: string;
    noData: string;
  }
> = {
  ja: {
    title: 'FANZA新作ピックアップ',
    viewMore: 'FANZA専門サイトで見る',
    sale: 'SALE',
    new: 'NEW',
    noData: 'データを取得中...',
  },
  en: {
    title: 'FANZA New Releases',
    viewMore: 'View on FANZA Site',
    sale: 'SALE',
    new: 'NEW',
    noData: 'Loading...',
  },
  zh: {
    title: 'FANZA新作精选',
    viewMore: '在FANZA网站查看',
    sale: '特价',
    new: '新品',
    noData: '加载中...',
  },
  'zh-TW': {
    title: 'FANZA新作精選',
    viewMore: '在FANZA網站查看',
    sale: '特價',
    new: '新品',
    noData: '載入中...',
  },
  ko: {
    title: 'FANZA 신작 픽업',
    viewMore: 'FANZA 사이트에서 보기',
    sale: '세일',
    new: '신상',
    noData: '로딩 중...',
  },
} as const;

export const markAsViewedTranslations: Record<
  Locale | string,
  {
    markAsViewed: string;
    viewed: string;
    addToDiary: string;
    rating: string;
    note: string;
    notePlaceholder: string;
    cancel: string;
    save: string;
    viewCount: string;
  }
> = {
  ja: {
    markAsViewed: '視聴済みにする',
    viewed: '視聴済み',
    addToDiary: '日記に追加',
    rating: '評価',
    note: 'メモ（任意）',
    notePlaceholder: '感想やメモを残す...',
    cancel: 'キャンセル',
    save: '保存',
    viewCount: '回視聴',
  },
  en: {
    markAsViewed: 'Mark as Viewed',
    viewed: 'Viewed',
    addToDiary: 'Add to Diary',
    rating: 'Rating',
    note: 'Note (optional)',
    notePlaceholder: 'Leave your thoughts...',
    cancel: 'Cancel',
    save: 'Save',
    viewCount: 'views',
  },
  zh: {
    markAsViewed: '标记为已看',
    viewed: '已观看',
    addToDiary: '添加到日记',
    rating: '评分',
    note: '备注（可选）',
    notePlaceholder: '写下你的感想...',
    cancel: '取消',
    save: '保存',
    viewCount: '次观看',
  },
  'zh-TW': {
    markAsViewed: '標記為已看',
    viewed: '已觀看',
    addToDiary: '新增到日記',
    rating: '評分',
    note: '備註（可選）',
    notePlaceholder: '寫下你的感想...',
    cancel: '取消',
    save: '儲存',
    viewCount: '次觀看',
  },
  ko: {
    markAsViewed: '시청 완료로 표시',
    viewed: '시청 완료',
    addToDiary: '일기에 추가',
    rating: '평점',
    note: '메모 (선택)',
    notePlaceholder: '소감을 남겨보세요...',
    cancel: '취소',
    save: '저장',
    viewCount: '회 시청',
  },
} as const;

export const priceComparisonTranslations: Record<
  Locale | string,
  {
    title: string;
    titleSingle: string;
    cheapest: string;
    sale: string;
    subscription: string;
    regularPrice: string;
    salePrice: string;
    discount: string;
    saleEnds: string;
    today: string;
    daysLeft: string;
    buyNow: string;
    noPrice: string;
    savings: string;
    compare: string;
  }
> = {
  ja: {
    title: '購入先を選択',
    titleSingle: '購入先',
    cheapest: '最安',
    sale: 'セール中',
    subscription: '月額',
    regularPrice: '通常価格',
    salePrice: 'セール価格',
    discount: 'OFF',
    saleEnds: 'セール終了',
    today: '本日まで',
    daysLeft: 'あと{days}日',
    buyNow: '購入する',
    noPrice: '価格情報なし',
    savings: '最大節約',
    compare: 'サイト',
  },
  en: {
    title: 'Where to Buy',
    titleSingle: 'Purchase',
    cheapest: 'Best Price',
    sale: 'On Sale',
    subscription: 'Monthly',
    regularPrice: 'Regular',
    salePrice: 'Sale',
    discount: 'OFF',
    saleEnds: 'Sale ends',
    today: 'Today',
    daysLeft: '{days} days left',
    buyNow: 'Buy',
    noPrice: 'Price unavailable',
    savings: 'Max savings',
    compare: 'sources',
  },
  zh: {
    title: '购买渠道',
    titleSingle: '购买',
    cheapest: '最低价',
    sale: '促销中',
    subscription: '月费',
    regularPrice: '原价',
    salePrice: '促销价',
    discount: '折扣',
    saleEnds: '促销结束',
    today: '今日截止',
    daysLeft: '剩余{days}天',
    buyNow: '购买',
    noPrice: '价格未知',
    savings: '最大节省',
    compare: '来源',
  },
  'zh-TW': {
    title: '購買管道',
    titleSingle: '購買',
    cheapest: '最低價',
    sale: '促銷中',
    subscription: '月費',
    regularPrice: '原價',
    salePrice: '促銷價',
    discount: '折扣',
    saleEnds: '促銷結束',
    today: '今日截止',
    daysLeft: '剩餘{days}天',
    buyNow: '購買',
    noPrice: '價格未知',
    savings: '最大節省',
    compare: '來源',
  },
  ko: {
    title: '구매처 선택',
    titleSingle: '구매',
    cheapest: '최저가',
    sale: '세일 중',
    subscription: '월정액',
    regularPrice: '정가',
    salePrice: '세일가',
    discount: '할인',
    saleEnds: '세일 종료',
    today: '오늘까지',
    daysLeft: '{days}일 남음',
    buyNow: '구매',
    noPrice: '가격 정보 없음',
    savings: '최대 절약',
    compare: '출처',
  },
} as const;

export const sceneTimelineTranslations: Record<
  Locale | string,
  {
    title: string;
    addScene: string;
    noScenes: string;
    beFirst: string;
    votes: string;
    bestScene: string;
    addSceneTitle: string;
    timestamp: string;
    timestampPlaceholder: string;
    label: string;
    labelPlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    rating: string;
    cancel: string;
    add: string;
    invalidTimestamp: string;
  }
> = {
  ja: {
    title: 'シーン情報',
    addScene: 'シーンを追加',
    noScenes: 'まだシーン情報がありません',
    beFirst: '最初のシーンを追加しましょう',
    votes: '票',
    bestScene: 'ベストシーン',
    addSceneTitle: 'シーンを追加',
    timestamp: 'タイムスタンプ',
    timestampPlaceholder: '例: 12:30',
    label: 'ラベル',
    labelPlaceholder: '例: ハイライト、名シーン',
    description: '説明（任意）',
    descriptionPlaceholder: 'このシーンの見どころを説明...',
    rating: '評価',
    cancel: 'キャンセル',
    add: '追加',
    invalidTimestamp: '正しい形式で入力してください (例: 12:30)',
  },
  en: {
    title: 'Scene Info',
    addScene: 'Add Scene',
    noScenes: 'No scene info yet',
    beFirst: 'Be the first to add a scene',
    votes: 'votes',
    bestScene: 'Best Scene',
    addSceneTitle: 'Add Scene',
    timestamp: 'Timestamp',
    timestampPlaceholder: 'e.g., 12:30',
    label: 'Label',
    labelPlaceholder: 'e.g., Highlight, Best moment',
    description: 'Description (optional)',
    descriptionPlaceholder: 'Describe what makes this scene special...',
    rating: 'Rating',
    cancel: 'Cancel',
    add: 'Add',
    invalidTimestamp: 'Please enter a valid format (e.g., 12:30)',
  },
  zh: {
    title: '场景信息',
    addScene: '添加场景',
    noScenes: '暂无场景信息',
    beFirst: '成为第一个添加场景的人',
    votes: '票',
    bestScene: '最佳场景',
    addSceneTitle: '添加场景',
    timestamp: '时间戳',
    timestampPlaceholder: '例如: 12:30',
    label: '标签',
    labelPlaceholder: '例如: 高光时刻',
    description: '描述（可选）',
    descriptionPlaceholder: '描述这个场景的亮点...',
    rating: '评分',
    cancel: '取消',
    add: '添加',
    invalidTimestamp: '请输入正确的格式 (例如: 12:30)',
  },
  'zh-TW': {
    title: '場景資訊',
    addScene: '新增場景',
    noScenes: '暫無場景資訊',
    beFirst: '成為第一個新增場景的人',
    votes: '票',
    bestScene: '最佳場景',
    addSceneTitle: '新增場景',
    timestamp: '時間戳',
    timestampPlaceholder: '例如: 12:30',
    label: '標籤',
    labelPlaceholder: '例如: 精彩時刻',
    description: '描述（可選）',
    descriptionPlaceholder: '描述這個場景的亮點...',
    rating: '評分',
    cancel: '取消',
    add: '新增',
    invalidTimestamp: '請輸入正確的格式 (例如: 12:30)',
  },
  ko: {
    title: '씬 정보',
    addScene: '씬 추가',
    noScenes: '아직 씬 정보가 없습니다',
    beFirst: '첫 번째로 씬을 추가해 보세요',
    votes: '표',
    bestScene: '베스트 씬',
    addSceneTitle: '씬 추가',
    timestamp: '타임스탬프',
    timestampPlaceholder: '예: 12:30',
    label: '라벨',
    labelPlaceholder: '예: 하이라이트, 명장면',
    description: '설명 (선택)',
    descriptionPlaceholder: '이 씬의 특징을 설명...',
    rating: '평점',
    cancel: '취소',
    add: '추가',
    invalidTimestamp: '올바른 형식으로 입력해주세요 (예: 12:30)',
  },
} as const;

export const similarProductMapTranslations: Record<
  Locale | string,
  {
    analyzing: string;
    networkTitle: string;
    networkSubtitle: string;
    listView: string;
    networkView: string;
    sameMaker: string;
    samePerformer: string;
    similarGenre: string;
    sameMakerProducts: string;
    samePerformerProducts: string;
    similarGenreProducts: string;
  }
> = {
  ja: {
    analyzing: '類似作品を分析中...',
    networkTitle: '類似作品ネットワーク',
    networkSubtitle: '出演者・ジャンルによる関連',
    listView: 'リスト表示',
    networkView: 'ネットワーク図',
    sameMaker: '同じメーカー',
    samePerformer: '同じ出演者',
    similarGenre: 'ジャンル類似',
    sameMakerProducts: '同じメーカーの作品',
    samePerformerProducts: '同じ出演者の作品',
    similarGenreProducts: 'ジャンル類似作品',
  },
  en: {
    analyzing: 'Analyzing similar products...',
    networkTitle: 'Similar Products Network',
    networkSubtitle: 'Related by performers & genres',
    listView: 'List view',
    networkView: 'Network view',
    sameMaker: 'Same maker',
    samePerformer: 'Same performer',
    similarGenre: 'Similar genre',
    sameMakerProducts: 'Same Maker',
    samePerformerProducts: 'Same Performer',
    similarGenreProducts: 'Similar Genre',
  },
  'zh-TW': {
    analyzing: '分析類似作品中...',
    networkTitle: '類似作品網路',
    networkSubtitle: '依演員與類型的關聯',
    listView: '清單檢視',
    networkView: '網路圖',
    sameMaker: '相同廠商',
    samePerformer: '相同演員',
    similarGenre: '類型類似',
    sameMakerProducts: '相同廠商的作品',
    samePerformerProducts: '相同演員的作品',
    similarGenreProducts: '類型類似作品',
  },
} as const;

export const productCompareTranslations: Record<
  Locale | string,
  {
    compareProducts: string;
    selectAtLeast2: string;
    loadingComparison: string;
    bestPrice: string;
    onSale: string;
    topRated: string;
    longest: string;
    video: string;
    images: string;
    price: string;
    duration: string;
    rating: string;
    releaseDate: string;
    reviews: string;
    performers: string;
    genres: string;
    availableOn: string;
    comparisonChart: string;
    radarChart: string;
    durationShort: string;
    barComparison: string;
    priceLowerBetter: string;
    commonFeatures: string;
    hours: string;
    minutes: string;
    reviewCount: string;
  }
> = {
  ja: {
    compareProducts: '作品を比較しましょう',
    selectAtLeast2: '2作品以上を選択すると比較できます',
    loadingComparison: '比較データを読み込み中...',
    bestPrice: '最安値',
    onSale: 'セール中',
    topRated: '高評価',
    longest: '長尺',
    video: '動画',
    images: '画像',
    price: '価格',
    duration: '再生時間',
    rating: '評価',
    releaseDate: '発売日',
    reviews: 'レビュー',
    performers: '出演者',
    genres: 'ジャンル',
    availableOn: '配信サイト',
    comparisonChart: '比較グラフ',
    radarChart: 'レーダーチャート',
    durationShort: '時間',
    barComparison: '棒グラフ比較',
    priceLowerBetter: '価格（安いほど高評価）',
    commonFeatures: '共通点',
    hours: '時間',
    minutes: '分',
    reviewCount: '件',
  },
  en: {
    compareProducts: 'Compare Products',
    selectAtLeast2: 'Select at least 2 products to compare',
    loadingComparison: 'Loading comparison...',
    bestPrice: 'Best Price',
    onSale: 'On Sale',
    topRated: 'Top Rated',
    longest: 'Longest',
    video: 'Video',
    images: 'Images',
    price: 'Price',
    duration: 'Duration',
    rating: 'Rating',
    releaseDate: 'Release',
    reviews: 'Reviews',
    performers: 'Performers',
    genres: 'Genres',
    availableOn: 'Available on',
    comparisonChart: 'Comparison Chart',
    radarChart: 'Radar Chart',
    durationShort: 'Duration',
    barComparison: 'Bar Comparison',
    priceLowerBetter: 'Price (lower is better)',
    commonFeatures: 'Common Features',
    hours: 'h ',
    minutes: 'min',
    reviewCount: '',
  },
  'zh-TW': {
    compareProducts: '比較作品',
    selectAtLeast2: '選擇2部以上作品即可比較',
    loadingComparison: '載入比較資料中...',
    bestPrice: '最低價',
    onSale: '促銷中',
    topRated: '高評價',
    longest: '長片',
    video: '影片',
    images: '圖片',
    price: '價格',
    duration: '播放時間',
    rating: '評價',
    releaseDate: '發售日',
    reviews: '評論',
    performers: '演員',
    genres: '類型',
    availableOn: '上架平台',
    comparisonChart: '比較圖表',
    radarChart: '雷達圖',
    durationShort: '時間',
    barComparison: '長條圖比較',
    priceLowerBetter: '價格（越低越好）',
    commonFeatures: '共同點',
    hours: '小時',
    minutes: '分',
    reviewCount: '則',
  },
} as const;

export const priceAlertTranslations: Record<
  Locale | string,
  {
    removeAlert: string;
    setAlert: string;
    description: string;
    currentPrice: string;
    targetPrice: string;
    placeholder: string;
    cancel: string;
    submit: string;
  }
> = {
  ja: {
    removeAlert: 'アラート解除',
    setAlert: '価格アラート設定',
    description: '指定した価格以下になったらお知らせします。',
    currentPrice: '現在の価格: ',
    targetPrice: '目標価格 (円)',
    placeholder: '例: 1000',
    cancel: 'キャンセル',
    submit: '設定する',
  },
  en: {
    removeAlert: 'Remove alert',
    setAlert: 'Set Price Alert',
    description: 'We will notify you when the price drops below your target.',
    currentPrice: 'Current price: ',
    targetPrice: 'Target price (¥)',
    placeholder: 'e.g. 1000',
    cancel: 'Cancel',
    submit: 'Set Alert',
  },
  'zh-TW': {
    removeAlert: '取消提醒',
    setAlert: '設定價格提醒',
    description: '當價格降至指定金額以下時通知您。',
    currentPrice: '目前價格：',
    targetPrice: '目標價格 (日圓)',
    placeholder: '例如: 1000',
    cancel: '取消',
    submit: '設定',
  },
} as const;

export const salePredictionTranslations: Record<
  Locale | string,
  {
    salePrediction: string;
    description: string;
    probability: string;
    in30Days: string;
    in90Days: string;
    typicalDiscount: string;
    nextLikelySale: string;
    nextYear: string;
    around: string;
    monthNames: string[];
    times: string;
    historicalSales: string;
    noHistory: string;
    avgDuration: string;
    days: string;
    waitRecommended: string;
    buyNow: string;
    uncertain: string;
    loading: string;
  }
> = {
  ja: {
    salePrediction: 'セール予測',
    description: '過去のセールパターンに基づく予測',
    probability: 'セール確率',
    in30Days: '30日以内',
    in90Days: '90日以内',
    typicalDiscount: '平均割引率',
    nextLikelySale: '次回セール予想',
    nextYear: '来年',
    around: '頃',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    times: '回',
    historicalSales: '過去のセール履歴',
    noHistory: 'セール履歴がありません',
    avgDuration: '平均セール期間',
    days: '日',
    waitRecommended: '待つのがおすすめ',
    buyNow: '今が買い時',
    uncertain: '予測困難',
    loading: '予測中...',
  },
  en: {
    salePrediction: 'Sale Prediction',
    description: 'Based on historical sale patterns',
    probability: 'Sale probability',
    in30Days: 'Within 30 days',
    in90Days: 'Within 90 days',
    typicalDiscount: 'Typical discount',
    nextLikelySale: 'Next likely sale',
    nextYear: 'Next year',
    around: '',
    monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    times: 'times',
    historicalSales: 'Historical sales',
    noHistory: 'No sale history',
    avgDuration: 'Avg sale duration',
    days: 'days',
    waitRecommended: 'Wait recommended',
    buyNow: 'Good time to buy',
    uncertain: 'Uncertain',
    loading: 'Predicting...',
  },
  zh: {
    salePrediction: '促销预测',
    description: '基于历史促销模式',
    probability: '促销概率',
    in30Days: '30天内',
    in90Days: '90天内',
    typicalDiscount: '平均折扣',
    nextLikelySale: '下次预计促销',
    nextYear: '明年',
    around: '左右',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    times: '次',
    historicalSales: '历史促销记录',
    noHistory: '暂无促销记录',
    avgDuration: '平均促销时长',
    days: '天',
    waitRecommended: '建议等待',
    buyNow: '现在购买合适',
    uncertain: '难以预测',
    loading: '预测中...',
  },
  'zh-TW': {
    salePrediction: '促銷預測',
    description: '基於歷史促銷模式',
    probability: '促銷機率',
    in30Days: '30天內',
    in90Days: '90天內',
    typicalDiscount: '平均折扣',
    nextLikelySale: '下次預計促銷',
    nextYear: '明年',
    around: '左右',
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    times: '次',
    historicalSales: '歷史促銷紀錄',
    noHistory: '暫無促銷紀錄',
    avgDuration: '平均促銷時長',
    days: '天',
    waitRecommended: '建議等待',
    buyNow: '現在購買合適',
    uncertain: '難以預測',
    loading: '預測中...',
  },
  ko: {
    salePrediction: '세일 예측',
    description: '과거 세일 패턴 기반',
    probability: '세일 확률',
    in30Days: '30일 이내',
    in90Days: '90일 이내',
    typicalDiscount: '평균 할인율',
    nextLikelySale: '다음 예상 세일',
    nextYear: '내년',
    around: '경',
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    times: '회',
    historicalSales: '과거 세일 이력',
    noHistory: '세일 이력 없음',
    avgDuration: '평균 세일 기간',
    days: '일',
    waitRecommended: '기다리는 것이 좋음',
    buyNow: '지금이 구매 적기',
    uncertain: '예측 어려움',
    loading: '예측 중...',
  },
} as const;
