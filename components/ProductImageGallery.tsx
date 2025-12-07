'use client';

import Image from 'next/image';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { isDtiUncensoredSite, getFullSizeImageUrl } from '@/lib/image-utils';
import { useTranslations } from 'next-intl';

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x800/1f2937/ffffff?text=NO+IMAGE';

// 有効な画像URLかどうかをチェック（プロトコル相対URL対応）
function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  // HTMLタグが含まれている場合は無効
  if (url.includes('<') || url.includes('>')) return false;
  // 基本的なURL形式をチェック（プロトコル相対URLも許可）
  try {
    const urlToCheck = url.startsWith('//') ? `https:${url}` : url;
    const parsed = new URL(urlToCheck);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// URLを正規化（プロトコル相対URL → https://）
function normalizeUrl(url: string): string {
  if (!url) return PLACEHOLDER_IMAGE;
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  return url;
}

interface ProductImageGalleryProps {
  mainImage: string | null;
  sampleImages?: string[];
  productTitle: string;
}

export default function ProductImageGallery({ mainImage, sampleImages, productTitle }: ProductImageGalleryProps) {
  const t = useTranslations('productImageGallery');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 無修正サイトかどうかをチェック（ブラーを適用するため）
  const isUncensored = isDtiUncensoredSite(mainImage || '');

  // メイン画像とサンプル画像を結合し、重複を除外、無効なURLをフィルタリング、正規化
  const allImagesWithDuplicates = [mainImage, ...(sampleImages || [])]
    .filter((img): img is string => typeof img === 'string' && Boolean(img) && isValidImageUrl(img))
    .map((img) => normalizeUrl(img)); // プロトコル相対URLを絶対URLに変換
  // 重複する画像URLを除外（Set を使用）
  const allImages = Array.from(new Set(allImagesWithDuplicates));
  const hasMultipleImages = allImages.length > 1;

  const selectedImage = allImages[selectedIndex] || PLACEHOLDER_IMAGE;

  // ライトボックス用の高解像度画像URL（scap -> sample等の変換）
  const fullSizeImage = useMemo(() => {
    return getFullSizeImageUrl(selectedImage);
  }, [selectedImage]);

  const handleImageError = () => {
    setImageError(true);
  };

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  }, [allImages.length]);

  // キーボードナビゲーション
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, goToPrevious, goToNext]);

  // ライトボックスが開いているときはスクロールを無効化
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  return (
    <>
      <div className="space-y-4">
        {/* メイン画像 */}
        <div
          className="relative aspect-[3/4] w-full bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => setLightboxOpen(true)}
        >
          <Image
            src={imageError ? PLACEHOLDER_IMAGE : selectedImage}
            alt={productTitle}
            fill
            className={`object-cover transition-transform group-hover:scale-105 ${isUncensored ? 'blur-[3px]' : ''}`}
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
            onError={handleImageError}
          />
          {/* 拡大アイコン */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {/* ナビゲーションボタン（複数画像の場合） */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                aria-label={t('nextImage')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          {/* 画像カウンター */}
          {hasMultipleImages && (
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-sm">
              {selectedIndex + 1} / {allImages.length}
            </div>
          )}
        </div>

        {/* サムネイル一覧（複数画像がある場合のみ） */}
        {hasMultipleImages && (
          <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-5 gap-2">
            {allImages.map((imgUrl, idx) => (
              <button
                key={imgUrl}
                onClick={() => setSelectedIndex(idx)}
                className={`relative aspect-[3/4] rounded overflow-hidden border-2 transition-all ${
                  selectedIndex === idx
                    ? 'border-rose-600 ring-2 ring-rose-600/50'
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`${productTitle} - ${t('sampleImageAlt')} ${idx + 1}`}
                  fill
                  className={`object-cover ${isUncensored ? 'blur-[3px]' : ''}`}
                  sizes="(max-width: 768px) 20vw, (max-width: 1024px) 16vw, 10vw"
                />
              </button>
            ))}
          </div>
        )}

        {/* 画像枚数表示 */}
        {hasMultipleImages && (
          <p className="text-sm text-gray-400 text-center">
            {t('sampleImageCount', { count: allImages.length })}
          </p>
        )}
      </div>

      {/* ライトボックス */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          {/* 閉じるボタン */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            aria-label={t('close')}
          >
            <X className="w-8 h-8" />
          </button>

          {/* 画像カウンター */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 rounded text-white text-lg">
              {selectedIndex + 1} / {allImages.length}
            </div>
          )}

          {/* クリックで閉じるヒント */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 rounded text-white/70 text-sm pointer-events-none">
            {t('clickToCloseEsc')}
          </div>

          {/* メイン画像 - 画像クリックでも閉じる */}
          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh] mx-4 pointer-events-none"
          >
            <Image
              src={imageError ? PLACEHOLDER_IMAGE : fullSizeImage}
              alt={productTitle}
              fill
              className={`object-contain ${isUncensored ? 'blur-[3px]' : ''}`}
              sizes="100vw"
              priority
            />
          </div>

          {/* ナビゲーションボタン（複数画像の場合） */}
          {hasMultipleImages && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                aria-label={t('nextImage')}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* サムネイル一覧 */}
          {hasMultipleImages && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/60 rounded-lg max-w-full overflow-x-auto">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={imgUrl}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                  className={`relative w-16 h-20 shrink-0 rounded overflow-hidden border-2 transition-all ${
                    selectedIndex === idx
                      ? 'border-rose-600'
                      : 'border-transparent hover:border-gray-500'
                  }`}
                >
                  <Image
                    src={imgUrl}
                    alt={`${productTitle} - ${t('thumbnailAlt')} ${idx + 1}`}
                    fill
                    className={`object-cover ${isUncensored ? 'blur-[3px]' : ''}`}
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
