import { Metadata } from 'next';

// サイト設定（各サイトで上書き可能）
let siteConfig = {
  siteName: 'Adult Viewer Lab',
  alternateName: 'アダルトビューアーラボ',
  defaultDescription: '複数のプラットフォームを横断し、ヘビー視聴者向けに女優・ジャンル別のレビュー、ランキング、キャンペーン速報を届けるアフィリエイトサイト。',
};

/**
 * サイト設定を更新
 */
export function setSeoConfig(config: Partial<typeof siteConfig>) {
  siteConfig = { ...siteConfig, ...config };
}

/**
 * 現在のサイト設定を取得
 */
export function getSeoConfig() {
  return { ...siteConfig };
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';

/**
 * SEO最適化されたメタディスクリプションを生成（150-160文字に制限）
 * セール商品や高評価商品は優先的に表示してCTR向上
 */
export function generateOptimizedDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  releaseDate?: string,
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    duration?: number;
    provider?: string;
    locale?: string;
  },
): string {
  const locale = options?.locale || 'ja';

  // ロケール別テンプレート
  switch (locale) {
    case 'ja':
      return generateJapaneseProductDescription(title, actressName, tags, productId, options);
    case 'en':
      return generateEnglishProductDescription(title, actressName, tags, productId, options);
    case 'zh':
    case 'zh-TW':
      return generateChineseProductDescription(title, actressName, tags, productId, options, locale);
    case 'ko':
      return generateKoreanProductDescription(title, actressName, tags, productId, options);
    default:
      return generateEnglishProductDescription(title, actressName, tags, productId, options);
  }
}

/**
 * 日本語商品ページ用CTR最適化ディスクリプション
 */
function generateJapaneseProductDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    duration?: number;
    provider?: string;
  },
): string {
  const parts: string[] = [];

  // セール時は割引を最優先
  if (options?.discount && options.discount > 0) {
    parts.push(`【${options.discount}%OFF】`);
  }

  // 品番（検索ヒット用）
  if (productId) {
    parts.push(productId);
  }

  // タイトル（短縮）
  if (title) {
    const maxLen = options?.discount ? 30 : 40;
    parts.push(title.length > maxLen ? title.substring(0, maxLen) + '…' : title);
  }

  // 女優名
  if (actressName) {
    parts.push(`${actressName}出演`);
  }

  // 時間
  if (options?.duration && options.duration > 0) {
    parts.push(`${options.duration}分`);
  }

  // プロバイダー + アクション誘導
  if (options?.provider) {
    parts.push(`${options.provider}で今すぐ視聴`);
  }

  // 評価（高評価のみ）
  if (options?.rating && options.rating >= 4.0 && options?.reviewCount && options.reviewCount >= 3) {
    parts.push(`★${options.rating.toFixed(1)}評価`);
  }

  const description = parts.join(' - ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

/**
 * 英語商品ページ用CTR最適化ディスクリプション
 */
function generateEnglishProductDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    duration?: number;
    provider?: string;
  },
): string {
  const parts: string[] = [];

  // Sale first for CTR
  if (options?.discount && options.discount > 0) {
    parts.push(`[${options.discount}% OFF]`);
  }

  // Product code for search
  if (productId) {
    parts.push(productId);
  }

  // Title (shortened)
  if (title) {
    const maxLen = options?.discount ? 30 : 40;
    parts.push(title.length > maxLen ? title.substring(0, maxLen) + '…' : title);
  }

  // Actress
  if (actressName) {
    parts.push(`feat. ${actressName}`);
  }

  // Duration
  if (options?.duration && options.duration > 0) {
    parts.push(`${options.duration}min`);
  }

  // Provider + CTA
  if (options?.provider) {
    parts.push(`Watch now on ${options.provider}`);
  }

  // Rating (only high)
  if (options?.rating && options.rating >= 4.0 && options?.reviewCount && options.reviewCount >= 3) {
    parts.push(`★${options.rating.toFixed(1)}`);
  }

  const description = parts.join(' - ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

/**
 * 中国語商品ページ用CTR最適化ディスクリプション
 */
function generateChineseProductDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    duration?: number;
    provider?: string;
  },
  locale: string = 'zh',
): string {
  const parts: string[] = [];
  const isTraditional = locale === 'zh-TW';

  // Sale first
  if (options?.discount && options.discount > 0) {
    parts.push(isTraditional ? `【${options.discount}%折扣】` : `【${options.discount}%优惠】`);
  }

  // Product code
  if (productId) {
    parts.push(productId);
  }

  // Title
  if (title) {
    const maxLen = options?.discount ? 25 : 35;
    parts.push(title.length > maxLen ? title.substring(0, maxLen) + '…' : title);
  }

  // Actress
  if (actressName) {
    parts.push(isTraditional ? `${actressName}出演` : `${actressName}出演`);
  }

  // Duration
  if (options?.duration && options.duration > 0) {
    parts.push(`${options.duration}${isTraditional ? '分鐘' : '分钟'}`);
  }

  // Provider + CTA
  if (options?.provider) {
    parts.push(isTraditional ? `立即在${options.provider}觀看` : `立即在${options.provider}观看`);
  }

  // Rating
  if (options?.rating && options.rating >= 4.0 && options?.reviewCount && options.reviewCount >= 3) {
    parts.push(`★${options.rating.toFixed(1)}`);
  }

  const description = parts.join(' - ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

/**
 * 韓国語商品ページ用CTR最適化ディスクリプション
 */
function generateKoreanProductDescription(
  title: string,
  actressName?: string,
  tags?: string[],
  productId?: string,
  options?: {
    salePrice?: number;
    regularPrice?: number;
    discount?: number;
    rating?: number;
    reviewCount?: number;
    duration?: number;
    provider?: string;
  },
): string {
  const parts: string[] = [];

  // Sale first
  if (options?.discount && options.discount > 0) {
    parts.push(`[${options.discount}% 할인]`);
  }

  // Product code
  if (productId) {
    parts.push(productId);
  }

  // Title
  if (title) {
    const maxLen = options?.discount ? 25 : 35;
    parts.push(title.length > maxLen ? title.substring(0, maxLen) + '…' : title);
  }

  // Actress
  if (actressName) {
    parts.push(`${actressName} 출연`);
  }

  // Duration
  if (options?.duration && options.duration > 0) {
    parts.push(`${options.duration}분`);
  }

  // Provider + CTA
  if (options?.provider) {
    parts.push(`${options.provider}에서 바로 시청`);
  }

  // Rating
  if (options?.rating && options.rating >= 4.0 && options?.reviewCount && options.reviewCount >= 3) {
    parts.push(`★${options.rating.toFixed(1)}`);
  }

  const description = parts.join(' - ');
  return description.length > 160
    ? description.substring(0, 157) + '...'
    : description;
}

/**
 * 女優ページ用CTR最適化ディスクリプション
 */
export function generateActressDescription(
  name: string,
  options?: {
    workCount?: number;
    topGenres?: string[];
    latestWork?: string;
    isRetired?: boolean;
    locale?: string;
  },
): string {
  const locale = options?.locale || 'ja';

  if (locale === 'ja') {
    const parts: string[] = [];

    parts.push(`${name}の作品一覧`);

    if (options?.workCount && options.workCount > 0) {
      parts.push(`全${options.workCount}本`);
    }

    if (options?.topGenres && options.topGenres.length > 0) {
      parts.push(`人気ジャンル: ${options.topGenres.slice(0, 3).join('・')}`);
    }

    if (options?.latestWork) {
      parts.push(`最新作「${options.latestWork.substring(0, 20)}」`);
    }

    parts.push('高評価作品からセール中作品まで一覧でチェック');

    const description = parts.join(' | ');
    return description.length > 160
      ? description.substring(0, 157) + '...'
      : description;
  }

  // 英語
  if (locale === 'en') {
    const parts = [`${name}'s videos`];
    if (options?.workCount) parts.push(`${options.workCount} titles`);
    if (options?.topGenres?.length) parts.push(`Genres: ${options.topGenres.slice(0, 3).join(', ')}`);
    parts.push('Browse top-rated and sale items');
    return parts.join(' | ').substring(0, 160);
  }

  // 中国語
  if (locale === 'zh') {
    const parts = [`${name}的作品列表`];
    if (options?.workCount) parts.push(`共${options.workCount}部`);
    if (options?.topGenres?.length) parts.push(`热门类型: ${options.topGenres.slice(0, 3).join('・')}`);
    parts.push('浏览高评分和特价作品');
    return parts.join(' | ').substring(0, 160);
  }

  // 韓国語
  if (locale === 'ko') {
    const parts = [`${name}의 작품 목록`];
    if (options?.workCount) parts.push(`총 ${options.workCount}편`);
    if (options?.topGenres?.length) parts.push(`인기 장르: ${options.topGenres.slice(0, 3).join('・')}`);
    parts.push('인기작과 할인작 확인하기');
    return parts.join(' | ').substring(0, 160);
  }

  return `${name} - Video list and profile`;
}

// SEO向けキーワード（多言語対応）
const localeKeywords = {
  ja: [
    'アダルト動画',
    'AV女優',
    '女優ランキング',
    'アダルト配信',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '動画レビュー',
    'アダルトサイト比較',
    '新作AV',
    'セール情報',
    'アダルトキャンペーン',
    '無修正動画',
    'カリビアンコム',
    '一本道',
    'HEYZO',
  ],
  en: [
    'adult videos',
    'JAV actresses',
    'actress rankings',
    'adult streaming',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    'video reviews',
    'adult site comparison',
    'new releases',
    'sales information',
    'adult campaigns',
    'uncensored videos',
    'Caribbeancom',
    '1Pondo',
    'HEYZO',
  ],
  zh: [
    '成人影片',
    'AV女優',
    '女優排名',
    '成人影音',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '影片评论',
    '成人网站比较',
    '新片发布',
    '优惠信息',
    '成人活动',
    '无码影片',
    '加勒比海',
    '一本道',
    'HEYZO',
  ],
  ko: [
    '성인 비디오',
    'AV 여배우',
    '여배우 랭킹',
    '성인 스트리밍',
    'DUGA',
    'MGS',
    'DTI',
    'SOKMIL',
    '비디오 리뷰',
    '성인 사이트 비교',
    '신작 출시',
    '세일 정보',
    '성인 캠페인',
    '무수정 비디오',
    '카리비안컴',
    '잇폰도',
    'HEYZO',
  ],
};

const defaultKeywords = localeKeywords.ja;

/**
 * ロケールマッピング（OpenGraph用）
 */
const localeMap: Record<string, string> = {
  ja: 'ja_JP',
  en: 'en_US',
  zh: 'zh_CN',
  'zh-TW': 'zh_TW',
  ko: 'ko_KR',
};

/**
 * ベースのメタタグを生成（多言語対応）
 */
export function generateBaseMetadata(
  title: string,
  description?: string,
  image?: string,
  path?: string,
  keywords?: string[],
  locale: string = 'ja',
): Metadata {
  const { siteName, defaultDescription } = siteConfig;
  const pageTitle = `${title} | ${siteName}`;
  const pageDescription = description || defaultDescription;
  const pageUrl = path ? `${siteUrl}${path}` : siteUrl;
  // デフォルトOGP画像のパスを設定（publicフォルダ内）
  const pageImage = image || `${siteUrl}/og-image.jpg`;
  const pageKeywords = keywords || localeKeywords[locale as keyof typeof localeKeywords] || defaultKeywords;
  const ogLocale = localeMap[locale] || 'ja_JP';

  // pathからlocale部分を除去してbasePathを取得（?hl=パラメータ形式に統一）
  // middlewareが/ja/, /en/などのプレフィックスを?hl=形式に301リダイレクトするため
  // 例: /ja/actress/123 → /actress/123
  // 例: /en → '' (ルートページ)
  const localePattern = /^\/(ja|en|zh|zh-TW|ko)(\/|$)/;
  const basePath = path ? path.replace(localePattern, '/').replace(/^\/$/, '') : '';
  // canonical URLは全言語で統一（パラメータなし）
  // Googleはcanonicalを「正規URL」として認識するため、全言語で同じURLを指定
  // alternatesのhreflangで各言語版を示す
  const baseWithPath = `${siteUrl}${basePath || '/'}`;
  const canonicalUrl = baseWithPath;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: pageKeywords.join(', '),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'ja': baseWithPath,
        'en': `${baseWithPath}?hl=en`,
        'zh': `${baseWithPath}?hl=zh`,
        'zh-TW': `${baseWithPath}?hl=zh-TW`,
        'ko': `${baseWithPath}?hl=ko`,
        'x-default': baseWithPath,
      },
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      siteName,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: ogLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    other: {
      'google-site-verification': process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    },
  };
}

/**
 * 構造化データ: WebSite（多言語対応）
 */
export function generateWebSiteSchema(locale: string = 'ja') {
  const { siteName, alternateName, defaultDescription } = siteConfig;
  const localeDescriptions: Record<string, string> = {
    ja: defaultDescription,
    en: 'Cross-platform adult streaming hub covering DUGA, MGS, DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    zh: '跨平台成人影音中心，涵盖DUGA、MGS、DTI，提供基于女优的评论、排名和活动更新，专为重度用户打造。',
    ko: '여러 플랫폼을 아우르는 성인 스트리밍 허브로, DUGA, MGS, DTI를 다루며 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    alternateName,
    url: siteUrl,
    description: localeDescriptions[locale] || localeDescriptions.ja,
    inLanguage: ['ja', 'en', 'zh', 'ko'],
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${locale}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * 構造化データ: BreadcrumbList
 */
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}

/**
 * 構造化データ: Person（女優）
 * SEO最適化: jobTitle, workCount, デビュー年などを追加
 */
export function generatePersonSchema(
  name: string,
  description: string,
  image: string,
  url: string,
  options?: {
    workCount?: number;
    debutYear?: number;
    aliases?: string[];
  },
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: description || `${name}の作品一覧、出演情報、プロフィールをご覧いただけます。`,
    image,
    url: `${siteUrl}${url}`,
    jobTitle: 'AV女優',
  };

  // 別名（aliases）がある場合
  if (options?.aliases && options.aliases.length > 0) {
    schema.alternateName = options.aliases;
  }

  // 作品数がある場合
  if (options?.workCount && options.workCount > 0) {
    schema.knowsAbout = `${options.workCount}作品以上に出演`;
  }

  // デビュー年がある場合
  if (options?.debutYear) {
    schema.birthDate = `${options.debutYear}`;
  }

  return schema;
}

/**
 * 構造化データ: Product（商品）
 */
export function generateProductSchema(
  name: string,
  description: string,
  image: string | undefined,
  url: string,
  price?: number,
  brand?: string,
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  },
  salePrice?: number,
  currency: string = 'JPY',
  sku?: string,
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    url: `${siteUrl}${url}`,
  };

  if (image) {
    schema.image = image;
  }

  if (sku) {
    schema.sku = sku;
    schema.productID = sku;
  }

  if (brand) {
    schema.brand = {
      '@type': 'Brand',
      name: brand,
    };
  }

  if (price !== undefined || salePrice !== undefined) {
    const offerPrice = salePrice ?? price;
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      price: offerPrice,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
    };

    // セール価格がある場合、元の価格と割引情報を追加
    if (salePrice && price && salePrice < price) {
      offer.priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30日後
    }

    schema.offers = offer;
  }

  // aggregateRatingが有効な場合のみ追加（ratingValue > 0 かつ reviewCount > 0）
  if (aggregateRating && aggregateRating.ratingValue > 0 && aggregateRating.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: aggregateRating.ratingValue,
      bestRating: 5,
      worstRating: 1,
      reviewCount: aggregateRating.reviewCount,
    };
  }

  return schema;
}

/**
 * 構造化データ: VideoObject（動画商品）
 */
export function generateVideoObjectSchema(
  name: string,
  description: string,
  thumbnailUrl: string | undefined,
  url: string,
  duration?: number,
  uploadDate?: string,
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    contentUrl: url,
    embedUrl: url,
  };

  if (thumbnailUrl) {
    schema.thumbnailUrl = thumbnailUrl;
  }

  if (duration) {
    schema.duration = `PT${Math.round(duration)}M`;
  }

  if (uploadDate) {
    schema.uploadDate = uploadDate;
  }

  return schema;
}

/**
 * 構造化データ: HowTo（視聴方法）
 * 商品ページに追加することでリッチスニペット表示を狙う
 */
export function generateHowToSchema(
  productTitle: string,
  providerName: string,
  affiliateUrl: string,
  locale: string = 'ja',
) {
  const steps = {
    ja: [
      {
        name: '購入ボタンをクリック',
        text: `「${providerName}で購入」ボタンをクリックして${providerName}の商品ページへ移動します。`,
      },
      {
        name: '会員登録・ログイン',
        text: `${providerName}のアカウントをお持ちでない場合は無料会員登録を行います。既にアカウントをお持ちの場合はログインしてください。`,
      },
      {
        name: '決済方法を選択',
        text: 'クレジットカード、電子マネー、コンビニ決済など、お好みの決済方法を選択して購入手続きを完了します。',
      },
      {
        name: 'ストリーミング視聴開始',
        text: '購入完了後、すぐにストリーミング再生で視聴を開始できます。ダウンロード版の場合はダウンロード後に視聴できます。',
      },
    ],
    en: [
      {
        name: 'Click the purchase button',
        text: `Click the "Buy on ${providerName}" button to go to the ${providerName} product page.`,
      },
      {
        name: 'Register or login',
        text: `If you don't have a ${providerName} account, create a free account. If you already have one, log in.`,
      },
      {
        name: 'Choose payment method',
        text: 'Select your preferred payment method such as credit card, e-money, or convenience store payment to complete the purchase.',
      },
      {
        name: 'Start streaming',
        text: 'After purchase, you can immediately start streaming. For download versions, you can watch after downloading.',
      },
    ],
  };

  const localizedSteps = steps[locale as keyof typeof steps] || steps.ja;
  const title = locale === 'ja'
    ? `「${productTitle}」を${providerName}で視聴する方法`
    : `How to watch "${productTitle}" on ${providerName}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description: locale === 'ja'
      ? `${providerName}で「${productTitle}」を購入・視聴するための手順をご紹介します。`
      : `Step-by-step guide to purchase and watch "${productTitle}" on ${providerName}.`,
    step: localizedSteps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      url: index === 0 ? affiliateUrl : undefined,
    })),
    totalTime: 'PT5M',
  };
}

/**
 * 構造化データ: AggregateOffer（複数ASPの価格比較）
 * 複数の配信サイトで販売されている場合に使用
 */
export function generateAggregateOfferSchema(
  offers: Array<{
    providerName: string;
    price: number;
    salePrice?: number;
    url: string;
    availability?: 'InStock' | 'OutOfStock';
  }>,
  currency: string = 'JPY',
) {
  if (!offers || offers.length === 0) return null;

  const prices = offers.map(o => o.salePrice ?? o.price);
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);

  return {
    '@type': 'AggregateOffer',
    lowPrice,
    highPrice,
    priceCurrency: currency,
    offerCount: offers.length,
    offers: offers.map(offer => ({
      '@type': 'Offer',
      price: offer.salePrice ?? offer.price,
      priceCurrency: currency,
      url: offer.url,
      availability: offer.availability === 'OutOfStock'
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: offer.providerName,
      },
    })),
  };
}

/**
 * 構造化データ: ItemList（女優一覧など）
 */
export function generateItemListSchema(items: { name: string; url: string }[], listName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}

/**
 * 構造化データ: ItemList for Products（関連商品・類似商品用）
 * Product型を含むItemListでSEO効果を向上
 */
export function generateProductItemListSchema(
  products: Array<{
    id: string | number;
    title: string;
    imageUrl?: string | null;
    price?: number;
    salePrice?: number;
  }>,
  listName: string,
  locale: string = 'ja',
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.title,
        url: `${siteUrl}/${locale}/products/${product.id}`,
        ...(product.imageUrl && { image: product.imageUrl }),
        ...(product.price || product.salePrice) && {
          offers: {
            '@type': 'Offer',
            price: product.salePrice ?? product.price,
            priceCurrency: 'JPY',
            availability: 'https://schema.org/InStock',
          },
        },
      },
    })),
  };
}

/**
 * 構造化データ: ItemList for Performers（類似女優・関連女優用）
 * Person型を含むItemListでSEO効果を向上
 */
export function generatePerformerItemListSchema(
  performers: Array<{
    id: string | number;
    name: string;
    imageUrl?: string | null;
    productCount?: number;
  }>,
  listName: string,
  locale: string = 'ja',
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: performers.length,
    itemListElement: performers.map((performer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Person',
        name: performer.name,
        url: `${siteUrl}/${locale}/actress/${performer.id}`,
        ...(performer.imageUrl && { image: performer.imageUrl }),
        jobTitle: 'AV女優',
        ...(performer.productCount && { knowsAbout: `${performer.productCount}作品以上に出演` }),
      },
    })),
  };
}

/**
 * 構造化データ: FAQPage（よくある質問）
 * リッチリザルト表示でCTR向上を狙う
 */
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * ホームページ用FAQ（多言語対応）
 * Googleリッチリザルトに表示されCTR向上を狙う
 */
export function getHomepageFAQs(locale: string = 'ja'): { question: string; answer: string }[] {
  const { siteName } = siteConfig;
  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      {
        question: `${siteName}とは何ですか？`,
        answer: `${siteName}は、DUGA、MGS、SOKMIL、カリビアンコム、一本道、HEYZOなど主要アダルト動画配信サイトを横断検索できるサービスです。38,000名以上のAV女優情報、出演作品の価格比較、無料サンプル動画へのリンクを提供しています。`,
      },
      {
        question: 'どのような配信サイトに対応していますか？',
        answer: 'DUGA、MGS（PRESTIGE・S1・Ideapocket等）、SOKMIL、カリビアンコム、カリビアンコムプレミアム、一本道、HEYZO、天然むすめ、パコパコママ、FC2コンテンツマーケット、Japanskaなど主要サイトに対応しています。',
      },
      {
        question: '無料で利用できますか？',
        answer: `はい、${siteName}は完全無料でご利用いただけます。女優検索、作品検索、価格比較、無料サンプル動画の視聴など全ての機能を無料でお使いいただけます。`,
      },
      {
        question: 'セール情報はどこで確認できますか？',
        answer: 'トップページのセールセクション、または作品一覧ページの「セール中のみ」フィルターで確認できます。各配信サイトの最新セール情報をリアルタイムで収集しています。',
      },
    ],
    en: [
      {
        question: `What is ${siteName}?`,
        answer: `${siteName} is a cross-platform search service for major adult video streaming sites including DUGA, MGS, SOKMIL, Caribbeancom, 1Pondo, and HEYZO. We provide information on over 38,000 JAV actresses, price comparisons, and links to free sample videos.`,
      },
      {
        question: 'Which streaming sites are supported?',
        answer: 'We support DUGA, MGS (PRESTIGE, S1, Ideapocket, etc.), SOKMIL, Caribbeancom, Caribbeancom Premium, 1Pondo, HEYZO, 10musume, Pacopacomama, FC2 Content Market, Japanska, and more.',
      },
      {
        question: 'Is it free to use?',
        answer: `Yes, ${siteName} is completely free to use. All features including actress search, product search, price comparison, and free sample video viewing are available at no cost.`,
      },
      {
        question: 'Where can I find sale information?',
        answer: 'You can find sales on the homepage sale section or by using the "On Sale Only" filter on the products page. We collect the latest sale information from each streaming site in real-time.',
      },
    ],
    zh: [
      {
        question: `${siteName}是什么？`,
        answer: `${siteName}是一个跨平台搜索服务，涵盖DUGA、MGS、SOKMIL、加勒比海、一本道、HEYZO等主要成人视频平台。我们提供超过38,000名AV女优的信息、价格比较和免费样片链接。`,
      },
      {
        question: '支持哪些视频平台？',
        answer: '支持DUGA、MGS（PRESTIGE、S1、Ideapocket等）、SOKMIL、加勒比海、加勒比海Premium、一本道、HEYZO、天然娘、Pacopacomama、FC2内容市场、Japanska等主要平台。',
      },
      {
        question: '可以免费使用吗？',
        answer: `是的，${siteName}完全免费使用。女优搜索、作品搜索、价格比较、免费样片观看等所有功能都是免费的。`,
      },
      {
        question: '在哪里可以查看特卖信息？',
        answer: '您可以在首页的特卖区域或作品列表页面的"仅显示特卖"筛选器中查看。我们实时收集各平台的最新特卖信息。',
      },
    ],
    ko: [
      {
        question: `${siteName}이란 무엇인가요?`,
        answer: `${siteName}은 DUGA, MGS, SOKMIL, 카리비안컴, 일본도, HEYZO 등 주요 성인 비디오 스트리밍 사이트를 통합 검색할 수 있는 서비스입니다. 38,000명 이상의 AV 여배우 정보, 가격 비교, 무료 샘플 비디오 링크를 제공합니다.`,
      },
      {
        question: '어떤 스트리밍 사이트를 지원하나요?',
        answer: 'DUGA, MGS(PRESTIGE, S1, Ideapocket 등), SOKMIL, 카리비안컴, 카리비안컴 프리미엄, 일본도, HEYZO, 천연무스메, 파코파코마마, FC2 콘텐츠 마켓, Japanska 등 주요 사이트를 지원합니다.',
      },
      {
        question: '무료로 이용할 수 있나요?',
        answer: `네, ${siteName}은 완전 무료입니다. 여배우 검색, 작품 검색, 가격 비교, 무료 샘플 비디오 시청 등 모든 기능을 무료로 이용하실 수 있습니다.`,
      },
      {
        question: '세일 정보는 어디서 확인할 수 있나요?',
        answer: '홈페이지의 세일 섹션 또는 작품 목록 페이지의 "세일 중만" 필터에서 확인할 수 있습니다. 각 스트리밍 사이트의 최신 세일 정보를 실시간으로 수집합니다.',
      },
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}

/**
 * 構造化データ: CollectionPage（作品一覧・検索結果ページ）
 * ページネーション情報を含むことでSEO向上
 */
export function generateCollectionPageSchema(
  name: string,
  description: string,
  url: string,
  locale: string = 'ja',
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  },
) {
  const { siteName } = siteConfig;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${siteUrl}${url}`,
    inLanguage: locale,
    isPartOf: {
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
    },
  };

  if (pagination) {
    schema.numberOfItems = pagination.totalItems;

    // ページネーション情報
    if (pagination.currentPage > 1) {
      const prevPageUrl = url.includes('?')
        ? `${url}&page=${pagination.currentPage - 1}`
        : `${url}?page=${pagination.currentPage - 1}`;
      schema.relatedLink = `${siteUrl}${prevPageUrl}`;
    }
  }

  return schema;
}

/**
 * 構造化データ: Organization（サイト運営者）
 */
export function generateOrganizationSchema(locale: string = 'ja') {
  const { siteName, alternateName, defaultDescription } = siteConfig;
  const localeDescriptions: Record<string, string> = {
    ja: defaultDescription,
    en: 'Cross-platform adult streaming hub covering DUGA, MGS, DTI with actress-based reviews, rankings, and campaign updates for heavy users.',
    zh: '跨平台成人影音中心，涵盖DUGA、MGS、DTI，提供基于女优的评论、排名和活动更新，专为重度用户打造。',
    ko: '여러 플랫폼을 아우르는 성인 스트리밍 허브로, DUGA, MGS, DTI를 다루며 헤비 유저를 위한 여배우 기반 리뷰, 랭킹 및 캠페인 업데이트를 제공합니다.',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    alternateName,
    url: siteUrl,
    description: localeDescriptions[locale] || localeDescriptions.ja,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/logo.png`,
      width: 512,
      height: 512,
    },
    foundingDate: '2024',
    slogan: 'Discover, Compare, Enjoy',
    knowsAbout: [
      'アダルト動画',
      'AV女優',
      'DUGA',
      'MGS',
      'SOKMIL',
      'DTI',
      'カリビアンコム',
      '一本道',
      'HEYZO',
    ],
    areaServed: {
      '@type': 'Country',
      name: 'Japan',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Japanese', 'English', 'Chinese', 'Korean'],
    },
  };
}

/**
 * 商品ページ用FAQ（多言語対応）
 * 商品情報から動的にFAQを生成してリッチリザルト表示
 */
export function getProductPageFAQs(
  locale: string = 'ja',
  options: {
    productId?: string;
    title: string;
    duration?: number;
    releaseDate?: string;
    provider?: string;
    hasSubtitles?: boolean;
    isHD?: boolean;
    actressName?: string;
  }
): { question: string; answer: string }[] {
  const { productId, title, duration, releaseDate, provider, hasSubtitles, isHD, actressName } = options;

  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      // SEO強化: 品番検索向けFAQ（「SSIS-865とは」などのクエリ対応）
      ...(productId ? [{
        question: `${productId}とは何ですか？`,
        answer: `${productId}は「${title.substring(0, 30)}${title.length > 30 ? '...' : ''}」の品番（製品コード）です。${actressName ? `${actressName}が出演しています。` : ''}${provider ? `${provider}で購入・視聴できます。` : ''}`,
      }] : []),
      // SEO強化: 商品名検索向けFAQ
      ...(title ? [{
        question: `「${title.substring(0, 25)}${title.length > 25 ? '...' : ''}」の詳細情報は？`,
        answer: `${productId ? `品番は${productId}です。` : ''}${duration ? `収録時間は約${duration}分。` : ''}${actressName ? `${actressName}出演。` : ''}${releaseDate ? `${releaseDate}配信開始。` : ''}複数サイトで価格比較してお得に購入できます。`,
      }] : []),
      ...(duration ? [{
        question: `「${title}」の収録時間は？`,
        answer: `この作品の収録時間は約${duration}分です。${duration >= 120 ? '長編作品なのでじっくりお楽しみいただけます。' : duration >= 60 ? '見応えのある内容となっています。' : '短時間でお楽しみいただける作品です。'}`,
      }] : []),
      ...(productId ? [{
        question: `品番「${productId}」はどこで購入できますか？`,
        answer: `${provider || '各配信サイト'}で購入可能です。当サイトでは複数の配信サイトの価格を比較して最安値でお求めいただけます。`,
      }] : []),
      ...(releaseDate ? [{
        question: `「${title}」の配信開始日はいつですか？`,
        answer: `${releaseDate}に配信開始されました。${actressName ? `${actressName}出演の人気作品です。` : ''}`,
      }] : []),
      {
        question: `この作品にはサンプル動画がありますか？`,
        answer: `はい、無料のサンプル動画をご用意しています。購入前に内容をご確認いただけます。`,
      },
      ...(isHD ? [{
        question: `HD・4K画質に対応していますか？`,
        answer: `はい、高画質版でお楽しみいただけます。対応画質は配信サイトによって異なりますので、各サイトでご確認ください。`,
      }] : []),
    ],
    en: [
      // SEO: Product code search FAQ
      ...(productId ? [{
        question: `What is ${productId}?`,
        answer: `${productId} is the product code for "${title.substring(0, 30)}${title.length > 30 ? '...' : ''}". ${actressName ? `Featuring ${actressName}.` : ''}${provider ? `Available on ${provider}.` : ''}`,
      }] : []),
      ...(duration ? [{
        question: `What is the runtime of "${title}"?`,
        answer: `This video is approximately ${duration} minutes long. ${duration >= 120 ? 'It\'s a feature-length work you can enjoy thoroughly.' : duration >= 60 ? 'It has substantial content.' : 'A quick video for your enjoyment.'}`,
      }] : []),
      ...(productId ? [{
        question: `Where can I purchase product "${productId}"?`,
        answer: `Available on ${provider || 'various streaming sites'}. Our site compares prices across multiple platforms to help you find the best deal.`,
      }] : []),
      ...(releaseDate ? [{
        question: `When was "${title}" released?`,
        answer: `Released on ${releaseDate}. ${actressName ? `A popular work featuring ${actressName}.` : ''}`,
      }] : []),
      {
        question: `Is there a sample video available?`,
        answer: `Yes, free sample videos are available. You can preview the content before purchasing.`,
      },
    ],
    zh: [
      ...(duration ? [{
        question: `"${title}"的播放时长是多少？`,
        answer: `这部作品约${duration}分钟。${duration >= 120 ? '这是一部长篇作品，可以充分享受。' : duration >= 60 ? '内容充实。' : '短时间即可观看的作品。'}`,
      }] : []),
      ...(productId ? [{
        question: `在哪里可以购买"${productId}"？`,
        answer: `可在${provider || '各视频平台'}购买。本站比较多个平台的价格，帮您找到最优惠的价格。`,
      }] : []),
      ...(releaseDate ? [{
        question: `"${title}"的发布日期是？`,
        answer: `${releaseDate}开始配信。${actressName ? `${actressName}出演的人气作品。` : ''}`,
      }] : []),
      {
        question: `有免费的示例视频吗？`,
        answer: `是的，提供免费的示例视频。您可以在购买前预览内容。`,
      },
    ],
    ko: [
      ...(duration ? [{
        question: `"${title}"의 재생 시간은?`,
        answer: `이 작품은 약 ${duration}분입니다. ${duration >= 120 ? '장편 작품으로 충분히 즐기실 수 있습니다.' : duration >= 60 ? '알찬 내용입니다.' : '짧은 시간에 즐기실 수 있는 작품입니다.'}`,
      }] : []),
      ...(productId ? [{
        question: `"${productId}"는 어디서 구매할 수 있나요?`,
        answer: `${provider || '각 스트리밍 사이트'}에서 구매 가능합니다. 당 사이트에서는 여러 플랫폼의 가격을 비교하여 최저가를 찾을 수 있습니다.`,
      }] : []),
      ...(releaseDate ? [{
        question: `"${title}"의 출시일은?`,
        answer: `${releaseDate}에 배포되었습니다. ${actressName ? `${actressName} 출연의 인기 작품입니다.` : ''}`,
      }] : []),
      {
        question: `샘플 동영상이 있나요?`,
        answer: `네, 무료 샘플 동영상이 제공됩니다. 구매 전에 내용을 확인하실 수 있습니다.`,
      },
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}

/**
 * 女優ページ用FAQ（多言語対応）
 * 女優情報から動的にFAQを生成してリッチリザルト表示
 */
export function getActressPageFAQs(
  locale: string = 'ja',
  options: {
    name: string;
    productCount: number;
    debutYear?: number;
    latestReleaseDate?: string;
    aliases?: string[];
    topGenres?: string[];
    aspNames?: string[];
    isRetired?: boolean;
  }
): { question: string; answer: string }[] {
  const { name, productCount, debutYear, latestReleaseDate, aliases, topGenres, aspNames, isRetired } = options;

  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      {
        question: `${name}の出演作品数は？`,
        answer: `${name}は現在${productCount}作品に出演しています。${debutYear ? `データ上最も古い作品は${debutYear}年のもので、` : ''}${isRetired ? '現在は引退されています。' : '現在も活躍中です。'}`,
      },
      ...(debutYear ? [{
        question: `${name}の初出演作品はいつ？`,
        answer: `${name}のデータ上最も古い作品は${debutYear}年のものです。${productCount > 50 ? '多数の作品に出演し、人気女優として活躍しています。' : ''}`,
      }] : []),
      ...(topGenres && topGenres.length > 0 ? [{
        question: `${name}の出演ジャンルは？`,
        answer: `${name}は${topGenres.slice(0, 5).join('、')}などのジャンルに多く出演しています。様々なシチュエーションの作品をお楽しみいただけます。`,
      }] : []),
      ...(aliases && aliases.length > 0 ? [{
        question: `${name}の別名義は？`,
        answer: `${name}は${aliases.join('、')}という名義でも活動しています。複数の配信サイトで異なる名前で出演している場合があります。`,
      }] : []),
      ...(aspNames && aspNames.length > 0 ? [{
        question: `${name}の作品はどこで見られますか？`,
        answer: `${name}の作品は${aspNames.join('、')}などで視聴可能です。当サイトでは複数サイトの価格を比較して最安値でお求めいただけます。`,
      }] : []),
      ...(latestReleaseDate ? [{
        question: `${name}の最新作は？`,
        answer: `${name}の最新作は${latestReleaseDate}に配信されました。当サイトで最新作から過去作まで全ての出演作品をご確認いただけます。`,
      }] : []),
    ],
    en: [
      {
        question: `How many videos has ${name} appeared in?`,
        answer: `${name} has appeared in ${productCount} videos. ${debutYear ? `The earliest recorded work is from ${debutYear} and ` : ''}${isRetired ? 'has since retired.' : 'is still active.'}`,
      },
      ...(debutYear ? [{
        question: `What is ${name}'s earliest work?`,
        answer: `The earliest recorded work for ${name} is from ${debutYear}. ${productCount > 50 ? 'She has appeared in numerous works and is a popular actress.' : ''}`,
      }] : []),
      ...(topGenres && topGenres.length > 0 ? [{
        question: `What genres does ${name} appear in?`,
        answer: `${name} frequently appears in ${topGenres.slice(0, 5).join(', ')} and other genres. Enjoy her work across various scenarios.`,
      }] : []),
      ...(aliases && aliases.length > 0 ? [{
        question: `Does ${name} have other stage names?`,
        answer: `${name} also performs under the names ${aliases.join(', ')}. She may appear under different names on various streaming sites.`,
      }] : []),
      ...(aspNames && aspNames.length > 0 ? [{
        question: `Where can I watch ${name}'s videos?`,
        answer: `${name}'s videos are available on ${aspNames.join(', ')}. Our site compares prices across multiple platforms to help you find the best deal.`,
      }] : []),
    ],
    zh: [
      {
        question: `${name}出演了多少部作品？`,
        answer: `${name}目前出演了${productCount}部作品。${debutYear ? `数据上最早的作品是${debutYear}年的，` : ''}${isRetired ? '目前已经退役。' : '目前仍在活跃中。'}`,
      },
      ...(debutYear ? [{
        question: `${name}最早的作品是什么时候？`,
        answer: `${name}数据上最早的作品是${debutYear}年的。${productCount > 50 ? '她出演了大量作品，是一位人气女优。' : ''}`,
      }] : []),
      ...(topGenres && topGenres.length > 0 ? [{
        question: `${name}出演哪些类型的作品？`,
        answer: `${name}经常出演${topGenres.slice(0, 5).join('、')}等类型的作品。可以欣赏她在各种场景中的表演。`,
      }] : []),
      ...(aliases && aliases.length > 0 ? [{
        question: `${name}有其他艺名吗？`,
        answer: `${name}也以${aliases.join('、')}的名字活动。她可能在不同的平台上使用不同的名字。`,
      }] : []),
      ...(aspNames && aspNames.length > 0 ? [{
        question: `在哪里可以观看${name}的作品？`,
        answer: `${name}的作品可以在${aspNames.join('、')}等平台观看。本站比较多个平台的价格，帮您找到最优惠的价格。`,
      }] : []),
    ],
    ko: [
      {
        question: `${name}는 몇 작품에 출연했나요?`,
        answer: `${name}는 현재 ${productCount}작품에 출연했습니다. ${debutYear ? `데이터상 가장 오래된 작품은 ${debutYear}년 것이며, ` : ''}${isRetired ? '현재는 은퇴했습니다.' : '현재도 활동 중입니다.'}`,
      },
      ...(debutYear ? [{
        question: `${name}의 가장 오래된 작품은?`,
        answer: `${name}의 데이터상 가장 오래된 작품은 ${debutYear}년 것입니다. ${productCount > 50 ? '다수의 작품에 출연하며 인기 여배우로 활약하고 있습니다.' : ''}`,
      }] : []),
      ...(topGenres && topGenres.length > 0 ? [{
        question: `${name}는 어떤 장르에 출연하나요?`,
        answer: `${name}는 ${topGenres.slice(0, 5).join(', ')} 등의 장르에 자주 출연합니다. 다양한 상황의 작품을 즐기실 수 있습니다.`,
      }] : []),
      ...(aliases && aliases.length > 0 ? [{
        question: `${name}의 다른 이름은?`,
        answer: `${name}는 ${aliases.join(', ')}라는 이름으로도 활동하고 있습니다. 여러 사이트에서 다른 이름으로 출연할 수 있습니다.`,
      }] : []),
      ...(aspNames && aspNames.length > 0 ? [{
        question: `${name}의 작품은 어디서 볼 수 있나요?`,
        answer: `${name}의 작품은 ${aspNames.join(', ')} 등에서 시청 가능합니다. 당 사이트에서는 여러 플랫폼의 가격을 비교하여 최저가를 찾을 수 있습니다.`,
      }] : []),
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}

export function getCategoryPageFAQs(locale: string = 'ja'): { question: string; answer: string }[] {
  const faqsByLocale: Record<string, { question: string; answer: string }[]> = {
    ja: [
      {
        question: 'カテゴリ検索でどんなジャンルが探せますか？',
        answer: '人気ジャンル、シチュエーション、プレイ内容、体型、コスチュームなど多彩なカテゴリから作品を探せます。各カテゴリは作品数順に並んでおり、人気のジャンルがすぐに見つかります。',
      },
      {
        question: '複数のジャンルを組み合わせて検索できますか？',
        answer: 'はい、作品一覧ページでは「含む」と「除外」フィルターを使って、複数のジャンルを組み合わせた検索が可能です。お好みの条件で絞り込むことができます。',
      },
      {
        question: 'どのカテゴリが一番人気ですか？',
        answer: 'カテゴリ一覧ページでは各ジャンルの作品数が表示されています。作品数が多いジャンルほど人気があり、豊富なコンテンツから選ぶことができます。',
      },
    ],
    en: [
      {
        question: 'What genres can I search for in the category search?',
        answer: 'You can search for products from various categories including popular genres, situations, play types, body types, and costumes. Categories are sorted by the number of products, making it easy to find popular genres.',
      },
      {
        question: 'Can I combine multiple genres in my search?',
        answer: 'Yes, on the product listing page, you can use "Include" and "Exclude" filters to combine multiple genres. This allows you to narrow down your search to match your preferences.',
      },
      {
        question: 'Which categories are most popular?',
        answer: 'The category listing page shows the number of products for each genre. Genres with more products are more popular and offer a wider selection of content to choose from.',
      },
    ],
    zh: [
      {
        question: '分类搜索可以找到哪些类型？',
        answer: '您可以从人气类型、场景、玩法、体型、服装等多种分类中搜索作品。各分类按作品数量排序，可以快速找到热门类型。',
      },
      {
        question: '可以组合多个类型进行搜索吗？',
        answer: '可以。在作品列表页面，您可以使用"包含"和"排除"筛选器来组合多个类型进行搜索，按您的喜好进行筛选。',
      },
      {
        question: '哪个分类最受欢迎？',
        answer: '分类列表页面显示了每个类型的作品数量。作品数量越多的类型越受欢迎，可以从丰富的内容中选择。',
      },
    ],
    ko: [
      {
        question: '카테고리 검색에서 어떤 장르를 찾을 수 있나요?',
        answer: '인기 장르, 상황, 플레이 유형, 체형, 의상 등 다양한 카테고리에서 작품을 검색할 수 있습니다. 각 카테고리는 작품 수 순으로 정렬되어 인기 장르를 쉽게 찾을 수 있습니다.',
      },
      {
        question: '여러 장르를 조합하여 검색할 수 있나요?',
        answer: '네, 작품 목록 페이지에서 "포함" 및 "제외" 필터를 사용하여 여러 장르를 조합한 검색이 가능합니다. 원하는 조건으로 좁힐 수 있습니다.',
      },
      {
        question: '어떤 카테고리가 가장 인기 있나요?',
        answer: '카테고리 목록 페이지에서 각 장르의 작품 수를 확인할 수 있습니다. 작품 수가 많은 장르일수록 인기가 있으며, 풍부한 콘텐츠에서 선택할 수 있습니다.',
      },
    ],
  };

  return faqsByLocale[locale] || faqsByLocale.ja;
}

/**
 * 構造化データ: Review（AIレビュー用）
 * Googleリッチリザルトに表示されCTR向上を狙う
 * 注: itemReviewedを含めることでProduct Schemaと連携
 */
export function generateReviewSchema(
  reviewBody: string,
  productName: string,
  productUrl: string,
  options?: {
    ratingValue?: number;
    bestRating?: number;
    worstRating?: number;
    datePublished?: string;
    productImage?: string;
    productId?: string;
  }
) {
  const { siteName } = siteConfig;
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewBody,
    author: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    itemReviewed: {
      '@type': 'Product',
      name: productName,
      url: `${siteUrl}${productUrl}`,
      ...(options?.productImage && { image: options.productImage }),
      ...(options?.productId && { sku: options.productId }),
    },
  };

  // レーティング情報（AIが評価した場合）
  if (options?.ratingValue) {
    schema.reviewRating = {
      '@type': 'Rating',
      ratingValue: options.ratingValue,
      bestRating: options.bestRating || 5,
      worstRating: options.worstRating || 1,
    };
  }

  // レビュー公開日（AI分析日）
  if (options?.datePublished) {
    schema.datePublished = options.datePublished;
  }

  return schema;
}

/**
 * 構造化データ: CriticReview（専門家レビュー）
 * AI分析レビューを専門家レビューとして構造化
 * より信頼性の高いリッチリザルト表示を狙う
 */
export function generateCriticReviewSchema(
  reviewBody: string,
  productName: string,
  productUrl: string,
  options?: {
    ratingValue?: number;
    datePublished?: string;
    productImage?: string;
    productId?: string;
    summary?: string;
  }
) {
  const { siteName } = siteConfig;

  // レビュー本文を150文字以内に要約（meta description用）
  const reviewSummary = options?.summary || (
    reviewBody.length > 150
      ? reviewBody.substring(0, 147) + '...'
      : reviewBody
  );

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CriticReview',
    reviewBody,
    name: `${productName}のAI分析レビュー`,
    author: {
      '@type': 'Organization',
      name: `${siteName} AI分析`,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
    },
    itemReviewed: {
      '@type': 'Product',
      name: productName,
      url: `${siteUrl}${productUrl}`,
      ...(options?.productImage && { image: options.productImage }),
      ...(options?.productId && { sku: options.productId }),
    },
    description: reviewSummary,
  };

  // レーティング情報
  if (options?.ratingValue) {
    schema.reviewRating = {
      '@type': 'Rating',
      ratingValue: options.ratingValue,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // レビュー公開日
  if (options?.datePublished) {
    schema.datePublished = options.datePublished;
  }

  return schema;
}
