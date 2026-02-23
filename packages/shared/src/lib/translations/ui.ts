/**
 * UI component translations.
 * Extracted from shared UI components for centralized maintenance.
 */

// ============================================================
// BulkActionBar
// ============================================================
export const bulkActionBarTranslations = {
  ja: {
    selected: '件選択中',
    selectAll: 'すべて選択',
    clearSelection: '選択解除',
    processing: '処理中...',
  },
  en: {
    selected: ' selected',
    selectAll: 'Select all',
    clearSelection: 'Clear selection',
    processing: 'Processing...',
  },
  'zh-TW': {
    selected: ' 已選取',
    selectAll: '全部選取',
    clearSelection: '取消選取',
    processing: '處理中...',
  },
} as const;

// ============================================================
// CompareButton
// ============================================================
export const compareButtonTranslations = {
  ja: {
    addToCompare: '比較に追加',
    removeFromCompare: '比較から削除',
    added: '比較リストに追加しました',
    removed: '比較リストから削除しました',
    checkBottom: '画面下部で比較できます',
    compareFull: (maxItems: number) => `比較リストが満杯（${maxItems}件）`,
  },
  en: {
    addToCompare: 'Add to compare',
    removeFromCompare: 'Remove from compare',
    added: 'Added to compare list',
    removed: 'Removed from compare list',
    checkBottom: 'Compare at the bottom of screen',
    compareFull: (maxItems: number) => `Compare list full (${maxItems} items)`,
  },
  'zh-TW': {
    addToCompare: '加入比較',
    removeFromCompare: '從比較移除',
    added: '已加入比較清單',
    removed: '已從比較清單移除',
    checkBottom: '在畫面底部進行比較',
    compareFull: (maxItems: number) => `比較清單已滿（${maxItems}件）`,
  },
};

// ============================================================
// CompareFloatingBar
// ============================================================
export const compareFloatingBarTranslations = {
  ja: {
    compare: '比較する',
    clearAll: 'クリア',
    items: '件',
    hint: '「比較する」ボタンで比較ページへ',
    compareReady: '比較できます！',
    addMore: (remaining: number) => `あと${remaining}件追加可能`,
  },
  en: {
    compare: 'Compare',
    clearAll: 'Clear',
    items: 'items',
    hint: 'Click "Compare" to view comparison',
    compareReady: 'Ready to compare!',
    addMore: (remaining: number) => `${remaining} more can be added`,
  },
  'zh-TW': {
    compare: '比較',
    clearAll: '清除',
    items: '件',
    hint: '點擊「比較」前往比較頁面',
    compareReady: '可以比較了！',
    addMore: (remaining: number) => `還可新增${remaining}件`,
  },
};

// ============================================================
// CookieConsent
// ============================================================
export const cookieConsentTranslations = {
  ja: {
    message: '当サイトでは、サイトの利用状況を把握するためにGoogle Analyticsを使用しています。',
    accept: '同意する',
    decline: '拒否する',
    learnMore: '詳細',
  },
  en: {
    message: 'This site uses Google Analytics to understand how the site is used.',
    accept: 'Accept',
    decline: 'Decline',
    learnMore: 'Learn more',
  },
  zh: {
    message: '本站使用Google Analytics来了解网站的使用情况。',
    accept: '同意',
    decline: '拒绝',
    learnMore: '了解更多',
  },
  'zh-TW': {
    message: '本站使用 Google Analytics 來了解網站的使用情況。',
    accept: '同意',
    decline: '拒絕',
    learnMore: '了解更多',
  },
  ko: {
    message: '이 사이트는 Google Analytics를 사용하여 사이트 이용 현황을 파악합니다.',
    accept: '동의',
    decline: '거부',
    learnMore: '자세히',
  },
} as const;

// ============================================================
// FilterSortBar
// ============================================================
export const filterSortBarTranslations = {
  ja: {
    filter: 'フィルター',
    clear: 'クリア',
    sort: '並び替え',
    releaseDateDesc: 'リリース日（新しい順）',
    releaseDateAsc: 'リリース日（古い順）',
    priceDesc: '価格（高い順）',
    priceAsc: '価格（安い順）',
    ratingDesc: '評価（高い順）',
    ratingAsc: '評価（低い順）',
    titleAsc: 'タイトル（あいうえお順）',
    distributionService: '配信サービス',
    priceRange: '価格帯',
    priceAbove: '以上',
  },
  en: {
    filter: 'Filter',
    clear: 'Clear',
    sort: 'Sort',
    releaseDateDesc: 'Release Date (Newest)',
    releaseDateAsc: 'Release Date (Oldest)',
    priceDesc: 'Price (High to Low)',
    priceAsc: 'Price (Low to High)',
    ratingDesc: 'Rating (High to Low)',
    ratingAsc: 'Rating (Low to High)',
    titleAsc: 'Title (A-Z)',
    distributionService: 'Distribution Service',
    priceRange: 'Price Range',
    priceAbove: 'and above',
  },
  zh: {
    filter: '筛选',
    clear: '清除',
    sort: '排序',
    releaseDateDesc: '发布日期（最新）',
    releaseDateAsc: '发布日期（最早）',
    priceDesc: '价格（从高到低）',
    priceAsc: '价格（从低到高）',
    ratingDesc: '评分（从高到低）',
    ratingAsc: '评分（从低到高）',
    titleAsc: '标题（A-Z）',
    distributionService: '分发服务',
    priceRange: '价格范围',
    priceAbove: '以上',
  },
  'zh-TW': {
    filter: '篩選',
    clear: '清除',
    sort: '排序',
    releaseDateDesc: '發布日期（最新）',
    releaseDateAsc: '發布日期（最早）',
    priceDesc: '價格（從高到低）',
    priceAsc: '價格（從低到高）',
    ratingDesc: '評分（從高到低）',
    ratingAsc: '評分（從低到高）',
    titleAsc: '標題（A-Z）',
    distributionService: '配信服務',
    priceRange: '價格範圍',
    priceAbove: '以上',
  },
  ko: {
    filter: '필터',
    clear: '지우기',
    sort: '정렬',
    releaseDateDesc: '출시일 (최신순)',
    releaseDateAsc: '출시일 (오래된순)',
    priceDesc: '가격 (높은순)',
    priceAsc: '가격 (낮은순)',
    ratingDesc: '평점 (높은순)',
    ratingAsc: '평점 (낮은순)',
    titleAsc: '제목 (가나다순)',
    distributionService: '배포 서비스',
    priceRange: '가격대',
    priceAbove: '이상',
  },
} as const;

// ============================================================
// FilterPresetManager (default translations for prop-based system)
// ============================================================
export const filterPresetManagerDefaults = {
  savedFilters: '保存済みフィルター',
  saveCurrentFilter: '現在のフィルターを保存',
  presetName: 'プリセット名',
  save: '保存',
  cancel: 'キャンセル',
  apply: '適用',
  delete: '削除',
  noPresets: '保存されたフィルターはありません',
  maxPresetsReached: '最大10件まで保存できます',
} as const;

// ============================================================
// HomeSectionManager
// ============================================================
export const homeSectionManagerTranslations = {
  ja: {
    defaultTitle: 'セクションをカスタマイズ',
    description: 'セクションの表示/非表示と順序を変更できます',
    reset: 'リセット',
    close: '閉じる',
    dragHint: 'ドラッグして並び替え',
  },
  en: {
    defaultTitle: 'Customize Sections',
    description: 'Show/hide and reorder sections',
    reset: 'Reset',
    close: 'Close',
    dragHint: 'Drag to reorder',
  },
  'zh-TW': {
    defaultTitle: '自訂區塊',
    description: '顯示/隱藏及調整區塊順序',
    reset: '重設',
    close: '關閉',
    dragHint: '拖曳以重新排序',
  },
} as const;

// ============================================================
// InitialSearchMenu
// ============================================================
export const initialSearchMenuTranslations = {
  ja: {
    etc: 'その他',
  },
  en: {
    etc: 'Others',
  },
  zh: {
    etc: '其他',
  },
  'zh-TW': {
    etc: '其他',
  },
  ko: {
    etc: '기타',
  },
} as const;

// ============================================================
// OfflineIndicator
// ============================================================
export const offlineIndicatorTranslations = {
  ja: {
    offline: 'オフラインです',
    reconnecting: '再接続中...',
    backOnline: 'オンラインに復帰しました',
  },
  en: {
    offline: "You're offline",
    reconnecting: 'Reconnecting...',
    backOnline: 'Back online',
  },
  zh: {
    offline: '您已离线',
    reconnecting: '重新连接中...',
    backOnline: '已恢复在线',
  },
  'zh-TW': {
    offline: '您已離線',
    reconnecting: '重新連線中...',
    backOnline: '已恢復連線',
  },
  ko: {
    offline: '오프라인 상태입니다',
    reconnecting: '재연결 중...',
    backOnline: '온라인으로 복귀했습니다',
  },
} as const;

// ============================================================
// Pagination
// ============================================================
export const paginationTranslations = {
  ja: {
    first: '最初',
    prev: '前へ',
    next: '次へ',
    last: '最後',
    items: '件',
    page: 'ページ',
    goToPage: 'ページへ移動',
    inputPlaceholder: 'ページ番号',
    go: '移動',
    jumpBack: '-10',
    jumpForward: '+10',
  },
  en: {
    first: 'First',
    prev: 'Prev',
    next: 'Next',
    last: 'Last',
    items: 'items',
    page: 'page',
    goToPage: 'Go to page',
    inputPlaceholder: 'Page #',
    go: 'Go',
    jumpBack: '-10',
    jumpForward: '+10',
  },
  zh: {
    first: '首页',
    prev: '上一页',
    next: '下一页',
    last: '末页',
    items: '条',
    page: '页',
    goToPage: '跳转到',
    inputPlaceholder: '页码',
    go: '跳转',
    jumpBack: '-10',
    jumpForward: '+10',
  },
  'zh-TW': {
    first: '首頁',
    prev: '上一頁',
    next: '下一頁',
    last: '末頁',
    items: '筆',
    page: '頁',
    goToPage: '跳至',
    inputPlaceholder: '頁碼',
    go: '前往',
    jumpBack: '-10',
    jumpForward: '+10',
  },
  ko: {
    first: '처음',
    prev: '이전',
    next: '다음',
    last: '마지막',
    items: '건',
    page: '페이지',
    goToPage: '페이지로 이동',
    inputPlaceholder: '페이지 번호',
    go: '이동',
    jumpBack: '-10',
    jumpForward: '+10',
  },
} as const;

// ============================================================
// PWAInstallerBase
// ============================================================
export const pwaInstallerTranslations = {
  ja: {
    title: 'アプリをインストール',
    description: 'ホーム画面に追加して、より快適にご利用いただけます。',
    install: 'インストール',
    later: '後で',
    close: '閉じる',
  },
  en: {
    title: 'Install App',
    description: 'Add to home screen for a better experience.',
    install: 'Install',
    later: 'Later',
    close: 'Close',
  },
  zh: {
    title: '安装应用',
    description: '添加到主屏幕以获得更好的体验。',
    install: '安装',
    later: '稍后',
    close: '关闭',
  },
  'zh-TW': {
    title: '安裝應用程式',
    description: '加入主畫面以獲得更佳體驗。',
    install: '安裝',
    later: '稍後',
    close: '關閉',
  },
  ko: {
    title: '앱 설치',
    description: '홈 화면에 추가하여 더 나은 경험을 즐기세요.',
    install: '설치',
    later: '나중에',
    close: '닫기',
  },
} as const;

// ============================================================
// PageSectionNav
// ============================================================
export const pageSectionNavTranslations = {
  ja: {
    sale: 'セール中',
    recentlyViewed: '最近見た作品',
    recommendations: 'おすすめ',
    weeklyHighlights: '今週の注目',
    trending: 'トレンド分析',
    allProducts: '全作品一覧',
  },
  en: {
    sale: 'On Sale',
    recentlyViewed: 'Recently Viewed',
    recommendations: 'For You',
    weeklyHighlights: 'This Week',
    trending: 'Trending',
    allProducts: 'All Products',
  },
  zh: {
    sale: '特卖',
    recentlyViewed: '最近浏览',
    recommendations: '推荐',
    weeklyHighlights: '本周热门',
    trending: '趋势',
    allProducts: '全部作品',
  },
  'zh-TW': {
    sale: '特賣',
    recentlyViewed: '最近瀏覽',
    recommendations: '推薦',
    weeklyHighlights: '本週熱門',
    trending: '趨勢',
    allProducts: '全部作品',
  },
  ko: {
    sale: '세일',
    recentlyViewed: '최근 본 작품',
    recommendations: '추천',
    weeklyHighlights: '이번 주',
    trending: '트렌드',
    allProducts: '전체 작품',
  },
} as const;

// ============================================================
// SearchFilters (SearchFiltersBase)
// ============================================================
export const searchFiltersTranslations = {
  ja: {
    filter: 'フィルター',
    clear: 'クリア',
    sortBy: '並び替え',
    providers: '配信元',
    releaseDate: '発売日',
    hasVideo: 'サンプル動画あり',
    hasImage: 'サンプル画像あり',
  },
  en: {
    filter: 'Filters',
    clear: 'Clear',
    sortBy: 'Sort by',
    providers: 'Providers',
    releaseDate: 'Release Date',
    hasVideo: 'Has sample video',
    hasImage: 'Has sample images',
  },
  zh: {
    filter: '筛选',
    clear: '清除',
    sortBy: '排序',
    providers: '来源',
    releaseDate: '发行日期',
    hasVideo: '有样品视频',
    hasImage: '有样品图片',
  },
  'zh-TW': {
    filter: '篩選',
    clear: '清除',
    sortBy: '排序',
    providers: '來源',
    releaseDate: '發行日期',
    hasVideo: '有範例影片',
    hasImage: '有範例圖片',
  },
  ko: {
    filter: '필터',
    clear: '지우기',
    sortBy: '정렬',
    providers: '제공자',
    releaseDate: '발매일',
    hasVideo: '샘플 동영상 있음',
    hasImage: '샘플 이미지 있음',
  },
} as const;

// ============================================================
// UnifiedSearchBar
// ============================================================
export const unifiedSearchTranslations = {
  ja: {
    placeholder: '作品・女優・画像で検索...',
    productPlaceholder: '作品名・ID・説明文で検索',
    actressPlaceholder: '女優名・プロフィールで検索',
    imagePlaceholder: '画像URLを貼り付けて類似検索',
    aiPlaceholder: '自然言語で検索（例：明るい雰囲気の巨乳作品）',
    shortcutHint: '/',
    clear: 'クリア',
    modeProduct: '作品',
    modeActress: '女優',
    modeImage: '画像',
    modeAi: 'AI',
    search: '検索',
    dropImageHint: '画像をドロップまたはURLを貼り付け',
    aiAnalyzing: 'AIが解析中...',
  },
  en: {
    placeholder: 'Search products, actresses, images...',
    productPlaceholder: 'Search by title, ID, description',
    actressPlaceholder: 'Search by actress name, profile',
    imagePlaceholder: 'Paste image URL for similar search',
    aiPlaceholder: 'Search with natural language (e.g., busty with bright atmosphere)',
    shortcutHint: '/',
    clear: 'Clear',
    modeProduct: 'Product',
    modeActress: 'Actress',
    modeImage: 'Image',
    modeAi: 'AI',
    search: 'Search',
    dropImageHint: 'Drop image or paste URL',
    aiAnalyzing: 'AI analyzing...',
  },
  zh: {
    placeholder: '搜索作品、女优、图片...',
    productPlaceholder: '按标题、ID、描述搜索',
    actressPlaceholder: '按女优名、简介搜索',
    imagePlaceholder: '粘贴图片URL进行相似搜索',
    aiPlaceholder: '用自然语言搜索（例：氛围明亮的巨乳作品）',
    shortcutHint: '/',
    clear: '清除',
    modeProduct: '作品',
    modeActress: '女优',
    modeImage: '图片',
    modeAi: 'AI',
    search: '搜索',
    dropImageHint: '拖放图片或粘贴URL',
    aiAnalyzing: 'AI分析中...',
  },
  'zh-TW': {
    placeholder: '搜尋作品、女優、圖片...',
    productPlaceholder: '依標題、ID、描述搜尋',
    actressPlaceholder: '依女優名、簡介搜尋',
    imagePlaceholder: '貼上圖片網址進行相似搜尋',
    aiPlaceholder: '用自然語言搜尋（例：氣氛明亮的巨乳作品）',
    shortcutHint: '/',
    clear: '清除',
    modeProduct: '作品',
    modeActress: '女優',
    modeImage: '圖片',
    modeAi: 'AI',
    search: '搜尋',
    dropImageHint: '拖放圖片或貼上網址',
    aiAnalyzing: 'AI分析中...',
  },
  ko: {
    placeholder: '작품, 여배우, 이미지 검색...',
    productPlaceholder: '제목, ID, 설명으로 검색',
    actressPlaceholder: '여배우 이름, 프로필로 검색',
    imagePlaceholder: '이미지 URL을 붙여넣어 유사 검색',
    aiPlaceholder: '자연어로 검색 (예: 밝은 분위기의 거유 작품)',
    shortcutHint: '/',
    clear: '지우기',
    modeProduct: '작품',
    modeActress: '여배우',
    modeImage: '이미지',
    modeAi: 'AI',
    search: '검색',
    dropImageHint: '이미지를 드롭하거나 URL을 붙여넣기',
    aiAnalyzing: 'AI 분석 중...',
  },
} as const;

// ============================================================
// SearchBarBase
// ============================================================
export const searchBarTranslations = {
  ja: {
    actressPlaceholder: '女優名・プロフィールで検索...',
    productPlaceholder: '作品名・作品ID・説明文で検索...',
    aiPlaceholder: 'AIに聞く：「巨乳の人妻作品」など自然な言葉で...',
    shortcutHint: 'Ctrl+K',
    clear: 'クリア',
    aiMode: 'AI',
    normalMode: '通常',
    aiAnalyzing: 'AI解析中...',
  },
  en: {
    actressPlaceholder: 'Search by actress name or profile...',
    productPlaceholder: 'Search by title, product ID, or description...',
    aiPlaceholder: 'Ask AI: "busty married woman videos" etc...',
    shortcutHint: 'Ctrl+K',
    clear: 'Clear',
    aiMode: 'AI',
    normalMode: 'Normal',
    aiAnalyzing: 'AI analyzing...',
  },
  zh: {
    actressPlaceholder: '按女优名称或简介搜索...',
    productPlaceholder: '按标题、产品ID或描述搜索...',
    aiPlaceholder: '问AI："巨乳人妻作品"等自然语言...',
    shortcutHint: 'Ctrl+K',
    clear: '清除',
    aiMode: 'AI',
    normalMode: '普通',
    aiAnalyzing: 'AI分析中...',
  },
  'zh-TW': {
    actressPlaceholder: '依女優名稱或簡介搜尋...',
    productPlaceholder: '依標題、產品ID或描述搜尋...',
    aiPlaceholder: '問AI：「巨乳人妻作品」等自然語言...',
    shortcutHint: 'Ctrl+K',
    clear: '清除',
    aiMode: 'AI',
    normalMode: '一般',
    aiAnalyzing: 'AI分析中...',
  },
  ko: {
    actressPlaceholder: '여배우 이름 또는 프로필로 검색...',
    productPlaceholder: '제목, 제품 ID 또는 설명으로 검색...',
    aiPlaceholder: 'AI에게 물어보세요: "거유 유부녀 작품" 등...',
    shortcutHint: 'Ctrl+K',
    clear: '지우기',
    aiMode: 'AI',
    normalMode: '일반',
    aiAnalyzing: 'AI 분석 중...',
  },
} as const;

// ============================================================
// SortDropdown
// ============================================================
export const sortDropdownTranslations = {
  ja: {
    sortLabel: '並び順:',
    nameAsc: '名前順（あ→ん）',
    nameDesc: '名前順（ん→あ）',
    productCountDesc: '作品数順（多い順）',
    productCountAsc: '作品数順（少ない順）',
    recent: '新着順',
  },
  en: {
    sortLabel: 'Sort:',
    nameAsc: 'Name (A-Z)',
    nameDesc: 'Name (Z-A)',
    productCountDesc: 'Most Videos',
    productCountAsc: 'Least Videos',
    recent: 'Recently Added',
  },
  zh: {
    sortLabel: '排序:',
    nameAsc: '名称 (A→Z)',
    nameDesc: '名称 (Z→A)',
    productCountDesc: '作品数（多到少）',
    productCountAsc: '作品数（少到多）',
    recent: '最新添加',
  },
  'zh-TW': {
    sortLabel: '排序:',
    nameAsc: '名稱 (A→Z)',
    nameDesc: '名稱 (Z→A)',
    productCountDesc: '作品數（多到少）',
    productCountAsc: '作品數（少到多）',
    recent: '最新新增',
  },
  ko: {
    sortLabel: '정렬:',
    nameAsc: '이름순 (가→하)',
    nameDesc: '이름순 (하→가)',
    productCountDesc: '작품 수 (많은순)',
    productCountAsc: '작품 수 (적은순)',
    recent: '최신 추가순',
  },
} as const;

// ============================================================
// ProductSectionNav
// ============================================================
export const productSectionNavTranslations = {
  ja: {
    info: '商品情報',
    video: 'サンプル動画',
    prices: '価格比較',
    value: 'コスパ分析',
    aiReview: 'AIレビュー',
    scenes: 'シーン情報',
    performer: '出演者の他作品',
    series: 'シリーズ作品',
    maker: 'メーカー作品',
    similar: '類似ネットワーク',
    alsoViewed: 'この作品を見た人',
  },
  en: {
    info: 'Info',
    video: 'Video',
    prices: 'Prices',
    value: 'Value',
    aiReview: 'AI Review',
    scenes: 'Scenes',
    performer: 'More by Actress',
    series: 'Series',
    maker: 'Maker',
    similar: 'Similar',
    alsoViewed: 'Also Viewed',
  },
  'zh-TW': {
    info: '商品資訊',
    video: '範例影片',
    prices: '價格比較',
    value: '性價比分析',
    aiReview: 'AI評價',
    scenes: '場景資訊',
    performer: '演員其他作品',
    series: '系列作品',
    maker: '廠商作品',
    similar: '相似網路',
    alsoViewed: '看過此作品的人',
  },
} as const;

// ============================================================
// ProductListSectionNav
// ============================================================
export const productListSectionNavTranslations = {
  ja: { onSale: 'セール中', products: '商品一覧' },
  en: { onSale: 'On Sale', products: 'Products' },
  'zh-TW': { onSale: '特賣中', products: '商品列表' },
} as const;

// ============================================================
// ProductListWithSelection
// ============================================================
export const productListWithSelectionTranslations = {
  ja: {
    selectToCompare: '比較選択モード',
    exitSelection: '選択終了',
    selected: '選択中',
    maxReachedPrefix: '最大',
    maxReachedSuffix: '件まで選択可能',
  },
  en: {
    selectToCompare: 'Select to Compare',
    exitSelection: 'Exit Selection',
    selected: 'Selected',
    maxReachedPrefix: 'Max ',
    maxReachedSuffix: ' items',
  },
  zh: {
    selectToCompare: '比较选择模式',
    exitSelection: '结束选择',
    selected: '已选择',
    maxReachedPrefix: '最多',
    maxReachedSuffix: '件可选',
  },
  'zh-TW': {
    selectToCompare: '比較選擇模式',
    exitSelection: '結束選擇',
    selected: '已選擇',
    maxReachedPrefix: '最多',
    maxReachedSuffix: '件可選',
  },
  ko: {
    selectToCompare: '비교 선택 모드',
    exitSelection: '선택 종료',
    selected: '선택 중',
    maxReachedPrefix: '최대 ',
    maxReachedSuffix: '건까지 선택 가능',
  },
} as const;

// ============================================================
// FooterBase
// ============================================================
export const footerTranslations = {
  ja: {
    popularGenres: '人気ジャンル',
    discoverContent: 'コンテンツを探す',
    todaysPick: '今日の1本',
    birthdays: '誕生日カレンダー',
    annualBest: '年間ベスト',
    weeklyTrends: '週間トレンド',
    rookies: '新人デビュー',
    hiddenGems: '隠れた名作',
    aiSearch: 'AI検索',
    discover: '発見',
    community: 'コミュニティ',
    publicLists: '公開リスト',
    listRankings: 'リストランキング',
    reviewers: 'レビュアー',
    voteRankings: 'ランキング投票',
    statistics: '統計',
    legalCompliance: '法的コンプライアンス',
    popularSeries: '人気シリーズ',
    popularMakers: '人気メーカー',
  },
  en: {
    popularGenres: 'Popular Genres',
    discoverContent: 'Discover Content',
    todaysPick: "Today's Pick",
    birthdays: 'Birthdays',
    annualBest: 'Annual Best',
    weeklyTrends: 'Weekly Trends',
    rookies: 'Rookies',
    hiddenGems: 'Hidden Gems',
    aiSearch: 'AI Search',
    discover: 'Discover',
    community: 'Community',
    publicLists: 'Public Lists',
    listRankings: 'List Rankings',
    reviewers: 'Reviewers',
    voteRankings: 'Vote Rankings',
    statistics: 'Statistics',
    legalCompliance: 'Legal Compliance',
    popularSeries: 'Popular Series',
    popularMakers: 'Popular Studios',
  },
  'zh-TW': {
    popularGenres: '熱門類型',
    discoverContent: '探索內容',
    todaysPick: '今日精選',
    birthdays: '生日日曆',
    annualBest: '年度最佳',
    weeklyTrends: '每週趨勢',
    rookies: '新人出道',
    hiddenGems: '隱藏佳作',
    aiSearch: 'AI搜尋',
    discover: '發現',
    community: '社群',
    publicLists: '公開清單',
    listRankings: '清單排行',
    reviewers: '評論者',
    voteRankings: '排行投票',
    statistics: '統計',
    legalCompliance: '法律合規',
    popularSeries: '熱門系列',
    popularMakers: '熱門廠商',
  },
} as const;
