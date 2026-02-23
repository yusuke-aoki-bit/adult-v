import Link from 'next/link';
import { headers } from 'next/headers';

const translations: Record<
  string,
  { notFound: string; goHome: string; orCheck: string; products: string; actresses: string }
> = {
  ja: {
    notFound: 'ページが見つかりません',
    goHome: 'ホームに戻る',
    orCheck: 'または以下をチェック',
    products: '作品一覧',
    actresses: '女優一覧',
  },
  en: {
    notFound: 'Page Not Found',
    goHome: 'Go Home',
    orCheck: 'Or check these out',
    products: 'Products',
    actresses: 'Actresses',
  },
  zh: {
    notFound: '页面未找到',
    goHome: '返回首页',
    orCheck: '或查看以下内容',
    products: '作品列表',
    actresses: '女优列表',
  },
  'zh-TW': {
    notFound: '頁面未找到',
    goHome: '返回首頁',
    orCheck: '或查看以下內容',
    products: '作品列表',
    actresses: '女優列表',
  },
  ko: {
    notFound: '페이지를 찾을 수 없습니다',
    goHome: '홈으로 돌아가기',
    orCheck: '또는 아래를 확인하세요',
    products: '작품 목록',
    actresses: '배우 목록',
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
  const t = translations[locale] ?? translations['ja']!;

  const quickLinks = [
    { href: '/products', label: t.products },
    { href: '/actresses', label: t.actresses },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '28rem',
          width: '100%',
          backgroundColor: '#1f2937',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          margin: '1rem',
        }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>404</h1>
        <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>{t.notFound}</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            backgroundColor: '#e11d48',
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
        <div style={{ borderTop: '1px solid #374151', paddingTop: '1rem', marginTop: '1rem' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{t.orCheck}</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: '#f472b6',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
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
