import Link from 'next/link';

// This page renders when a route is not found at the root level
// Due to next-intl middleware, most routes should be locale-prefixed
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
      backgroundColor: '#111827',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: '#1f2937',
        borderRadius: '1rem',
        padding: '2rem',
        textAlign: 'center',
        margin: '1rem'
      }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>
          404
        </h1>
        <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
          ページが見つかりません
        </p>
        <Link
          href="/ja"
          style={{
            display: 'inline-block',
            backgroundColor: '#e11d48',
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
        <div style={{ borderTop: '1px solid #374151', paddingTop: '1rem', marginTop: '1rem' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            または以下をチェック
          </p>
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
                  border: '1px solid #374151'
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
