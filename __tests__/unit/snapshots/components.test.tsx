/**
 * コンポーネントスナップショットテスト
 * UI変更を検知するためのテスト
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mocks
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ locale: 'ja' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@adult-v/shared/lib/theme', () => ({
  getThemeMode: () => 'light',
  getPrimaryColor: () => 'rose',
}));

vi.mock('@adult-v/shared/lib/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// Import components after mocks
import Pagination from '@adult-v/shared/components/Pagination';

describe('Component Snapshots', () => {
  describe('Pagination', () => {
    it('matches snapshot for first page', () => {
      const { container } = render(
        <Pagination
          total={100}
          page={1}
          perPage={10}
          basePath="/products"
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('matches snapshot for middle page', () => {
      const { container } = render(
        <Pagination
          total={100}
          page={5}
          perPage={10}
          basePath="/products"
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('matches snapshot for last page', () => {
      const { container } = render(
        <Pagination
          total={100}
          page={10}
          perPage={10}
          basePath="/products"
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('matches snapshot with many pages (shows jump buttons)', () => {
      const { container } = render(
        <Pagination
          total={500}
          page={25}
          perPage={10}
          basePath="/products"
        />
      );
      expect(container).toMatchSnapshot();
    });

    it('matches snapshot with query params', () => {
      const { container } = render(
        <Pagination
          total={100}
          page={3}
          perPage={10}
          basePath="/products"
          queryParams={{ sort: 'date', filter: 'new' }}
        />
      );
      expect(container).toMatchSnapshot();
    });
  });
});
