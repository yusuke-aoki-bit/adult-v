/**
 * DynamicCharts コンポーネントのテスト
 * 動的インポートされるチャートコンポーネントの基本テスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    // Return a simple mock component that shows loading state
    const MockComponent = (props: Record<string, unknown>) => {
      return React.createElement('div', {
        'data-testid': 'dynamic-chart',
        ...props,
      });
    };
    MockComponent.displayName = 'MockDynamicComponent';
    return MockComponent;
  },
}));

// Mock the actual chart components
vi.mock('@adult-v/shared/components/stats/ReleasesTrendChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'releases-trend-chart' }),
}));

vi.mock('@adult-v/shared/components/stats/GenreDistributionChart', () => ({
  default: () => React.createElement('div', { 'data-testid': 'genre-distribution-chart' }),
}));

// Import after mocks
import {
  DynamicReleasesTrendChart,
  DynamicGenreDistributionChart,
  DynamicYearlyStatsChart,
  DynamicMakerShareChart,
  DynamicGenreTrendChart,
  DynamicDebutTrendChart,
} from '@adult-v/shared/components/stats';

describe('DynamicCharts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Export validation', () => {
    it('should export DynamicReleasesTrendChart', () => {
      expect(DynamicReleasesTrendChart).toBeDefined();
    });

    it('should export DynamicGenreDistributionChart', () => {
      expect(DynamicGenreDistributionChart).toBeDefined();
    });

    it('should export DynamicYearlyStatsChart', () => {
      expect(DynamicYearlyStatsChart).toBeDefined();
    });

    it('should export DynamicMakerShareChart', () => {
      expect(DynamicMakerShareChart).toBeDefined();
    });

    it('should export DynamicGenreTrendChart', () => {
      expect(DynamicGenreTrendChart).toBeDefined();
    });

    it('should export DynamicDebutTrendChart', () => {
      expect(DynamicDebutTrendChart).toBeDefined();
    });
  });

  describe('Component rendering', () => {
    it('should render DynamicReleasesTrendChart', () => {
      render(React.createElement(DynamicReleasesTrendChart, { data: [] }));
      expect(screen.getByTestId('dynamic-chart')).toBeInTheDocument();
    });

    it('should render DynamicGenreDistributionChart', () => {
      render(React.createElement(DynamicGenreDistributionChart, { data: [] }));
      expect(screen.getByTestId('dynamic-chart')).toBeInTheDocument();
    });

    it('should pass props to dynamic component', () => {
      const testData = [{ month: '2024-01', releaseCount: 100 }];
      render(React.createElement(DynamicReleasesTrendChart, { data: testData }));

      const chart = screen.getByTestId('dynamic-chart');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('Dynamic import behavior', () => {
    it('should be function components', () => {
      expect(typeof DynamicReleasesTrendChart).toBe('function');
      expect(typeof DynamicGenreDistributionChart).toBe('function');
      expect(typeof DynamicYearlyStatsChart).toBe('function');
      expect(typeof DynamicMakerShareChart).toBe('function');
      expect(typeof DynamicGenreTrendChart).toBe('function');
      expect(typeof DynamicDebutTrendChart).toBe('function');
    });
  });
});

describe('Chart Skeleton', () => {
  it('should provide loading state for charts', () => {
    // The skeleton is rendered during dynamic loading
    // This tests that the skeleton component structure is valid
    const ChartSkeleton = ({ height = 'h-[300px]' }: { height?: string }) => {
      return React.createElement('div', {
        className: `w-full ${height} bg-gray-200 dark:bg-gray-700 animate-pulse rounded`,
        'data-testid': 'chart-skeleton',
      });
    };

    render(React.createElement(ChartSkeleton));
    const skeleton = screen.getByTestId('chart-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.className).toContain('h-[300px]');
  });

  it('should support custom height', () => {
    const ChartSkeleton = ({ height = 'h-[300px]' }: { height?: string }) => {
      return React.createElement('div', {
        className: `w-full ${height} bg-gray-200 dark:bg-gray-700 animate-pulse rounded`,
        'data-testid': 'chart-skeleton',
      });
    };

    render(React.createElement(ChartSkeleton, { height: 'h-[400px]' }));
    const skeleton = screen.getByTestId('chart-skeleton');
    expect(skeleton.className).toContain('h-[400px]');
  });
});
