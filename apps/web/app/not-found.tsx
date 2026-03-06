import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 Not Found',
  robots: { index: false, follow: false },
};

// headers()を呼ぶと全ページがforce-dynamicになるためデフォルト言語を使用
// 404ページはSEO的に重要でなく、多くのユーザーはデフォルト言語(ja)で問題ない
const t = {
  notFound: 'ページが見つかりません',
  goHome: 'ホームに戻る',
  orCheck: 'または以下をチェック',
  products: '作品一覧',
  actresses: '女優一覧',
};

const quickLinks = [
  { href: '/products', label: t.products },
  { href: '/actresses', label: t.actresses },
];

export default function RootNotFound() {
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
