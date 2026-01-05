// Skeleton components
export { default as ActressCardSkeleton, ActressCardSkeletonGrid } from './ActressCardSkeleton';

// Favorite and interaction components
export { default as ViewedButton } from './ViewedButton';
export { default as FavoriteButton } from './FavoriteButton';
export { default as ConnectedFavoriteButton } from './ConnectedFavoriteButton';

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
export { default as FilterPresetManager } from './FilterPresetManager';
export { default as QuickFilterRestore } from './QuickFilterRestore';

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
export { default as NotificationPreferences } from './NotificationPreferences';

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
export { default as FanzaSiteBanner } from './FanzaSiteBanner';
export { default as FanzaNewReleasesSection } from './FanzaNewReleasesSection';

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

// ProductCard utilities (themes and helpers) and base component
export {
  ProductCardBase,
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
  ProductCardBaseProps,
  ProductCardSize,
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
export { SearchBarBase, searchBarTranslations, UnifiedSearchBar, unifiedSearchTranslations } from './SearchBar';
export type { SearchBarTheme, SearchBarBaseProps, AiSearchResult, UnifiedSearchBarProps, SearchMode } from './SearchBar';

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

// UserMenu (login/avatar dropdown)
export { UserMenu } from './UserMenu';

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
export { default as ConnectedWatchLaterButton } from './ConnectedWatchLaterButton';

// StickyCta (shared between apps)
export { StickyCtaBase } from './StickyCta';
export type { StickyCtaBaseProps } from './StickyCta';

// Accessibility components
export { SkipLink } from './SkipLink';

// Virtual scroll components
// TODO: Enable after fixing build issues
// export { VirtualProductGridBase } from './VirtualProductGrid';

// Mobile UX components
export { default as SwipeableCarousel } from './SwipeableCarousel';
export { default as PullToRefresh } from './PullToRefresh';

// Price alert and tracking components
export { default as SaleAlertButton } from './SaleAlertButton';
export { default as PriceHistoryChart } from './PriceHistoryChart';
export { default as ActressBundleCalculator } from './ActressBundleCalculator';
export { default as ForYouSales } from './ForYouSales';
export { default as SalePrediction } from './SalePrediction';
export { default as PricePrediction } from './PricePrediction';

// Copy button (clipboard)
export { CopyButton } from './CopyButton';
export type { CopyButtonProps } from './CopyButton';

// Bulk selection components
export { BulkActionBar } from './BulkActionBar';
export type { BulkActionBarProps, BulkAction } from './BulkActionBar';
export { SelectableCard } from './SelectableCard';
export type { SelectableCardProps } from './SelectableCard';

// ChatBot (AI assistant)
export { ChatBot } from './ChatBot';

// Search suggestions (AI-powered)
export { SearchSuggestions } from './SearchSuggestions';

// AI-generated content components
export { AiProductDescription } from './AiProductDescription';
export { AiActressProfile } from './AiActressProfile';

// AI Search (natural language search)
export { AiSearchBar } from './AiSearchBar';

// Personalized recommendations (based on viewing history)
export { PersonalizedRecommendations } from './PersonalizedRecommendations';
export { default as RecommendationReason } from './RecommendationReason';
export { default as ConnectedForYouRecommendations } from './ConnectedForYouRecommendations';

// Also viewed (collaborative filtering)
export { AlsoViewed } from './AlsoViewed';

// User preference profile (AI-generated taste profile)
export { UserPreferenceProfile } from './UserPreferenceProfile';

// Image search (visual similarity search)
export { ImageSearch } from './ImageSearch';

// Product comparison
export { ProductCompare } from './ProductCompare';
export { default as CompareButton } from './CompareButton';
export { default as CompareFloatingBar } from './CompareFloatingBar';

// Price alert button (shared between apps)
export { default as PriceAlertButton } from './PriceAlertButton';
export { default as ConnectedPriceAlertButton } from './ConnectedPriceAlertButton';

// Purchase history importer
export { default as PurchaseHistoryImporter } from './PurchaseHistoryImporter';

// Performer relation map (costar visualization)
export { PerformerRelationMap } from './PerformerRelationMap';

// Similar performer map (similarity visualization)
export { SimilarPerformerMap } from './SimilarPerformerMap';

// Similar product map (product network visualization)
export { SimilarProductMap } from './SimilarProductMap';

// Trend analysis
export { TrendAnalysis } from './TrendAnalysis';

// Home customization
export { default as HomeSectionManager } from './HomeSectionManager';

// Section settings (全ページのセクション設定)
export { SectionSettings } from './SectionSettings';
export type { SectionSettingsProps } from './SectionSettings';

// Section visibility control (Server Component対応)
export { SectionVisibility } from './SectionVisibility';
export type { SectionVisibilityProps } from './SectionVisibility';

// Viewing habits dashboard
export { ViewingHabitsDashboard } from './ViewingHabitsDashboard';
export type { ViewingHabitsDashboardProps } from './ViewingHabitsDashboard';

// Admin components
export { default as AdminStatsContent } from './AdminStatsContent';
export type { AdminStatsContentProps } from './AdminStatsContent';

// TopPage menu components
export { LinkMenuItem, AccordionMenuItem, TopPageMenuSection } from './TopPageMenu';
export type { LinkMenuItemProps, AccordionMenuItemProps, TopPageMenuItemProps, TopPageMenuSectionProps, MenuType } from './TopPageMenu';

// Section navigation
export { SectionNav } from './SectionNav';
export type { SectionItem } from './SectionNav';
export { PageSectionNav } from './PageSectionNav';
export type { PageSectionNavConfig } from './PageSectionNav';

// User contributions (reviews, tag suggestions, performer suggestions)
export {
  UserReviewForm,
  UserReviewList,
  TagSuggestionForm,
  TagSuggestionList,
  PerformerSuggestionForm,
  PerformerSuggestionList,
  UserContributionsSection,
} from './UserContributions';
export type { UserContributionsSectionTranslations } from './UserContributions';

// Public favorite lists
export {
  PublicListCard,
  CreateListModal,
  PublicListDetail,
  AddToListButton,
} from './PublicFavoriteLists';
export type {
  PublicListCardProps,
  CreateListModalProps,
  PublicListDetailProps,
  AddToListButtonProps,
} from './PublicFavoriteLists';

// Offline indicator
export { OfflineIndicator } from './OfflineIndicator';

// Scene info (user-contributed scene markers)
export { SceneTimeline } from './SceneInfo';

// Rookie ranking (new performers)
export { RookieRanking } from './RookieRanking';

// Performer comparison
export { PerformerCompare } from './PerformerCompare';
export { default as PerformerCompareFloatingBar } from './PerformerCompareFloatingBar';
export { default as PerformerCompareButton } from './PerformerCompareButton';

// List with selection (for bulk comparison)
export { ProductListWithSelection } from './ProductListWithSelection';
export { PerformerListWithSelection } from './PerformerListWithSelection';

// User corrections (suggest edits to product/performer info)
export { CorrectionForm, type CorrectionFormProps, type CorrectionFormTranslations } from './CorrectionForm';
export { CorrectionList, type CorrectionListProps, type CorrectionListTranslations, type Correction } from './CorrectionList';
