'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import ActressCard from '@/components/ActressCard';
import Pagination from '@/components/Pagination';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Actress } from '@/types/product';

const PER_PAGE = 24;

function ActressesContent() {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const [actresses, setActresses] = useState<Actress[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function loadActresses() {
      setLoading(true);
      try {
        // APIルートからデータを取得
        const response = await fetch('/api/actresses?limit=10000');
        const data = await response.json();
        const allActresses = data.actresses || [];
        
        setTotal(allActresses.length);
        
        const start = (page - 1) * PER_PAGE;
        const end = start + PER_PAGE;
        const paginatedActresses = allActresses.slice(start, end);
        setActresses(paginatedActresses);
      } catch (error) {
        console.error('Error loading actresses:', error);
      } finally {
        setLoading(false);
      }
    }
    loadActresses();
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-8">
            <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {[...Array(24)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="h-48 bg-gray-200"></div>
                  <div className="p-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            女優図鑑
          </h1>
          <p className="text-lg text-gray-600">
            {total}名の女優を掲載中
          </p>
        </div>

        {actresses.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {actresses.map((actress) => (
                <Link key={actress.id} href={`/actress/${actress.id}`} className="block">
                  <ActressCard actress={actress} compact />
                </Link>
              ))}
            </div>
            <Pagination
              total={total}
              page={page}
              perPage={PER_PAGE}
              basePath="/actresses"
            />
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600">女優が見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActressesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4">
            <div className="animate-pulse space-y-8">
              <div className="h-12 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="h-48 bg-gray-200"></div>
                    <div className="p-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ActressesContent />
    </Suspense>
  );
}
