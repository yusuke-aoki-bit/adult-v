import Link from 'next/link';
import { headers } from 'next/headers';

const translations: Record<
  string,
  { notFound: string; goHome: string; orCheck: string; products: string; actresses: string; discover: string }
> = {
  ja: {
    notFound: 'ページが見つかりません',
    goHome: 'ホームに戻る',
    orCheck: 'または以下をチェック',
    products: '新着作品',
    actresses: '人気女優',
    discover: '今日の発見',
  },
  en: {
    notFound: 'Page Not Found',
    goHome: 'Go Home',
    orCheck: 'Or check these out',
    products: 'Products',
    actresses: 'Actresses',
    discover: 'Discover',
  },
  zh: {
    notFound: '页面未找到',
    goHome: '返回首页',
    orCheck: '或查看以下内容',
    products: '作品列表',
    actresses: '女优列表',
    discover: '今日发现',
  },
  'zh-TW': {
    notFound: '頁面未找到',
    goHome: '返回首頁',
    orCheck: '或查看以下內容',
    products: '作品列表',
    actresses: '女優列表',
    discover: '今日發現',
  },
  ko: {
    notFound: '페이지를 찾을 수 없습니다',
    goHome: '홈으로 돌아가기',
    orCheck: '또는 아래를 확인하세요',
    products: '작품 목록',
    actresses: '배우 목록',
    discover: '오늘의 발견',
  },
};

function detectLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'ja';
  const supported = ['ja', 'en', 'zh-TW', 'zh', 'ko'];
  for (const lang of acceptLanguage.split(',')) {
    const code = lang.split(';')[0]!.trim().toLowerCase();
    if (code.startsWith('zh-tw') || code.startsWith('zh-hant')) return 'zh-TW';
    if (code.startsWith('zh')) return 'zh';
    const match = supported.find((s) => code.startsWith(s.toLowerCase()));
    if (match) return match;
  }
  return 'ja';
}

export default async function RootNotFound() {
  const headerStore = await headers();
  const locale = detectLocale(headerStore.get('accept-language'));
  const t = (translations[locale] || translations['ja'])!;

  const quickLinks = [
    { href: '/products', label: t.products },
    { href: '/actresses', label: t.actresses },
    { href: '/discover', label: t.discover },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '28rem',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          margin: '1rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#B42F5A', marginBottom: '1rem' }}>404</h1>
        <p style={{ color: '#4B4B4B', marginBottom: '1.5rem' }}>{t.notFound}</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            backgroundColor: '#B42F5A',
            color: 'white',
            fontWeight: '500',
            padding: '0.5rem 1.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            marginBottom: '1.5rem',
          }}
        >
          {t.goHome}
        </Link>
        <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '1rem', marginTop: '1rem' }}>
          <p style={{ color: '#6B6B6B', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{t.orCheck}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: '#B42F5A',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#FDF2F5',
                  border: '1px solid #E5E5E5',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
