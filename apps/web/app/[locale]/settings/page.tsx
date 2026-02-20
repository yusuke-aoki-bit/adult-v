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
  };
  const t = translations[locale as keyof typeof translations] || translations.ja;

  return (
    <div className="theme-body min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{t.title}</h1>
          <p className="text-gray-400 mt-1">{t.description}</p>
        </div>
        <SectionSettings locale={locale} theme="dark" />
      </div>
    </div>
  );
}
