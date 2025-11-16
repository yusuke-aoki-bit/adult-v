import apexSource from '@/data/apex.json';
import { Product, ProductCategory } from '@/types/product';

interface ApexEntry {
  id: string;
  title?: string;
  description?: string;
  label?: string;
  maker?: string;
  category?: string;
  price?: string;
  sellType?: string;
  actress?: string;
  releaseDate?: string;
  url?: string;
}

const DEFAULT_IMAGE = 'https://placehold.co/600x800/052e16/ffffff?text=APEX';

const apexRaw = apexSource as ApexEntry[];

function mapCategory(raw?: string): ProductCategory {
  if (!raw) {
    return 'premium';
  }
  const text = raw.toLowerCase();
  if (text.includes('人妻') || text.includes('熟女') || text.includes('マダム')) {
    return 'mature';
  }
  if (text.includes('素人') || text.includes('ナンパ') || text.includes('企画')) {
    return 'indies';
  }
  if (text.includes('fetish') || text.includes('フェチ') || text.includes('sm') || text.includes('調教')) {
    return 'fetish';
  }
  if (text.includes('vr')) {
    return 'vr';
  }
  if (text.includes('cos') || text.includes('コス')) {
    return 'cosplay';
  }
  return 'premium';
}

function slugify(input?: string): string | undefined {
  if (!input) return undefined;
  return input
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isRecent(dateValue?: string): boolean {
  if (!dateValue) return false;
  const parsed = new Date(dateValue.replace(/年|月/g, '-').replace('日', ''));
  if (Number.isNaN(parsed.getTime())) return false;
  const diff = Date.now() - parsed.getTime();
  const ninetyDays = 1000 * 60 * 60 * 24 * 120;
  return diff <= ninetyDays;
}

export const apexProducts: Product[] = apexRaw.map((entry, index) => {
  const actressName =
    entry.actress && entry.actress !== '---' ? entry.actress.split(/[、,／/]/)[0].trim() : undefined;
  const releaseDate = entry.releaseDate && entry.releaseDate !== '---' ? entry.releaseDate : undefined;
  const price = Number(entry.price ?? '0');
  const slug = slugify(actressName);

  return {
    id: entry.id,
    title: entry.title ?? 'APEX作品',
    description: entry.description ?? 'APEXアフィリエイトCSVから取得した作品です。',
    price: Number.isFinite(price) ? price : 0,
    category: mapCategory(entry.category),
    imageUrl: DEFAULT_IMAGE,
    affiliateUrl: entry.url ?? '#',
    provider: 'apex',
    providerLabel: 'APEX（CSV）',
    actressId: slug ? `apex-${slug}` : undefined,
    actressName,
    releaseDate,
    duration: 120,
    tags: [entry.category, entry.label, entry.maker, entry.sellType].filter(
      (tag): tag is string => Boolean(tag),
    ),
    isFeatured: index < 12,
    isNew: isRecent(releaseDate),
    reviewHighlight: entry.description ? `${entry.description.slice(0, 70)}…` : undefined,
    ctaLabel: 'APEX公式で見る',
  };
});

export function getApexProducts(limit?: number): Product[] {
  if (typeof limit === 'number') {
    return apexProducts.slice(0, limit);
  }
  return apexProducts;
}

