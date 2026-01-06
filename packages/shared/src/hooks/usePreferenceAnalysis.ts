'use client';

import { useMemo } from 'react';
import { useViewingDiary } from './useViewingDiary';
import { useFavorites } from './useFavorites';

// タグカテゴリ分類
const TAG_CATEGORIES = {
  // 女優タイプ
  young: ['美少女', '女子大生', '素人', 'ロリ', '清楚', '天然', '18歳', '19歳', '20代'],
  mature: ['熟女', '人妻', '三十路', '四十路', '五十路', 'マダム', 'おばさん'],
  // コンテンツタイプ
  solo: ['単体女優', '専属女優', 'AV女優', '単体作品'],
  variety: ['企画', 'バラエティ', 'ゲーム', '罰ゲーム', 'ドッキリ'],
  // テクノロジー
  vr: ['VR', '4K', '8K', 'ハイスペック', '高画質'],
  standard: [], // デフォルト
  // ジャンル
  fetish: ['SM', 'M女', 'S女', '緊縛', 'アナル', 'フェチ', 'マニア', '変態'],
  cosplay: ['コスプレ', 'コス', '制服', 'ナース', 'OL', 'メイド', '女教師'],
  romance: ['恋愛', 'ラブラブ', '主観', 'イチャイチャ', '彼女'],
  hardcore: ['ハード', '中出し', '3P', '乱交', '輪姦', '陵辱'],
  softcore: ['イメージビデオ', 'グラビア', '着エロ', 'ソフト'],
};

// カテゴリ名の日本語マッピング
const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  ja: {
    young: '若手・素人',
    mature: '熟女・人妻',
    solo: '単体女優',
    variety: '企画物',
    vr: 'VR・高画質',
    fetish: 'フェチ・マニア',
    cosplay: 'コスプレ',
    romance: '恋愛・主観',
    hardcore: 'ハードコア',
    softcore: 'ソフト・イメージ',
  },
  en: {
    young: 'Young/Amateur',
    mature: 'Mature/MILF',
    solo: 'Solo Actress',
    variety: 'Variety',
    vr: 'VR/High Quality',
    fetish: 'Fetish',
    cosplay: 'Cosplay',
    romance: 'Romance/POV',
    hardcore: 'Hardcore',
    softcore: 'Softcore',
  },
  zh: {
    young: '年轻/素人',
    mature: '熟女/人妻',
    solo: '单体女优',
    variety: '企划物',
    vr: 'VR/高画质',
    fetish: '恋物癖',
    cosplay: '角色扮演',
    romance: '恋爱/主观',
    hardcore: '硬核',
    softcore: '软核',
  },
  ko: {
    young: '젊은/아마추어',
    mature: '숙녀/유부녀',
    solo: '단독 배우',
    variety: '기획물',
    vr: 'VR/고화질',
    fetish: '페티시',
    cosplay: '코스프레',
    romance: '로맨스/1인칭',
    hardcore: '하드코어',
    softcore: '소프트코어',
  },
};

// ASPの分類
const ASP_CATEGORIES = {
  mainstream: ['FANZA', 'MGS', 'DUGA'],
  premium: ['caribbeancom', 'caribbeancompr', '1pondo', 'heyzo', 'tokyohot'],
  amateur: ['FC2', '素人系'],
  niche: ['SOKMIL', 'B10F', 'JAPANSKA'],
};

export interface PreferenceAnalysis {
  // レーダーチャート用データ
  radarData: Array<{ label: string; value: number }>;
  // カテゴリ別スコア
  categoryScores: Record<string, number>;
  // 好みの要約テキスト
  summary: string;
  // おすすめキーワード
  recommendedKeywords: string[];
  // 分析に使用したデータ数
  dataCount: number;
  // 主要な好み（上位3つ）
  topPreferences: Array<{ category: string; label: string; score: number }>;
}

export function usePreferenceAnalysis(locale: string = 'ja'): PreferenceAnalysis {
  const { entries } = useViewingDiary();
  const { favorites } = useFavorites();

  const analysis = useMemo(() => {
    // タグの収集（視聴日記 + お気に入り商品のタグ）
    const allTags: string[] = [];
    const allAsps: string[] = [];

    // 視聴日記から
    entries.forEach((entry) => {
      if (entry.tags) {
        allTags.push(...entry.tags);
      }
      if (entry.aspName) {
        allAsps.push(entry.aspName);
      }
    });

    // お気に入りは現在タグ情報がないので、視聴日記のみで分析
    const dataCount = entries.length;

    if (dataCount === 0) {
      return {
        radarData: [],
        categoryScores: {},
        summary: '',
        recommendedKeywords: [],
        dataCount: 0,
        topPreferences: [],
      };
    }

    // カテゴリ別のマッチ数を計算
    const categoryMatches: Record<string, number> = {};
    Object.keys(TAG_CATEGORIES).forEach((category) => {
      categoryMatches[category] = 0;
    });

    allTags.forEach((tag) => {
      Object.entries(TAG_CATEGORIES).forEach(([category, keywords]) => {
        if (keywords.some((keyword) => tag.includes(keyword))) {
          categoryMatches[category] = (categoryMatches[category] || 0) + 1;
        }
      });
    });

    // スコアを正規化 (0-100)
    const maxMatches = Math.max(...Object.values(categoryMatches), 1);
    const categoryScores: Record<string, number> = {};
    Object.entries(categoryMatches).forEach(([category, count]) => {
      categoryScores[category] = Math.round((count / maxMatches) * 100);
    });

    // ラベル取得
    const labels = CATEGORY_LABELS[locale] ?? CATEGORY_LABELS['ja'];

    // レーダーチャート用データ（主要カテゴリのみ）
    const mainCategories = ['young', 'mature', 'solo', 'variety', 'vr', 'fetish', 'cosplay', 'romance'];
    const radarData = mainCategories
      .map((category) => ({
        label: labels?.[category] ?? category,
        value: categoryScores[category] || 0,
      }))
      .filter((item) => item['value'] > 0 || mainCategories.includes(item.label));

    // 上位カテゴリを抽出
    const sortedCategories = Object.entries(categoryScores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    const topPreferences = sortedCategories.slice(0, 3).map(([category, score]) => ({
      category,
      label: labels?.[category] ?? category,
      score,
    }));

    // 好みの要約テキスト生成
    const summaryParts: string[] = [];
    if (topPreferences.length > 0) {
      const topLabels = topPreferences.map((p) => p.label);
      if (locale === 'ja') {
        summaryParts.push(`あなたは「${topLabels.join('」「')}」系がお好みです`);
      } else if (locale === 'en') {
        summaryParts.push(`You prefer ${topLabels.join(', ')} content`);
      } else if (locale === 'zh') {
        summaryParts.push(`您喜欢${topLabels.join('、')}类内容`);
      } else if (locale === 'ko') {
        summaryParts.push(`${topLabels.join(', ')} 콘텐츠를 선호합니다`);
      }
    }

    // おすすめキーワード
    const recommendedKeywords: string[] = [];
    topPreferences.forEach((pref) => {
      const keywords = TAG_CATEGORIES[pref.category as keyof typeof TAG_CATEGORIES];
      if (keywords && keywords.length > 0) {
        recommendedKeywords.push(...keywords.slice(0, 2));
      }
    });

    return {
      radarData,
      categoryScores,
      summary: summaryParts.join('。'),
      recommendedKeywords: [...new Set(recommendedKeywords)].slice(0, 6),
      dataCount,
      topPreferences,
    };
  }, [entries, favorites, locale]);

  return analysis;
}

// 翻訳
export const profileTranslations = {
  ja: {
    title: '作品DNA分析',
    subtitle: 'あなたの好みを可視化',
    noData: 'まだデータがありません',
    noDataDesc: '作品を視聴して「視聴済み」にすると、好みの分析が始まります',
    basedOn: '件のデータに基づく分析',
    yourPreference: 'あなたの好み',
    topCategories: 'トップカテゴリ',
    recommendedKeywords: 'おすすめキーワード',
    searchWithKeyword: 'で検索',
    viewDiary: '視聴日記を見る',
    startViewing: '作品を見始める',
  },
  en: {
    title: 'Content DNA Analysis',
    subtitle: 'Visualize your preferences',
    noData: 'No data yet',
    noDataDesc: 'Mark products as "Viewed" to start analyzing your preferences',
    basedOn: 'Analysis based on',
    yourPreference: 'Your Preferences',
    topCategories: 'Top Categories',
    recommendedKeywords: 'Recommended Keywords',
    searchWithKeyword: 'Search',
    viewDiary: 'View Diary',
    startViewing: 'Start Viewing',
  },
  zh: {
    title: '作品DNA分析',
    subtitle: '可视化您的偏好',
    noData: '暂无数据',
    noDataDesc: '将作品标记为"已观看"后开始分析您的偏好',
    basedOn: '基于以下数据的分析',
    yourPreference: '您的偏好',
    topCategories: '热门类别',
    recommendedKeywords: '推荐关键词',
    searchWithKeyword: '搜索',
    viewDiary: '查看日记',
    startViewing: '开始观看',
  },
  ko: {
    title: '작품 DNA 분석',
    subtitle: '취향을 시각화',
    noData: '데이터 없음',
    noDataDesc: '작품을 "시청 완료"로 표시하면 취향 분석이 시작됩니다',
    basedOn: '개의 데이터 기반 분석',
    yourPreference: '당신의 취향',
    topCategories: '인기 카테고리',
    recommendedKeywords: '추천 키워드',
    searchWithKeyword: '검색',
    viewDiary: '일기 보기',
    startViewing: '시청 시작',
  },
} as const;
