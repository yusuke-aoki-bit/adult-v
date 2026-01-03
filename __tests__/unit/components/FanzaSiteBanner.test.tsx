import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Import after mocks
import { FanzaSiteBanner } from '@adult-v/shared/components';

describe('FanzaSiteBanner Component', () => {
  const FANZA_SITE_URL = 'https://www.f.adult-v.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Footer Variant', () => {
    it('renders footer variant correctly', () => {
      render(<FanzaSiteBanner locale="ja" variant="footer" />);

      // Check for FANZA text
      expect(screen.getByText(/FANZA専門サイト/)).toBeInTheDocument();
      expect(screen.getByText(/FANZAサイトへ/)).toBeInTheDocument();
    });

    it('links to correct FANZA site URL', () => {
      render(<FanzaSiteBanner locale="ja" variant="footer" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', expect.stringContaining(FANZA_SITE_URL));
    });

    it('opens in new tab with security attributes', () => {
      render(<FanzaSiteBanner locale="ja" variant="footer" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });
  });

  describe('Card Variant', () => {
    it('renders card variant correctly', () => {
      render(<FanzaSiteBanner locale="ja" variant="card" />);

      expect(screen.getByText(/FANZA専門サイト/)).toBeInTheDocument();
    });

    it('has gradient background styling', () => {
      const { container } = render(<FanzaSiteBanner locale="ja" variant="card" />);

      const link = container.querySelector('a');
      // Tailwind 4 uses bg-linear-to-* instead of bg-gradient-to-*
      expect(link?.className).toContain('bg-linear-to-');
    });
  });

  describe('Inline Variant', () => {
    it('renders inline variant correctly', () => {
      render(<FanzaSiteBanner locale="ja" variant="inline" />);

      expect(screen.getByText(/FANZA専門/)).toBeInTheDocument();
    });

    it('has compact styling', () => {
      const { container } = render(<FanzaSiteBanner locale="ja" variant="inline" />);

      const link = container.querySelector('a');
      expect(link?.className).toContain('rounded-full');
    });
  });

  describe('Localization', () => {
    it('renders Japanese translations by default', () => {
      render(<FanzaSiteBanner locale="ja" variant="footer" />);

      expect(screen.getByText(/FANZA専門サイト/)).toBeInTheDocument();
    });

    it('renders English translations when locale is en', () => {
      render(<FanzaSiteBanner locale="en" variant="footer" />);

      expect(screen.getByText(/FANZA Dedicated Site/)).toBeInTheDocument();
    });

    it('renders Chinese translations when locale is zh', () => {
      render(<FanzaSiteBanner locale="zh" variant="footer" />);

      expect(screen.getByText(/FANZA专门网站/)).toBeInTheDocument();
    });

    it('renders Korean translations when locale is ko', () => {
      render(<FanzaSiteBanner locale="ko" variant="footer" />);

      expect(screen.getByText(/FANZA 전문 사이트/)).toBeInTheDocument();
    });

    it('includes locale in URL', () => {
      render(<FanzaSiteBanner locale="en" variant="footer" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', expect.stringContaining('hl=en'));
    });
  });

  describe('Accessibility', () => {
    it('has accessible link text', () => {
      render(<FanzaSiteBanner locale="ja" variant="footer" />);

      const link = screen.getByRole('link');
      // Should have visible text content
      expect(link.textContent?.length).toBeGreaterThan(0);
    });

    it('icon has hidden text alternative', () => {
      const { container } = render(<FanzaSiteBanner locale="ja" variant="footer" />);

      // SVG should be decorative or have aria-hidden
      const svgs = container.querySelectorAll('svg');
      svgs.forEach((svg) => {
        // Either hidden or part of link with text
        const ariaHidden = svg.getAttribute('aria-hidden');
        const isDecorative = ariaHidden === 'true' || svg.closest('a')?.textContent;
        expect(isDecorative).toBeTruthy();
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(
        <FanzaSiteBanner locale="ja" variant="footer" className="custom-class" />
      );

      const link = container.querySelector('a');
      expect(link?.className).toContain('custom-class');
    });
  });
});

describe('FanzaSiteBanner - URL Construction', () => {
  it('constructs correct base URL', () => {
    render(<FanzaSiteBanner locale="ja" variant="footer" />);

    const link = screen.getByRole('link');
    const href = link.getAttribute('href');

    expect(href).toBe('https://www.f.adult-v.com?hl=ja');
  });

  it('handles different locales correctly', () => {
    const locales = ['ja', 'en', 'zh', 'zh-TW', 'ko'];

    locales.forEach((locale) => {
      const { unmount } = render(<FanzaSiteBanner locale={locale} variant="footer" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `https://www.f.adult-v.com?hl=${locale}`);

      unmount();
    });
  });
});
