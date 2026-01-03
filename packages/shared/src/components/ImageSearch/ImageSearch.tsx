'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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

export function ImageSearch({ locale = 'ja', theme = 'dark', onProductClick }: ImageSearchProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themeClasses = {
    container: theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: theme === 'dark' ? 'text-white' : 'text-gray-900',
    textMuted: theme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    dropzone: theme === 'dark'
      ? 'border-gray-600 hover:border-blue-500 bg-gray-700/50'
      : 'border-gray-300 hover:border-blue-400 bg-gray-50',
    dropzoneActive: theme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-400 bg-blue-50',
    card: theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
    tag: theme === 'dark' ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700',
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setResults([]);
    setAnalysis(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  // クリップボードからの貼り付け処理
  const handlePaste = useCallback((e: ClipboardEvent) => {
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
  }, [handleFileSelect]);

  // グローバルなペーストイベントを監視
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  const handleSearch = useCallback(async () => {
    if (!selectedImage) return;

    setIsSearching(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '検索に失敗しました');
      }

      const data = await response.json();
      setResults(data.results || []);
      setAnalysis(data.analysis || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '検索中にエラーが発生しました');
    } finally {
      setIsSearching(false);
    }
  }, [selectedImage]);

  const handleClear = useCallback(() => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResults([]);
    setAnalysis(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleProductClick = useCallback((result: SearchResult) => {
    if (onProductClick && result.normalizedProductId) {
      onProductClick(result.normalizedProductId);
    }
  }, [onProductClick]);

  return (
    <div className={`rounded-lg border p-4 sm:p-6 ${themeClasses.container}`}>
      {/* ヘッダー */}
      <div className="mb-4">
        <h2 className={`text-lg sm:text-xl font-bold ${themeClasses.text} flex items-center gap-2`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {locale === 'ja' ? '画像で検索' : 'Search by Image'}
        </h2>
        <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
          {locale === 'ja'
            ? '画像を貼り付け（Ctrl+V）またはドラッグ＆ドロップして類似作品を検索'
            : 'Paste (Ctrl+V) or drag & drop an image to find similar products'}
        </p>
      </div>

      {/* ドロップゾーン */}
      {!previewUrl ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? themeClasses.dropzoneActive : themeClasses.dropzone
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleInputChange}
          />
          <svg
            className={`w-12 h-12 mx-auto mb-3 ${themeClasses.textMuted}`}
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
          <p className={themeClasses.text}>
            {locale === 'ja' ? 'Ctrl+V で貼り付け' : 'Paste with Ctrl+V'}
          </p>
          <p className={`text-sm ${themeClasses.textMuted} mt-1`}>
            {locale === 'ja' ? 'またはクリック・ドラッグ＆ドロップでアップロード' : 'Or click / drag & drop to upload'}
          </p>
          <p className={`text-xs ${themeClasses.textMuted} mt-2`}>
            {locale === 'ja' ? 'JPEG, PNG, WebP, GIF (最大5MB)' : 'JPEG, PNG, WebP, GIF (max 5MB)'}
          </p>
        </div>
      ) : (
        /* プレビュー */
        <div className="space-y-4">
          <div className="relative">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full max-h-64 object-contain rounded-lg"
            />
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 検索ボタン */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              isSearching
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {locale === 'ja' ? '分析中...' : 'Analyzing...'}
              </span>
            ) : (
              locale === 'ja' ? '類似作品を検索' : 'Search Similar'
            )}
          </button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 分析結果 */}
      {analysis && (
        <div className={`mt-6 p-4 rounded-lg ${themeClasses.card}`}>
          <h3 className={`font-semibold mb-2 ${themeClasses.text}`}>
            {locale === 'ja' ? '画像分析結果' : 'Image Analysis'}
          </h3>
          <p className={`text-sm ${themeClasses.textMuted} mb-3`}>{analysis.description}</p>

          {analysis.keywords.length > 0 && (
            <div className="mb-3">
              <p className={`text-xs ${themeClasses.textMuted} mb-1`}>
                {locale === 'ja' ? '検出キーワード:' : 'Keywords:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.keywords.map((keyword, i) => (
                  <span key={i} className={`px-2 py-0.5 text-xs rounded ${themeClasses.tag}`}>
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.genres.length > 0 && (
            <div>
              <p className={`text-xs ${themeClasses.textMuted} mb-1`}>
                {locale === 'ja' ? '推奨ジャンル:' : 'Suggested Genres:'}
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.genres.map((genre, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs rounded bg-blue-600/30 text-blue-300">
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
          <h3 className={`font-semibold mb-3 ${themeClasses.text}`}>
            {locale === 'ja' ? `類似作品 (${results.length}件)` : `Similar Products (${results.length})`}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.map((result) => (
              <div
                key={result.id}
                className={`rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105 ${themeClasses.card}`}
                onClick={() => handleProductClick(result)}
              >
                <div className="relative aspect-3/4">
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${themeClasses.textMuted}`}>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* スコアバッジ */}
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                    {result.score}%
                  </div>
                </div>
                <div className="p-2">
                  <p className={`text-xs line-clamp-2 ${themeClasses.text}`}>{result.title}</p>
                  <p className={`text-xs mt-1 ${themeClasses.textMuted}`}>{result.matchReason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 結果なし */}
      {analysis && results.length === 0 && !isSearching && (
        <div className={`mt-6 text-center py-8 ${themeClasses.textMuted}`}>
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{locale === 'ja' ? '類似作品が見つかりませんでした' : 'No similar products found'}</p>
        </div>
      )}
    </div>
  );
}
