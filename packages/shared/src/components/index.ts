// Skeleton components
export { default as ActressCardSkeleton, ActressCardSkeletonGrid } from './ActressCardSkeleton';

// Favorite and interaction components
export { default as ViewedButton } from './ViewedButton';
export { default as FavoriteButton } from './FavoriteButton';

// Cookie consent
export { default as CookieConsent } from './CookieConsent';

// Pagination
export { default as Pagination } from './Pagination';

// Image components
export { default as ActressHeroImage } from './ActressHeroImage';
export { default as ImageLightbox } from './ImageLightbox';

// Notice and content components
export { default as AdultContentNotice } from './AdultContentNotice';
export { default as AgeVerification } from './AgeVerification';
export { default as CampaignCard } from './CampaignCard';
export type { CampaignCardTheme } from './CampaignCard';

// Layout components
export { ConditionalLayout } from './ConditionalLayout';

// Navigation components
export { default as Breadcrumb } from './Breadcrumb';
export type { BreadcrumbItem } from './Breadcrumb';

// SEO components
export { JsonLD } from './JsonLD';

// Persistence components
export { default as FilterPersistence } from './FilterPersistence';
export { default as PerPagePersistence } from './PerPagePersistence';

// Analytics and SEO components
export { default as GoogleAnalytics } from './GoogleAnalytics';
export { default as HreflangTags } from './HreflangTags';
export { default as StructuredData } from './StructuredData';

// UI components
export { default as NavigationProgress } from './NavigationProgress';
export { default as ScrollToTop } from './ScrollToTop';
export { default as PreferenceChart, PreferenceBarChart } from './PreferenceChart';
export type { PreferenceChartTheme } from './PreferenceChart';
export { default as StarRating } from './StarRating';
export { default as SortDropdown } from './SortDropdown';
export type { SortDropdownTheme, SortByValue } from './SortDropdown';
export { default as NotificationSubscriber } from './NotificationSubscriber';
export type { NotificationSubscriberTheme } from './NotificationSubscriber';

// E-commerce components
export { default as PriceComparison } from './PriceComparison';
export type { PriceComparisonTheme } from './PriceComparison';
export { default as ProductIdSearch } from './ProductIdSearch';

// Toast notification
export { ToastProvider, useToast } from './Toast';

// Tracking components
export { default as ViewTracker } from './ViewTracker';

// Cost and price analysis components
export { default as CostPerformanceCard } from './CostPerformanceCard';
export { default as PriceComparisonServer } from './PriceComparisonServer';

// Cross-site and cross-ASP components
export { default as CrossAspInfo } from './CrossAspInfo';
export { default as FanzaCrossLink, FanzaSiteLink } from './FanzaCrossLink';

// Product action components
export { default as MarkAsViewedButton } from './MarkAsViewedButton';

// Watchlist components
export { default as WatchlistAnalysis } from './WatchlistAnalysis';

// Accordion and layout components
export { default as AccordionSection } from './AccordionSection';
export { default as ProductSkeleton } from './ProductSkeleton';

// Section components (shared between apps)
export {
  RecentlyViewedSection,
  ForYouRecommendationsSection,
  SalesSectionBase,
  WeeklyHighlightsSection,
  getThemeConfig,
  darkTheme,
  lightTheme,
  productDetailTranslations,
  getTranslation,
} from './sections';
export type { SectionTheme, ThemeConfig, Locale } from './sections';

// Filter components (shared between apps)
export {
  ProductSortDropdown,
  ActiveFiltersChips,
  getFilterThemeConfig,
  darkFilterTheme,
  lightFilterTheme,
  sortTranslations,
  activeFiltersTranslations,
  getSortTranslation,
  getActiveFiltersTranslation,
} from './filters';
export type { FilterTheme, FilterThemeConfig, SortTranslationKey, ActiveFiltersTranslationKey, SupportedLocale } from './filters';

// Client providers (Firebase auth, etc.)
export { ClientProviders } from './ClientProviders';

// Firebase provider (Analytics, Performance Monitoring, Remote Config)
export { FirebaseProvider } from './FirebaseProvider';

// ProductCard utilities (themes and helpers)
export {
  getThemeConfig as getProductCardThemeConfig,
  themes as productCardThemes,
  getAffiliateUrl,
  normalizeMgsProductId,
  extractMgsProductUrl,
  convertFanzaToDirectUrl,
} from './ProductCard';
export type {
  ProductCardTheme,
  ThemeConfig as ProductCardThemeConfig,
  GetAffiliateUrlOptions,
} from './ProductCard';

// Actress career components
export { ActressCareerTimeline } from './ActressCareerTimeline';
export { RetirementAlert } from './RetirementAlert';
export { default as ActressAiReview } from './ActressAiReview';
export type { ActressAiReviewTheme } from './ActressAiReview';

// ActressCard utilities (themes and helpers) and base component
export {
  actressCardThemes,
  getActressCardThemeConfig,
  filterServicesForSite,
  ActressCardBase,
} from './ActressCard';
export type {
  ActressCardTheme,
  ActressCardThemeConfig,
  ActressCardBaseProps,
  ActressCardSize,
} from './ActressCard';

// Cloud sync settings
export { CloudSyncSettings, cloudSyncTranslations } from './CloudSyncSettings';
export type { CloudSyncSettingsProps } from './CloudSyncSettings';

// FilterSortBar (shared between apps)
export { FilterSortBarBase } from './FilterSortBar';
export type { FilterSortBarBaseProps, FilterSortBarTheme, SortOption } from './FilterSortBar';

// SearchBar (shared between apps)
export { SearchBarBase, searchBarTranslations } from './SearchBar';
export type { SearchBarTheme, SearchBarBaseProps } from './SearchBar';

// OptimizedImage (shared between apps)
export { OptimizedImageBase } from './OptimizedImage';
export type { OptimizedImageTheme, OptimizedImageBaseProps } from './OptimizedImage';

// LanguageSwitcher (shared between apps)
export {
  LanguageSwitcherBase,
  locales,
  localeNames,
  defaultLocale,
} from './LanguageSwitcher';
export type {
  LanguageSwitcherTheme,
  LanguageSwitcherBaseProps,
  Locale as LanguageSwitcherLocale,
} from './LanguageSwitcher';

// Header (shared between apps)
export { HeaderBase } from './Header';
export type { HeaderBaseProps } from './Header';

// Footer (shared between apps)
export { FooterBase } from './Footer';
export type { FooterBaseProps, FooterTranslation } from './Footer';

// SearchFilters (shared between apps)
export { SearchFiltersBase, searchFiltersTranslations, SORT_OPTIONS, PROVIDERS } from './SearchFilters';
export type { SearchFiltersTheme, SearchFiltersBaseProps, SearchFilterOptions } from './SearchFilters';

// BudgetManager (shared between apps)
export {
  BudgetManagerBase,
  budgetManagerTranslations,
  statusColors as budgetStatusColors,
  progressColors as budgetProgressColors,
} from './BudgetManager';
export type { BudgetManagerTheme, BudgetManagerBaseProps, BudgetStatus } from './BudgetManager';

// Social sharing components
export { SocialShareButtons } from './SocialShareButtons';

// Similar actresses component
export { default as SimilarActresses } from './SimilarActresses';

// Performer products components
export { default as PerformerTopProducts } from './PerformerTopProducts';
export { default as PerformerOnSaleProducts } from './PerformerOnSaleProducts';

// Watch Later button (shared between apps)
export { default as WatchLaterButton } from './WatchLaterButton';

// StickyCta (shared between apps)
export { StickyCtaBase } from './StickyCta';
export type { StickyCtaBaseProps } from './StickyCta';

// Accessibility components
export { SkipLink } from './SkipLink';

// Virtual scroll components
// TODO: Enable after fixing build issues
// export { VirtualProductGridBase } from './VirtualProductGrid';

// Price alert and tracking components
export { default as SaleAlertButton } from './SaleAlertButton';
export { default as PriceHistoryChart } from './PriceHistoryChart';
export { default as ActressBundleCalculator } from './ActressBundleCalculator';
export { default as ForYouSales } from './ForYouSales';
export { default as SalePrediction } from './SalePrediction';
