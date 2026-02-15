'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Play, Clock } from 'lucide-react';
import { localizedHref } from '@adult-v/shared/i18n';

interface SaleProduct {
  productId: number;
  normalizedProductId: string | null;
  title: string;
  thumbnailUrl: string | null;
  aspName: string;
  affiliateUrl: string | null;
  regularPrice: number;
  salePrice: number;
  discountPercent: number;
  saleName: string | null;
  saleType: string | null;
  endAt: string | null;
  performers: Array<{ id: number; name: string; profileImageUrl?: string | null }>;
}

interface TrendingActress {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  releaseCount?: number;
}

interface HeroSectionProps {
  locale: string;
  saleProducts: SaleProduct[];
  trendingActresses?: TrendingActress[];
  totalActressCount?: number;
  totalProductCount?: number;
}

// カウントダウンタイマーコンポーネント
function CountdownTimer({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endAt).getTime();
      // 無効な日付の場合はnullを設定して終了
      if (isNaN(end)) {
        setTimeLeft(null);
        return;
      }
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1 text-sm">
      <Clock className="w-4 h-4" />
      <span className="font-mono">
        {String(timeLeft.hours).padStart(2, '0')}:
        {String(timeLeft.minutes).padStart(2, '0')}:
        {String(timeLeft.seconds).padStart(2, '0')}
      </span>
      <span className="text-xs opacity-80 ml-1">
        {timeLeft.hours > 0 ? `残り${timeLeft.hours}時間${timeLeft.minutes}分` : `残り${timeLeft.minutes}分`}
      </span>
    </div>
  );
}

export default function HeroSection({
  locale,
  saleProducts,
  trendingActresses = [],
  totalActressCount = 38000,
  totalProductCount = 120000,
}: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // 表示する商品（最大5件）
  const heroProducts = saleProducts.slice(0, 5);

  // 自動スライド
  useEffect(() => {
    if (!isAutoPlaying || heroProducts.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroProducts.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isAutoPlaying, heroProducts.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const goToPrev = () => {
    setCurrentSlide((prev) => (prev - 1 + heroProducts.length) % heroProducts.length);
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % heroProducts.length);
    setIsAutoPlaying(false);
  };

  const currentProduct = heroProducts[currentSlide];

  // セールがない場合は統計情報のみ表示
  if (heroProducts.length === 0) {
    return (
      <section className="relative bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              アダルト動画の<span className="text-pink-400">総合データベース</span>
            </h1>
            <p className="text-gray-300 text-lg mb-8">
              {totalActressCount.toLocaleString()}名以上の女優、{totalProductCount.toLocaleString()}本以上の作品を収録
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href={localizedHref('/products', locale)}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-lg hover:from-pink-400 hover:to-rose-400 transition-all transform hover:scale-105"
              >
                作品を探す
              </Link>
              <Link
                href={localizedHref('/', locale)}
                className="px-6 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-all"
              >
                女優を探す
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      {/* 背景グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-red-900/30 to-gray-900" />

      {/* メインカルーセル */}
      <div className="relative container mx-auto px-4 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          {/* 左側: 商品情報 */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* セールバッジ */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold rounded-full text-sm animate-pulse">
                <Flame className="w-4 h-4" />
                SALE
              </span>
              {currentProduct?.discountPercent && (
                <span className="px-3 py-1.5 bg-yellow-500 text-black font-bold rounded-full text-sm">
                  最大 {currentProduct.discountPercent}% OFF
                </span>
              )}
              {currentProduct?.endAt && (
                <div className="px-3 py-1.5 bg-black/50 text-white rounded-full">
                  <CountdownTimer endAt={currentProduct.endAt} />
                </div>
              )}
            </div>

            {/* タイトル */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-2">
              {currentProduct?.title}
            </h2>

            {/* 出演者 */}
            {currentProduct?.performers && currentProduct.performers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-sm">出演:</span>
                {currentProduct.performers.slice(0, 3).map((performer, i) => (
                  <Link
                    key={performer.id}
                    href={localizedHref(`/actress/${performer.id}`, locale)}
                    className="text-pink-400 hover:text-pink-300 font-medium transition-colors"
                  >
                    {performer.name}
                    {i < Math.min(currentProduct.performers.length, 3) - 1 && ', '}
                  </Link>
                ))}
                {currentProduct.performers.length > 3 && (
                  <span className="text-gray-400 text-sm">他</span>
                )}
              </div>
            )}

            {/* 価格 */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-bold text-red-400">
                ¥{currentProduct?.salePrice?.toLocaleString()}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ¥{currentProduct?.regularPrice?.toLocaleString()}
              </span>
            </div>
            {currentProduct?.regularPrice && currentProduct?.salePrice && currentProduct.regularPrice > currentProduct.salePrice && (
              <p className="text-sm text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ¥{(currentProduct.regularPrice - currentProduct.salePrice).toLocaleString()} お得
              </p>
            )}

            {/* CTA */}
            <div className="flex gap-3 flex-wrap">
              <Link
                href={localizedHref(`/products/${currentProduct?.productId}`, locale)}
                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold rounded-lg hover:from-pink-400 hover:to-rose-400 transition-all transform hover:scale-105 text-center shadow-lg shadow-pink-500/30"
              >
                詳細を見る
              </Link>
              <Link
                href={localizedHref('/sales', locale)}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-700/80 text-white font-bold rounded-lg hover:bg-gray-600 transition-all text-center"
              >
                全セール商品 →
              </Link>
            </div>
          </div>

          {/* 右側: 画像 */}
          <div className="relative order-1 lg:order-2">
            <div
              className="relative aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl"
              onMouseEnter={() => setIsAutoPlaying(false)}
              onMouseLeave={() => setIsAutoPlaying(true)}
            >
              {currentProduct?.thumbnailUrl ? (
                <Image
                  src={currentProduct.thumbnailUrl}
                  alt={currentProduct.title}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  quality={78}
                  placeholder="blur"
                  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                />
              ) : (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <Play className="w-16 h-16 text-gray-600" />
                </div>
              )}

              {/* オーバーレイ */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* ナビゲーションボタン */}
              {heroProducts.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-3 sm:p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label="前の商品"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 sm:p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    aria-label="次の商品"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* ドットインジケーター + スライドカウンター */}
            {heroProducts.length > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="flex gap-2">
                  {heroProducts.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`h-3 rounded-full transition-all p-1 ${
                        index === currentSlide
                          ? 'bg-pink-500 w-8'
                          : 'bg-gray-600 hover:bg-gray-500 w-3'
                      }`}
                      aria-label={`スライド ${index + 1}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {currentSlide + 1}/{heroProducts.length}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* トレンド女優ストリップ */}
        {trendingActresses.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-bold text-white">今週のトレンド女優</h3>
              <Link
                href={localizedHref('/', locale)}
                className="ml-auto text-sm text-pink-400 hover:text-pink-300"
              >
                もっと見る →
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
              {trendingActresses.map((actress) => (
                <Link
                  key={actress.id}
                  href={localizedHref(`/actress/${actress.id}`, locale)}
                  className="flex-shrink-0 group"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-pink-500 transition-all">
                    {actress.thumbnailUrl ? (
                      <Image
                        src={actress.thumbnailUrl}
                        alt={actress.name}
                        fill
                        className="object-cover"
                        sizes="96px"
                        quality={72}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-500 text-2xl">
                        {actress.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-center text-sm text-white mt-2 truncate max-w-20 sm:max-w-24 group-hover:text-pink-400 transition-colors">
                    {actress.name}
                  </p>
                  {actress.releaseCount && (
                    <p className="text-center text-xs text-gray-400">
                      {actress.releaseCount}本
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
