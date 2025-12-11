'use client';

import { useParams } from 'next/navigation';
import { isSubscriptionProvider } from '@/lib/providers';
import { formatPrice } from '@/lib/utils/subscription';

/**
 * 再生時間を分単位でフォーマット
 * - 600分（10時間）以上の異常値は非表示
 * - 時間と分に分けて表示
 */
function formatDuration(minutes: number, locale: string): string | null {
  // 600分（10時間）以上は異常データとして非表示
  if (minutes > 600) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes}`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (locale === 'ja') {
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  } else if (locale === 'zh') {
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  } else if (locale === 'ko') {
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  } else {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

// Client-side translations (outside NextIntlClientProvider)
const translations = {
  ja: {
    productDetails: '作品詳細情報',
    duration: '再生時間:',
    minutes: '分',
    releaseDate: '配信開始:',
    performerCount: '出演者数:',
    people: '名',
    tagCount: 'タグ数:',
    items: '件',
    distributionSites: '配信サイト',
    sites: 'サイト',
    productId: '品番:',
    subscriptionOnly: '月額会員限定',
    dataInfo: '複数の配信サイトから価格・在庫情報を収集し、最新の情報を提供しています',
    lastUpdated: '最終更新:',
    verifiedData: '検証済みデータ',
    officialSource: '公式提供元',
    copyrightNotice: 'すべての画像・動画コンテンツの著作権は各権利者に帰属します',
  },
  en: {
    productDetails: 'Product Details',
    duration: 'Duration:',
    minutes: 'min',
    releaseDate: 'Release Date:',
    performerCount: 'Performers:',
    people: '',
    tagCount: 'Tags:',
    items: '',
    distributionSites: 'Distribution Sites',
    sites: 'sites',
    productId: 'Product ID:',
    subscriptionOnly: 'Subscription Only',
    dataInfo: 'We collect pricing and availability information from multiple distribution sites to provide the latest data',
    lastUpdated: 'Last Updated:',
    verifiedData: 'Verified Data',
    officialSource: 'Official Source',
    copyrightNotice: 'All image and video content copyrights belong to their respective owners',
  },
  zh: {
    productDetails: '作品详情',
    duration: '时长:',
    minutes: '分钟',
    releaseDate: '发布日期:',
    performerCount: '演员数:',
    people: '人',
    tagCount: '标签数:',
    items: '个',
    distributionSites: '分发站点',
    sites: '个站点',
    productId: '产品编号:',
    subscriptionOnly: '仅限会员',
    dataInfo: '我们从多个分发站点收集价格和库存信息，以提供最新数据',
    lastUpdated: '最后更新:',
    verifiedData: '已验证数据',
    officialSource: '官方来源',
    copyrightNotice: '所有图片和视频内容的版权归各权利人所有',
  },
  ko: {
    productDetails: '작품 상세 정보',
    duration: '재생시간:',
    minutes: '분',
    releaseDate: '배포일:',
    performerCount: '출연자 수:',
    people: '명',
    tagCount: '태그 수:',
    items: '개',
    distributionSites: '배포 사이트',
    sites: '개 사이트',
    productId: '제품번호:',
    subscriptionOnly: '월간 회원 전용',
    dataInfo: '여러 배포 사이트에서 가격 및 재고 정보를 수집하여 최신 정보를 제공합니다',
    lastUpdated: '최종 업데이트:',
    verifiedData: '검증된 데이터',
    officialSource: '공식 제공처',
    copyrightNotice: '모든 이미지 및 동영상 콘텐츠의 저작권은 각 권리자에게 있습니다',
  },
} as const;

interface ProductSource {
  aspName: string;
  originalProductId: string;
  price: number | null;
  currency?: string | null;
  affiliateUrl: string;
}

interface ProductDetailInfoProps {
  duration: number | null;
  releaseDate: string | null;
  sources: ProductSource[];
  updatedAt: Date | null;
  performerCount: number;
  tagCount: number;
}

export default function ProductDetailInfo({
  duration,
  releaseDate,
  sources,
  updatedAt,
  performerCount,
  tagCount,
}: ProductDetailInfoProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-2">
        {t.productDetails}
      </h2>

      {/* 基本情報 */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {duration && formatDuration(duration, locale) && (
          <div>
            <span className="text-gray-400">{t.duration}</span>
            <span className="text-white ml-2 font-semibold">
              {formatDuration(duration, locale)}{duration < 60 ? t.minutes : ''}
            </span>
          </div>
        )}
        {releaseDate && (
          <div>
            <span className="text-gray-400">{t.releaseDate}</span>
            <span className="text-white ml-2 font-semibold">{releaseDate}</span>
          </div>
        )}
        <div>
          <span className="text-gray-400">{t.performerCount}</span>
          <span className="text-white ml-2 font-semibold">{performerCount}{t.people}</span>
        </div>
        <div>
          <span className="text-gray-400">{t.tagCount}</span>
          <span className="text-white ml-2 font-semibold">{tagCount}{t.items}</span>
        </div>
      </div>

      {/* データソースの透明性 */}
      {sources.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-semibold text-white mb-3">
            {t.distributionSites} ({sources.length} {t.sites})
          </h3>
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={`${source.aspName}-${source.originalProductId}`}
                className="flex items-center justify-between bg-gray-700/50 rounded p-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-gray-600 rounded font-mono text-white">
                    {source.aspName}
                  </span>
                  <span className="text-gray-300">
                    {t.productId} {source.originalProductId}
                  </span>
                </div>
                {source.price !== null && source.price > 0 ? (
                  <span className="text-green-400 font-semibold">
                    {formatPrice(source.price, source.currency ?? undefined)}
                  </span>
                ) : isSubscriptionProvider(source.aspName) ? (
                  <span className="text-rose-400 font-semibold">
                    {t.subscriptionOnly}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {t.dataInfo}
          </p>
        </div>
      )}

      {/* 更新日時 */}
      {updatedAt && (
        <div className="text-xs text-gray-400 pt-4 border-t border-gray-700">
          {t.lastUpdated} {new Date(updatedAt).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US')}
        </div>
      )}

      {/* 信頼性バッジ */}
      <div className="flex items-center gap-2 pt-4">
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-600 rounded-full">
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-blue-300 font-medium">{t.verifiedData}</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 bg-green-600/20 border border-green-600 rounded-full">
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path
              fillRule="evenodd"
              d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-green-300 font-medium">{t.officialSource}</span>
        </div>
      </div>

      {/* 著作権表示 */}
      <p className="text-xs text-gray-500 pt-4 border-t border-gray-700">
        {t.copyrightNotice}
      </p>
    </div>
  );
}
