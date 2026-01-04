import Link from 'next/link';

// This page renders when a route is not found at the root level
// Due to next-intl middleware, most routes should be locale-prefixed
// FANZA theme: Light background with rose accent colors
export default function RootNotFound() {
  const quickLinks = [
    { href: '/ja/products', label: '新着作品' },
    { href: '/ja/actresses', label: '人気女優' },
    { href: '/ja/discover', label: '今日の発見' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F5F5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        margin: '1rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#B42F5A', marginBottom: '1rem' }}>
          404
        </h1>
        <p style={{ color: '#4B4B4B', marginBottom: '1.5rem' }}>
          ページが見つかりません
        </p>
        <Link
          href="/ja"
          style={{
            display: 'inline-block',
            backgroundColor: '#B42F5A',
            color: 'white',
            fontWeight: '500',
            padding: '0.5rem 1.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            marginBottom: '1.5rem'
          }}
        >
          ホームに戻る
        </Link>
        <div style={{ borderTop: '1px solid #E5E5E5', paddingTop: '1rem', marginTop: '1rem' }}>
          <p style={{ color: '#6B6B6B', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            または以下をチェック
          </p>
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
                  border: '1px solid #E5E5E5'
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
