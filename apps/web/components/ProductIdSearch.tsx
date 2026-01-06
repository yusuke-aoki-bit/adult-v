'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function ProductIdSearch() {
  const [productId, setProductId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useParams();
  const locale = params['locale'] as string || 'ja';
  const t = useTranslations('productIdSearch');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId.trim()) {
      setError(t('errorRequired'));
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await fetch(`/api/products/search-by-id?productId=${encodeURIComponent(productId.trim())}`);
      const data = await response.json();

      if (response.ok && data.product) {
        // Redirect to product page
        router.push(`/${locale}/products/${data.product.id}`);
      } else {
        setError(data.error || t('errorNotFound'));
      }
    } catch (err) {
      setError(t('errorGeneric'));
      console.error('Product ID search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('title')}</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setError('');
          }}
          placeholder={t('placeholder')}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
          disabled={isSearching}
        />
        <button
          type="submit"
          disabled={isSearching}
          className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSearching ? t('searching') : t('searchButton')}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        {t('helperText')}
      </p>
    </div>
  );
}
