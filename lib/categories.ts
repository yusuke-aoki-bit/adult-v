import { CategoryInfo, ProductCategory } from '@/types/product';

export const categories: CategoryInfo[] = [
  {
    id: 'all',
    name: 'すべて',
    description: '全女優・全ジャンルの作品を表示',
    icon: '🎯',
    exampleServices: ['dmm', 'apex', 'sokmil', 'dti'],
  },
  {
    id: 'premium',
    name: '王道・人気女優',
    description: '大型専属女優のハイエンド作品を追跡',
    icon: '👑',
    exampleServices: ['dmm', 'apex'],
  },
  {
    id: 'mature',
    name: '人妻・熟女',
    description: 'SOKMILやDTIで強い落ち着いた作品群',
    icon: '🌹',
    exampleServices: ['sokmil', 'dti'],
  },
  {
    id: 'fetish',
    name: 'マニアック',
    description: 'カテゴリ特化・フェチ系の深掘り特集',
    icon: '🌀',
    exampleServices: ['apex', 'sokmil'],
  },
  {
    id: 'vr',
    name: 'VR・4K',
    description: '没入感重視のVR/4K配信まとめ',
    icon: '🕶️',
    exampleServices: ['dmm', 'dti'],
  },
  {
    id: 'cosplay',
    name: 'コスプレ・企画',
    description: '衣装・企画のバリエーション重視',
    icon: '🎭',
    exampleServices: ['dmm', 'apex'],
  },
  {
    id: 'indies',
    name: '素人・インディーズ',
    description: '新人発掘やドキュメント系で回遊',
    icon: '📹',
    exampleServices: ['dti', 'sokmil'],
  },
];

export function getCategoryInfo(categoryId: ProductCategory): CategoryInfo | undefined {
  return categories.find((cat) => cat.id === categoryId);
}

export function getCategoryName(categoryId: ProductCategory): string {
  return getCategoryInfo(categoryId)?.name || 'すべて';
}
