'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, X, ExternalLink, RefreshCw, Sparkles, Clock, User } from 'lucide-react';
import { useFavorites } from '@adult-v/shared/hooks';
import { localizedHref } from '@adult-v/shared/i18n';

interface DiscoverProduct {
  id: number;
  title: string;
  imageUrl: string;
  sampleImages: string[] | null;
  releaseDate: string | null;
  duration: number | null;
  price: number | null;
  provider: string | null;
  affiliateUrl: string | null;
  performers: string[];
}

const translations = {
  ja: {
    title: '発掘モード',
    subtitle: 'ランダムに作品を発見',
    loading: '作品を探しています...',
    noMore: 'これ以上の作品がありません',
    tryAgain: 'もう一度試す',
    interested: '興味あり',
    pass: 'パス',
    viewDetails: '詳細を見る',
    buyNow: '購入する',
    duration: '分',
    addedToFavorites: 'お気に入りに追加しました',
    passedCount: '{count}作品をパス',
    likedCount: '{count}作品をお気に入り',
    reset: 'リセット',
  },
  en: {
    title: 'Discover Mode',
    subtitle: 'Find random products',
    loading: 'Finding products...',
    noMore: 'No more products',
    tryAgain: 'Try again',
    interested: 'Interested',
    pass: 'Pass',
    viewDetails: 'View Details',
    buyNow: 'Buy Now',
    duration: 'min',
    addedToFavorites: 'Added to favorites',
    passedCount: '{count} passed',
    likedCount: '{count} liked',
    reset: 'Reset',
  },
  zh: {
    title: '发现模式',
    subtitle: '随机发现作品',
    loading: '正在寻找作品...',
    noMore: '没有更多作品',
    tryAgain: '再试一次',
    interested: '感兴趣',
    pass: '跳过',
    viewDetails: '查看详情',
    buyNow: '购买',
    duration: '分钟',
    addedToFavorites: '已添加到收藏',
    passedCount: '跳过了{count}部',
    likedCount: '收藏了{count}部',
    reset: '重置',
  },
  ko: {
    title: '발견 모드',
    subtitle: '랜덤으로 작품 발견',
    loading: '작품을 찾는 중...',
    noMore: '더 이상 작품이 없습니다',
    tryAgain: '다시 시도',
    interested: '관심 있음',
    pass: '패스',
    viewDetails: '상세 보기',
    buyNow: '구매',
    duration: '분',
    addedToFavorites: '즐겨찾기에 추가됨',
    passedCount: '{count}개 패스',
    likedCount: '{count}개 좋아요',
    reset: '리셋',
  },
} as const;

type TranslationKey = keyof typeof translations;

export default function DiscoverPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'ja';
  const t = translations[locale as TranslationKey] || translations.ja;

  const { addFavorite, isFavorite } = useFavorites();
  const [product, setProduct] = useState<DiscoverProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);
  const [passedCount, setPassedCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'like' | 'pass' | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const fetchProduct = useCallback(async (newExcludeIds: number[] = excludeIds) => {
    setIsLoading(true);
    setCurrentImageIndex(0);
    try {
      const params = new URLSearchParams();
      if (newExcludeIds.length > 0) {
        params.set('excludeIds', newExcludeIds.join(','));
      }
      params.set('locale', locale);

      const res = await fetch(`/api/discover?${params.toString()}`);
      const data = await res.json();
      setProduct(data.product);
    } catch (error) {
      console.error('Error fetching product:', error);
      setProduct(null);
    } finally {
      setIsLoading(false);
    }
  }, [excludeIds, locale]);

  useEffect(() => {
    fetchProduct([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLike = useCallback(() => {
    if (!product) return;

    // Add to favorites
    if (!isFavorite('product', product.id)) {
      addFavorite({
        id: product.id,
        type: 'product',
        title: product.title,
        thumbnail: product.imageUrl,
      });
    }

    setShowFeedback('like');
    setLikedCount(prev => prev + 1);

    // Fetch next product
    const newExcludeIds = [...excludeIds, product.id];
    setExcludeIds(newExcludeIds);

    setTimeout(() => {
      setShowFeedback(null);
      fetchProduct(newExcludeIds);
    }, 500);
  }, [product, excludeIds, isFavorite, addFavorite, fetchProduct]);

  const handlePass = useCallback(() => {
    if (!product) return;

    setShowFeedback('pass');
    setPassedCount(prev => prev + 1);

    // Fetch next product
    const newExcludeIds = [...excludeIds, product.id];
    setExcludeIds(newExcludeIds);

    setTimeout(() => {
      setShowFeedback(null);
      fetchProduct(newExcludeIds);
    }, 300);
  }, [product, excludeIds, fetchProduct]);

  const handleReset = useCallback(() => {
    setExcludeIds([]);
    setPassedCount(0);
    setLikedCount(0);
    fetchProduct([]);
  }, [fetchProduct]);

  // Image list (main + sample images)
  const images = product ? [
    product.imageUrl,
    ...(product.sampleImages?.slice(0, 5) || []),
  ].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-500" />
            {t.title}
          </h1>
          <p className="text-gray-500 mt-2">{t.subtitle}</p>

          {/* Stats */}
          <div className="flex justify-center gap-4 mt-4 text-sm">
            <span className="text-rose-600">
              {t.likedCount.replace('{count}', String(likedCount))}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">
              {t.passedCount.replace('{count}', String(passedCount))}
            </span>
            {(likedCount > 0 || passedCount > 0) && (
              <>
                <span className="text-gray-400">|</span>
                <button
                  onClick={handleReset}
                  className="text-blue-600 hover:text-blue-500 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t.reset}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-md mx-auto">
          {isLoading ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
              <RefreshCw className="w-12 h-12 text-gray-400 mx-auto animate-spin" />
              <p className="text-gray-500 mt-4">{t.loading}</p>
            </div>
          ) : !product ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="text-gray-500 mt-4">{t.noMore}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2 bg-rose-700 text-white rounded-lg hover:bg-rose-600 transition-colors"
              >
                {t.tryAgain}
              </button>
            </div>
          ) : (
            <div
              className={`relative bg-white rounded-2xl overflow-hidden shadow-xl transition-all duration-300 ${
                showFeedback === 'like'
                  ? 'scale-95 opacity-50 translate-x-20'
                  : showFeedback === 'pass'
                  ? 'scale-95 opacity-50 -translate-x-20'
                  : ''
              }`}
            >
              {/* Image Gallery */}
              <div className="relative aspect-3/4 bg-gray-100">
                <Image
                  src={images[currentImageIndex] || product.imageUrl}
                  alt={product.title}
                  fill
                  className="object-cover"
                />

                {/* Image Navigation Dots */}
                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentImageIndex
                            ? 'bg-white w-4 shadow-md'
                            : 'bg-white/50 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Feedback Overlay */}
                {showFeedback && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    {showFeedback === 'like' ? (
                      <Heart className="w-24 h-24 text-rose-500 fill-rose-500 animate-ping" />
                    ) : (
                      <X className="w-24 h-24 text-gray-500 animate-ping" />
                    )}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h2 className="text-lg font-bold text-gray-800 line-clamp-2 mb-2">
                  {product.title}
                </h2>

                <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
                  {product.performers.length > 0 && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {product.performers.slice(0, 2).join(', ')}
                      {product.performers.length > 2 && ` +${product.performers.length - 2}`}
                    </span>
                  )}
                  {product.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {product.duration}{t.duration}
                    </span>
                  )}
                  {product.price && (
                    <span className="text-emerald-600 font-medium">
                      ¥{product.price.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  {/* Pass Button */}
                  <button
                    onClick={handlePass}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                    {t.pass}
                  </button>

                  {/* Like Button */}
                  <button
                    onClick={handleLike}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-700 hover:bg-rose-600 text-white rounded-xl transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                    {t.interested}
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex gap-2 mt-3">
                  <Link
                    href={localizedHref(`/products/${product.id}`, locale)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
                  >
                    {t.viewDetails}
                  </Link>
                  {product.affiliateUrl && (
                    <a
                      href={product.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="flex-1 flex items-center justify-center gap-2 py-2 border border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-lg text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t.buyNow}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
