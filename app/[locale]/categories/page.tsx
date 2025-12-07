import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCategories } from '@/lib/db/queries';
import { generateBaseMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import Breadcrumb from '@/components/Breadcrumb';
import { JsonLD } from '@/components/JsonLD';
import { getLocalizedTagName } from '@/lib/localization';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return generateBaseMetadata(
    'アダルト動画ジャンル一覧【200種類以上】熟女・素人・VR等から検索',
    '【無料サンプル動画あり】200種類以上のジャンルから好みの作品を検索。熟女、素人、企画、フェチ、VR等人気ジャンルを網羅。MGS・DUGA・DTI等複数サイトの作品を一括比較。',
    undefined,
    `/${locale}/categories`,
    undefined,
    locale,
  );
}

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CategoriesPage({ params }: PageProps) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tCategories = await getTranslations({ locale, namespace: 'categories' });

  const categories = await getCategories({ sortBy: 'productCount', limit: 200 });

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tNav('home'),
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: tCategories('title'),
        item: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/categories`,
      },
    ],
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: tCategories('pageTitle'),
    numberOfItems: categories.length,
    itemListElement: categories.slice(0, 50).map((cat, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: getLocalizedTagName(cat, locale),
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/${locale}/categories/${cat.id}`,
    })),
  };

  const totalProducts = categories.reduce((sum, cat) => sum + cat.productCount, 0);

  return (
    <>
      <JsonLD data={breadcrumbSchema} />
      <JsonLD data={itemListSchema} />

      <div className="bg-gray-900 min-h-screen">
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <Breadcrumb
              items={[
                { label: tNav('home'), href: `/${locale}` },
                { label: tCategories('title') },
              ]}
              className="mb-6"
            />

            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                {tCategories('pageTitle')}
              </h1>
              <p className="text-gray-300">
                {tCategories('pageDescription', { count: categories.length, totalProducts: totalProducts.toLocaleString() })}
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 text-lg">{tCategories('noCategories')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/${locale}/categories/${category.id}`}
                    className="group bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
                  >
                    <h2 className="text-white font-semibold text-lg mb-2 group-hover:text-purple-400 transition-colors line-clamp-2">
                      {getLocalizedTagName(category, locale)}
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {tCategories('productCount', { count: category.productCount.toLocaleString() })}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
