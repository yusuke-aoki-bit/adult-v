'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useEffect, useRef, TouchEvent, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { Product } from '@/types/product';
import { normalizeImageUrl, getFullSizeImageUrl, isDtiUncensoredSite, isSubscriptionSite } from '@/lib/image-utils';
import { generateAltText } from '@/lib/seo-utils';
import { formatPrice } from '@/lib/utils/subscription';
import { providerMeta, type ProviderId } from '@/lib/providers';
import FavoriteButton from './FavoriteButton';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x560/1f2937/ffffff?text=NO+IMAGE';

export default function ProductCard({ product }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations('productCard');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasValidImageUrl = product.imageUrl && product.imageUrl.trim() !== '';
  const [imgSrc, setImgSrc] = useState(hasValidImageUrl ? normalizeImageUrl(product.imageUrl) : PLACEHOLDER_IMAGE);
  const [hasError, setHasError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImgError, setModalImgError] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  // スワイプ用の状態
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 全画像配列（メイン画像 + サンプル画像）- サムネイルURLを高解像度に変換
  const allImages = useMemo(() => {
    const images: string[] = [];
    if (hasValidImageUrl && product.imageUrl) {
      const normalized = normalizeImageUrl(product.imageUrl);
      const fullSize = getFullSizeImageUrl(normalized);
      images.push(fullSize);
    }
    if (product.sampleImages && product.sampleImages.length > 0) {
      product.sampleImages.forEach(img => {
        const normalized = normalizeImageUrl(img);
        const fullSize = getFullSizeImageUrl(normalized);
        if (!images.includes(fullSize)) {
          images.push(fullSize);
        }
      });
    }
    return images;
  }, [product.imageUrl, product.sampleImages, hasValidImageUrl]);

  const hasMultipleImages = allImages.length > 1;
  const currentModalImage = allImages[modalImageIndex] || PLACEHOLDER_IMAGE;

  // 女優ページかどうかを判定
  const isActressPage = pathname.includes('/actress/');

  // ASPフィルタURLを生成
  const getAspFilterUrl = useCallback((provider: string) => {
    // 女優ページの場合は現在のページ+ASPフィルタ
    if (isActressPage) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('includeAsp', provider);
      params.delete('page');
      return `${pathname}?${params.toString()}`;
    }
    // それ以外は作品一覧ページへ
    return `/${locale}/products?includeAsp=${provider}`;
  }, [isActressPage, pathname, searchParams, locale]);

  // タグリンクのURLを生成（既存のフィルターにタグを追加）
  const getTagFilterUrl = useCallback((tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const existingInclude = params.get('include');

    if (existingInclude) {
      // 既存のタグがある場合、重複チェックしてから追加
      const existingTags = existingInclude.split(',').map(t => t.trim());
      if (!existingTags.includes(tag)) {
        params.set('include', [...existingTags, tag].join(','));
      }
      // すでに含まれている場合は何も変更しない
    } else {
      params.set('include', tag);
    }

    params.delete('page'); // ページをリセット

    if (isActressPage) {
      return `${pathname}?${params.toString()}`;
    }
    // 作品一覧ページへ遷移（既存のフィルターも引き継ぐ）
    return `/${locale}/products?${params.toString()}`;
  }, [isActressPage, pathname, searchParams, locale]);

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(PLACEHOLDER_IMAGE);
    }
  };

  // DTI系（無修正）サイトの画像かどうか
  const isUncensored = isDtiUncensoredSite(imgSrc);

  // モーダル内画像ナビゲーション
  const goToPreviousImage = useCallback(() => {
    setModalImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
    setModalImgError(false);
  }, [allImages.length]);

  const goToNextImage = useCallback(() => {
    setModalImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    setModalImgError(false);
  }, [allImages.length]);

  // スワイプハンドラー
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
    setIsTransitioning(false);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    touchEndX.current = currentX;
    const diff = currentX - touchStartX.current;
    setSwipeOffset(diff);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) {
      setSwipeOffset(0);
      return;
    }

    const diff = touchEndX.current - touchStartX.current;
    const threshold = 50;

    setIsTransitioning(true);
    setSwipeOffset(0);

    if (diff > threshold && hasMultipleImages) {
      goToPreviousImage();
    } else if (diff < -threshold && hasMultipleImages) {
      goToNextImage();
    }

    touchStartX.current = null;
    touchEndX.current = null;

    setTimeout(() => setIsTransitioning(false), 300);
  }, [hasMultipleImages, goToPreviousImage, goToNextImage]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // プレースホルダー画像の場合はモーダルを開かない（無修正はブラー付きで拡大OK）
    if (imgSrc !== PLACEHOLDER_IMAGE && hasValidImageUrl && !hasError) {
      setShowModal(true);
    }
  }, [imgSrc, hasValidImageUrl, hasError]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setModalImgError(false);
    setModalImageIndex(0);
  }, []);

  // モーダル背景クリックゾーンハンドラー（画面左1/3: 前へ、中央1/3: 閉じる、右1/3: 次へ）
  const handleModalZoneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 画面全体の幅で判定
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    if (hasMultipleImages && clickX < screenWidth / 3) {
      // 画面左1/3 - 前の画像
      goToPreviousImage();
    } else if (hasMultipleImages && clickX > (screenWidth * 2) / 3) {
      // 画面右1/3 - 次の画像
      goToNextImage();
    } else {
      // 画面中央1/3 - モーダルを閉じる
      handleCloseModal();
    }
  }, [hasMultipleImages, goToPreviousImage, goToNextImage, handleCloseModal]);

  // ESCキーでモーダルを閉じる & 矢印キーでナビゲーション & スクロール無効化
  useEffect(() => {
    if (!showModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        goToPreviousImage();
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        goToNextImage();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModal, hasMultipleImages, goToPreviousImage, goToNextImage]);

  return (
    <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300 border border-gray-700">
      <div className="relative h-72 bg-gradient-to-br from-gray-700 to-gray-800">
        <div className="relative block h-full group">
          {/* 画像クリックでフルサイズ表示 */}
          <button
            type="button"
            onClick={handleImageClick}
            className="absolute inset-0 z-10 cursor-zoom-in focus:outline-none"
            aria-label={t('enlargeImage')}
          />
          <Image
            src={imgSrc}
            alt={generateAltText(product)}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            onError={handleImageError}
            priority={false}
            quality={75}
          />
          {/* ズームアイコン */}
          {hasValidImageUrl && !hasError && imgSrc !== PLACEHOLDER_IMAGE && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
          {/* No Image オーバーレイ */}
          {(hasError || imgSrc === PLACEHOLDER_IMAGE || !hasValidImageUrl) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800">
              <div className="text-7xl mb-3 text-gray-500">📷</div>
              <span className="inline-block px-4 py-1.5 bg-gray-600 text-white text-xs font-bold rounded-full shadow-md">
                NO IMAGE
              </span>
            </div>
          )}
        </div>
        {product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-600 text-white shadow-lg">
              {t('comingSoon')}
            </span>
          </div>
        )}
        {product.isNew && !product.isFuture && (
          <div className="absolute top-4 left-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-600 text-white shadow-lg">
              NEW
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4 bg-gray-700 rounded-full shadow-md">
          <FavoriteButton type="product" id={product.id} />
        </div>
        {product.discount && !product.salePrice && (
          <span className="absolute bottom-4 right-4 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
            {product.discount}%OFF
          </span>
        )}
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-400 flex items-center gap-1 flex-wrap">
            {product.actressId ? (
              <Link
                href={`/${locale}/actress/${product.actressId}`}
                className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {product.actressName ?? t('performerInfo')}
              </Link>
            ) : product.performers && product.performers.length > 0 ? (
              product.performers.slice(0, 3).map((performer, index) => (
                <span key={performer.id}>
                  <Link
                    href={`/${locale}/actress/${performer.id}`}
                    className="text-rose-400/80 hover:text-rose-400 hover:underline underline-offset-2 transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {performer.name}
                  </Link>
                  {index < Math.min(product.performers!.length, 3) - 1 && <span className="mx-0.5 text-gray-500">/</span>}
                </span>
              ))
            ) : (
              <span className="text-gray-500">{product.actressName ?? t('performerInfo')}</span>
            )}
            <span className="mx-1 text-gray-600">|</span>
            <span className="text-gray-500">{product.releaseDate ?? t('releaseDateTbd')}</span>
          </div>
          <Link href={`/${locale}/products/${product.id}`}>
            <div className="text-xs text-gray-500 mt-1">
              <p>{t('productId')}: {product.normalizedProductId || product.id}</p>
              {product.originalProductId && (
                <p>{t('manufacturerId')}: {product.originalProductId}</p>
              )}
            </div>
            <h3 className="font-semibold text-xl leading-tight mt-1 line-clamp-2 text-white hover:text-gray-300">
              {product.title}
            </h3>
          </Link>
          <p className="text-sm text-gray-400 mt-2 line-clamp-3">{product.description}</p>
        </div>

        {product.reviewHighlight && (
          <p className="text-sm text-gray-200 bg-gray-700 rounded-xl px-4 py-2 italic">
            &ldquo;{product.reviewHighlight}&rdquo;
          </p>
        )}

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.slice(0, 4).map((tag) => (
              <Link
                key={tag}
                href={getTagFilterUrl(tag)}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-700 text-gray-300 hover:bg-rose-600 hover:text-white transition-all border border-gray-600 hover:border-rose-500 cursor-pointer group"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  {tag}
                </span>
              </Link>
            ))}
          </div>
        )}

        {(product.rating || product.duration) && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            {product.rating && (
              <>
                <span className="font-semibold text-white">{product.rating.toFixed(1)}</span>
                <span>({product.reviewCount ?? 0}{t('reviews')})</span>
              </>
            )}
            {product.duration && <span>・ {product.duration}{t('minutes')}</span>}
          </div>
        )}

        <div className="mt-auto space-y-2">
          {/* 価格表示: セール中の場合は通常価格を取り消し線、セール価格を強調表示 */}
          {product.salePrice && product.regularPrice ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-red-500">
                  {formatPrice(product.salePrice, product.currency)}
                </p>
                <p className="text-sm text-gray-500 line-through">
                  {formatPrice(product.regularPrice, product.currency)}
                </p>
                {product.discount && (
                  <span className="text-xs font-bold text-red-400 bg-red-900/50 px-1.5 py-0.5 rounded">
                    {product.discount}%OFF
                  </span>
                )}
              </div>
            </div>
          ) : product.price > 0 ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <p className="text-2xl font-semibold text-white">
                {formatPrice(product.price, product.currency)}
              </p>
            </div>
          ) : isSubscriptionSite(product.provider) ? (
            <div>
              <Link
                href={getAspFilterUrl(product.provider)}
                onClick={(e) => e.stopPropagation()}
                className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                  providerMeta[product.provider as ProviderId]?.textClass || 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {product.providerLabel}
              </Link>
              <p className="text-lg font-semibold text-rose-500">
                {t('subscriptionOnly')}
              </p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Link
              href={`/${locale}/products/${product.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 text-white px-3 py-2 hover:bg-gray-800 active:scale-95 transition-transform"
              title={t('viewDetails')}
              aria-label={t('viewDetails')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </Link>
            {product.affiliateUrl && (
              <a
                href={product.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 text-white px-3 py-2 text-sm font-semibold hover:bg-rose-700 active:scale-95 transition-transform"
                title={`${product.providerLabel}で購入`}
                aria-label={`${product.providerLabel}で購入（外部リンク）`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* フルサイズ画像モーダル */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 cursor-pointer select-none"
          onClick={handleModalZoneClick}
          style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          {/* 閉じるボタン */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            aria-label={t('close')}
          >
            <X className="w-8 h-8" />
          </button>

          {/* 画像カウンター（複数画像の場合） */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded text-white text-lg z-10">
              {modalImageIndex + 1} / {allImages.length}
            </div>
          )}

          {/* クリックで閉じるヒント */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded text-white/70 text-sm pointer-events-none">
            {t('clickToCloseEsc')}
          </div>

          {/* メイン画像 - スワイプ対応 */}
          <div
            className="relative max-w-5xl max-h-[85vh] mx-4 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modalImgError ? imgSrc : getFullSizeImageUrl(currentModalImage)}
                alt={generateAltText(product)}
                className={`max-w-full max-h-[85vh] object-contain ${isUncensored ? 'blur-[3px]' : ''}`}
                onError={() => {
                  if (!modalImgError) {
                    setModalImgError(true);
                  }
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* ナビゲーションボタン（複数画像の場合） */}
          {hasMultipleImages && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goToPreviousImage(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={t('nextImage')}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* サムネイル一覧（複数画像の場合） */}
          {hasMultipleImages && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/60 rounded-lg max-w-[90vw] overflow-x-auto">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={imgUrl}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setModalImageIndex(idx); setModalImgError(false); }}
                  className={`relative w-20 h-28 shrink-0 rounded overflow-hidden border-2 transition-all ${
                    modalImageIndex === idx
                      ? 'border-rose-600'
                      : 'border-transparent hover:border-gray-500'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`${t('thumbnailAlt')} ${idx + 1}`}
                    className={`w-full h-full object-cover ${isUncensored ? 'blur-[2px]' : ''}`}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {/* フォールバック表示 */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-700 -z-10">
                    <span className="text-gray-400 text-xs">{idx + 1}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* 詳細ページへのリンク */}
          <Link
            href={`/${locale}/products/${product.id}`}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition-colors pointer-events-auto flex items-center gap-2 whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            {t('viewDetails')}
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
