'use client';

import { useParams } from 'next/navigation';
import { SectionSettings } from '@adult-v/shared/components';

export default function SettingsPage() {
  const params = useParams();
  const locale = (params['locale'] as string) || 'ja';

  const translations = {
    ja: {
      title: '設定',
      description: 'サイトの表示設定をカスタマイズできます',
    },
    en: {
      title: 'Settings',
      description: 'Customize your site display settings',
    },
    zh: {
      title: '设置',
      description: '自定义网站显示设置',
    },
    'zh-TW': {
      title: '設定',
      description: '自訂網站顯示設定',
    },
    ko: {
      title: '설정',
      description: '사이트 표시 설정을 맞춤 설정합니다',
    },
  };
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className="theme-body min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="mt-1 text-gray-400">{t.description}</p>
        </div>
        <SectionSettings locale={locale} theme="dark" />
      </div>
    </div>
  );
}
