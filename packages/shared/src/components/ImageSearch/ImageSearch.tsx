'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSiteTheme } from '../../contexts/SiteThemeContext';
import { getTranslation, imageSearchTranslations } from '../../lib/translations';

interface SearchResult {
  id: number;
  title: string;
  normalizedProductId: string | null;
  imageUrl: string | null;
  genres: string[];
  score: number;
  matchReason: string;
}

interface AnalysisResult {
  description: string;
  keywords: string[];
  genres: string[];
  features?: {
    performers?: string[];
    setting?: string;
    clothing?: string[];
    mood?: string;
    actions?: string[];
  };
}

interface ImageSearchProps {
  locale?: string;
  theme?: 'light' | 'dark';
  onProductClick?: (productId: string) => void;
}

export function ImageSearch({ locale = 'ja', theme: themeProp, onProductClick }: ImageSearchProps) {
  const { theme: contextTheme } = useSiteTheme();
  const theme = themeProp ?? contextTheme;
  const st = getTranslation(imageSearchTranslations, locale);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Cleanup blob URL when previewUrl changes or on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    dropzone:
      theme === 'dark'
        ? 'border-gray-600 hover:border-blue-500 bg-gray-700/50'
        : 'border-gray-300 hover:border-blue-400 bg-gray-50',
    dropzoneActive: theme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-400 bg-blue-50',
    card: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    tag: theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700',
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(st.invalidFile);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(st.fileTooLarge);
      return;
    }

    setSelectedImage(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setError(null);
    setResults([]);
    setAnalysis(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  // クリップボードからの貼り付け処理
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFileSelect(file);
            return;
          }
        }
      }
    },
    [handleFileSelect],
  );

  // グローバルなペーストイベントを監視
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleSearch = useCallback(async () => {
    if (!selectedImage) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || st.searchFailed);
      }

      const data = await response.json();
      setResults(data.results || []);
      setAnalysis(data.analysis || null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : st.searchError);
    } finally {
      setIsSearching(false);
    }
  }, [selectedImage]);

  const handleClear = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(null);
    setPreviewUrl(null);
    setResults([]);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const handleProductClick = useCallback(
    (result: SearchResult) => {
      if (onProductClick && result.normalizedProductId) {
        onProductClick(result.normalizedProductId);
      }
    },
    [onProductClick],
  );

  return (
    <div className={`rounded-lg border p-4 sm:p-6 ${themeClasses.container}`}>
      {/* ヘッダー */}
      <div className="mb-4">
        <h2 className={`text-lg font-bold sm:text-xl ${themeClasses.text} flex items-center gap-2`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {st.title}
        </h2>
        <p className={`text-sm ${themeClasses.textMuted} mt-1`}>{st.subtitle}</p>
      </div>

      {/* ドロップゾーン */}
      {!previewUrl ? (
        <div
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
            isDragging ? themeClasses.dropzoneActive : themeClasses.dropzone
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          <svg
            className={`mx-auto mb-3 h-12 w-12 ${themeClasses.textMuted}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className={themeClasses.text}>{st.paste}</p>
          <p className={`text-sm ${themeClasses.textMuted} mt-1`}>{st.uploadHint}</p>
          <p className={`text-xs ${themeClasses.textMuted} mt-2`}>{st.formats}</p>
        </div>
      ) : (
        /* プレビュー */
        <div className="space-y-4">
          <div className="relative">
            <img src={previewUrl} alt="Preview" className="max-h-64 w-full rounded-lg object-contain" />
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 検索ボタン */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className={`w-full rounded-lg py-3 font-medium transition-colors ${
              isSearching ? 'cursor-not-allowed bg-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {st.analyzing}
              </span>
            ) : (
              st.searchSimilar
            )}
          </button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {/* 分析結果 */}
      {analysis && (
        <div className={`mt-6 rounded-lg p-4 ${themeClasses.card}`}>
          <h3 className={`mb-2 font-semibold ${themeClasses.text}`}>{st.analysisResult}</h3>
          <p className={`text-sm ${themeClasses.textMuted} mb-3`}>{analysis.description}</p>

          {analysis.keywords.length > 0 && (
            <div className="mb-3">
              <p className={`text-xs ${themeClasses.textMuted} mb-1`}>{st.keywords}</p>
              <div className="flex flex-wrap gap-1">
                {analysis.keywords.map((keyword, i) => (
                  <span key={i} className={`rounded px-2 py-0.5 text-xs ${themeClasses.tag}`}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.genres.length > 0 && (
            <div>
              <p className={`text-xs ${themeClasses.textMuted} mb-1`}>{st.genres}</p>
              <div className="flex flex-wrap gap-1">
                {analysis.genres.map((genre, i) => (
                  <span key={i} className="rounded bg-blue-600/30 px-2 py-0.5 text-xs text-blue-300">
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 検索結果 */}
      {results.length > 0 && (
        <div className="mt-6">
          <h3 className={`mb-3 font-semibold ${themeClasses.text}`}>{st.results(results.length)}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.map((result) => (
              <div
                key={result['id']}
                className={`cursor-pointer overflow-hidden rounded-lg transition-transform hover:scale-105 ${themeClasses.card}`}
                onClick={() => handleProductClick(result)}
              >
                <div className="relative aspect-3/4">
                  {result.imageUrl ? (
                    <img src={result.imageUrl} alt={result['title']} className="h-full w-full object-cover" />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${themeClasses.textMuted}`}>
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {/* スコアバッジ */}
                  <div className="absolute top-1 right-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">
                    {result.score}%
                  </div>
                </div>
                <div className="p-2">
                  <p className={`line-clamp-2 text-xs ${themeClasses.text}`}>{result['title']}</p>
                  <p className={`mt-1 text-xs ${themeClasses.textMuted}`}>{result.matchReason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 結果なし */}
      {analysis && results.length === 0 && !isSearching && (
        <div className={`mt-6 py-8 text-center ${themeClasses.textMuted}`}>
          <svg className="mx-auto mb-3 h-12 w-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>{st.noResults}</p>
        </div>
      )}
    </div>
  );
}
