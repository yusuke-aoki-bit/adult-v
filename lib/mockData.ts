import {
  Actress,
  Campaign,
  Product,
  ProviderId,
  ProviderMeta,
  RankingEntry,
} from '@/types/product';
import { apexProducts } from '@/lib/providers/apex';

const now = new Date();
function addDays(days: number) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export const providerMeta: Record<ProviderId, ProviderMeta> = {
  dmm: {
    id: 'dmm',
    label: 'DMM 動画',
    accentClass: 'from-pink-600 to-orange-500',
    textClass: 'text-pink-300',
    description: '王道ラインナップとVR/4Kに強い国内最大級プラットフォーム',
    siteUrl: 'https://www.dmm.co.jp/digital/videoa/',
  },
  apex: {
    id: 'apex',
    label: 'APEX',
    accentClass: 'from-emerald-500 to-teal-500',
    textClass: 'text-emerald-300',
    description: '専属女優に強い高画質レーベル。女優別特集が豊富',
    siteUrl: 'https://www.apex-pictures.com/',
  },
  sokmil: {
    id: 'sokmil',
    label: 'SOKMIL',
    accentClass: 'from-purple-600 to-blue-600',
    textClass: 'text-purple-300',
    description: '熟女・マニアック系が充実。独占レンタルも多い',
    siteUrl: 'https://www.sokmil.com/',
  },
  dti: {
    id: 'dti',
    label: 'DTI 見放題',
    accentClass: 'from-red-600 to-rose-500',
    textClass: 'text-rose-300',
    description: '月額ストリーミング型。見放題派のヘビー視聴者向け',
    siteUrl: 'https://www.dti.ne.jp/',
  },
};

export const actresses: Actress[] = [
  {
    id: 'mizuki-hina',
    name: '水城ひな',
    catchcopy: '透明感からの豹変で話題急騰',
    description:
      'DMM独占4K作品で一気にブレイク。Apexでのハードな企画にも対応し、幅広いジャンルを消化する万能系。',
    heroImage: 'https://placehold.co/600x800/111827/ffffff?text=HINA',
    thumbnail: 'https://placehold.co/400x520/312e81/ffffff?text=Hina',
    primaryGenres: ['premium', 'vr', 'cosplay'],
    services: ['dmm', 'apex'],
    metrics: {
      releaseCount: 56,
      trendingScore: 92,
      fanScore: 95,
    },
    highlightWorks: ['dmm-hina-001', 'apex-hina-az', 'dmm-hina-vr01'],
    tags: ['4K', '独占', 'ハイブリッド'],
  },
  {
    id: 'tachibana-rui',
    name: '橘るい',
    catchcopy: 'しっとり人妻ラインを牽引',
    description:
      'SOKMILでの人妻企画とDTIのドキュメンタリー調見放題が人気。長尺作が多く、没入派に支持される。',
    heroImage: 'https://placehold.co/600x800/0f172a/f1f5f9?text=RUI',
    thumbnail: 'https://placehold.co/400x520/1f2937/f8fafc?text=Rui',
    primaryGenres: ['mature', 'fetish'],
    services: ['sokmil', 'dti'],
    metrics: {
      releaseCount: 78,
      trendingScore: 88,
      fanScore: 91,
    },
    highlightWorks: ['sok-rui-obsession', 'dti-rui-docu', 'sok-rui-deluxe'],
    tags: ['人妻', 'NTR', 'ドキュメント'],
  },
  {
    id: 'shiina-yuri',
    name: '椎名ゆり',
    catchcopy: 'フェチ路線の指名トップ',
    description:
      'Apexの限界突破フェチシリーズで固定ファンを獲得。SOKMILとのコラボ配信も増え、検索ニーズが安定。',
    heroImage: 'https://placehold.co/600x800/1b1c3c/ffffff?text=YURI',
    thumbnail: 'https://placehold.co/400x520/3730a3/ffffff?text=Yuri',
    primaryGenres: ['fetish', 'cosplay'],
    services: ['apex', 'sokmil'],
    metrics: {
      releaseCount: 42,
      trendingScore: 85,
      fanScore: 89,
    },
    highlightWorks: ['apex-yuri-fetish', 'sok-yuri-hypno'],
    tags: ['SM', 'コスプレ', 'ハード'],
  },
  {
    id: 'hoshina-mei',
    name: '星名めい',
    catchcopy: 'VR特化の没入型クイーン',
    description:
      'DMMとDTIのVRラインを回遊するヘビー視聴者向け女優。収録テクニックに定評があり、レビュー評価が常に高い。',
    heroImage: 'https://placehold.co/600x800/111111/fafafa?text=MEI',
    thumbnail: 'https://placehold.co/400x520/701a75/fdf4ff?text=Mei',
    primaryGenres: ['vr', 'premium'],
    services: ['dmm', 'dti'],
    metrics: {
      releaseCount: 64,
      trendingScore: 94,
      fanScore: 93,
    },
    highlightWorks: ['dmm-mei-vr-luxe', 'dti-mei-360'],
    tags: ['VR', '没入感', '独占'],
  },
  {
    id: 'nako-shiraishi',
    name: '白石なこ',
    catchcopy: 'インディーズ育ちの突き抜け感',
    description:
      'DTIの素人発掘からSOKMIL本線に飛び級。リアル系の演技が高く評価され、ジャンル横断のレビュー需要が増加中。',
    heroImage: 'https://placehold.co/600x800/082f49/e0f2fe?text=NAKO',
    thumbnail: 'https://placehold.co/400x520/0f766e/ecfeff?text=Nako',
    primaryGenres: ['indies', 'fetish'],
    services: ['dti', 'sokmil'],
    metrics: {
      releaseCount: 31,
      trendingScore: 81,
      fanScore: 87,
    },
    highlightWorks: ['dti-nako-raw', 'sok-nako-trace'],
    tags: ['素人感', 'リアル', 'NTR'],
  },
];

// 作品データ（手動キュレーション分）
const curatedProducts: Product[] = [
  {
    id: 'dmm-hina-001',
    title: '4K没入インタラクティブ - 水城ひな',
    description: 'DMM独占の4K視点作。接写と音声収録のクオリティが段違いで、ヘビー視聴者の定期買い付け作品。',
    price: 1980,
    category: 'premium',
    imageUrl: 'https://placehold.co/600x800/f43f5e/fff?text=Hina+4K',
    affiliateUrl: '#',
    provider: 'dmm',
    providerLabel: 'DMM 動画 (単品)',
    actressId: 'mizuki-hina',
    actressName: '水城ひな',
    releaseDate: '2025-10-05',
    duration: 110,
    format: '4K/60fps',
    rating: 4.9,
    reviewCount: 132,
    tags: ['4K', '超至近距離', '独占'],
    isFeatured: true,
    isNew: true,
    discount: 30,
    reviewHighlight: '音声定位が歴代トップクラス。ヘッドホン視聴推奨。',
    ctaLabel: 'DMMで購入',
  },
  {
    id: 'apex-hina-az',
    title: '限界密着アナザーゾーン - 水城ひな',
    description: 'APEXらしいハードテイスト。女優の豹変ぶりがレビューで絶賛され、ランキング急上昇中。',
    price: 2480,
    category: 'fetish',
    imageUrl: 'https://placehold.co/600x800/34d399/041d16?text=APEX+Hina',
    affiliateUrl: '#',
    provider: 'apex',
    providerLabel: 'APEX (DL配信)',
    actressId: 'mizuki-hina',
    actressName: '水城ひな',
    releaseDate: '2025-09-18',
    duration: 140,
    rating: 4.7,
    reviewCount: 94,
    tags: ['覚醒', '双視点', '過激'],
    isFeatured: true,
    reviewHighlight: '同時収録されたドキュメントカメラが臨場感を倍増。',
    ctaLabel: 'APEXで視聴',
  },
  {
    id: 'dmm-hina-vr01',
    title: '360度テレポVR - 水城ひな',
    description: '視点切替型のVRで、シーンごとに距離感を選べる。VR勢のレビューで最高評価を獲得。',
    price: 2280,
    category: 'vr',
    imageUrl: 'https://placehold.co/600x800/f472b6/0f0a15?text=Hina+VR',
    affiliateUrl: '#',
    provider: 'dmm',
    providerLabel: 'DMM VR',
    actressId: 'mizuki-hina',
    actressName: '水城ひな',
    releaseDate: '2025-08-30',
    duration: 95,
    format: '8K master / 6K配信',
    rating: 4.8,
    reviewCount: 160,
    tags: ['VR', '視点切替', '6K'],
    discount: 20,
    reviewHighlight: 'シーンのテンポがVR向けに最適化されていて酔いにくい。',
  },
  {
    id: 'sok-rui-obsession',
    title: '囁きと焦らしの共犯記録 - 橘るい',
    description: 'SOKMILのオリジナル人妻ライン。ボイス比率が高く、ドラマ要素を重視した長尺構成。',
    price: 1680,
    category: 'mature',
    imageUrl: 'https://placehold.co/600x800/6366f1/0b0b1b?text=Rui',
    affiliateUrl: '#',
    provider: 'sokmil',
    providerLabel: 'SOKMIL レンタル',
    actressId: 'tachibana-rui',
    actressName: '橘るい',
    releaseDate: '2025-09-05',
    duration: 150,
    rating: 4.6,
    reviewCount: 210,
    tags: ['人妻', 'ドラマ', 'モノローグ'],
    isFeatured: true,
    reviewHighlight: '冒頭15分のモノローグ演出で没入感が爆発。字幕モードも搭載。',
  },
  {
    id: 'dti-rui-docu',
    title: '見放題ドキュメント・橘るい編',
    description: 'DTIの独自密着シリーズ。撮影裏の息遣いまで拾っており、サブスク会員の満足度が高い。',
    price: 2480,
    category: 'mature',
    imageUrl: 'https://placehold.co/600x800/ef4444/fee2e2?text=DTI+Rui',
    affiliateUrl: '#',
    provider: 'dti',
    providerLabel: 'DTI 見放題',
    actressId: 'tachibana-rui',
    actressName: '橘るい',
    releaseDate: '2025-07-28',
    duration: 180,
    tags: ['見放題', 'ドキュメンタリー', '感情描写'],
    rating: 4.5,
    reviewCount: 88,
    reviewHighlight: '長尺だが章立てが細かく、サブスクでの回し視聴がしやすい。',
  },
  {
    id: 'apex-yuri-fetish',
    title: '極彩色フェティッシュパッケージ - 椎名ゆり',
    description: 'Apexが得意とするハードフェチ。色彩監修が秀逸でレビュー欄でも絶賛多数。',
    price: 2100,
    category: 'fetish',
    imageUrl: 'https://placehold.co/600x800/10b981/041a12?text=Yuri',
    affiliateUrl: '#',
    provider: 'apex',
    providerLabel: 'APEX フルHD',
    actressId: 'shiina-yuri',
    actressName: '椎名ゆり',
    releaseDate: '2025-09-22',
    duration: 125,
    rating: 4.8,
    reviewCount: 147,
    tags: ['拘束', '色彩', '覚醒'],
    isFeatured: true,
    reviewHighlight: 'セット全体を一色に統一する新照明で雰囲気が激変。',
  },
  {
    id: 'sok-yuri-hypno',
    title: '催眠潜入録 - 椎名ゆり',
    description: 'SOKMILのマニアックコラボ。フェチ層の指名率が今月トップ。',
    price: 1580,
    category: 'fetish',
    imageUrl: 'https://placehold.co/600x800/7c3aed/f3e8ff?text=Hypno',
    affiliateUrl: '#',
    provider: 'sokmil',
    providerLabel: 'SOKMIL 独占',
    actressId: 'shiina-yuri',
    actressName: '椎名ゆり',
    releaseDate: '2025-08-12',
    duration: 135,
    rating: 4.4,
    reviewCount: 76,
    tags: ['催眠', '演技派'],
    reviewHighlight: '擬似催眠の脚本がリアルで、ドラマ勢にも刺さる内容。',
  },
  {
    id: 'dmm-mei-vr-luxe',
    title: 'VR LUXE 没入トリック - 星名めい',
    description: '視点切替＋空間音声。DMM VRで週間1位を連続獲得。',
    price: 2480,
    category: 'vr',
    imageUrl: 'https://placehold.co/600x800/db2777/fff?text=Mei+VR',
    affiliateUrl: '#',
    provider: 'dmm',
    providerLabel: 'DMM VR Premium',
    actressId: 'hoshina-mei',
    actressName: '星名めい',
    releaseDate: '2025-10-01',
    duration: 100,
    format: '6K VR',
    rating: 4.9,
    reviewCount: 205,
    tags: ['VR', '空間音声', '超接写'],
    isFeatured: true,
    isNew: true,
    reviewHighlight: '被写界深度と空間音声の同期が完璧で没入度が異次元。',
  },
  {
    id: 'dti-mei-360',
    title: '360度グラデーション密着 - 星名めい',
    description: 'DTI見放題ラインのVR専用セクション。月額派に人気のパッケージ。',
    price: 2480,
    category: 'vr',
    imageUrl: 'https://placehold.co/600x800/9d174d/ffe4e6?text=Mei+DTI',
    affiliateUrl: '#',
    provider: 'dti',
    providerLabel: 'DTI VR見放題',
    actressId: 'hoshina-mei',
    actressName: '星名めい',
    releaseDate: '2025-08-05',
    duration: 120,
    rating: 4.6,
    reviewCount: 98,
    tags: ['VR', '回遊向け', '見放題'],
    reviewHighlight: '月額会員専用のビットレートでブロックノイズがほぼ皆無。',
  },
  {
    id: 'dti-nako-raw',
    title: '素描ドキュメント - 白石なこ',
    description: 'DTIの素人発掘ライン。映像よりも会話重視でリアルさが売り。',
    price: 1980,
    category: 'indies',
    imageUrl: 'https://placehold.co/600x800/0ea5e9/042f2e?text=Nako',
    affiliateUrl: '#',
    provider: 'dti',
    providerLabel: 'DTI サブスク',
    actressId: 'nako-shiraishi',
    actressName: '白石なこ',
    releaseDate: '2025-09-10',
    duration: 160,
    rating: 4.3,
    reviewCount: 64,
    tags: ['素人感', '会話', '初撮り'],
    reviewHighlight: '編集が最低限で空気感がリアル。ながら視聴にも◎',
  },
  {
    id: 'sok-nako-trace',
    title: '痕跡記録 - 白石なこ',
    description: 'SOKMIL移籍後の初ロングレンジ。フェチ視点のカメラワークで検索急増。',
    price: 1760,
    category: 'indies',
    imageUrl: 'https://placehold.co/600x800/065f46/ffffff?text=Trace',
    affiliateUrl: '#',
    provider: 'sokmil',
    providerLabel: 'SOKMIL ハイレート',
    actressId: 'nako-shiraishi',
    actressName: '白石なこ',
    releaseDate: '2025-07-20',
    duration: 145,
    rating: 4.4,
    reviewCount: 71,
    tags: ['質感', 'ハンドヘルド'],
    reviewHighlight: '撮影監督が同伴する形式で、画作りの熱量が高い。',
  },
];

export const mockProducts: Product[] = [...apexProducts, ...curatedProducts];

export const campaigns: Campaign[] = [
  {
    id: 'cmp-dmm-autumn',
    provider: 'dmm',
    title: 'DMM秋の4Kセール',
    description: '4K/8Kラインを最大50%OFF。水城ひな・星名めいのVRも対象。',
    highlight: '期間限定でクーポン併用可。ヘビー視聴者向けまとめ買い推奨。',
    expiresAt: addDays(12),
    ctaUrl: 'https://www.dmm.co.jp/digital/videoa/-/campaign/4k/',
    badge: '4K/8K',
    genres: ['premium', 'vr'],
  },
  {
    id: 'cmp-apex-core',
    provider: 'apex',
    title: 'APEX CORE女優別パック',
    description: '専属女優の最新作3本セットで25%OFF。フェチラインも対象。',
    highlight: '作品レビュー記事と連動するとCVが伸びやすいキャンペーン。',
    expiresAt: addDays(5),
    ctaUrl: 'https://www.apex-pictures.com/campaign/core/',
    badge: 'セット割',
    genres: ['premium', 'fetish'],
  },
  {
    id: 'cmp-sokmil-midnight',
    provider: 'sokmil',
    title: 'SOKMIL 深夜割',
    description: '24時〜6時の購入で熟女ライン15%OFF。NTR特集も更新。',
    highlight: '夜間のヘビー視聴者向け。クーポン発行でCTRが高い。',
    expiresAt: addDays(3),
    ctaUrl: 'https://www.sokmil.com/campaign/night/',
    badge: '深夜限定',
    genres: ['mature', 'fetish'],
  },
  {
    id: 'cmp-dti-binge',
    provider: 'dti',
    title: 'DTI 見放題ビンジパス',
    description: '30日間見放題＋VRセクション解放で2,980円。長尺派専用。',
    highlight: 'ヘビー視聴者のサブスク移行に最適。レビュー記事と相性◎',
    expiresAt: addDays(20),
    ctaUrl: 'https://www.dti.ne.jp/campaign/binge/',
    badge: 'サブスク',
    genres: ['vr', 'indies', 'mature'],
  },
];

export const actressRankings: RankingEntry[] = [
  {
    id: 'mizuki-hina',
    position: 1,
    title: '水城ひな',
    metric: '検索流入 +42%',
    delta: '+3',
  },
  {
    id: 'hoshina-mei',
    position: 2,
    title: '星名めい',
    metric: 'VRレビュー平均4.9',
  },
  {
    id: 'tachibana-rui',
    position: 3,
    title: '橘るい',
    metric: 'SOKMIL指名率 1位',
  },
];

export const genreRankings: RankingEntry[] = [
  {
    id: 'vr',
    position: 1,
    title: 'VR・4K',
    metric: 'CVR 6.2%',
  },
  {
    id: 'mature',
    position: 2,
    title: '人妻・熟女',
    metric: '平均単価 ¥1,820',
  },
  {
    id: 'fetish',
    position: 3,
    title: 'マニアック',
    metric: 'レビュー件数 +18%',
  },
];

// 女優関連ユーティリティ
export function getActresses(): Actress[] {
  return actresses;
}

export function getFeaturedActresses(limit = 3): Actress[] {
  return actresses
    .slice()
    .sort((a, b) => b.metrics.trendingScore - a.metrics.trendingScore)
    .slice(0, limit);
}

export function getActressById(id: string): Actress | undefined {
  return actresses.find((actress) => actress.id === id);
}

export function getProductsByActress(actressId?: string): Product[] {
  if (!actressId) return [];
  return mockProducts.filter((product) => product.actressId === actressId);
}

// 作品関連
export function getProductsByCategory(category: string): Product[] {
  if (category === 'all') {
    return mockProducts;
  }
  return mockProducts.filter((product) => product.category === category);
}

export function getFeaturedProducts(): Product[] {
  return mockProducts.filter((product) => product.isFeatured);
}

export function getNewProducts(): Product[] {
  return mockProducts.filter((product) => product.isNew);
}

export function getProductById(id: string): Product | undefined {
  return mockProducts.find((product) => product.id === id);
}

// キャンペーン
export function getActiveCampaigns(): Campaign[] {
  const today = new Date().toISOString().split('T')[0];
  return campaigns.filter((campaign) => campaign.expiresAt >= today);
}

export function getCampaignsByProvider(provider: string): Campaign[] {
  return getActiveCampaigns().filter((campaign) => campaign.provider === provider);
}

export function getProviderInfo(provider: ProviderId): ProviderMeta | undefined {
  return providerMeta[provider];
}
