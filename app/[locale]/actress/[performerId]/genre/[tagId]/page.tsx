import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getDb } from '@/lib/db';
import { products, productPerformers, productTags, performers, tags } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import ProductCard from '@/components/ProductCard';
import Breadcrumb, { type BreadcrumbItem } from '@/components/Breadcrumb';
import { generateBaseMetadata } from '@/lib/seo';

interface PageProps {
  params: Promise<{
    locale: string;
    performerId: string;
    tagId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { performerId, tagId } = await params;
  const db = getDb();

  const [performer] = await db
    .select()
    .from(performers)
    .where(eq(performers.id, parseInt(performerId)))
    .limit(1);

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, parseInt(tagId)))
    .limit(1);

  if (!performer || !tag) return {};

  const title = `${performer.name} × ${tag.name} 作品一覧 | 配信サイト横断検索`;
  const description = `${performer.name}が出演する${tag.name}ジャンルの作品を一覧で紹介。複数配信サイト(DMM, MGS, DUGA等)の価格比較で最安値を見つけられます。高画質サンプル画像と詳細情報付き。`;

  return generateBaseMetadata(title, description);
}

export default async function PerformerGenrePage({ params }: PageProps) {
  const { locale, performerId, tagId } = await params;
  const tNav = await getTranslations('nav');
  const db = getDb();

  const [performer] = await db
    .select()
    .from(performers)
    .where(eq(performers.id, parseInt(performerId)))
    .limit(1);

  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.id, parseInt(tagId)))
    .limit(1);

  if (!performer || !tag) {
    notFound();
  }

  const matchingProducts = await db
    .selectDistinct({
      id: products.id,
      normalizedProductId: products.normalizedProductId,
      title: products.title,
      releaseDate: products.releaseDate,
      imageUrl: products.defaultThumbnailUrl,
      description: products.description,
    })
    .from(products)
    .innerJoin(productPerformers, eq(products.id, productPerformers.productId))
    .innerJoin(productTags, eq(products.id, productTags.productId))
    .where(
      and(
        eq(productPerformers.performerId, parseInt(performerId)),
        eq(productTags.tagId, parseInt(tagId))
      )
    )
    .orderBy(desc(products.releaseDate))
    .limit(50);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: tNav('home'), href: `/${locale}` },
    { label: performer.name, href: `/${locale}/actress/${performerId}` },
    { label: tag.name },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb items={breadcrumbItems} className="mb-6" />
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            {performer.name} × {tag.name}
          </h1>
          <p className="text-gray-300 leading-relaxed">
            {performer.name}が出演する{tag.name}ジャンルの作品{matchingProducts.length}件を掲載。
            複数の配信サイトから価格・在庫情報を収集し、最新の情報を提供しています。
          </p>
        </div>
        {matchingProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {matchingProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  id: String(product.id),
                  normalizedProductId: product.normalizedProductId || String(product.id),
                  title: product.title,
                  releaseDate: product.releaseDate || undefined,
                  imageUrl: product.imageUrl || '',
                  description: product.description || '',
                  price: 0,
                  affiliateUrl: '',
                  providerLabel: '',
                  actressName: performer.name,
                  tags: [tag.name],
                  category: 'all' as const,
                  provider: 'duga' as const,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400 text-lg">該当する作品が見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
}
